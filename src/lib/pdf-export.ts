/**
 * PDF Export Utility
 *
 * Captures analysis results as a PDF using jspdf + html2canvas.
 * Uses dynamic imports to avoid bundle bloat.
 */

import type { FacebookApiResult } from './facebook-api';

/**
 * Export analysis results as PDF
 *
 * @param result - The Facebook API result containing analysis data
 * @param elementId - The DOM element ID to capture
 * @throws Error if element not found
 */
export async function exportToPDF(
  result: FacebookApiResult,
  elementId: string
): Promise<void> {
  // Dynamically import jsPDF and html2canvas to avoid bundle bloat
  const jsPDF = (await import('jspdf')).default;
  const html2canvas = (await import('html2canvas')).default;

  // Get the element to capture
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  // Capture the element with html2canvas
  // html2canvas options for high-quality capture
  const canvas = await html2canvas(element, {
    scale: 2, // 2x for better quality
    useCORS: true,
    logging: false,
    backgroundColor: '#1c1c0d', // Match dark theme
    scrollX: 0,
    scrollY: -window.scrollY,
  } as Parameters<typeof html2canvas>[1]);

  // Get canvas dimensions
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 dimensions in points (portrait)
  const pdfWidth = 595.28;
  const pdfHeight = 841.89;

  // Calculate scaling to fit width with margins
  const margin = 20;
  const contentWidth = pdfWidth - (margin * 2);
  const scale = contentWidth / imgWidth;
  const scaledHeight = imgHeight * scale;

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Handle multi-page if content is tall
  const pageContentHeight = pdfHeight - (margin * 2);
  const totalPages = Math.ceil(scaledHeight / pageContentHeight);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    // Calculate the portion of the canvas to draw
    const sourceY = (page * pageContentHeight) / scale;
    const sourceHeight = Math.min(
      pageContentHeight / scale,
      imgHeight - sourceY
    );

    // Create a temporary canvas for this page portion
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgWidth;
    pageCanvas.height = Math.ceil(sourceHeight);
    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        0, sourceY, imgWidth, sourceHeight,
        0, 0, imgWidth, sourceHeight
      );
    }

    // Add image to PDF
    const imgData = pageCanvas.toDataURL('image/png');
    pdf.addImage(
      imgData,
      'PNG',
      margin,
      margin,
      contentWidth,
      sourceHeight * scale
    );
  }

  // Generate filename
  const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'analysis';
  const date = new Date().toISOString().split('T')[0];
  const filename = `${pageName}_analysis_${date}.pdf`;

  // Save the PDF
  pdf.save(filename);
}
