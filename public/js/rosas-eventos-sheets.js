(function () {
  "use strict";

  function parseCSV(text) {
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
        } else if (c === ",") {
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
      if (!o.titulo && !o.fecha && !o.descripcion && !tieneImagen) continue;
      out.push(o);
    }
    return out;
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
          ? '<div class="-mx-2 md:-mx-2 mb-4 rounded-xl overflow-hidden border-2 border-fuchsia-200/60 shadow-md bg-violet-100/80 aspect-[16/10] max-h-64">' +
            '<img src="' +
            escapeHtml(imagenSrc) +
            '" alt="' +
            escapeHtml(tituloPlain) +
            '" class="w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
            "</div>"
          : "";

        const horaHtml = hora
          ? '<p class="text-sm font-semibold text-violet-700 mt-0.5 flex items-center gap-1 justify-start flex-wrap">' +
            '<span class="material-icons text-base text-fuchsia-600">schedule</span><span>' +
            hora +
            "</span></p>"
          : "";

        const categoriaHtml = categoria
          ? '<span class="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-violet-200/80 text-violet-900 border border-violet-300/60">' +
            categoria +
            "</span>"
          : "";

        const metaHtml =
          modalidad || precio
            ? '<div class="flex flex-wrap gap-2 mt-2 text-xs md:text-sm">' +
              (modalidad
                ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200/80 font-medium"><span class="material-icons text-sm">podcasts</span>' +
                  modalidad +
                  "</span>"
                : "") +
              (precio
                ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-200/80 font-semibold"><span class="material-icons text-sm">payments</span>' +
                  precio +
                  "</span>"
                : "") +
              "</div>"
            : "";

        const descHtml = desc
          ? '<p class="text-violet-950/90 text-sm md:text-base leading-relaxed mt-3 whitespace-pre-line">' +
            desc +
            "</p>"
          : "";
        const lugarHtml = lugar
          ? '<p class="flex items-start gap-2 text-fuchsia-800 text-sm mt-2 font-medium"><span class="material-icons text-base text-fuchsia-600 shrink-0">place</span><span>' +
            lugar +
            "</span></p>"
          : "";
        const btnHtml = enlaceSafe
          ? '<a href="' +
            escapeHtml(enlaceSafe) +
            '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-4 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold shadow-md shadow-fuchsia-500/25 hover:from-violet-700 hover:to-fuchsia-700 transition-all">' +
            '<span class="material-icons text-lg">open_in_new</span>Más información</a>'
          : "";
        return (
          '<article class="rounded-2xl border-2 border-fuchsia-200/70 bg-gradient-to-br from-white via-fuchsia-50/50 to-violet-50/60 shadow-lg shadow-purple-500/5 p-6 md:p-8 transition-all hover:shadow-xl hover:border-fuchsia-300/80 hover:shadow-fuchsia-500/10">' +
          imagenHtml +
          (fecha
            ? '<p class="text-sm font-bold uppercase tracking-wider text-transparent bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text font-display" style="-webkit-background-clip:text;background-clip:text">' +
              fecha +
              "</p>"
            : "") +
          horaHtml +
          categoriaHtml +
          '<h3 class="font-title text-xl md:text-2xl bg-gradient-to-r from-fuchsia-800 to-violet-800 bg-clip-text text-transparent mt-2">' +
          titulo +
          "</h3>" +
          metaHtml +
          lugarHtml +
          descHtml +
          btnHtml +
          "</article>"
        );
      })
      .join("");
    container.innerHTML =
      '<div class="grid grid-cols-1 gap-6 md:gap-8 max-w-3xl mx-auto">' + cards + "</div>";
  }

  function run() {
    const container = document.getElementById("eventos-desde-sheets");
    const status = document.getElementById("eventos-estado");
    if (!container) return;

    const url =
      typeof window.ROSAS_EVENTOS_CSV_URL === "string" ? window.ROSAS_EVENTOS_CSV_URL.trim() : "";

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
        const rows = parseCSV(text.replace(/^\uFEFF/, ""));
        const eventos = rowsToObjects(rows);
        if (status) status.classList.add("hidden");
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
