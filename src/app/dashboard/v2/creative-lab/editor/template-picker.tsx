'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { TEMPLATES, getTemplatesByFormat } from '../templates';
import type { TemplateDefinition } from '../templates/types';
import { AD_FORMATS } from '../format-selector';

// Formats that actually have templates
const TEMPLATE_FORMATS = ['square', 'story', 'landscape', 'portrait'];

interface TemplatePickerProps {
  onSelect: (template: TemplateDefinition) => void;
  selectedId: string | null;
}

export function TemplatePicker({ onSelect, selectedId }: TemplatePickerProps) {
  const [activeFormat, setActiveFormat] = useState('all');

  const templates =
    activeFormat === 'all' ? TEMPLATES : getTemplatesByFormat(activeFormat);

  // Build tab list: "All" + one per format that has templates
  const formatTabs = [
    { id: 'all', label: 'All' },
    ...TEMPLATE_FORMATS.map((fmtId) => {
      const fmt = AD_FORMATS.find((f) => f.id === fmtId);
      return { id: fmtId, label: fmt?.label ?? fmtId };
    }),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Format filter tabs */}
      <div className="flex gap-1 flex-wrap px-1 pb-3 border-b border-white/10">
        {formatTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFormat(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFormat === tab.id
                ? 'bg-[#1235e2] text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto pt-3">
        <div className="grid grid-cols-2 gap-2">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedId;
            const fmt = AD_FORMATS.find((f) => f.id === tpl.format);

            return (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className={`relative text-left rounded-lg border-2 overflow-hidden transition-all ${
                  isSelected
                    ? 'border-[#1235e2] ring-1 ring-[#1235e2]/30'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Thumbnail or placeholder */}
                <TemplateThumbnail template={tpl} />

                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white truncate">
                    {tpl.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {fmt?.size ?? tpl.format}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 capitalize">
                      {tpl.category}
                    </span>
                  </div>
                </div>

                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#1235e2] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Shows template thumbnail image, falls back to colored placeholder */
function TemplateThumbnail({ template }: { template: TemplateDefinition }) {
  const [imgError, setImgError] = useState(false);

  if (imgError || !template.thumbnail) {
    return (
      <div
        className="w-full aspect-square flex items-center justify-center"
        style={{ backgroundColor: template.defaults.primaryColor + '33' }}
      >
        <span
          className="text-xs font-bold px-2 text-center leading-tight"
          style={{ color: template.defaults.primaryColor }}
        >
          {template.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={template.thumbnail}
      alt={template.name}
      className="w-full aspect-square object-cover"
      onError={() => setImgError(true)}
    />
  );
}
