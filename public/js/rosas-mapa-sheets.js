/**
 * Carga puntos del mapa desde CSV (Google Sheets) y dibuja Leaflet en #mapa-activaciones.
 * Requiere: Leaflet global (L), ROSAS_MAPA_CSV_URL en rosas-mapa-config.js
 */
(function () {
  "use strict";

  /**
   * Cualquier URL de la hoja (editar, export, gviz) → CSV vía Google Visualization (gviz).
   * El /export?format=csv suele devolver 307/400 en fetch desde el sitio; gviz responde 200 con CSV.
   */
  function resolveGoogleSheetCsvFetchUrl(raw) {
    var u = String(raw || "").trim().split("#")[0];
    if (!u) return "";
    var m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (!m) return u;
    var id = m[1];
    var gid = "0";
    var gidQ = u.match(/[#&?]gid=(\d+)/i);
    if (gidQ) gid = gidQ[1];
    return (
      "https://docs.google.com/spreadsheets/d/" +
      id +
      "/gviz/tq?tqx=out:csv&gid=" +
      gid
    );
  }

  function googleSheetExportFallbackUrl(raw) {
    var u = String(raw || "").trim().split("#")[0];
    var m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (!m) return "";
    var id = m[1];
    var gid = "0";
    var gidQ = u.match(/[#&?]gid=(\d+)/i);
    if (gidQ) gid = gidQ[1];
    return "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv&gid=" + gid;
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

    var fallback = googleSheetExportFallbackUrl(raw);

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
