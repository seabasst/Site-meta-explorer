'use client';

import { Loader2 } from 'lucide-react';
import { TAXONOMY } from '@/lib/classification/taxonomy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GapMatrixProps {
  gapMatrix: Record<string, Record<string, number>>;
  maxCellCount: number;
  darkMode: boolean;
  onCellClick: (awarenessStage: string, visualFormat: string, count: number) => void;
  loadingCell?: { stage: string; format: string } | null;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getCellColors(count: number, maxCellCount: number, darkMode: boolean) {
  if (count === 0) {
    return {
      bg: darkMode ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100',
      text: 'text-red-400',
    };
  }

  const ratio = maxCellCount > 0 ? count / maxCellCount : 0;

  if (ratio < 0.25) {
    return {
      bg: darkMode ? 'bg-amber-500/15 hover:bg-amber-500/25' : 'bg-amber-50 hover:bg-amber-100',
      text: darkMode ? 'text-amber-400' : 'text-amber-600',
    };
  }

  if (ratio < 0.5) {
    return {
      bg: darkMode ? 'bg-[#1235e2]/10 hover:bg-[#1235e2]/20' : 'bg-blue-50 hover:bg-blue-100',
      text: darkMode ? 'text-[#1235e2]' : 'text-blue-600',
    };
  }

  return {
    bg: darkMode ? 'bg-green-500/15 hover:bg-green-500/25' : 'bg-green-50 hover:bg-green-100',
    text: darkMode ? 'text-green-400' : 'text-green-600',
  };
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

const LEGEND_ITEMS = [
  { label: '0 (gap)', dark: 'bg-red-500/10', light: 'bg-red-50', textClass: 'text-red-400' },
  { label: 'Sparse', dark: 'bg-amber-500/15', light: 'bg-amber-50', textClass: 'text-amber-500' },
  { label: 'Moderate', dark: 'bg-[#1235e2]/10', light: 'bg-blue-50', textClass: 'text-[#1235e2]' },
  { label: 'Strong', dark: 'bg-green-500/15', light: 'bg-green-50', textClass: 'text-green-500' },
];

// ---------------------------------------------------------------------------
// GapMatrix
// ---------------------------------------------------------------------------

export function GapMatrix({
  gapMatrix,
  maxCellCount,
  darkMode,
  onCellClick,
  loadingCell,
}: GapMatrixProps) {
  const stages = TAXONOMY.awarenessStage.values;
  const formats = TAXONOMY.visualFormat.values;

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div>
      {/* Scrollable grid */}
      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div
          className="grid gap-[2px] min-w-[780px]"
          style={{
            gridTemplateColumns: `140px repeat(${formats.length}, minmax(64px, 1fr))`,
          }}
        >
          {/* Corner cell */}
          <div />

          {/* Format headers */}
          {formats.map((format) => (
            <div
              key={format}
              className="flex items-end justify-center h-20 pb-1"
            >
              <span
                className={`text-[10px] font-medium ${muted} truncate max-w-[60px] origin-bottom-left`}
                style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                title={TAXONOMY.visualFormat.labels[format]}
              >
                {TAXONOMY.visualFormat.labels[format]}
              </span>
            </div>
          ))}

          {/* Data rows */}
          {stages.map((stage) => (
            <>
              {/* Row label */}
              <div
                key={`label-${stage}`}
                className="flex items-center pr-2"
              >
                <span className="text-xs font-medium truncate">
                  {TAXONOMY.awarenessStage.labels[stage]}
                </span>
              </div>

              {/* Cells */}
              {formats.map((format) => {
                const count = gapMatrix[stage]?.[format] ?? 0;
                const isLoading =
                  loadingCell?.stage === stage && loadingCell?.format === format;
                const colors = getCellColors(count, maxCellCount, darkMode);

                return (
                  <button
                    key={`${stage}-${format}`}
                    onClick={() => onCellClick(stage, format, count)}
                    disabled={isLoading}
                    className={`
                      flex items-center justify-center
                      h-10 rounded-md text-xs font-semibold
                      cursor-pointer transition-colors
                      ${colors.bg} ${colors.text}
                      disabled:cursor-wait
                    `}
                    title={`${TAXONOMY.awarenessStage.labels[stage]} x ${TAXONOMY.visualFormat.labels[format]}: ${count} ads`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>{count}</span>
                    )}
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className={`w-4 h-4 rounded ${darkMode ? item.dark : item.light}`}
            />
            <span className={`text-[10px] font-medium ${muted}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
