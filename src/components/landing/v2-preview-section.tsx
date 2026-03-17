import Link from 'next/link';

export function V2PreviewSection() {
  return (
    <section className="relative bg-[#101322] py-28 md:py-36 overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-[#1235e2]/6 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.15em] font-medium text-[#1235e2] bg-[#1235e2]/10 border border-[#1235e2]/20 mb-6">
            Preview
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl tracking-tighter leading-[1.05] text-white mb-5">
            A glimpse of Ad Library Pro
          </h2>
          <p className="text-base md:text-lg text-slate-400 leading-relaxed">
            A dedicated workspace for competitive ad intelligence, powered by
            data from the Facebook Ad Library.
          </p>
        </div>

        {/* Dashboard mockup - CSS-only stylized wireframe */}
        <div className="max-w-5xl mx-auto">
          {/* Outer bezel */}
          <div className="rounded-2xl md:rounded-3xl bg-white/[0.03] p-1.5 border border-white/[0.06] shadow-[0_0_80px_-20px_rgba(18,53,226,0.2)]">
            {/* Window chrome */}
            <div className="rounded-[calc(1.5rem-6px)] md:rounded-[calc(1.5rem-4px)] bg-[#0a0e1a] overflow-hidden border border-white/[0.04]">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="rounded-md bg-white/[0.04] px-12 py-1 text-[10px] text-slate-500 font-medium tracking-wide">
                    Ad Library Pro
                  </div>
                </div>
                <div className="w-16" />
              </div>

              {/* Dashboard layout */}
              <div className="flex min-h-[340px] md:min-h-[420px]">
                {/* Sidebar mockup */}
                <div className="hidden sm:flex flex-col w-48 md:w-56 border-r border-white/[0.04] py-5 px-4 shrink-0">
                  {/* Brand */}
                  <div className="flex items-center gap-2 mb-8 px-1">
                    <div className="w-6 h-6 rounded-md bg-[#1235e2] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-sm bg-white/30" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="h-2.5 w-20 rounded bg-white/15" />
                      <div className="h-1.5 w-12 rounded bg-white/6" />
                    </div>
                  </div>

                  {/* Nav items */}
                  <div className="space-y-1">
                    {['Dashboard', 'Creative Lab'].map((label) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg ${
                          label === 'Dashboard' ? 'bg-[#1235e2]/10' : ''
                        }`}
                      >
                        <div className={`w-4 h-4 rounded ${label === 'Dashboard' ? 'bg-[#1235e2]/40' : 'bg-white/8'}`} />
                        <span className={`text-[11px] font-medium ${label === 'Dashboard' ? 'text-[#1235e2]' : 'text-white/25'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Section label */}
                  <div className="mt-5 mb-2 px-2.5">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-white/15 font-medium">
                      Inspiration
                    </div>
                  </div>
                  <div className="space-y-1">
                    {['Ad Library', 'Saved Ads', 'Brands', 'Categories'].map((label) => (
                      <div key={label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
                        <div className="w-4 h-4 rounded bg-white/8" />
                        <span className="text-[11px] text-white/25 font-medium">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-1">
                    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
                      <div className="w-4 h-4 rounded bg-white/8" />
                      <span className="text-[11px] text-white/25 font-medium">Hikaru AI</span>
                    </div>
                  </div>
                </div>

                {/* Main content mockup */}
                <div className="flex-1 p-5 md:p-6">
                  {/* KPI row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Total Ads', value: '52.4K' },
                      { label: 'Active', value: '18.7K' },
                      { label: 'Avg. Reach', value: '247K' },
                      { label: 'Brands', value: '1,284' },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3 md:p-4"
                      >
                        <div className="text-[10px] text-slate-500 mb-1 font-medium">{kpi.label}</div>
                        <div className="text-lg md:text-xl font-bold text-white/80 tracking-tight">{kpi.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Chart placeholder */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-4 md:p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-2.5 w-28 rounded bg-white/10" />
                      <div className="flex gap-2">
                        <div className="h-5 w-12 rounded-md bg-white/[0.04]" />
                        <div className="h-5 w-12 rounded-md bg-white/[0.04]" />
                      </div>
                    </div>
                    {/* Bars */}
                    <div className="flex items-end gap-2 h-24 md:h-32">
                      {[40, 65, 50, 80, 72, 55, 90, 68, 75, 60, 85, 45].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-sm bg-[#1235e2]/30" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>

                  {/* Table rows placeholder */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] overflow-hidden">
                    <div className="grid grid-cols-4 gap-3 px-4 py-2.5 border-b border-white/[0.04]">
                      {['Brand', 'Ads', 'Reach', 'Status'].map((col) => (
                        <div key={col} className="h-2 rounded bg-white/8 w-2/3" />
                      ))}
                    </div>
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-white/[0.02] last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-white/6 shrink-0" />
                          <div className="h-2 rounded bg-white/8 w-3/4" />
                        </div>
                        <div className="h-2 rounded bg-white/6 w-1/2 self-center" />
                        <div className="h-2 rounded bg-white/6 w-2/3 self-center" />
                        <div className="h-4 rounded-full bg-[#1235e2]/15 w-12 self-center" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA below mockup */}
        <div className="text-center mt-14">
          <p className="text-slate-400 text-base mb-6">
            Unlock the full dashboard with 50,000+ ads and AI-powered insights.
          </p>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-6 py-3 rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
