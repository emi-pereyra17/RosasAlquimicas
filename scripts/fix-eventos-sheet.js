/**
 * Genera public/eventos-sheet-corregido.csv desde public/eventos-sheet-raw.csv
 * Ejecutar: node scripts/fix-eventos-sheet.js
 */
const fs = require("fs");
const path = require("path");

const MESES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const RETIRO_IMAGEN =
  "https://i.ibb.co/ZpXzsH8Y/Whats-App-Image-2026-07-11-at-9-16-26-AM.jpg";

function parseCSV(text, delim = ",") {
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
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function csvEscape(val) {
  const s = String(val ?? "").replace(/\r\n/g, "\n").trim();
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function extractImageUrl(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/src\s*=\s*["'](https?:\/\/i\.ibb\.co\/[^"']+)/i);
  if (m) return m[1];
  if (/^https?:\/\/i\.ibb\.co\//i.test(s)) return s;
  if (/^https?:\/\/(encrypted-tbn|.*googleusercontent)/i.test(s)) return s;
  return "";
}

function normalizeDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[1].padStart(2, "0")}/${slash[2].padStart(2, "0")}/${slash[3]}`;
  }

  const norm = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const m1 = norm.match(/(?:[a-z]+\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (m1 && MESES[m1[2]]) {
    return `${m1[1].padStart(2, "0")}/${String(MESES[m1[2]]).padStart(2, "0")}/${m1[3] || "2026"}`;
  }

  const m1b = norm.match(/(?:[a-z]+\s+)?(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (m1b && MESES[m1b[2]]) {
    return `${m1b[1].padStart(2, "0")}/${String(MESES[m1b[2]]).padStart(2, "0")}/${m1b[3] || "2026"}`;
  }

  const m2 = norm.match(/([a-z]+)\s+(\d{1,2})(?:\s+de\s+([a-z]+))?(?:\s+(\d{4}))?/);
  if (m2) {
    const monthName = MESES[m2[1]] ? m2[1] : m2[3];
    if (monthName && MESES[monthName]) {
      return `${m2[2].padStart(2, "0")}/${String(MESES[monthName]).padStart(2, "0")}/${m2[4] || "2026"}`;
    }
  }

  return s;
}

function dateSortKey(fecha) {
  const m = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : "00000000";
}

function normalizeHora(raw) {
  let h = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/argentina/gi, "Argentina")
    .replace(/Argetnina/gi, "Argentina")
    .replace(/11\.00/g, "11:00")
    .replace(/11 00/g, "11:00")
    .trim();

  h = h.replace(/\s+(Online|Presencial.*|Youtube.*|Spotif.*)$/i, "").trim();
  return h;
}

function normalizeModalidad(raw, horaRaw) {
  let m = String(raw || "").trim();
  const h = String(horaRaw || "");

  if (!m && /online|youtube|spotif/i.test(h)) m = "Online";
  if (!m && /presencial/i.test(h)) m = "Presencial";

  m = m.replace(/^on\s*line$/i, "Online");
  if (/presencial/i.test(m) && /online/i.test(m)) return "Presencial y online";
  if (/^online$/i.test(m)) return "Online";
  if (/^presencial$/i.test(m)) return "Presencial";
  if (!m) return "";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function cleanTitle(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/Pot\s*CAst/gi, "Podcast")
    .replace(/Potcast/gi, "Podcast")
    .replace(/Desmagnetizacion/gi, "Desmagnetización")
    .replace(/Ascencion/gi, "Ascensión")
    .replace(/Cuántica/gi, "Cuántica")
    .trim();
}

function cleanLugar(lugar, titulo) {
  let l = cleanTitle(lugar);
  const t = String(titulo || "").trim();
  if (!l || l === t) return "";
  if (/^online$/i.test(l) || /^on\s*line$/i.test(l)) return "Online";
  if (/^en vivo$/i.test(l)) return "En vivo";
  if (/^online grabado/i.test(l)) return "Online (grabado)";
  return l;
}

function fixRow(cells) {
  let [fecha, titulo, lugar, descripcion, enlace, imagen, hora, modalidad] = cells.map((c) =>
    String(c ?? "").trim()
  );

  if (!titulo && !fecha) return null;

  titulo = cleanTitle(titulo);
  fecha = normalizeDate(fecha);
  lugar = cleanLugar(lugar, titulo);
  const horaRaw = hora;
  hora = normalizeHora(hora);
  modalidad = normalizeModalidad(modalidad, horaRaw);

  imagen = extractImageUrl(imagen);

  if (!imagen && /^https?:\/\//i.test(enlace) && /gstatic|googleusercontent|i\.ibb/i.test(enlace)) {
    imagen = enlace;
    enlace = "";
  }

  if (/^https?:\/\/(ibb\.co\/|i\.ibb\.co)/i.test(descripcion) && !imagen) {
    imagen = extractImageUrl(descripcion) || descripcion;
    descripcion = "";
  }

  if (descripcion === lugar && descripcion.length < 80) descripcion = "";

  if (titulo.includes("Retiro Frecuencia")) {
    if (!descripcion || /^https?:\/\//.test(descripcion)) {
      descripcion =
        "Retiro presencial en Capilla del Monte (Erks). Un espacio para conectar con la frecuencia de las Marías en ascensión.";
    }
    if (!imagen || imagen.includes("ibb.co/bMm5hHB2")) imagen = RETIRO_IMAGEN;
  }

  if (titulo.includes("Cantos sagrados") && descripcion.length < 40) {
    descripcion = "Encuentro online de cantos sagrados y alabanzas en unión.";
  }

  if (titulo.includes("Danzas espiraladas") && !descripcion) {
    descripcion = "Sesión grupal online de danzas espiraladas.";
  }

  if (titulo.includes("Canto y Danza en Rezo") && !descripcion) {
    descripcion =
      "Nos reunimos para elevar canto y danza en práctica consciente, meditar unidos y experimentar la nueva forma de meditar y rezar en unidad. Actividad de la Academia y comunidad.";
  }

  if (titulo.includes("Labor planetaria") && titulo.includes("Buenos aires")) {
    lugar = lugar || "Buenos Aires, CABA";
  }

  if (titulo.includes("Labor planetaria") && titulo.includes("Capilla")) {
    lugar = lugar || "Capilla del Monte";
  }

  return [fecha, titulo, lugar, descripcion, enlace, imagen, hora, modalidad];
}

const rawPath = path.join(__dirname, "../public/eventos-sheet-raw.csv");
const outPath = path.join(__dirname, "../public/eventos-sheet-corregido.csv");

const text = fs.readFileSync(rawPath, "utf8").replace(/^\uFEFF/, "");
const rows = parseCSV(text);
const header = ["Fecha", "Título", "Lugar", "Descripción", "Enlace", "Imagen", "Hora", "Modalidad"];

const data = [];
for (let i = 1; i < rows.length; i++) {
  const row = fixRow(rows[i]);
  if (row) data.push(row);
}

data.sort((a, b) => dateSortKey(a[0]).localeCompare(dateSortKey(b[0])));

const csv = [header, ...data].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
fs.writeFileSync(outPath, csv, "utf8");
console.log("Escrito:", outPath);
console.log("Filas de eventos:", data.length);
