/**
 * Mapa de Labores planetarias — datos desde Google Sheets (CSV público)
 * -----------------------------------------------------------------------
 * Hoja: Nombre, Latitud, Longitud, Tipo (próximo/realizado), Descripción (opcional)
 * Opcional: Mostrar (sí/no) para ocultar filas sin borrarlas.
 *
 * Compartir: "Cualquiera con el enlace" → Lector.
 * Podés pegar el enlace de edición; el script usa el endpoint gviz (más fiable que /export en el navegador).
 * Lat/Long: idealmente columna “Número” o “Texto plano” con decimales (-34.42, -64.18). Evitá formato #,##0 sin decimales.
 *
 * Importar datos: Archivo → Importar → public/data/mapa-lugares-para-google-sheets.csv
 * Respaldo local si falla la hoja: ROSAS_MAPA_FALLBACK_CSV_URL
 */
window.ROSAS_MAPA_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1SNgnnlZEZHC27Dsnpx0GHTXsLMTwmWH4pvxOzI-BoR4/edit?usp=sharing";

window.ROSAS_MAPA_FALLBACK_CSV_URL = "public/labores-mapa-datos.csv";
