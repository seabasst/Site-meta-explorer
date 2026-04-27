// SERVER COMPONENT — Creative Lab is currently hidden from the v2 sidebar
// and the route is disabled. Anyone navigating directly to
// /dashboard/v2/creative-lab is redirected to the dashboard.
//
// The previous client implementation is preserved at `_archive-page.tsx`
// (the leading underscore + non-`page.tsx` name keeps Next from routing
// to it). Bring it back by:
//   1. Restoring `page.tsx` from `_archive-page.tsx`.
//   2. Re-adding the entry to NAV_SECTIONS in v2-shell.tsx (the "HIDDEN"
//      comment block in that file has the original line preserved).
//
// See: 2026-04-18 audit + product direction note in MEMORY.md.

import { redirect } from 'next/navigation';

export default function CreativeLabDisabled() {
  redirect('/dashboard/v2');
}
