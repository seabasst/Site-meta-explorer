# Phase 27 Plan 01: Brand Deletion with Confirmation and Bulk Selection

**One-liner:** Confirmation dialogs on all delete actions plus bulk selection mode for competitor cards using shadcn AlertDialog

## What Was Done

### Task 1: Install AlertDialog, create DeleteBrandDialog, add bulk DELETE endpoint
- Installed shadcn AlertDialog and Button UI primitives
- Created reusable `DeleteBrandDialog` component with single and bulk modes (shows count when multiple)
- Updated competitors API DELETE handler to support both `?id=xxx` (single) and `?ids=xxx,yyy,zzz` (bulk) query params using `deleteMany`

### Task 2: Wire deletion UI into dashboard, cards, and detail page
- **Competitor card:** Remove button now opens confirmation dialog instead of directly deleting; added `selectable`, `selected`, `onSelect` props for bulk mode with checkbox overlay
- **Own brand card:** Added optional `onDelete` prop and Delete button (red text) next to Change button, with confirmation dialog
- **Dashboard page:** Added bulk selection mode with Select/Cancel toggle, Select All/Deselect All, Delete Selected (N) button with bulk confirmation dialog; wired `handleDeleteOwnBrand` and `handleBulkDelete` callbacks
- **Brand detail page:** Added Delete Brand button next to Re-analyze, with confirmation dialog and redirect to `/dashboard` on success

## Commits

| Hash | Message |
|------|---------|
| b9ce01b | feat(27-01): install AlertDialog, create DeleteBrandDialog, add bulk DELETE endpoint |
| 63fec53 | feat(27-01): wire deletion UI into dashboard, cards, and detail page |

## Key Files

### Created
- `src/components/ui/alert-dialog.tsx` - shadcn AlertDialog primitive
- `src/components/ui/button.tsx` - shadcn Button primitive (dependency)
- `src/components/dashboard/delete-brand-dialog.tsx` - Reusable confirmation dialog

### Modified
- `src/app/api/dashboard/competitors/route.ts` - Bulk DELETE support
- `src/components/dashboard/competitor-card.tsx` - Confirmation dialog + selection props
- `src/components/dashboard/own-brand-card.tsx` - Delete button + confirmation
- `src/app/dashboard/page.tsx` - Bulk selection mode + delete handlers
- `src/app/dashboard/[brandId]/page.tsx` - Delete button + confirmation + redirect

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Used shadcn AlertDialog over custom modal | Accessible, keyboard-navigable, follows established UI patterns |
| Bulk delete via comma-separated query param | Simple API, no request body needed for DELETE |
| Select mode as explicit toggle | Prevents accidental selection; clear UX state |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles with no errors
- `npm run build` passes successfully
- All deletion flows require confirmation dialog before executing
- Bulk selection mode with Select All/Deselect All working

## Duration

Start: 2026-02-02T10:47:54Z
End: 2026-02-02T10:51:30Z
Duration: ~4 minutes
