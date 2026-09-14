import jsPDF from 'jspdf';

/**
 * Génère un vrai PDF A4 à partir d'une liste d'images (data URLs JPEG),
 * une page par image, orientation automatique selon le ratio de l'image.
 * Traitement 100% local dans le navigateur (jsPDF) — aucune image n'est
 * envoyée à un serveur pour la génération du PDF.
 */
export async function generatePdfFromPages(pages: string[]): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (let i = 0; i < pages.length; i++) {
    const dataUrl = pages[i];
    const dims = await getImageDimensions(dataUrl);
    const isLandscape = dims.width > dims.height;

    if (i > 0) {
      doc.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    } else if (isLandscape) {
      doc.deletePage(1);
      doc.addPage('a4', 'landscape');
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Ajuste l'image dans la page en conservant le ratio, avec une petite marge.
    const margin = 5;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const ratio = Math.min(maxW / dims.width, maxH / dims.height);
    const w = dims.width * ratio;
    const h = dims.height * ratio;
    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;

    doc.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'MEDIUM');
  }

  return doc.output('blob');
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
