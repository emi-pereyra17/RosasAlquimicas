(function () {
  "use strict";

  /**
   * Convierte URL de edición de Google Sheets en URL de exportación CSV.
   * Ej. .../d/ID/edit?gid=0 → .../d/ID/export?format=csv&gid=0
   */
  function normalizeGoogleSheetCsvUrl(raw) {
    const u = String(raw || "").trim();
    if (!u) return "";
    if (/docs\.google\.com\/spreadsheets\/d\//i.test(u) && /\/export\?[^#]*format=csv/i.test(u)) {
      return u.split("#")[0].trim();
    }
    const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (!m) return u;
    const id = m[1];
    let gid = "0";
    const gidQ = u.match(/[#&?]gid=(\d+)/i);
    if (gidQ) gid = gidQ[1];
    return "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv&gid=" + gid;
  }

  function parseCSV(text, delim) {
    const D = delim === ";" ? ";" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
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
          if (row.some((x) => x !== "")) rows.push(row);
          row = [];
        } else {
          cell += c;
        }
      }
    }
    row.push(cell.trim());
    if (row.some((x) => x !== "")) rows.push(row);
    return rows;
  }

  function mapHeaderToKey(h) {
    const n = String(h || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (n === "fecha") return "fecha";
    if (n === "titulo" || n === "título") return "titulo";
    if (n === "lugar") return "lugar";
    if (n === "descripcion" || n === "descripción") return "descripcion";
    if (n === "enlace" || n === "link" || n === "url") return "enlace";
    if (n === "imagen" || n === "foto" || n === "url imagen" || n === "imagen url") return "imagen";
    if (n === "hora") return "hora";
    if (n === "categoria" || n === "categoría" || n === "tipo") return "categoria";
    if (n === "precio") return "precio";
    if (n === "modalidad") return "modalidad";
    if (n === "mostrar" || n === "visible" || n === "activo") return "mostrar";
    return null;
  }

  function parseFechaSortValue(fechaStr) {
    if (!fechaStr) return 0;
    const s = String(fechaStr).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
    }
    const es = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (es) {
      return new Date(Number(es[3]), Number(es[2]) - 1, Number(es[1])).getTime();
    }
    const t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }

  function rowVisible(mostrarVal) {
    if (mostrarVal == null || mostrarVal === "") return true;
    const v = String(mostrarVal).trim().toLowerCase();
    if (v === "no" || v === "0" || v === "false" || v === "oculto") return false;
    return true;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Solo URLs http(s) para imágenes (evita javascript:, data:, etc.) */
  function safeHttpUrl(url) {
    const u = String(url || "").trim();
    if (!u || !/^https?:\/\//i.test(u)) return "";
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return u;
    } catch {
      return "";
    }
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(mapHeaderToKey);
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const o = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        if (key) o[key] = cells[c] != null ? cells[c] : "";
      }
      if (!rowVisible(o.mostrar)) continue;
      const tieneImagen = safeHttpUrl(o.imagen);
      const tieneLugar = String(o.lugar || "").trim() !== "";
      const tieneEnlace = String(o.enlace || "").trim().match(/^https?:\/\//i);
      const tieneModalidad = String(o.modalidad || "").trim() !== "";
      const tieneHora = String(o.hora || "").trim() !== "";
      if (
        !o.titulo &&
        !o.fecha &&
        !o.descripcion &&
        !tieneImagen &&
        !tieneLugar &&
        !tieneEnlace &&
        !tieneModalidad &&
        !tieneHora
      ) {
        continue;
      }
      out.push(o);
    }
    return out;
  }

  /** CSV con coma o punto y coma (Sheets según región) */
  function parseCsvAutoDelimiter(text) {
    const clean = text.replace(/^\uFEFF/, "");
    let rows = parseCSV(clean, ",");
    if (
      rows.length > 0 &&
      rows[0].length === 1 &&
      String(rows[0][0]).indexOf(";") !== -1 &&
      String(rows[0][0]).split(";").length >= 3
    ) {
      return parseCSV(clean, ";");
    }
    const firstLine = (clean.match(/^[^\r\n]*/) || [""])[0];
    const nSemi = (firstLine.match(/;/g) || []).length;
    const nComma = (firstLine.match(/,/g) || []).length;
    if (nSemi > nComma && nSemi >= 2) {
      rows = parseCSV(clean, ";");
    }
    return rows;
  }

  function renderEventos(container, eventos) {
    if (!eventos.length) {
      container.innerHTML =
        '<p class="text-center text-violet-900 font-display italic py-12 px-4 rounded-2xl bg-fuchsia-50/80 border border-fuchsia-200/60 text-lg">No hay eventos publicados por ahora. Vuelve pronto.</p>';
      return;
    }
    eventos.sort((a, b) => parseFechaSortValue(a.fecha) - parseFechaSortValue(b.fecha));
    const cards = eventos
      .map((ev) => {
        const titulo = escapeHtml(ev.titulo || "Evento");
        const tituloPlain = ev.titulo || "Evento";
        const fecha = escapeHtml(ev.fecha || "");
        const hora = escapeHtml(ev.hora || "");
        const categoria = escapeHtml(ev.categoria || "");
        const precio = escapeHtml(ev.precio || "");
        const modalidad = escapeHtml(ev.modalidad || "");
        const lugar = escapeHtml(ev.lugar || "");
        const desc = escapeHtml(ev.descripcion || "");
        const enlace = String(ev.enlace || "").trim();
        const enlaceSafe = enlace.match(/^https?:\/\//i) ? enlace : "";
        const imagenSrc = safeHttpUrl(ev.imagen);

        const imagenHtml = imagenSrc
          ? '<div class="w-full overflow-hidden bg-gradient-to-br from-violet-100 to-fuchsia-100 aspect-[16/9] max-h-72 border-b border-fuchsia-200/50">' +
            '<img src="' +
            escapeHtml(imagenSrc) +
            '" alt="' +
            escapeHtml(tituloPlain) +
            '" class="w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
            "</div>"
          : "";

        const horaHtml = hora
          ? '<p class="text-sm font-semibold text-violet-700 flex items-center justify-center gap-1.5 flex-wrap">' +
            '<span class="material-icons text-base text-fuchsia-600">schedule</span><span>' +
            hora +
            "</span></p>"
          : "";

        const categoriaHtml = categoria
          ? '<span class="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-900 border border-violet-200/70 shadow-sm">' +
            categoria +
            "</span>"
          : "";

        const metaHtml =
          modalidad || precio
            ? '<div class="flex flex-wrap gap-2 justify-center items-center text-xs md:text-sm w-full">' +
              (modalidad
                ? '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-50 text-fuchsia-900 border border-fuchsia-200/90 font-semibold shadow-sm"><span class="material-icons text-base text-fuchsia-600">podcasts</span>' +
                  modalidad +
                  "</span>"
                : "") +
              (precio
                ? '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-950 border border-amber-200/90 font-bold shadow-sm"><span class="material-icons text-base text-amber-600">payments</span>' +
                  precio +
                  "</span>"
                : "") +
              "</div>"
            : "";

        const descHtml = desc
          ? '<p class="text-violet-900/90 text-sm md:text-base leading-relaxed whitespace-pre-line max-w-lg mx-auto text-center">' +
            desc +
            "</p>"
          : "";
        const lugarHtml = lugar
          ? '<p class="flex items-center justify-center gap-2 text-fuchsia-800 text-sm font-medium text-center max-w-md mx-auto">' +
            '<span class="material-icons text-lg text-fuchsia-600 shrink-0">place</span><span class="leading-snug">' +
            lugar +
            "</span></p>"
          : "";
        const btnHtml = enlaceSafe
          ? '<div class="w-full flex justify-center pt-1">' +
            '<a href="' +
            escapeHtml(enlaceSafe) +
            '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white text-sm font-bold shadow-lg shadow-fuchsia-500/30 border border-white/20 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">' +
            '<span class="material-icons text-lg">open_in_new</span>Más información</a></div>'
          : "";
        return (
          '<article class="group rounded-3xl overflow-hidden border-2 border-fuchsia-200/80 bg-gradient-to-b from-white via-fuchsia-50/40 to-violet-50/70 shadow-xl shadow-purple-500/10 transition-all duration-300 hover:shadow-2xl hover:shadow-fuchsia-500/15 hover:border-fuchsia-300/90 hover:-translate-y-0.5 ring-1 ring-amber-200/20">' +
          imagenHtml +
          '<div class="flex flex-col items-center text-center px-6 py-8 md:px-10 md:py-9 gap-3 md:gap-4">' +
          '<div class="h-1 w-12 rounded-full bg-gradient-to-r from-fuchsia-400 via-amber-400 to-violet-500 opacity-90 mb-1" aria-hidden="true"></div>' +
          (fecha
            ? '<p class="text-sm font-bold uppercase tracking-[0.2em] text-transparent bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text font-display" style="-webkit-background-clip:text;background-clip:text">' +
              fecha +
              "</p>"
            : "") +
          horaHtml +
          categoriaHtml +
          '<h3 class="font-title text-xl md:text-2xl md:leading-snug max-w-xl mx-auto bg-gradient-to-r from-fuchsia-800 via-violet-800 to-fuchsia-800 bg-clip-text text-transparent">' +
          titulo +
          "</h3>" +
          metaHtml +
          lugarHtml +
          descHtml +
          btnHtml +
          "</div></article>"
        );
      })
      .join("");
    container.innerHTML =
      '<div class="grid grid-cols-1 gap-8 md:gap-10 max-w-xl md:max-w-2xl mx-auto">' + cards + "</div>";
  }

  function run() {
    const container = document.getElementById("eventos-desde-sheets");
    const status = document.getElementById("eventos-estado");
    if (!container) return;

    let url =
      typeof window.ROSAS_EVENTOS_CSV_URL === "string" ? window.ROSAS_EVENTOS_CSV_URL.trim() : "";
    url = normalizeGoogleSheetCsvUrl(url);

    if (!url) {
      if (status) {
        status.textContent =
          "Falta pegar la URL del CSV en public/js/rosas-eventos-config.js (solo una vez, quien mantenga el sitio).";
        status.classList.remove("hidden");
      }
      container.innerHTML =
        '<p class="text-center text-violet-900 font-display italic py-10 px-6 rounded-2xl bg-gradient-to-br from-violet-100/90 to-fuchsia-100/80 border-2 border-violet-200/70">Los eventos se mostrarán aquí cuando esté enlazada la hoja de cálculo.</p>';
      return;
    }

    if (status) {
      status.textContent = "Cargando eventos…";
      status.classList.remove("hidden");
    }

    fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((text) => {
        const rows = parseCsvAutoDelimiter(text);
        const eventos = rowsToObjects(rows);
        if (status) status.classList.add("hidden");
        if (!eventos.length && rows.length > 1) {
          console.warn(
            "[eventos] CSV recibido pero ninguna fila válida. Revisá los títulos de la fila 1 (Fecha, Titulo, Lugar…). Filas parseadas:",
            rows.length
          );
        }
        renderEventos(container, eventos);
      })
      .catch((err) => {
        console.error(err);
        if (status) {
          status.textContent =
            "No se pudieron cargar los eventos. Comprueba que la hoja esté compartida (cualquiera con el enlace puede ver) y la URL en rosas-eventos-config.js.";
          status.classList.remove("hidden");
        }
        container.innerHTML =
          '<p class="text-center text-rose-900 py-10 px-6 rounded-2xl bg-rose-50 border-2 border-rose-200 font-medium">Error al cargar eventos. Intenta más tarde.</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
