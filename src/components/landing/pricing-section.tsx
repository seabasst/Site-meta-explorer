import Link from 'next/link';
import { Check } from 'lucide-react';
import { ProCTA } from './pro-cta';

const FREE_FEATURES = [
  'Search any brand',
  'Ad demographics & reach',
  'Media format breakdown',
  'Basic ad analysis',
  'Ad copy preview',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Analytics Dashboard with KPIs',
  'Creative Lab & pillar analysis',
  'Full Ad Library (50,000+ ads)',
  'Advanced filters & sorting',
  'Saved Ads & swipe files',
  'Brand tracking & categories',
  'Hikaru AI with interactive charts',
  'Downloads & exports (coming soon)',
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative bg-[#f6f6f8] py-28 md:py-36 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.15em] font-medium text-[#1235e2] bg-[#1235e2]/8 border border-[#1235e2]/15 mb-6">
            Pricing
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl tracking-tighter leading-[1.05] text-[#101322] mb-5">
            Start free, go Pro when you need more
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed">
            The analyser is free forever. Upgrade to Pro for the full competitive
            intelligence platform.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {/* FREE tier */}
          <div className="rounded-2xl bg-white/60 p-1 border border-slate-200/60">
            <div className="rounded-[calc(1rem-2px)] bg-white p-7 md:p-8 h-full flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#101322] tracking-tight mb-1">
                  Ad Analyser
                </h3>
                <p className="text-sm text-slate-500">
                  Quick competitor lookups
                </p>
              </div>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-[#101322] tracking-tight">
                  $0
                </span>
                <span className="text-sm text-slate-400 font-medium">/forever</span>
              </div>

              <Link
                href="/analyser"
                className="inline-flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-[#101322] text-sm font-medium py-3 rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] mb-8"
              >
                Try Free
              </Link>

              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* PRO tier */}
          <div className="relative rounded-2xl bg-[#1235e2]/[0.06] p-1 border border-[#1235e2]/20 shadow-[0_8px_40px_-12px_rgba(18,53,226,0.15)]">
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.1em] font-semibold text-white bg-[#1235e2] shadow-[0_4px_12px_-2px_rgba(18,53,226,0.4)]">
                Popular
              </span>
            </div>

            <div className="rounded-[calc(1rem-2px)] bg-white p-7 md:p-8 h-full flex flex-col shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#101322] tracking-tight mb-1">
                  Ad Library Pro
                </h3>
                <p className="text-sm text-slate-500">
                  Full competitive intelligence
                </p>
              </div>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-[#101322] tracking-tight">
                  $99
                </span>
                <span className="text-sm text-slate-400 font-medium">/month</span>
              </div>

              <div className="mb-8">
                <ProCTA
                  className="text-sm px-6 py-3 w-full"
                  label="Get Started with Pro"
                />
              </div>

              <ul className="space-y-3 flex-1">
                {PRO_FEATURES.map((feature, idx) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        idx === 0 ? 'text-slate-400' : 'text-[#1235e2]'
                      }`}
                      strokeWidth={2}
                    />
                    <span
                      className={`text-sm ${
                        idx === 0 ? 'text-slate-500 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
