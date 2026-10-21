// Plain helpers, safe on server and client (ui.tsx is a client module).

export const brandHref = (pageId: string) => `/dashboard/v3/brand/${pageId}`;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string) => {
  try { return regionNames.of(code) ?? code; } catch { return code; }
};

// Dates arrive as 'YYYY-MM-DD' strings from SQL; render them without a TZ shift.
export const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
