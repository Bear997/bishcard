/**
 * pdfExtractor.js — PDF text extraction via PDF.js
 */

const PdfExtractor = (() => {
  const MAX_CHARS = 12000;

  // Initialize PDF.js worker
  function init() {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js non è disponibile. Controlla la connessione internet.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /**
   * Extracts text from a PDF File object.
   * @param {File} file - The PDF file
   * @param {Function} onProgress - Called with (current, total, text_so_far)
   * @returns {Promise<{ text: string, truncated: boolean, pageCount: number }>}
   */
  async function extractText(file, onProgress) {
    init();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    let fullText = '';
    let truncated = false;

    for (let i = 1; i <= pageCount; i++) {
      if (onProgress) onProgress(i, pageCount);

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Join items, preserving rough paragraph structure
      const pageText = content.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (pageText) fullText += pageText + '\n\n';

      if (fullText.length >= MAX_CHARS) {
        fullText = fullText.slice(0, MAX_CHARS);
        truncated = true;
        break;
      }
    }

    const text = fullText.trim();
    if (!text) {
      throw new Error(
        'Nessun testo estraibile da questo PDF. ' +
        'Il file potrebbe essere una scansione di immagini senza OCR.'
      );
    }

    return { text, truncated, pageCount };
  }

  return { extractText, MAX_CHARS };
})();

window.PdfExtractor = PdfExtractor;
