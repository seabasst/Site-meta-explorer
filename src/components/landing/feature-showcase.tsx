import {
  BarChart3,
  Sparkles,
  Library,
  FolderOpen,
  Bot,
  Download,
} from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'KPI cards, timeline charts, format and platform breakdowns. Understand the landscape at a glance.',
    accent: 'bg-[#1235e2]/10 text-[#1235e2]',
  },
  {
    icon: Sparkles,
    title: 'Creative Lab',
    description:
      'Brand pillar analysis, creative diversity scores, and hook analysis. Decode what makes ads work.',
    accent: 'bg-[#1235e2]/10 text-[#1235e2]',
  },
  {
    icon: Library,
    title: 'Ad Library',
    description:
      'Browse 50,000+ ads with advanced filters. Save favorites and build swipe files for your team.',
    accent: 'bg-[#1235e2]/10 text-[#1235e2]',
  },
  {
    icon: FolderOpen,
    title: 'Brand & Category Browsing',
    description:
      'Organized by industry and category. Discover new competitors and find inspiration fast.',
    accent: 'bg-[#1235e2]/10 text-[#1235e2]',
  },
  {
    icon: Bot,
    title: 'Hikaru AI',
    description:
      'AI-powered analysis with interactive charts. Ask questions about ad trends and get instant answers.',
    accent: 'bg-[#1235e2]/10 text-[#1235e2]',
  },
  {
    icon: Download,
    title: 'Downloads',
    description:
      'Export reports and data for your team. Share insights across your organization.',
    badge: 'Coming soon',
    accent: 'bg-slate-100 text-slate-400',
  },
] as const;

export function FeatureShowcase() {
  return (
    <section className="relative bg-[#f6f6f8] py-28 md:py-36">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="max-w-2xl mb-20">
          <span className="inline-flex rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.15em] font-medium text-[#1235e2] bg-[#1235e2]/8 border border-[#1235e2]/15 mb-6">
            Features
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl tracking-tighter leading-[1.05] text-[#101322] mb-5">
            Everything you need for competitive ad intelligence
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-[55ch]">
            From real-time monitoring to AI-powered analysis, Ad Library Pro gives
            you the complete toolkit to understand and outperform competitors.
          </p>
        </div>

        {/* Feature grid - asymmetric 2-col layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`animate-fade-in-up stagger-${Math.min(idx + 1, 5)} group relative`}
              >
                {/* Double-bezel: outer shell */}
                <div className="rounded-2xl bg-white/60 p-1 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  {/* Inner core */}
                  <div className="rounded-[calc(1rem-2px)] bg-white p-7 md:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-[0_8px_30px_-10px_rgba(18,53,226,0.1)]">
                    <div className="flex items-start gap-5">
                      <div className={`shrink-0 w-11 h-11 rounded-xl ${feature.accent} flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105`}>
                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <h3 className="text-[15px] font-semibold text-[#101322] tracking-tight">
                            {feature.title}
                          </h3>
                          {'badge' in feature && feature.badge && (
                            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] font-medium text-slate-400 bg-slate-100 border border-slate-200/80">
                              {feature.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
