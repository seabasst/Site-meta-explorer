'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Type,
  ImageIcon,
  Palette,
  LetterText,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Upload,
  Link,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useFontLoader } from '../hooks/use-font-loader';
import { CURATED_FONTS, DEFAULT_FONT } from './fonts';
import type { TemplateDefinition, TemplateLayer } from '../templates/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EditorSidebarProps {
  template: TemplateDefinition;
  resolvedLayers: TemplateLayer[];
  updateLayer: (id: string, changes: Partial<TemplateLayer>) => void;
  updateColors: (colors: { primary?: string; secondary?: string; accent?: string }) => void;
  updateFont: (fontFamily: string) => void;
  resetAll: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Icon className="w-3.5 h-3.5" />
        {title}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset color swatches
// ---------------------------------------------------------------------------

const COLOR_PRESETS = [
  '#1235e2',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#7c3aed',
  '#101322',
  '#ffffff',
  '#fafaf9',
];

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
          maxLength={7}
        />
      </div>
      <div className="flex gap-1 flex-wrap">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`w-5 h-5 rounded-sm border transition-transform hover:scale-110 ${
              value === c ? 'border-white ring-1 ring-white/40' : 'border-white/20'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role label mapping
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  headline: 'Headline',
  body: 'Body Text',
  cta: 'Call to Action',
};

// ---------------------------------------------------------------------------
// Editor Sidebar
// ---------------------------------------------------------------------------

export function EditorSidebar({
  template,
  resolvedLayers,
  updateLayer,
  updateColors,
  updateFont,
  resetAll,
}: EditorSidebarProps) {
  const { loadFont, loadedFonts, isLoading: fontLoading } = useFontLoader();

  // ---- Text layers grouped by role ----
  const textLayers = resolvedLayers.filter((l) => l.type === 'text');
  const groupedTextLayers: Record<string, TemplateLayer[]> = {};
  for (const layer of textLayers) {
    const key = layer.role ?? 'other';
    if (!groupedTextLayers[key]) groupedTextLayers[key] = [];
    groupedTextLayers[key].push(layer);
  }
  const roleOrder = ['headline', 'body', 'cta', 'other'];

  // ---- Editable image layers ----
  const editableImages = resolvedLayers.filter(
    (l) => l.type === 'image' && l.editable,
  );

  // ---- Current colors from defaults, overridden by edits ----
  const currentPrimary =
    resolvedLayers.find((l) => l.colorRole === 'primary')?.fill ??
    template.defaults.primaryColor;
  const currentSecondary =
    resolvedLayers.find((l) => l.colorRole === 'secondary')?.fill ??
    template.defaults.secondaryColor;
  const currentAccent =
    resolvedLayers.find((l) => l.colorRole === 'accent')?.fill ??
    template.defaults.accentColor;

  // ---- Current font ----
  const currentFont =
    textLayers[0]?.fontFamily ?? template.defaults.fontFamily ?? DEFAULT_FONT;

  // ---- Font select handler ----
  const handleFontChange = useCallback(
    async (family: string) => {
      await loadFont(family);
      updateFont(family);
    },
    [loadFont, updateFont],
  );

  // Group fonts by category for <optgroup>
  const fontsByCategory = CURATED_FONTS.reduce(
    (acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f.family);
      return acc;
    },
    {} as Record<string, string[]>,
  );
  const categoryOrder = ['sans-serif', 'serif', 'display', 'monospace'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Editing Controls
        </h2>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {template.name} &middot; {template.width}&times;{template.height}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* ---- Section 1: Text ---- */}
        <Section title="Text" icon={Type}>
          {roleOrder.map((role) => {
            const layers = groupedTextLayers[role];
            if (!layers?.length) return null;
            return (
              <div key={role} className="space-y-3">
                <p className="text-[11px] font-semibold text-slate-300">
                  {ROLE_LABELS[role] ?? 'Text'}
                </p>
                {layers.map((layer) => (
                  <TextLayerControls
                    key={layer.id}
                    layer={layer}
                    updateLayer={updateLayer}
                  />
                ))}
              </div>
            );
          })}
          {textLayers.length === 0 && (
            <p className="text-xs text-slate-600">No text layers in this template.</p>
          )}
        </Section>

        {/* ---- Section 2: Image ---- */}
        <Section title="Image" icon={ImageIcon}>
          {editableImages.length > 0 ? (
            editableImages.map((layer) => (
              <ImageLayerControls
                key={layer.id}
                layer={layer}
                updateLayer={updateLayer}
                templateLayers={template.layers}
              />
            ))
          ) : (
            <p className="text-xs text-slate-600">No editable image layers.</p>
          )}
        </Section>

        {/* ---- Section 3: Colors ---- */}
        <Section title="Colors" icon={Palette}>
          <ColorPicker
            label="Primary"
            value={currentPrimary}
            onChange={(c) => updateColors({ primary: c })}
          />
          <ColorPicker
            label="Secondary"
            value={currentSecondary}
            onChange={(c) => updateColors({ secondary: c })}
          />
          <ColorPicker
            label="Accent"
            value={currentAccent}
            onChange={(c) => updateColors({ accent: c })}
          />
          <div className="rounded-lg border border-white/10 p-2.5 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Set up <span className="text-slate-400">Brand Guidelines</span> to auto-apply your brand colors
            </p>
          </div>
        </Section>

        {/* ---- Section 4: Fonts ---- */}
        <Section title="Fonts" icon={LetterText}>
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">Font Family</label>
            <div className="relative">
              <select
                value={currentFont}
                onChange={(e) => handleFontChange(e.target.value)}
                disabled={fontLoading}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white appearance-none cursor-pointer disabled:opacity-50"
              >
                {categoryOrder.map((cat) => (
                  <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                    {(fontsByCategory[cat] ?? []).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {fontLoading && (
                <Loader2 className="w-3.5 h-3.5 text-blue-400 absolute right-2 top-1/2 -translate-y-1/2 animate-spin" />
              )}
            </div>
            <p className="text-[10px] text-slate-600">
              Currently: <span className="text-slate-400">{currentFont}</span>
            </p>
          </div>
        </Section>

        {/* ---- Section 5: Reset ---- */}
        <div className="px-4 py-4">
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all edits
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text Layer Controls
// ---------------------------------------------------------------------------

function TextLayerControls({
  layer,
  updateLayer,
}: {
  layer: TemplateLayer;
  updateLayer: (id: string, changes: Partial<TemplateLayer>) => void;
}) {
  const isCta = layer.role === 'cta';

  return (
    <div className="space-y-2 rounded-lg bg-white/[0.03] border border-white/5 p-3">
      {/* Text input */}
      {isCta ? (
        <input
          type="text"
          value={layer.text ?? ''}
          onChange={(e) => updateLayer(layer.id, { text: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-slate-600"
          placeholder="CTA text..."
        />
      ) : (
        <textarea
          value={layer.text ?? ''}
          onChange={(e) => updateLayer(layer.id, { text: e.target.value })}
          rows={layer.role === 'headline' ? 2 : 3}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-slate-600 resize-none"
          placeholder={`${ROLE_LABELS[layer.role ?? 'other'] ?? 'Text'}...`}
        />
      )}

      {/* Font size */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-slate-500 w-12 shrink-0">Size</label>
        <input
          type="range"
          min={12}
          max={120}
          step={1}
          value={layer.fontSize ?? 16}
          onChange={(e) => updateLayer(layer.id, { fontSize: Number(e.target.value) })}
          className="flex-1 accent-blue-500"
        />
        <input
          type="number"
          min={12}
          max={120}
          value={layer.fontSize ?? 16}
          onChange={(e) => updateLayer(layer.id, { fontSize: Number(e.target.value) })}
          className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-center"
        />
      </div>

      {/* Alignment + Bold */}
      <div className="flex items-center gap-1">
        {(['left', 'center', 'right'] as const).map((align) => {
          const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
          return (
            <button
              key={align}
              onClick={() => updateLayer(layer.id, { align })}
              className={`p-1.5 rounded transition-colors ${
                layer.align === align
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-white'
              }`}
              title={`Align ${align}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={() =>
            updateLayer(layer.id, {
              fontStyle: layer.fontStyle === 'bold' ? 'normal' : 'bold',
            })
          }
          className={`p-1.5 rounded transition-colors ${
            layer.fontStyle === 'bold' || layer.fontStyle === 'bold italic'
              ? 'bg-white/10 text-white'
              : 'text-slate-500 hover:text-white'
          }`}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Text color */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-slate-500 w-12 shrink-0">Color</label>
        <input
          type="color"
          value={layer.fill ?? '#ffffff'}
          onChange={(e) => updateLayer(layer.id, { fill: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent"
        />
        <span className="text-[10px] text-slate-500 font-mono">{layer.fill ?? '#ffffff'}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Layer Controls
// ---------------------------------------------------------------------------

function ImageLayerControls({
  layer,
  updateLayer,
  templateLayers,
}: {
  layer: TemplateLayer;
  updateLayer: (id: string, changes: Partial<TemplateLayer>) => void;
  templateLayers: TemplateLayer[];
}) {
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originalSrc = templateLayers.find((l) => l.id === layer.id)?.src;

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      updateLayer(layer.id, { src: blobUrl });
    },
    [layer.id, updateLayer],
  );

  const handleUrlApply = useCallback(() => {
    if (urlInput.trim()) {
      updateLayer(layer.id, { src: urlInput.trim() });
      setUrlMode(false);
    }
  }, [layer.id, urlInput, updateLayer]);

  return (
    <div className="space-y-2 rounded-lg bg-white/[0.03] border border-white/5 p-3">
      {/* Preview */}
      {layer.src && (
        <div className="w-full h-20 rounded bg-white/5 overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layer.src}
            alt="Layer preview"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors"
      >
        <Upload className="w-3 h-3" />
        Upload Image
      </button>

      {/* URL mode toggle */}
      {urlMode ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlApply()}
            placeholder="https://..."
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
          />
          <button
            onClick={handleUrlApply}
            className="px-2 py-1 bg-blue-600 rounded text-xs text-white hover:bg-blue-500 transition-colors"
          >
            Apply
          </button>
        </div>
      ) : (
        <button
          onClick={() => setUrlMode(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Link className="w-3 h-3" />
          Use URL instead
        </button>
      )}

      {/* Reset to default */}
      {originalSrc && layer.src !== originalSrc && (
        <button
          onClick={() => updateLayer(layer.id, { src: originalSrc })}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          Reset to default image
        </button>
      )}
    </div>
  );
}
