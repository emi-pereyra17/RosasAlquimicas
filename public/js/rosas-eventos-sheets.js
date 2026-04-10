(function () {
  "use strict";

  /** Orden de filas renderizadas → mismo índice que `data-evento-index` en cada artículo */
  let lastEventosFlat = [];

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
    if (n === "destacado" || n === "featured" || n === "destaque") return "destacado";
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

  /**
   * Acepta URL suelta o HTML de ImgBB/embed: extrae el primer src="https://..." de un <img>.
   */
  function extractImageUrlFromCell(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'");
    const mQuoted = s.match(/\bsrc\s*=\s*["'](https?:\/\/[^"']+)/i);
    if (mQuoted) return mQuoted[1].trim();
    const mBare = s.match(/\bsrc\s*=\s*(https?:\/\/[^\s>'"]+)/i);
    if (mBare) return mBare[1].trim();
    return s.trim();
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
      const tieneImagen = safeHttpUrl(extractImageUrlFromCell(o.imagen));
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

  const MESES_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  function parseEventDate(fechaStr) {
    if (!fechaStr) return null;
    const s = String(fechaStr).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const es = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (es) return new Date(Number(es[3]), Number(es[2]) - 1, Number(es[1]));
    const t = Date.parse(s);
    return isNaN(t) ? null : new Date(t);
  }

  function monthYearKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth()).padStart(2, "0");
  }

  function monthYearLabelEs(d) {
    return MESES_ES[d.getMonth()] + " " + d.getFullYear();
  }

  function weekdayShortEs(d) {
    const w = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(d);
    return String(w)
      .replace(/\.$/, "")
      .toUpperCase();
  }

  /** Ej.: "Domingo, 5 de abril de 2026" */
  function formatFechaLargaEs(d) {
    if (!d) return "";
    let wd = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(d);
    wd = wd.charAt(0).toUpperCase() + wd.slice(1);
    const day = d.getDate();
    const month = MESES_ES[d.getMonth()];
    return wd + ", " + day + " de " + month + " de " + d.getFullYear();
  }

  function modalDetailRow(icon, label, valueEscaped) {
    return (
      '<div class="flex gap-3 sm:gap-4 py-3.5 border-b border-fuchsia-100/90 last:border-b-0 first:pt-0">' +
      '<span class="material-icons text-fuchsia-600 text-2xl shrink-0 w-9 text-center leading-none pt-0.5">' +
      icon +
      "</span>" +
      '<div class="min-w-0 flex-1">' +
      '<p class="text-[0.65rem] font-bold uppercase tracking-wider text-violet-600">' +
      label +
      "</p>" +
      '<p class="text-gray-900 text-base sm:text-lg font-medium leading-snug">' +
      valueEscaped +
      "</p></div></div>"
    );
  }

  function isDestacado(val) {
    const v = String(val || "")
      .trim()
      .toLowerCase();
    return (
      v === "si" ||
      v === "sí" ||
      v === "yes" ||
      v === "1" ||
      v === "true" ||
      v === "destacado" ||
      v === "x"
    );
  }

  function groupEventosByMonth(eventos) {
    const sorted = eventos.slice().sort((a, b) => parseFechaSortValue(a.fecha) - parseFechaSortValue(b.fecha));
    const groups = [];
    let curKey = null;
    let curLabel = "";
    let curItems = [];

    function flush() {
      if (curItems.length) {
        groups.push({ key: curKey, label: curLabel, items: curItems });
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i];
      const d = parseEventDate(ev.fecha);
      const key = d ? monthYearKey(d) : "_nodate";
      const label = d ? monthYearLabelEs(d) : "Próximos encuentros";
      if (key !== curKey) {
        flush();
        curKey = key;
        curLabel = label;
        curItems = [];
      }
      curItems.push(ev);
    }
    flush();
    return groups;
  }

  function closeEventoModal() {
    const modal = document.getElementById("rosas-evento-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function ensureEventoModal() {
    const panelClass =
      "relative z-10 w-full max-w-5xl xl:max-w-6xl max-h-[min(94vh,940px)] overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-2xl border border-fuchsia-200/80 my-4 sm:my-6 md:my-8";
    let el = document.getElementById("rosas-evento-modal");
    if (el) {
      const p = el.querySelector("[data-modal-panel]");
      if (p) p.className = panelClass;
      return el;
    }
    el = document.createElement("div");
    el.id = "rosas-evento-modal";
    el.className =
      "fixed inset-0 z-[200] hidden flex items-start justify-center overflow-y-auto p-3 sm:p-6 md:p-8";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="absolute inset-0 bg-black/55 backdrop-blur-sm min-h-full" data-modal-backdrop></div>' +
      '<div class="' +
      panelClass +
      '" data-modal-panel>' +
      '<button type="button" class="absolute top-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-fuchsia-50 hover:border-fuchsia-200 transition-colors" data-modal-close aria-label="Cerrar">' +
      '<span class="material-icons text-2xl">close</span></button>' +
      '<div class="p-6 sm:p-8 lg:p-10 xl:p-12 pt-16 sm:pt-20" data-modal-body></div>' +
      "</div>";
    document.body.appendChild(el);
    el.querySelector("[data-modal-backdrop]").addEventListener("click", closeEventoModal);
    el.querySelector("[data-modal-close]").addEventListener("click", closeEventoModal);
    el.querySelector("[data-modal-panel]").addEventListener("click", function (e) {
      e.stopPropagation();
    });
    if (!window.__rosasEventoModalEscape) {
      window.__rosasEventoModalEscape = true;
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        const m = document.getElementById("rosas-evento-modal");
        if (m && !m.classList.contains("hidden")) closeEventoModal();
      });
    }
    return el;
  }

  function openEventoModal(idx) {
    const ev = lastEventosFlat[idx];
    if (!ev) return;
    const modal = ensureEventoModal();
    const body = modal.querySelector("[data-modal-body]");
    const tituloPlain = ev.titulo || "Evento";
    const fechaRaw = String(ev.fecha || "").trim();
    const hora = String(ev.hora || "").trim();
    const categoria = String(ev.categoria || "").trim();
    const precio = String(ev.precio || "").trim();
    const modalidad = String(ev.modalidad || "").trim();
    const lugar = String(ev.lugar || "").trim();
    const descRaw = String(ev.descripcion || "").trim();
    const enlace = String(ev.enlace || "").trim();
    const enlaceSafe = enlace.match(/^https?:\/\//i) ? enlace : "";
    const imagenSrc = safeHttpUrl(extractImageUrlFromCell(ev.imagen));
    const destacado = isDestacado(ev.destacado);
    const d = parseEventDate(fechaRaw);
    const fechaLarga = d ? formatFechaLargaEs(d) : "";

    const badgesHtml =
      (destacado
        ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-xs font-bold uppercase tracking-wide border border-violet-200"><span class="material-icons text-sm">workspace_premium</span>Destacado</span>'
        : "") +
      (categoria
        ? '<span class="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 text-fuchsia-900 px-3 py-1 text-xs font-bold uppercase tracking-wide border border-fuchsia-200">' +
          escapeHtml(categoria) +
          "</span>"
        : "");

    const badgesWrap =
      badgesHtml !== ""
        ? '<div class="flex flex-wrap items-center gap-2 mb-4">' + badgesHtml + "</div>"
        : "";

    let detailsInner = "";
    if (fechaRaw) {
      const fechaMostrar = fechaLarga || fechaRaw;
      detailsInner += modalDetailRow("event", "Fecha", escapeHtml(fechaMostrar));
    }
    if (hora) {
      detailsInner += modalDetailRow("schedule", "Horario", escapeHtml(hora));
    }
    if (lugar) {
      detailsInner += modalDetailRow("place", "Lugar", escapeHtml(lugar));
    }
    if (modalidad) {
      detailsInner += modalDetailRow("podcasts", "Modalidad", escapeHtml(modalidad));
    }
    if (precio) {
      detailsInner += modalDetailRow("payments", "Inversión / precio", escapeHtml(precio));
    }

    const detailsBlock =
      detailsInner !== ""
        ? '<div class="rounded-2xl bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/80 border border-fuchsia-100/90 px-4 sm:px-5 py-1 mt-6 shadow-sm">' +
          '<p class="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-violet-600 pt-4 pb-2 px-1">Datos del encuentro</p>' +
          detailsInner +
          "</div>"
        : "";

    const descBlock = descRaw
      ? '<section class="mt-8 lg:mt-10">' +
        '<h3 class="text-sm font-bold uppercase tracking-wider text-violet-700 mb-4 flex items-center gap-2">' +
        '<span class="material-icons text-xl text-fuchsia-600">subject</span>Descripción</h3>' +
        '<div class="text-gray-800 text-base sm:text-lg md:text-xl leading-relaxed sm:leading-8 whitespace-pre-line rounded-2xl bg-white/80 border border-fuchsia-100/80 px-5 sm:px-6 py-5 sm:py-6 shadow-inner">' +
        escapeHtml(descRaw) +
        "</div></section>"
      : '<section class="mt-8"><p class="text-gray-500 text-base italic rounded-2xl border border-dashed border-fuchsia-200 px-5 py-6 text-center">No hay descripción ampliada para este evento.</p></section>';

    const imgCol = imagenSrc
      ? '<div class="lg:sticky lg:top-6 rounded-2xl overflow-hidden border-2 border-fuchsia-200 shadow-lg bg-gradient-to-br from-gray-50 to-fuchsia-50/40 flex items-center justify-center">' +
        '<img src="' +
        escapeHtml(imagenSrc) +
        '" alt="' +
        escapeHtml(tituloPlain) +
        '" class="w-full h-auto max-h-[min(65vh,520px)] object-contain object-center" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
        "</div>"
      : '<div class="rounded-2xl border-2 border-dashed border-fuchsia-200 bg-gradient-to-br from-violet-50 via-fuchsia-50/50 to-pink-50 flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px] aspect-[4/3] max-w-full text-violet-400">' +
        '<span class="material-icons text-7xl mb-3 opacity-60">image</span>' +
        '<span class="text-sm font-semibold text-violet-600/80">Sin imagen</span></div>';

    const btnHtml = enlaceSafe
      ? '<a href="' +
        escapeHtml(enlaceSafe) +
        '" target="_blank" rel="noopener noreferrer" class="inline-flex w-full sm:w-auto min-w-[220px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-10 py-4 text-white font-bold text-base shadow-xl shadow-fuchsia-500/30 border border-white/20 hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] transition-all">' +
        '<span class="material-icons text-2xl">open_in_new</span>Abrir enlace del evento</a>'
      : '<p class="text-gray-500 text-sm max-w-md">Podés sumarte cuando haya un enlace (inscripción, Zoom, WhatsApp, etc.) en la hoja de cálculo.</p>';

    const ctaBlock =
      '<footer class="mt-10 lg:mt-12 pt-8 border-t-2 border-fuchsia-100 bg-gradient-to-r from-fuchsia-50/40 via-white to-violet-50/40 -mx-6 sm:-mx-8 lg:-mx-10 xl:-mx-12 px-6 sm:px-8 lg:px-10 xl:px-12 pb-2 rounded-b-3xl">' +
      '<p class="text-gray-700 font-display italic text-lg mb-5 text-center sm:text-left">¿Te gustaría participar o saber más?</p>' +
      '<div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 sm:gap-6">' +
      btnHtml +
      "</div></footer>";

    body.innerHTML =
      '<div class="lg:grid lg:grid-cols-12 lg:gap-10 xl:gap-12 items-start">' +
      '<div class="lg:col-span-5 mb-8 lg:mb-0">' +
      imgCol +
      "</div>" +
      '<div class="lg:col-span-7 min-w-0">' +
      badgesWrap +
      '<h2 id="rosas-evento-modal-title" class="font-title text-3xl sm:text-4xl xl:text-[2.5rem] font-bold text-gray-900 leading-[1.15] tracking-tight">' +
      escapeHtml(tituloPlain) +
      "</h2>" +
      detailsBlock +
      descBlock +
      ctaBlock +
      "</div></div>";

    const panel = modal.querySelector("[data-modal-panel]");
    if (panel) panel.scrollTop = 0;
    modal.scrollTop = 0;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const closeBtn = modal.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }

  function bindEventoListInteractions(container) {
    if (!container || container.getAttribute("data-rosas-eventos-bound") === "1") return;
    container.setAttribute("data-rosas-eventos-bound", "1");
    container.addEventListener("click", function (e) {
      const art = e.target.closest("article[data-evento-index]");
      if (!art || !container.contains(art)) return;
      const i = parseInt(art.getAttribute("data-evento-index"), 10);
      if (isNaN(i)) return;
      openEventoModal(i);
    });
    container.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const t = e.target;
      if (!t || t.tagName.toLowerCase() !== "article") return;
      if (!t.hasAttribute("data-evento-index") || !container.contains(t)) return;
      e.preventDefault();
      const i = parseInt(t.getAttribute("data-evento-index"), 10);
      if (isNaN(i)) return;
      openEventoModal(i);
    });
  }

  function renderEventos(container, eventos) {
    if (!eventos.length) {
      lastEventosFlat = [];
      container.innerHTML =
        '<p class="text-center text-violet-900 font-display italic py-12 px-4 rounded-2xl bg-fuchsia-50/80 border border-fuchsia-200/60 text-lg">No hay eventos publicados por ahora. Vuelve pronto.</p>';
      return;
    }

    const groups = groupEventosByMonth(eventos);
    lastEventosFlat = [];
    groups.forEach(function (g) {
      g.items.forEach(function (ev) {
        lastEventosFlat.push(ev);
      });
    });

    let rowIdx = 0;
    function renderRow(ev) {
      const myIdx = rowIdx++;
      const titulo = escapeHtml(ev.titulo || "Evento");
      const tituloPlain = ev.titulo || "Evento";
      const fechaRaw = String(ev.fecha || "").trim();
      const hora = String(ev.hora || "").trim();
      const categoria = String(ev.categoria || "").trim();
      const precio = String(ev.precio || "").trim();
      const modalidad = String(ev.modalidad || "").trim();
      const lugar = String(ev.lugar || "").trim();
      const desc = escapeHtml(ev.descripcion || "");
      const imagenSrc = safeHttpUrl(extractImageUrlFromCell(ev.imagen));
      const destacado = isDestacado(ev.destacado);
      const d = parseEventDate(ev.fecha);

      const diaNum = d ? String(d.getDate()) : "—";
      const diaSem = d ? weekdayShortEs(d) : "";

      const metaParts = [];
      if (fechaRaw) metaParts.push(escapeHtml(fechaRaw));
      if (hora) metaParts.push(escapeHtml(hora));
      const metaLine =
        metaParts.length > 0
          ? '<span class="text-gray-500 text-sm">' + metaParts.join(" · ") + "</span>"
          : "";

      const categoriaHtml = categoria
        ? '<span class="inline-flex items-center gap-1 text-violet-700 font-semibold text-xs uppercase tracking-wide ml-2">' +
          '<span class="material-icons text-sm opacity-80">label</span>' +
          escapeHtml(categoria) +
          "</span>"
        : "";

      const destacadoHtml = destacado
        ? '<span class="inline-flex items-center gap-1 text-violet-600 font-semibold text-xs mr-2"><span class="material-icons text-sm">workspace_premium</span>Destacado</span>'
        : "";

      const modalidadHtml = modalidad
        ? '<span class="text-gray-400 text-xs ml-2">· ' + escapeHtml(modalidad) + "</span>"
        : "";

      const lugarHtml = lugar
        ? '<p class="text-gray-600 text-sm mt-2 flex items-start gap-1.5"><span class="material-icons text-base text-fuchsia-600 shrink-0">place</span><span>' +
          escapeHtml(lugar) +
          "</span></p>"
        : "";

      const descHtml = desc
        ? '<p class="text-gray-800 text-sm md:text-base leading-relaxed mt-3 line-clamp-4 whitespace-pre-line">' +
          desc +
          "</p>"
        : "";

      const precioHtml = precio
        ? '<p class="text-gray-500 text-sm mt-3 font-medium">' + escapeHtml(precio) + "</p>"
        : "";

      const hintHtml =
        '<p class="text-violet-600/90 text-xs mt-3 font-medium flex items-center gap-1">' +
        '<span class="material-icons text-sm">touch_app</span>Clic para ver la información completa</p>';

      const thumbCol = imagenSrc
        ? '<div class="shrink-0 self-start md:self-center w-full max-w-sm sm:max-w-xs mx-auto md:mx-0 md:w-52 lg:w-60">' +
          '<div class="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">' +
          '<img src="' +
          escapeHtml(imagenSrc) +
          '" alt="' +
          escapeHtml(tituloPlain) +
          '" class="w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
          "</div></div>"
        : "";

      const barClass = destacado ? " border-l-4 border-violet-600 pl-4 -ml-1" : "";
      const ariaTit = escapeHtml(tituloPlain).replace(/"/g, "&quot;");

      return (
        '<article tabindex="0" role="button" data-evento-index="' +
        myIdx +
        '" aria-label="Ver detalles: ' +
        ariaTit +
        '" class="flex flex-col md:flex-row gap-6 md:gap-8 py-8 md:py-10 border-b border-gray-200/90 last:border-b-0 text-left rounded-xl -mx-1 px-1 cursor-pointer transition-colors hover:bg-fuchsia-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2' +
        barClass +
        '">' +
        '<div class="flex flex-col items-start md:items-center gap-1 shrink-0 md:w-20 pt-0.5">' +
        (diaSem ? '<span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">' + escapeHtml(diaSem) + "</span>" : "") +
        '<span class="text-3xl md:text-4xl font-bold text-gray-900 tabular-nums leading-none">' +
        escapeHtml(diaNum) +
        "</span>" +
        "</div>" +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex flex-wrap items-center gap-x-1 gap-y-1">' +
        destacadoHtml +
        metaLine +
        categoriaHtml +
        modalidadHtml +
        "</div>" +
        '<h3 class="font-sans text-xl md:text-2xl font-bold text-gray-900 mt-2 leading-snug">' +
        titulo +
        "</h3>" +
        lugarHtml +
        descHtml +
        precioHtml +
        hintHtml +
        "</div>" +
        thumbCol +
        "</article>"
      );
    }

    const html =
      '<div class="w-full max-w-6xl 2xl:max-w-7xl mx-auto">' +
      groups
        .map(function (g) {
          return (
            '<section class="mb-2">' +
            '<h2 class="text-xl md:text-2xl font-bold text-gray-900 capitalize tracking-tight pt-6 first:pt-0 pb-4 border-b border-gray-200">' +
            escapeHtml(g.label) +
            "</h2>" +
            '<div class="bg-white/60">' +
            g.items.map(renderRow).join("") +
            "</div></section>"
          );
        })
        .join("") +
      "</div>";

    container.innerHTML = html;
    bindEventoListInteractions(container);
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
