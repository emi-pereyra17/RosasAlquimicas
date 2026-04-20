/**
 * Mapa de Labores planetarias — datos desde Google Sheets (CSV público)
 * -----------------------------------------------------------------------
 * Hoja: Nombre, Latitud, Longitud, Tipo (próximo/realizado), Descripción (opcional)
 * Opcional: Mostrar (sí/no) para ocultar filas sin borrarlas.
 *
 * Compartir: "Cualquiera con el enlace" → Lector.
 * Podés pegar el enlace de edición; el script usa el endpoint gviz (más fiable que /export en el navegador).
 * Lat/Long: idealmente columna con formato “Texto plano” y valores como -34.42 (punto decimal).
 * Si ves puntos mal ubicados, suele ser formato de número regional en la hoja; el sitio lee el JSON de Google priorizando el texto mostrado en celda.
 */
window.ROSAS_MAPA_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1cIo1xHo6Dbev7dumLpqekLclKqhUggaW6UHWuRJ5z5o/edit?usp=sharing";
