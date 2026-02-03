'use client';

import type { Observation } from '@/lib/observation-engine';
import { ObservationCard } from './observation-card';

export function ObservationList({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        Key Observations
      </h3>
      {observations.map((obs, i) => (
        <ObservationCard key={`${obs.type}-${i}`} observation={obs} />
      ))}
    </div>
  );
}
