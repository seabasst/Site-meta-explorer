'use client';

interface ScrapeConfigProps {
  maxAds: number;
  onMaxAdsChange: (value: number) => void;
  disabled?: boolean;
}

export function ScrapeConfig({ maxAds, onMaxAdsChange, disabled }: ScrapeConfigProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-[var(--text-secondary)]">
        Ads to analyze:
      </label>
      <input
        type="number"
        min={1}
        max={50}
        value={maxAds}
        onChange={(e) => onMaxAdsChange(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
        disabled={disabled}
        className="input-field w-20 text-center"
      />
      <span className="text-xs text-[var(--text-muted)]">
        (1-50, more = slower but more accurate)
      </span>
    </div>
  );
}
