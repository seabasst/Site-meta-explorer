import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-[#101322] border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 mb-14">
          {/* Brand column */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-[#1235e2] p-1.5 rounded-lg text-white">
                <BarChart3 className="w-4 h-4" strokeWidth={2} />
              </div>
              <span className="text-[15px] font-semibold text-white tracking-tight">
                Ad Library Pro
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Built for competitive research. Data sourced from the Facebook Ad
              Library API.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.15em] font-medium text-slate-500 mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/analyser"
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300"
                  >
                    Free Analyser
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/v2"
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300"
                  >
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-white/[0.04] pt-8">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Ad Library Pro. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
