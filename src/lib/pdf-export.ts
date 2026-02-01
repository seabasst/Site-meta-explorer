/**
 * PDF Export Utility
 *
 * Section-by-section capture with professional formatting:
 * - Cover page with brand name, key stats, generation date
 * - Each data-pdf-section captured individually (no splits)
 * - Headers and footers on every content page
 *
 * Uses dynamic imports for jspdf + html2canvas-pro (code splitting).
 */

import type { FacebookApiResult } from './facebook-api';

// A4 dimensions in points
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const HEADER_HEIGHT = 25;
const FOOTER_HEIGHT = 20;
const SECTION_GAP = 8;

// Usable content area per page
const CONTENT_TOP = MARGIN + HEADER_HEIGHT;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

/**
 * Options for PDF export customization.
 */
export interface PDFExportOptions {
  /** Progress callback fired before each section capture */
  onProgress?: (step: string, current: number, total: number) => void;
  /** Renders all tab content into the DOM; returns a cleanup function */
  showAllTabs?: () => Promise<() => void>;
}

/**
 * Format a data-pdf-section attribute value into a human-readable label.
 * e.g. "age-gender-chart" -> "Age Gender Chart"
 */
function formatSectionLabel(attr: string): string {
  return attr
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Export analysis results as a professional multi-page PDF report.
 *
 * @param result - The Facebook API result containing analysis data
 * @param elementId - The DOM element ID containing all sections
 * @param options - Optional progress callback and multi-tab support
 * @throws Error if container element not found
 */
export async function exportToPDF(
  result: FacebookApiResult,
  elementId: string,
  options?: PDFExportOptions
): Promise<void> {
  // Dynamically import jsPDF and html2canvas to avoid bundle bloat
  const jsPDF = (await import('jspdf')).default;
  const html2canvas = (await import('html2canvas-pro')).default;

  // Find the container element
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  // --- Show all tabs (multi-tab capture) ---
  let cleanupTabs: (() => void) | undefined;
  if (options?.showAllTabs) {
    cleanupTabs = await options.showAllTabs();
    // Wait for React to render all tab content and charts to animate
    await new Promise(r => setTimeout(r, 500));
  }

  try {
  // Discover all capturable sections
  const sectionElements = container.querySelectorAll<HTMLElement>('[data-pdf-section]');
  if (sectionElements.length === 0) {
    throw new Error('No sections found with [data-pdf-section] attribute');
  }

  const totalSections = sectionElements.length;
  options?.onProgress?.('Preparing document...', 0, totalSections);

  // --- Pre-capture preparation ---

  // Hide interactive-only elements
  const hiddenElements = container.querySelectorAll<HTMLElement>('[data-pdf-hide]');
  const hiddenOriginalDisplay: string[] = [];
  hiddenElements.forEach((el, i) => {
    hiddenOriginalDisplay[i] = el.style.display;
    el.style.display = 'none';
  });

  // Force all <details> elements open
  const detailsElements = container.querySelectorAll<HTMLDetailsElement>('details');
  const detailsOriginalOpen: boolean[] = [];
  detailsElements.forEach((el, i) => {
    detailsOriginalOpen[i] = el.open;
    el.open = true;
  });

  // Wait for animations to settle
  await new Promise(r => setTimeout(r, 300));

  try {
    // --- Create PDF ---
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    // --- Cover page ---
    addCoverPage(pdf, result);

    // --- Section-by-section capture ---
    let currentY = CONTENT_TOP;
    let isFirstSection = true;

    for (const [index, section] of Array.from(sectionElements).entries()) {
      // Skip sections with zero height (hidden/empty)
      if (section.offsetHeight === 0 || section.offsetWidth === 0) {
        continue;
      }

      // Report progress for this section
      const sectionAttr = section.getAttribute('data-pdf-section') || 'section';
      const sectionLabel = formatSectionLabel(sectionAttr);
      options?.onProgress?.(`Capturing ${sectionLabel}...`, index + 1, totalSections);

      // Capture section with html2canvas
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
      } as Parameters<typeof html2canvas>[1]);

      // Calculate scaled dimensions to fit page width
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scale = CONTENT_WIDTH / imgWidth;
      const scaledHeight = imgHeight * scale;

      // Check if section fits on current page
      if (!isFirstSection && currentY + scaledHeight > CONTENT_BOTTOM) {
        // Section does not fit -- start a new page
        pdf.addPage();
        currentY = CONTENT_TOP;
      }

      // If a single section is taller than one page, split it across pages
      if (scaledHeight > CONTENT_HEIGHT) {
        // Calculate how many page-chunks we need
        const chunkHeightInCanvas = CONTENT_HEIGHT / scale;
        let sourceY = 0;

        while (sourceY < imgHeight) {
          const remainingCanvas = imgHeight - sourceY;
          const thisChunkCanvas = Math.min(chunkHeightInCanvas, remainingCanvas);
          const thisChunkScaled = thisChunkCanvas * scale;

          // Create a temporary canvas for this chunk
          const chunkCanvas = document.createElement('canvas');
          chunkCanvas.width = imgWidth;
          chunkCanvas.height = Math.ceil(thisChunkCanvas);
          const ctx = chunkCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, sourceY, imgWidth, thisChunkCanvas,
              0, 0, imgWidth, thisChunkCanvas
            );
          }

          const imgData = chunkCanvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', MARGIN, currentY, CONTENT_WIDTH, thisChunkScaled);

          sourceY += thisChunkCanvas;
          if (sourceY < imgHeight) {
            pdf.addPage();
            currentY = CONTENT_TOP;
          } else {
            currentY += thisChunkScaled + SECTION_GAP;
          }
        }
      } else {
        // Section fits within a page
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', MARGIN, currentY, CONTENT_WIDTH, scaledHeight);
        currentY += scaledHeight + SECTION_GAP;
      }

      isFirstSection = false;
    }

    // Report finalizing progress
    options?.onProgress?.('Finalizing PDF...', totalSections, totalSections);

    // --- Headers and footers on all content pages ---
    const totalPages = pdf.getNumberOfPages();
    const brandName = result.pageName || 'Analysis';
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    for (let i = 2; i <= totalPages; i++) {
      pdf.setPage(i);

      // Header: brand name left, date right, thin line underneath
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(brandName, MARGIN, MARGIN + 10);
      pdf.text(dateStr, PAGE_WIDTH - MARGIN, MARGIN + 10, { align: 'right' });

      // Header line
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, MARGIN + 15, PAGE_WIDTH - MARGIN, MARGIN + 15);

      // Footer line
      const footerLineY = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT + 2;
      pdf.line(MARGIN, footerLineY, PAGE_WIDTH - MARGIN, footerLineY);

      // Footer: "Generated by BrandSpy" left, "Page X of Y" center
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by BrandSpy', MARGIN, PAGE_HEIGHT - MARGIN - 5);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - MARGIN - 5,
        { align: 'center' }
      );
    }

    // --- Save PDF ---
    const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'analysis';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${pageName}_analysis_${date}.pdf`;
    pdf.save(filename);
  } finally {
    // --- Restore DOM state ---
    hiddenElements.forEach((el, i) => {
      el.style.display = hiddenOriginalDisplay[i];
    });
    detailsElements.forEach((el, i) => {
      el.open = detailsOriginalOpen[i];
    });
  }
  } finally {
    // --- Restore tab state ---
    cleanupTabs?.();
  }
}

/**
 * Draw the cover page using jsPDF text drawing (no html2canvas).
 */
function addCoverPage(
  pdf: InstanceType<typeof import('jspdf').default>,
  result: FacebookApiResult
): void {
  const brandName = result.pageName || 'Brand Analysis';

  // Brand name -- centered, large
  pdf.setFontSize(28);
  pdf.setTextColor(51, 51, 51); // #333
  pdf.text(brandName, PAGE_WIDTH / 2, 200, { align: 'center' });

  // Subtitle
  pdf.setFontSize(14);
  pdf.setTextColor(120, 120, 120);
  pdf.text('Facebook Ad Library Analysis Report', PAGE_WIDTH / 2, 240, {
    align: 'center',
  });

  // Key stats
  pdf.setFontSize(11);
  pdf.setTextColor(100, 100, 100);

  const totalAds = result.totalAdsFound ?? result.ads.length;
  const adsWithDemographics = result.aggregatedDemographics?.adsWithDemographics ?? 0;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const stats = [
    `Total Ads: ${totalAds}`,
    `Ads with Demographics: ${adsWithDemographics}`,
    `Generated: ${generatedDate}`,
  ];

  let statsY = 300;
  for (const stat of stats) {
    pdf.text(stat, PAGE_WIDTH / 2, statsY, { align: 'center' });
    statsY += 20;
  }

  // Bottom branding
  pdf.setFontSize(9);
  pdf.setTextColor(180, 180, 180);
  pdf.text('Generated by BrandSpy', PAGE_WIDTH / 2, PAGE_HEIGHT - 60, {
    align: 'center',
  });

  // Add new page for content
  pdf.addPage();
}
