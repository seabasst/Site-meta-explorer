# Phase 57: Text Overlay Editor - Research

**Researched:** 2026-03-23
**Domain:** Client-side template rendering, canvas-based image editing, image export
**Confidence:** HIGH

## Summary

This phase adds a template-based ad creative editor where users pick a template, customize text (headline/body/CTA), swap the background image, adjust colors/fonts, and export as PNG/JPG. The key architectural decision is **how to render templates and export them as images**.

Two viable approaches exist: (1) **react-konva** (canvas-based rendering with native export) and (2) **HTML/CSS rendering + html2canvas-pro for export**. After research, **react-konva is the recommended approach** because it provides pixel-perfect export (what you see IS the canvas), built-in `toDataURL()` for PNG/JPG export at any resolution, and first-class text/image/shape primitives. The html2canvas approach (already used in the project for PDF export) has well-documented font rendering inconsistencies and cross-browser issues that would be problematic for a creative tool where pixel accuracy matters.

Templates should be defined as JSON data structures (not React components), stored as static files shipped with the app. Each template defines positioned layers (image, text, shape) with editable properties. No database storage needed for v1 -- templates are hardcoded.

**Primary recommendation:** Use react-konva (v19.x + konva) for canvas rendering with JSON-defined template structures. Export via `stage.toDataURL()` with `pixelRatio: 2` for high-resolution output.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-konva | ^19.2.3 | React bindings for Konva canvas | Official React wrapper, version-aligned with React 19, declarative canvas API |
| konva | ^9.x or ^10.x | HTML5 Canvas 2D framework | Peer dependency of react-konva, provides Stage/Layer/Text/Image/Rect primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (CSS Font Loading API) | Browser native | Dynamic font loading | Loading Google Fonts on-demand when user selects a font |
| (existing) html2canvas-pro | ^1.6.6 | Already in project | NOT used for this feature -- keep for PDF export only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-konva | HTML/CSS + html2canvas-pro | html2canvas has documented font rendering bugs, cross-browser inconsistencies; canvas approach gives pixel-perfect export |
| react-konva | Fabric.js | Fabric.js is more full-featured (free-form editing), but heavier and no official React wrapper; overkill for template-based editing |
| Static template files | Database-stored templates | DB storage adds complexity; not needed until users can save custom templates (EDIT-08, deferred to v2) |

**Installation:**
```bash
npm install react-konva konva
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/dashboard/v2/creative-lab/
  editor/
    page.tsx                    # Editor page (new route)
    template-picker.tsx         # Template browsing/selection UI
    template-canvas.tsx         # Konva Stage rendering the template
    editor-sidebar.tsx          # Text/color/font/image editing controls
    export-controls.tsx         # PNG/JPG export buttons
  templates/
    index.ts                    # Template registry (exports all templates)
    types.ts                    # TemplateDefinition TypeScript types
    square-hero.ts              # Individual template definitions
    story-product.ts
    landscape-cta.ts
    ... (more templates)
  hooks/
    use-font-loader.ts          # Dynamic Google Font loading hook
    use-template-state.ts       # Template editing state management
```

### Pattern 1: JSON Template Definition
**What:** Templates defined as typed JSON objects with layers (image, text, shape), each with position, size, style properties, and an `editable` flag.
**When to use:** All template definitions.
**Example:**
```typescript
// Source: Custom design based on Konva primitives
interface TemplateLayer {
  id: string;
  type: 'image' | 'text' | 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;  // 'bold', 'italic', 'bold italic'
  fill?: string;
  align?: 'left' | 'center' | 'right';
  role?: 'headline' | 'body' | 'cta';  // Semantic role for editing
  // Image-specific
  src?: string;         // Default/placeholder image URL
  editable?: boolean;   // Can user swap this image?
  // Shape-specific
  cornerRadius?: number;
  opacity?: number;
  // Color customization
  colorRole?: 'primary' | 'secondary' | 'accent' | 'background';
}

interface TemplateDefinition {
  id: string;
  name: string;
  category: string;     // e.g. 'product', 'promo', 'announcement'
  thumbnail: string;    // Preview image path
  width: number;        // Canvas width in px
  height: number;       // Canvas height in px
  format: string;       // Maps to AdFormat id ('square', 'story', etc.)
  layers: TemplateLayer[];
  defaults: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}
```

