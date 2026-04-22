/**
 * Mapa de Labores planetarias — datos desde Google Sheets (CSV público)
 * -----------------------------------------------------------------------
 * Hoja: Nombre, Latitud, Longitud, Tipo (próximo/realizado), Descripción (opcional)
 * Opcional: Mostrar (sí/no) para ocultar filas sin borrarlas.
 *
 * Compartir: "Cualquiera con el enlace" → Lector.
 * Podés pegar el enlace de edición; el script usa el endpoint gviz (más fiable que /export en el navegador).
 * Lat/Long: idealmente columna “Número” o “Texto plano” con decimales (-34.42, -64.18). Evitá formato #,##0 sin decimales.
 * El script corrige escalados típicos (p. ej. 511 → 51.1) y algunos errores de longitud en la península ibérica; igual conviene revisar la hoja.
 */
window.ROSAS_MAPA_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1XzpYpqRkXpFqcofgotGgtTL24w6GjWLM82wDUQPVZbI/edit?usp=sharing";
