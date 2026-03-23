'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Check,
  Camera,
  Mic,
  Film,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Monitor,
  Ratio,
  Tag,
} from 'lucide-react';
import type { UGCBrief } from '@/lib/creative-lab-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UGCBriefViewProps {
  brief: UGCBrief;
  darkMode: boolean;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Format utilities
// ---------------------------------------------------------------------------

function formatBriefAsText(brief: UGCBrief): string {
  const lines: string[] = [];

  lines.push(`UGC CREATOR BRIEF: ${brief.briefTitle}`);
  lines.push(`Brand: ${brief.brandName}`);
  lines.push(`Category: ${brief.category}`);
  lines.push(`Content Type: ${brief.contentType}`);
  lines.push(`Platform: ${brief.platform}`);
  lines.push(`Duration: ${brief.duration}`);
  lines.push(`Aspect Ratio: ${brief.aspectRatio}`);
  lines.push('');

  lines.push('HOOK OPTIONS (test all 3)');
  brief.hooks.forEach((hook, i) => {
    lines.push(`  ${i + 1}. ${hook}`);
  });
  lines.push('');

  lines.push('SHOT LIST');
  brief.scenes.forEach((scene) => {
    lines.push(`  Scene ${scene.sceneNumber} [${scene.duration}] - ${scene.shotType}`);
    lines.push(`    ${scene.description}`);
    lines.push(`    Visual: ${scene.visualNotes}`);
    lines.push(`    Audio: ${scene.audioNotes}`);
  });
  lines.push('');

  lines.push('TALKING POINTS');
  brief.talkingPoints.forEach((point) => {
    lines.push(`  - ${point}`);
  });
  lines.push('');

  lines.push('B-ROLL SUGGESTIONS');
  brief.brollSuggestions.forEach((suggestion) => {
    lines.push(`  - ${suggestion}`);
  });
  lines.push('');

  lines.push('CALL TO ACTION');
  lines.push(`  ${brief.callToAction}`);
  lines.push('');

  lines.push('TONE & STYLE');
  lines.push(`  ${brief.tone}`);
  lines.push('');
  lines.push("  DO's:");
  brief.dosAndDonts.dos.forEach((d) => {
    lines.push(`    + ${d}`);
  });
  lines.push("  DON'Ts:");
  brief.dosAndDonts.donts.forEach((d) => {
    lines.push(`    - ${d}`);
  });
  lines.push('');

  lines.push('BRAND CONTEXT');
  lines.push(`  Product: ${brief.keyProductInfo}`);
  lines.push(`  Audience: ${brief.targetAudience}`);

  return lines.join('\n');
}

function formatBriefAsMarkdown(brief: UGCBrief): string {
  const lines: string[] = [];

  lines.push(`# ${brief.briefTitle}`);
  lines.push('');
  lines.push(`**Brand:** ${brief.brandName}  `);
  lines.push(`**Category:** ${brief.category}  `);
  lines.push(`**Content Type:** ${brief.contentType}  `);
  lines.push(`**Platform:** ${brief.platform}  `);
  lines.push(`**Duration:** ${brief.duration}  `);
  lines.push(`**Aspect Ratio:** ${brief.aspectRatio}`);
  lines.push('');

  lines.push('## Hook Options (test all 3)');
  lines.push('');
  brief.hooks.forEach((hook, i) => {
    lines.push(`${i + 1}. ${hook}`);
  });
  lines.push('');

  lines.push('## Shot List');
  lines.push('');
  lines.push('| Scene | Duration | Shot Type | Description | Visual Notes | Audio Notes |');
  lines.push('|-------|----------|-----------|-------------|--------------|-------------|');
  brief.scenes.forEach((scene) => {
    lines.push(
      `| ${scene.sceneNumber} | ${scene.duration} | ${scene.shotType} | ${scene.description} | ${scene.visualNotes} | ${scene.audioNotes} |`
    );
  });
  lines.push('');

  lines.push('## Talking Points');
  lines.push('');
  brief.talkingPoints.forEach((point) => {
    lines.push(`- ${point}`);
  });
  lines.push('');

  lines.push('## B-Roll Suggestions');
  lines.push('');
  brief.brollSuggestions.forEach((suggestion) => {
    lines.push(`- ${suggestion}`);
  });
  lines.push('');

  lines.push('## Call to Action');
  lines.push('');
  lines.push(brief.callToAction);
  lines.push('');

  lines.push('## Tone & Style');
  lines.push('');
  lines.push(brief.tone);
  lines.push('');

  lines.push("### Do's");
  lines.push('');
  brief.dosAndDonts.dos.forEach((d) => {
    lines.push(`- ${d}`);
  });
  lines.push('');

  lines.push("### Don'ts");
  lines.push('');
  brief.dosAndDonts.donts.forEach((d) => {
    lines.push(`- ${d}`);
  });
  lines.push('');

  lines.push('## Brand Context');
  lines.push('');
  lines.push(`**Product:** ${brief.keyProductInfo}`);
  lines.push('');
  lines.push(`**Target Audience:** ${brief.targetAudience}`);

  return lines.join('\n');
}