### Pattern 2: Konva Stage Rendering from Template State
**What:** A React component that takes template state and renders it as a Konva Stage with layers.
**When to use:** The main editor canvas.
**Example:**
```typescript
// Source: Konva docs + react-konva patterns
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';

function TemplateCanvas({ template, edits, stageRef }: Props) {
  return (
    <Stage
      ref={stageRef}
      width={template.width}
      height={template.height}
    >
      <Layer>
        {template.layers.map((layer) => {
          const merged = applyEdits(layer, edits);
          switch (layer.type) {
            case 'rect':
              return <Rect key={layer.id} {...merged} />;
            case 'text':
              return <Text key={layer.id} {...merged} />;
            case 'image':
              return <KonvaImage key={layer.id} image={merged.imageObj} {...merged} />;
          }
        })}
      </Layer>
    </Stage>
  );
}
```

### Pattern 3: Export via toDataURL
**What:** Use Konva's native canvas export with pixelRatio for high-res output.
**When to use:** PNG/JPG export.
**Example:**
```typescript
// Source: https://konvajs.org/docs/react/Canvas_Export.html
const handleExport = (format: 'png' | 'jpeg') => {
  const stage = stageRef.current;
  const uri = stage.toDataURL({
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    quality: format === 'jpeg' ? 0.92 : undefined,
    pixelRatio: 2,  // 2x resolution for crisp output
  });
  // Trigger download
  const link = document.createElement('a');
  link.download = `creative.${format}`;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

### Pattern 4: Dynamic Font Loading Hook
**What:** Load Google Fonts on-demand using CSS Font Loading API, then trigger canvas re-render.
**When to use:** When user picks a custom font from the font selector.
**Example:**
```typescript
// Source: https://konvajs.org/docs/sandbox/Custom_Font.html + MDN FontFace API
function useFontLoader() {
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  const loadFont = useCallback(async (fontFamily: string) => {
    if (loadedFonts.has(fontFamily)) return;

    // Inject Google Fonts stylesheet
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Wait for font to be ready
    await document.fonts.load(`16px "${fontFamily}"`);
    setLoadedFonts(prev => new Set(prev).add(fontFamily));
  }, [loadedFonts]);

  return { loadFont, loadedFonts };
}
```

### Anti-Patterns to Avoid
- **Free-form canvas editing:** This is explicitly out of scope. No drag-and-drop, no element repositioning. Users only edit text content, swap images, and change colors/fonts within fixed template layouts.
- **Server-side rendering/export:** All rendering and export happens client-side via Konva canvas. No server-side image processing needed.
- **Storing template state in database:** For v1, templates are static files. User edits are ephemeral (lost on page leave). Saving is deferred (EDIT-08).
- **Using html2canvas-pro for export:** It is already in the project for PDF export but should NOT be used here due to font rendering issues. Konva's native `toDataURL()` is superior for this use case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas rendering | Custom Canvas 2D API code | react-konva | Declarative React bindings, handles hit detection, layering, transforms |
| Image export | html2canvas screenshot of DOM | Konva `stage.toDataURL()` | Pixel-perfect, no DOM-to-canvas conversion bugs |
| Font loading | Manual font injection + polling | CSS Font Loading API (`document.fonts.load()`) | Browser-native, Promise-based, well-supported |
| Image loading for canvas | Manual Image() construction | Konva `useImage` hook from `react-konva-utils` or manual with `use-image` | Handles async loading, provides loading state |
| Color picker | Custom color input | Native `<input type="color">` + preset swatches | Good enough for v1, minimal code |

**Key insight:** Konva provides ALL the primitives needed (Text, Image, Rect, Group, Stage export). The custom code is only in defining templates and wiring up the editing UI -- not in the rendering/export pipeline.

## Common Pitfalls

### Pitfall 1: Font Not Rendering on Canvas
**What goes wrong:** Text appears in default font because custom Google Font hasn't loaded yet when canvas renders.
**Why it happens:** Canvas does NOT auto-update when fonts load (unlike DOM elements). Font loading is async.
**How to avoid:** Always use `document.fonts.load()` and await it before setting `fontFamily` on Konva.Text. Trigger canvas layer re-draw after font loads.
**Warning signs:** Text appears in serif/sans-serif default on first render, then corrects after interaction.

### Pitfall 2: Cross-Origin Image Loading Fails Export
**What goes wrong:** `stage.toDataURL()` throws "tainted canvas" error when images from external URLs are used.
**Why it happens:** Canvas security policy prevents export when cross-origin images are drawn without CORS headers.
**How to avoid:** For user-uploaded images, use blob URLs or data URLs. For generated images from R2, ensure CORS headers are set (R2 public URL should already have this). For template placeholder images, bundle them as local assets.
**Warning signs:** Export works in dev but fails with external image URLs.

### Pitfall 3: Canvas Scaling on Retina Displays
**What goes wrong:** Canvas appears blurry on high-DPI screens, or exported image is wrong resolution.
**Why it happens:** Konva handles devicePixelRatio automatically for display, but export needs explicit `pixelRatio` setting.
**How to avoid:** For display, let Konva handle it. For export, explicitly set `pixelRatio: 2` (or match `window.devicePixelRatio`).
**Warning signs:** Exported images look lower quality than the preview.

### Pitfall 4: Konva.Image Requires HTMLImageElement
**What goes wrong:** Passing a URL string to Konva `<Image>` component does nothing.
**Why it happens:** Konva.Image expects a loaded `HTMLImageElement`, not a URL string.
**How to avoid:** Use the `use-image` hook or manually create and load an `Image()` object. Handle loading state.
**Warning signs:** Image layer is blank despite correct URL.

### Pitfall 5: Large Canvas Memory Issues on Mobile
**What goes wrong:** Editor crashes or becomes unresponsive on mobile devices with large canvases.
**Why it happens:** 1080x1920 canvas at pixelRatio 2 = 2160x3840 pixel buffer = ~33MB of GPU memory.
**How to avoid:** Display canvas at scaled-down size (CSS transform or smaller stage + pixelRatio only on export). Keep working canvas at 1x, only use 2x for final export.
**Warning signs:** Mobile Safari crashes, Android Chrome shows black canvas.

## Code Examples

### Loading an Image for Konva
```typescript
// Source: react-konva patterns
import { Image as KonvaImage } from 'react-konva';

