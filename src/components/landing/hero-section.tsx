import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] bg-[#101322] overflow-hidden flex items-center">
      {/* Gradient orbs - fixed, pointer-events-none for performance */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#1235e2]/8 blur-[120px]" />
        <div className="absolute bottom-[-30%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#1235e2]/5 blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#1235e2]/3 blur-[80px]" />
      </div>

      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 w-full pt-28 pb-24">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.15em] font-medium text-[#1235e2] bg-[#1235e2]/10 border border-[#1235e2]/20 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1235e2] animate-pulse-subtle" />
              Competitive Ad Intelligence
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up stagger-1 font-serif italic text-4xl md:text-6xl lg:text-7xl tracking-tighter leading-[0.95] text-white mb-8">
            See what your{' '}
            <span className="text-[#1235e2]">competitors</span>{' '}
            are running
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-up stagger-2 text-lg md:text-xl text-slate-400 leading-relaxed max-w-[55ch] mb-12">
            Browse, save, and analyze Facebook ads across 50,000+ creatives.
            Spot trends, track brands, and get AI-powered insights to sharpen
            your ad strategy.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up stagger-3 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/analyser"
              className="group inline-flex items-center gap-3 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-base font-medium pl-6 pr-5 py-3.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Try Free Analyser
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-base font-medium px-6 py-3.5 rounded-full border border-white/10 hover:border-white/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Get Pro &mdash; $99/mo
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#f6f6f8] to-transparent z-20 pointer-events-none" />
    </section>
  );
}
