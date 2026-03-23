'use client';

import { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportControlsProps {
  stageRef: React.RefObject<any>;
  templateName: string;
}

export function ExportControls({ stageRef, templateName }: ExportControlsProps) {
  const [exporting, setExporting] = useState<'png' | 'jpg' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: 'png' | 'jpg') => {
      setError(null);

      const stage = stageRef.current;
      if (!stage) {
        setError('Canvas not ready');
        return;
      }

      setExporting(format);

      try {
        // Small delay to let UI update
        await new Promise((r) => setTimeout(r, 50));

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpg' ? 0.92 : 1;
        const ext = format === 'png' ? 'png' : 'jpg';

        const dataUrl = stage.toDataURL({
          mimeType,
          quality,
          pixelRatio: 2,
        });

        // Trigger download
        const timestamp = Date.now();
        const safeName = templateName
          .replace(/[^a-zA-Z0-9-_ ]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase();
        const filename = `${safeName}-${timestamp}.${ext}`;

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Export failed:', err);
        setError(
          'Export failed. If using a URL image, try uploading the image instead (cross-origin images may block export).',
        );
      } finally {
        setExporting(null);
      }
    },
    [stageRef, templateName],
  );

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('png')}
        disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs text-white transition-colors disabled:opacity-50"
        title="Export as PNG at 2x resolution"
      >
        {exporting === 'png' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Download className="w-3 h-3" />
        )}
        PNG
      </button>
      <button
        onClick={() => handleExport('jpg')}
        disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs text-white transition-colors disabled:opacity-50"
        title="Export as JPG at 2x resolution"
      >
        {exporting === 'jpg' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Download className="w-3 h-3" />
        )}
        JPG
      </button>
      {error && (
        <p className="text-[10px] text-rose-400 max-w-[200px] leading-tight">{error}</p>
      )}
    </div>
  );
}
