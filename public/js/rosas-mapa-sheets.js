/**
 * Carga puntos del mapa desde Google Sheets y dibuja Leaflet en #mapa-activaciones.
 * Requiere: Leaflet global (L), ROSAS_MAPA_CSV_URL en rosas-mapa-config.js
 *
 * Importante: el CSV de gviz puede corromper decimales (p. ej. 51.1449 → 511.449).
 * Por eso usamos la respuesta JSON de gviz y leemos el texto formateado (f) de cada celda numérica.
 */
(function () {
  "use strict";

  function sheetIdAndGid(raw) {
    var u = String(raw || "").trim().split("#")[0];
    if (!u) return null;
    var m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (!m) return null;
    var gid = "0";
    var gidQ = u.match(/[#&?]gid=(\d+)/i);
    if (gidQ) gid = gidQ[1];
    return { id: m[1], gid: gid };
  }

  /**
   * JSON gviz (recomendado): números correctos vía campo "f" (formateado).
   */
  function resolveGoogleSheetJsonFetchUrl(raw) {
    var sg = sheetIdAndGid(raw);
    if (!sg) return "";
    return (
      "https://docs.google.com/spreadsheets/d/" +
      sg.id +
      "/gviz/tq?tqx=out:json&gid=" +
      sg.gid +
      "&tq=" +
      encodeURIComponent("select *")
    );
  }

  /**
   * CSV gviz (respaldo).
   */
  function resolveGoogleSheetCsvFetchUrl(raw) {
    var sg = sheetIdAndGid(raw);
    if (!sg) return String(raw || "").trim().split("#")[0];
    return (
      "https://docs.google.com/spreadsheets/d/" +
      sg.id +
      "/gviz/tq?tqx=out:csv&gid=" +
      sg.gid
    );
  }

  function googleSheetExportFallbackUrl(raw) {
    var sg = sheetIdAndGid(raw);
    if (!sg) return "";
    return "https://docs.google.com/spreadsheets/d/" + sg.id + "/export?format=csv&gid=" + sg.gid;
  }

  function extractGvizJsonObject(text) {
    var needle = "google.visualization.Query.setResponse(";
    var start = text.indexOf(needle);
    if (start === -1) return null;
    start += needle.length;
    if (text[start] !== "{") return null;
    var depth = 0;
    var i = start;
    for (; i < text.length; i++) {
      var c = text[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.substring(start, i + 1));
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  }

  /**
   * Extrae filas tipo CSV desde la respuesta JSON de gviz.
   * Para celdas number, prioriza "f" (texto formateado) sobre "v" (valor interno a menudo mal escalado).
   */
  function gvizJsonToDataRows(text) {
    var parsed = extractGvizJsonObject(text);
    if (!parsed || parsed.status !== "ok" || !parsed.table || !parsed.table.cols) return null;
    var cols = parsed.table.cols;
    var headers = cols.map(function (c) {
      return (c && c.label) || "";
    });
    var rows = [headers];
    var tableRows = parsed.table.rows || [];
    for (var r = 0; r < tableRows.length; r++) {
      var tr = tableRows[r];
      var cells = (tr && tr.c) || [];
      var out = [];
      for (var i = 0; i < cols.length; i++) {
        var col = cols[i];
        var cell = cells[i];
        out.push(gvizCellToString(col, cell));
      }
      rows.push(out);
    }
    return rows;
  }

  function gvizCellToString(col, cell) {
    if (!cell) return "";
    if (col && col.type === "number") {
      if (cell.f != null && String(cell.f).trim() !== "") return String(cell.f).trim();
    }
    if (cell.v === null || cell.v === undefined) {
      if (cell.f != null && cell.f !== undefined) return String(cell.f).trim();
      return "";
    }
    if (typeof cell.v === "number" || typeof cell.v === "boolean") return String(cell.v);
    return String(cell.v != null ? cell.v : "").trim();
  }

  function parseCSV(text, delim) {
    var D = delim === ";" ? ";" : ",";
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === D) {
          row.push(cell.trim());
          cell = "";
        } else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(cell.trim());
          cell = "";
          if (row.some(function (x) { return x !== ""; })) rows.push(row);
          row = [];
        } else {
          cell += c;
        }
      }
    }
    row.push(cell.trim());
    if (row.some(function (x) { return x !== ""; })) rows.push(row);
    return rows;
  }

  function normHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function mapHeaderToKey(h) {
    var n = normHeader(h);
    if (n === "nombre" || n.indexOf("nombre") === 0) return "nombre";
    if (n === "latitud" || n.indexOf("latitud") === 0) return "latitud";
    if (n === "longitud" || n.indexOf("longitud") === 0) return "longitud";
    if (n.indexOf("tipo") === 0) return "tipo";
    if (n.indexOf("descripcion") === 0 || n.indexOf("descripción") === 0) return "descripcion";
    if (n === "mostrar" || n === "visible" || n === "activo") return "mostrar";
    return null;
  }

  function parseCoord(val) {
    if (val == null || val === "") return NaN;
    var t = String(val).trim().replace(/\s/g, "");
    if (/,/.test(t) && !/\./.test(t)) t = t.replace(",", ".");
    else if (/,/.test(t) && /\./.test(t)) {
      var lastComma = t.lastIndexOf(",");
      var lastDot = t.lastIndexOf(".");
      if (lastComma > lastDot) t = t.replace(/\./g, "").replace(",", ".");
      else t = t.replace(/,/g, "");
    }
    var x = parseFloat(t);
    return isNaN(x) ? NaN : x;
  }

  function rowVisible(mostrarVal) {
    if (mostrarVal == null || mostrarVal === "") return true;
    var v = String(mostrarVal).trim().toLowerCase();
    if (v === "no" || v === "0" || v === "false" || v === "oculto") return false;
    return true;
  }

  function parseTipoCell(raw) {
    var t = normHeader(String(raw || ""));
    if (t.indexOf("proxim") !== -1) return "proximo";
    return "realizado";
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowsToPoints(rows) {
    if (!rows.length) return { proximos: [], realizados: [] };
    var headers = rows[0];
    var keys = [];
    for (var h = 0; h < headers.length; h++) {
      keys[h] = mapHeaderToKey(headers[h]);
    }
    var proximos = [];
    var realizados = [];
    for (var r = 1; r < rows.length; r++) {
      var cells = rows[r];
      var obj = {};
      for (var c = 0; c < keys.length; c++) {
        if (keys[c]) obj[keys[c]] = cells[c] != null ? cells[c] : "";
      }
      if (!rowVisible(obj.mostrar)) continue;
      var nombre = String(obj.nombre || "").trim();
      var lat = parseCoord(obj.latitud);
      var lng = parseCoord(obj.longitud);
      if (nombre === "" && isNaN(lat) && isNaN(lng)) continue;
      if (isNaN(lat) || isNaN(lng)) continue;
      var desc = String(obj.descripcion || "").trim();
      var tipo = parseTipoCell(obj.tipo);
      var item = { nombre: nombre || "Lugar", coords: [lat, lng], desc: desc };
      if (tipo === "proximo") proximos.push(item);
      else realizados.push(item);
    }
    return { proximos: proximos, realizados: realizados };
  }

  function popupHtml(nombre, desc, tipo) {
    var badge =
      tipo === "proximo"
        ? '<span class="popup-badge badge-proximo">Próximo 2026</span>'
        : '<span class="popup-badge badge-realizado">Realizado</span>';
    return (
      '<div style="min-width:160px;padding:2px 0">' +
      badge +
      "<br>" +
      '<strong style="font-size:0.95rem;color:#2e1065">' +
      escapeHtml(nombre) +
      "</strong>" +
      (desc
        ? '<br><span style="font-size:0.8rem;color:#5b21b6">' + escapeHtml(desc) + "</span>"
        : "") +
      "</div>"
    );
  }

  function buildLeafletMap(mapaEl, proximos, realizados) {
    var mapa = L.map(mapaEl, {
      scrollWheelZoom: false,
      attributionControl: false,
    }).setView([20, 0], 2);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        keepBuffer: 4,
        updateWhenIdle: true,
        updateWhenZooming: false,
      }
    ).addTo(mapa);

    var estiloProximo = {
      radius: 11,
      fillColor: "#fbbf24",
      color: "#92400e",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.92,
    };

    var estiloRealizado = {
      radius: 9,
      fillColor: "#d946ef",
      color: "#5b21b6",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    };

    var bounds = [];

    proximos.forEach(function (l) {
      L.circleMarker(l.coords, estiloProximo)
        .addTo(mapa)
        .bindPopup(popupHtml(l.nombre, l.desc, "proximo"));
      bounds.push(l.coords);
    });

    realizados.forEach(function (l) {
      L.circleMarker(l.coords, estiloRealizado)
        .addTo(mapa)
        .bindPopup(popupHtml(l.nombre, l.desc, "realizado"));
      bounds.push(l.coords);
    });

    if (bounds.length > 0) {
      mapa.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 });
    }
  }

  function showMapMessage(mapaEl, message) {
    mapaEl.innerHTML =
      '<div class="flex items-center justify-center h-full min-h-[200px] px-6 text-center text-violet-900 text-sm leading-relaxed">' +
      escapeHtml(message) +
      "</div>";
  }

  /**
   * @param {HTMLElement} mapaEl - contenedor #mapa-activaciones
   * @param {string} [csvUrl] - opcional; por defecto window.ROSAS_MAPA_CSV_URL
   */
  function fetchCsvOk(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }

  function buildFromSheets(mapaEl, csvUrl) {
    var raw = csvUrl || (typeof window !== "undefined" && window.ROSAS_MAPA_CSV_URL) || "";
    var primary = resolveGoogleSheetCsvFetchUrl(raw);
    if (!primary) {
      showMapMessage(mapaEl, "Falta configurar ROSAS_MAPA_CSV_URL.");
      return;
    }
    if (typeof L === "undefined") {
      showMapMessage(mapaEl, "No se cargó el mapa (Leaflet).");
      return;
    }

    var jsonUrl = resolveGoogleSheetJsonFetchUrl(raw);
    var fallback = googleSheetExportFallbackUrl(raw);

    function processRows(rows) {
      if (!rows || !rows.length) {
        showMapMessage(mapaEl, "La hoja no tiene datos aún.");
        return;
      }
      var data = rowsToPoints(rows);
      if (data.proximos.length === 0 && data.realizados.length === 0) {
        showMapMessage(
          mapaEl,
          "No hay puntos válidos. Revisá Nombre, Latitud y Longitud en la hoja."
        );
        return;
      }
      mapaEl.innerHTML = "";
      buildLeafletMap(mapaEl, data.proximos, data.realizados);
    }

    function tryCsv(text) {
      var rows = parseCSV(text, ",");
      if (rows.length && rows[0].length < 2 && text.indexOf(";") !== -1) {
        rows = parseCSV(text, ";");
      }
      processRows(rows);
    }

    if (jsonUrl) {
      fetchCsvOk(jsonUrl)
        .then(function (text) {
          var rows = gvizJsonToDataRows(text);
          if (rows && rows.length > 1) {
            processRows(rows);
            return;
          }
          return fetchCsvOk(primary).then(tryCsv);
        })
        .catch(function () {
          return fetchCsvOk(primary)
            .catch(function () {
              if (fallback && fallback !== primary) return fetchCsvOk(fallback);
              throw new Error("fetch falló");
            })
            .then(tryCsv);
        })
        .catch(function () {
          showMapMessage(
            mapaEl,
            "No se pudieron cargar los lugares. Comprobá que la hoja sea pública (Cualquier persona con el enlace → Lector) y que Latitud/Longitud sean números válidos."
          );
        });
      return;
    }

    fetchCsvOk(primary)
      .catch(function () {
        if (fallback && fallback !== primary) return fetchCsvOk(fallback);
        throw new Error("fetch falló");
      })
      .then(function (text) {
        var rows = parseCSV(text, ",");
        if (rows.length && rows[0].length < 2 && text.indexOf(";") !== -1) {
          rows = parseCSV(text, ";");
        }
        if (!rows.length) {
          showMapMessage(mapaEl, "La hoja no tiene datos aún.");
          return;
        }
        var data = rowsToPoints(rows);
        if (data.proximos.length === 0 && data.realizados.length === 0) {
          showMapMessage(
            mapaEl,
            "No hay puntos válidos. Revisá Nombre, Latitud y Longitud en la hoja."
          );
          return;
        }
        mapaEl.innerHTML = "";
        buildLeafletMap(mapaEl, data.proximos, data.realizados);
      })
      .catch(function () {
        showMapMessage(
          mapaEl,
          "No se pudieron cargar los lugares. Comprobá que la hoja sea pública (Cualquier persona con el enlace → Lector) y que Latitud/Longitud sean números válidos."
        );
      });
  }

  window.RosasMapaSheets = { buildFromSheets: buildFromSheets };
})();
