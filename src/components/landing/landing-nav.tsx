import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#101322]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="bg-[#1235e2] p-1.5 rounded-lg text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
            <BarChart3 className="w-4 h-4" strokeWidth={2} />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">
            Ad Library Pro
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/analyser"
            className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] px-4 py-2 rounded-full"
          >
            Try Free
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            Get Pro
          </Link>
        </div>
      </div>
    </nav>
  );
}
