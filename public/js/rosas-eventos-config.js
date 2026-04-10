/**
 * Eventos desde Google Sheets (CSV público)
 * -----------------------------------------
 * 1. Primera fila: Fecha, Titulo, Lugar, Descripcion, Enlace, Imagen, Hora, Modalidad (+ opcionales: Categoría, Precio, Mostrar, Destacado = sí/1 para barra violeta).
 * 2. Comparte: "Cualquier persona con el enlace" → Lector.
 * 3. URL: debe ser de exportación CSV (o pegá el enlace de “editar”; el script lo corrige solo):
 *    https://docs.google.com/spreadsheets/d/TU_ID/export?format=csv&gid=0
 *    NO uses solo la vista /edit sin export: no devuelve CSV.
 *
 * En la página, cada fila es clicable: abre un modal con la descripción completa y el botón al enlace.
 *
 * La dueña del sitio solo edita la hoja después de esto.
 */
window.ROSAS_EVENTOS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1R5YwFFbqbz4r1dM-hHJUvyf1GoVgNMaN7qemv76kpVA/export?format=csv&gid=0";
