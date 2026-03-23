'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Layout, ChevronLeft, ChevronRight } from 'lucide-react';
import { TemplatePicker } from './template-picker';
import { useTemplateState } from '../hooks/use-template-state';
import type { TemplateDefinition } from '../templates/types';

// Dynamic import for Konva canvas -- must be client-only (no SSR)
const TemplateCanvas = dynamic(
  () => import('./template-canvas').then((m) => m.TemplateCanvas),
  { ssr: false, loading: () => <CanvasPlaceholder text="Loading canvas..." /> },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CanvasPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditorPage() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateDefinition | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);
  const stageRef = useRef<any>(null);

  const { resolvedLayers, edits, updateLayer, updateColors, updateFont, resetAll } =
    useTemplateState(selectedTemplate);

  const handleSelect = (tpl: TemplateDefinition) => {
    setSelectedTemplate(tpl);
    // Auto-collapse picker on small screens after selection
    if (window.innerWidth < 1024) {
      setPickerOpen(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#101322] text-white overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-[#101322] z-20">
        {/* Left: back */}
        <Link
          href="/dashboard/v2/creative-lab"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Creative Lab</span>
        </Link>

        {/* Center: title */}
        <h1 className="text-sm font-bold tracking-wide absolute left-1/2 -translate-x-1/2">
          Template Editor
        </h1>

        {/* Right: export controls placeholder */}
        <div id="export-controls" className="w-32" />
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main 3-column layout                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: Template picker */}
        <aside
          className={`shrink-0 border-r border-white/10 bg-[#0c0f1d] transition-all overflow-hidden flex flex-col ${
            pickerOpen ? 'w-full lg:w-[280px]' : 'w-0 lg:w-10'
          }`}
        >
          {pickerOpen ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Templates
                </span>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="text-slate-500 hover:text-white p-1"
                  title="Collapse picker"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <TemplatePicker
                  onSelect={handleSelect}
                  selectedId={selectedTemplate?.id ?? null}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              className="h-full w-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              title="Show templates"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </aside>

        {/* Center: Canvas area */}
        <main className="flex-1 flex items-center justify-center overflow-auto relative min-h-0">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          />

          {selectedTemplate ? (
            <div className="relative z-10 p-4">
              <TemplateCanvas
                template={selectedTemplate}
                edits={edits}
                stageRef={stageRef}
                maxWidth={Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 700 : 600)}
                maxHeight={600}
              />
            </div>
          ) : (
            <div className="text-center text-slate-500 relative z-10">
              <Layout className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">Pick a template to get started</p>
              <p className="text-xs text-slate-600">
                Choose from the panel on the left
              </p>
            </div>
          )}
        </main>

        {/* Right panel: Editor sidebar placeholder */}
        <aside className="shrink-0 w-full lg:w-[320px] border-l border-white/10 bg-[#0c0f1d] overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Editing Controls
            </h2>
          </div>
          <div className="p-4">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium text-white mb-1">{selectedTemplate.name}</p>
                  <p className="text-xs text-slate-500">
                    {selectedTemplate.width} x {selectedTemplate.height} &middot;{' '}
                    {selectedTemplate.format}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <p className="text-xs text-slate-500">
                    Text, color, and font controls will appear here.
                  </p>
                </div>
                <button
                  onClick={resetAll}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  Reset all edits
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Select a template to start editing.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
