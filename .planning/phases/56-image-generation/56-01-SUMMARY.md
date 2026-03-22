---
phase: 56-image-generation
plan: 01
status: complete
started: 2026-03-22
completed: 2026-03-22
---

# Summary: Format selector, multi-format generation, blob download

## What Was Built

Two new components (FormatSelector, GenerationResults) wired into the Creative Lab page, replacing the single-image generation flow with a multi-format workflow.

### Deliverables

1. **FormatSelector component** (`format-selector.tsx`)
   - 6 ad formats: Square, Story/Reel, Landscape, Portrait, Wide Banner, Pinterest
   - Multi-select with Select All/Deselect All toggle
   - Editable prompt textarea pre-filled from recommendation.imagePrompt
   - "Generate N Images" button with disabled state

2. **GenerationResults component** (`generation-results.tsx`)
   - Responsive grid with loading/success/error states per format
   - Format label badge on each image
   - Per-image blob-based download (JPG)
   - Download All button for 2+ successful images
   - Per-image Retry button

3. **Page integration** (`page.tsx`)
   - New steps: `format-select` and `image-result` in step machine
   - Single image generation → canvas crop to each selected format
   - Same creative content across all format variants
   - Regenerate single format fires new base image + crop

### Key Decisions

- **Single generation + canvas crop** instead of multiple API calls per format. User feedback: "the images must be the same, just different formats." One Flux Schnell call, then client-side canvas center-crop to each aspect ratio.
- **JPG output** instead of WebP. User preference for broader compatibility.
- **Blob-based download** pattern to handle cross-origin Replicate URLs reliably.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d86c560 | Create FormatSelector and GenerationResults components |
| Task 2 | 7b2fdc0 | Wire format selection and multi-format generation into page |
| Post-checkpoint fix | c6b8569 | Single image generation with canvas crop + JPG downloads |

## Requirements Covered

- GENR-01: Generate AI images from recommendations (click Generate → format select → generate)
- GENR-02: Select target ad format/size (6 formats with aspect ratio mapping)
- GENR-03: Generate multiple format variants from single prompt (single generation + canvas crop)
- GENR-04: Download generated images (blob-based cross-origin safe JPG download)
- GENR-05: Prompts pre-filled from analysis gaps (recommendation.imagePrompt → editable textarea)

## Deviations

- **Changed from parallel API calls to single-generation-then-crop.** Original plan called for `Promise.allSettled` with multiple API calls. User feedback during checkpoint revealed all formats should show the same image content. Switched to generate one 1:1 base image, then canvas center-crop to each format's aspect ratio.
- **Changed from WebP to JPG.** User preference.

## Issues

None.