function useLoadImage(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  useEffect(() => {
    if (!src) { setImage(null); setStatus('idle'); return; }
    setStatus('loading');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';  // Required for export
    img.onload = () => { setImage(img); setStatus('loaded'); };
    img.onerror = () => setStatus('error');
    img.src = src;
  }, [src]);

  return { image, status };
}
```

### Applying Brand Guidelines Colors to Template
```typescript
// Merge user's brand colors into template defaults
function applyBrandColors(
  template: TemplateDefinition,
  brandColors: { primary?: string; secondary?: string; accent?: string }
): TemplateDefinition {
  const colorMap: Record<string, string> = {
    primary: brandColors.primary || template.defaults.primaryColor,
    secondary: brandColors.secondary || template.defaults.secondaryColor,
    accent: brandColors.accent || template.defaults.accentColor,
  };

  return {
    ...template,
    layers: template.layers.map(layer => ({
      ...layer,
      fill: layer.colorRole ? colorMap[layer.colorRole] : layer.fill,
    })),
  };
}
```

### Template Editing State Hook
```typescript
// Manages all user edits as a flat map of layer overrides
type EditMap = Record<string, Partial<TemplateLayer>>;

function useTemplateState(template: TemplateDefinition) {
  const [edits, setEdits] = useState<EditMap>({});

  const updateLayer = (layerId: string, changes: Partial<TemplateLayer>) => {
    setEdits(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], ...changes },
    }));
  };

  const resetAll = () => setEdits({});

  // Merge template defaults with user edits
  const resolvedLayers = template.layers.map(layer => ({
    ...layer,
    ...edits[layer.id],
  }));

  return { resolvedLayers, updateLayer, resetAll, edits };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fabric.js (no React bindings) | react-konva (declarative) | react-konva v18+ (2023) | React developers get declarative canvas components |