function downloadBriefAsMarkdown(brief: UGCBrief): void {
  const markdown = formatBriefAsMarkdown(brief);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${brief.brandName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-ugc-brief.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UGCBriefView({ brief, darkMode, onBack }: UGCBriefViewProps) {
  const [copied, setCopied] = useState(false);
  const [brandContextOpen, setBrandContextOpen] = useState(false);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const cardBg = darkMode ? 'bg-[#101322]' : 'bg-white';
  const cardBorder = darkMode ? 'border-[#1235e2]/10' : 'border-slate-200';
  const sectionBg = darkMode ? 'bg-slate-800/30' : 'bg-slate-50';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatBriefAsText(brief));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: won't fail silently in most modern browsers
    }
  }

  function handleDownload() {
    downloadBriefAsMarkdown(brief);
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <button
            onClick={onBack}
            className={`text-sm ${muted} hover:text-[#1235e2] transition-colors mb-3 flex items-center gap-1`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl font-black mb-2 truncate">{brief.briefTitle}</h1>
          <p className={`text-sm ${muted} mb-3`}>{brief.brandName}</p>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-blue-50 text-[#1235e2]'
              }`}
            >
              <Monitor className="w-3 h-3" />
              {brief.platform}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Clock className="w-3 h-3" />
              {brief.duration}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Ratio className="w-3 h-3" />
              {brief.aspectRatio}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Tag className="w-3 h-3" />
              {brief.contentType}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              copied
                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                : darkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download .md
          </button>
        </div>
      </div>

      {/* Hooks section */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-4">
          Hook Options (test all 3)
        </h2>
        <div className="space-y-3">
          {brief.hooks.map((hook, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg ${sectionBg}`}
            >
              <span
                className="w-6 h-6 rounded-full bg-[#1235e2] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
              >
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{hook}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shot List section */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-4">
          Shot List
        </h2>
        <div className="space-y-3">
          {brief.scenes.map((scene) => (
            <div
              key={scene.sceneNumber}
              className={`rounded-lg ${sectionBg} p-4`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-7 h-7 rounded-lg bg-[#1235e2]/10 text-[#1235e2] text-xs font-bold flex items-center justify-center shrink-0"
                >
                  {scene.sceneNumber}
                </span>
                <span className={`text-xs font-medium ${muted}`}>{scene.duration}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {scene.shotType}
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-2">{scene.description}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex items-start gap-1.5 text-xs ${muted}`}>
                  <Camera className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{scene.visualNotes}</span>
                </div>
                <div className={`flex items-start gap-1.5 text-xs ${muted}`}>
                  <Mic className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{scene.audioNotes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Talking Points section */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-4">
          Talking Points
        </h2>
        <ul className="space-y-2">
          {brief.talkingPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1235e2] shrink-0 mt-2" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* B-Roll Suggestions section */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-4">
          B-Roll Suggestions
        </h2>
        <ul className="space-y-2">
          {brief.brollSuggestions.map((suggestion, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <Film className="w-4 h-4 text-[#1235e2] shrink-0 mt-0.5" />
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA section */}
      <div
        className={`rounded-xl border-2 border-[#1235e2]/20 p-5 ${
          darkMode ? 'bg-[#1235e2]/5' : 'bg-blue-50/50'
        }`}
      >
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-2">
          Call to Action
        </h2>
        <p className="text-sm font-medium leading-relaxed">{brief.callToAction}</p>
      </div>

      {/* Tone & Style section */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-5`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1235e2] mb-3">
          Tone & Style
        </h2>
        <p className={`text-sm ${muted} mb-4 leading-relaxed`}>{brief.tone}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Do's */}
          <div className={`rounded-lg ${sectionBg} p-4`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-green-500 mb-3">
              Do&apos;s
            </h3>
            <ul className="space-y-2">
              {brief.dosAndDonts.dos.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {/* Don'ts */}
          <div className={`rounded-lg ${sectionBg} p-4`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">
              Don&apos;ts
            </h3>
            <ul className="space-y-2">
              {brief.dosAndDonts.donts.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Brand Context section (collapsible) */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg}`}>
        <button
          onClick={() => setBrandContextOpen(!brandContextOpen)}
          className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium transition-colors ${
            darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}
        >
          <span className={muted}>Brand Context (for creator reference)</span>
          {brandContextOpen ? (
            <ChevronUp className={`w-4 h-4 ${muted}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${muted}`} />
          )}
        </button>
        {brandContextOpen && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1235e2] mb-1">
                Key Product Info
              </p>
              <p className={`text-sm ${muted} leading-relaxed`}>{brief.keyProductInfo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1235e2] mb-1">
                Target Audience
              </p>
              <p className={`text-sm ${muted} leading-relaxed`}>{brief.targetAudience}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
