'use client';

import { Users, Scale, Globe, MessageSquare, type LucideIcon } from 'lucide-react';
import type { Observation, ObservationType } from '@/lib/observation-engine';

const iconMap: Record<ObservationType, LucideIcon> = {
  'demographic-skew': Users,
  'gender-imbalance': Scale,
  'geo-concentration': Globe,
  'hook-pattern': MessageSquare,
};

export function ObservationCard({ observation }: { observation: Observation }) {
  const Icon = iconMap[observation.type];

  return (
    <div className="flex items-start gap-3 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-4 py-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent-green)]/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[var(--accent-green)]" />
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {observation.title}
        </p>
        <p className="text-sm text-[var(--text-primary)]">
          {observation.description}
        </p>
      </div>
    </div>
  );
}
