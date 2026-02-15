'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardCard } from './dashboard-card';
import { Video, Image, Layers } from 'lucide-react';
import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface MediaMixChartProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'ownBrand', label: 'Own Brand' },
  { key: 'competitors', label: 'Competitors' },
];

const COLORS = {
  video: 'var(--chart-navy)',
  image: 'var(--chart-blue)',
  carousel: 'var(--chart-blue-light)',
};

export function MediaMixChart({ ownBrand, competitors }: MediaMixChartProps) {
  const [filter, setFilter] = useState('all');

  const data = useMemo(() => {
    let brands: TrackedBrand[] = [];

    if (filter === 'all') {
      brands = [...(ownBrand ? [ownBrand] : []), ...competitors];
    } else if (filter === 'ownBrand' && ownBrand) {
      brands = [ownBrand];
    } else if (filter === 'competitors') {
      brands = competitors;
    }

    // Aggregate counts across all brands
    let totalVideo = 0;
    let totalImage = 0;
    let totalCarousel = 0;

    for (const brand of brands) {
      const snapshot = brand.snapshots[0];
      if (snapshot) {
        totalVideo += snapshot.videoCount || 0;
        totalImage += snapshot.imageCount || 0;
        // carouselCount might not exist in older snapshots
        totalCarousel += (snapshot as { carouselCount?: number }).carouselCount || 0;
      }
    }

    const total = totalVideo + totalImage + totalCarousel;
    if (total === 0) return null;

    return {
      total,
      items: [
        { name: 'Videos', value: totalVideo, percentage: Math.round((totalVideo / total) * 100), color: COLORS.video, icon: Video },
        { name: 'Images', value: totalImage, percentage: Math.round((totalImage / total) * 100), color: COLORS.image, icon: Image },
        { name: 'Carousels', value: totalCarousel, percentage: Math.round((totalCarousel / total) * 100), color: COLORS.carousel, icon: Layers },
      ].filter(item => item.value > 0),
    };
  }, [ownBrand, competitors, filter]);

  if (!data) {
    return null;
  }

  return (
    <DashboardCard
      title="Media Mix"
      tooltip="Breakdown of creative formats used across tracked brands. Video-heavy mixes often indicate higher production investment."
      filterTabs={FILTER_TABS}
      defaultTab="all"
      onTabChange={setFilter}
    >
      <div className="flex items-center gap-8">
        {/* Donut Chart */}
        <div className="relative w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.items}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.items.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value) => [(Number(value) || 0).toLocaleString(), '']}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {data.total.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Creatives</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-4">
          {data.items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-muted)] w-16 text-right">
                      {item.value.toLocaleString()} ({item.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-muted)]">
          {data.items[0]?.percentage > 50
            ? `${data.items[0].name} dominate the creative mix (${data.items[0].percentage}%). Consider testing this format if you haven't already.`
            : 'Creative formats are fairly balanced. Experiment to find what works best for your audience.'}
        </p>
      </div>
    </DashboardCard>
  );
}
