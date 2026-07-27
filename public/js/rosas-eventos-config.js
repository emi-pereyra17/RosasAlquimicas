/**
 * Eventos desde Google Sheets (CSV público)
 * -----------------------------------------
 * Hoja: https://docs.google.com/spreadsheets/d/1rxRU756Gnood651U2M7odpYB77fcOo8i1YsmHjleVXs/edit
 *
 * 1. Primera fila: Fecha, Titulo, Lugar, Descripcion, Enlace, Imagen, Hora, Modalidad
 *    (+ opcionales: Categoría, Precio, Mostrar, Destacado = sí/1 para barra violeta).
 * 2. Fecha recomendada: dd/mm/aaaa (ej. 14/08/2026) o aaaa-mm-dd.
 * 3. Imagen: URL directa https://… o HTML embed de ImgBB (el script extrae el src).
 *    Evitá solo ibb.co/… sin el enlace i.ibb.co/… de la imagen.
 * 4. Comparte: "Cualquier persona con el enlace" → Lector.
 * 5. En la hoja: orden cronológico (más antiguo arriba, filas nuevas abajo).
 *    El sitio invierte al mostrar: los meses más recientes quedan arriba en la web.
 *
 * Para importar una hoja corregida: Archivo → Importar → public/eventos-sheet-corregido.csv
 * (Separador: coma · Reemplazar hoja actual).
 *
 * En la página, cada fila es clicable: abre un modal con la descripción completa y el botón al enlace.
 */
window.ROSAS_EVENTOS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1rxRU756Gnood651U2M7odpYB77fcOo8i1YsmHjleVXs/export?format=csv";