| dom-to-image for export | Konva native toDataURL() | Always available | Eliminates DOM-to-canvas conversion bugs |
| Google Web Font Loader library | CSS Font Loading API (native) | Broadly supported since 2020 | No extra dependency for font loading |
| html2canvas for screenshots | html2canvas-pro (maintained fork) | 2024 | Better maintained but still has font issues |

**Deprecated/outdated:**
- `dom-to-image`: Unmaintained, replaced by `html-to-image`
- Google Web Font Loader: Still works but CSS Font Loading API is now preferred (native, no dependency)

## Open Questions

1. **Template visual design**
   - What we know: Templates need to cover common ad formats (square, story, landscape, portrait)
   - What's unclear: Exact template designs -- how many templates, what visual styles
   - Recommendation: Start with 6-8 templates (2 per major format). Design can be iterated. Define the data structure first, templates are easy to add later.

2. **Font selection scope**
   - What we know: Google Fonts provides hundreds of fonts. Brand guidelines currently store colors but NOT fonts.
   - What's unclear: Should we offer all Google Fonts or curate a list? Should we add font storage to BrandGuidelines model?
   - Recommendation: Curate ~20-30 popular Google Fonts for the font picker. Do NOT add font to BrandGuidelines schema in this phase (can be a follow-up).

3. **react-konva-utils / use-image**
   - What we know: `use-image` is a popular hook for loading images into Konva
   - What's unclear: Whether `react-konva-utils` is compatible with react-konva v19
   - Recommendation: Write a simple custom `useLoadImage` hook (shown in code examples) rather than depending on potentially incompatible utility package. It is ~15 lines of code.

4. **Template thumbnail generation**
   - What we know: Template picker needs preview thumbnails
   - What's unclear: Generate at build time? Static images? Render mini Konva stages?
   - Recommendation: Use static PNG thumbnails committed to the repo. Simplest approach, no runtime cost.

## Sources

### Primary (HIGH confidence)
- [Konva Canvas Export docs](https://konvajs.org/docs/react/Canvas_Export.html) -- toDataURL API, pixelRatio
- [Konva Custom Font docs](https://konvajs.org/docs/sandbox/Custom_Font.html) -- font loading pattern
- [Konva High Quality Export](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html) -- pixelRatio for retina
- [MDN CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API) -- document.fonts.load()
- [react-konva GitHub](https://github.com/konvajs/react-konva) -- v19.2.3, React 19 compatible

### Secondary (MEDIUM confidence)
- [react-konva NPM](https://www.npmjs.com/package/react-konva) -- version 19.2.3, peer deps konva ^8/^9/^10
- [html2canvas font issues](https://github.com/niklasvh/html2canvas/issues/3198) -- documented font rendering problems
- [Konva vs Fabric.js comparison](https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan) -- react-konva preferred for React apps
- [html-to-image vs html2canvas comparison](https://npm-compare.com/dom-to-image,html-to-image,html2canvas) -- library comparison

### Tertiary (LOW confidence)
- Template JSON structure design -- custom recommendation based on Konva primitives, no authoritative external source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- react-konva v19.x is well-documented, actively maintained, React 19 compatible
- Architecture: HIGH -- JSON template definition + Konva rendering is a well-established pattern (multiple open-source editors use this)
- Export: HIGH -- Konva `toDataURL()` is native canvas API, documented with examples
- Font loading: HIGH -- CSS Font Loading API is a web standard, Konva docs cover the pattern
- Template structure: MEDIUM -- custom design, but based on well-understood layer/property patterns
- Pitfalls: HIGH -- documented in Konva issues and community resources

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, libraries are mature)
