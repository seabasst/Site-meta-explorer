'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Palette,
  Settings,
  Moon,
  Sun,
  Bell,
  LayoutDashboard,
  Globe,
  Download,
  Heart,
  Layers,
  Wand2,
  MessageSquare,
} from 'lucide-react';
import { useV2 } from './v2-context';

interface SidebarInsights {
  genderLabel?: string | null;
  genderPct?: number;
  countries?: { code: string; pct: number }[];
}

const countryFlags: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
  NL: '🇳🇱', IT: '🇮🇹', ES: '🇪🇸', BR: '🇧🇷', IN: '🇮🇳', JP: '🇯🇵',
  MX: '🇲🇽', SE: '🇸🇪', DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮', PL: '🇵🇱',
  BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭', IE: '🇮🇪', NZ: '🇳🇿', SG: '🇸🇬',
  KR: '🇰🇷', ZA: '🇿🇦', AE: '🇦🇪', PT: '🇵🇹',
};

function getFlag(code: string | null): string {
  if (!code) return '🌍';
  return countryFlags[code.toUpperCase()] || '🌍';
}

type NavItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  disabledLabel?: string;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    // Top-level items (no section header)
    items: [
      { id: '/dashboard/v2', icon: LayoutDashboard, label: 'Dashboard' },
      { id: '/dashboard/v2/creative-lab', icon: Wand2, label: 'Creative Lab' },
      { id: '/dashboard/v2/brand-guidelines', icon: Palette, label: 'Brand Guidelines' },
    ],
  },
  {
    label: 'Inspiration',
    items: [
      { id: '/dashboard/v2/ad-library', icon: BookOpen, label: 'Ad Library' },
      { id: '/dashboard/v2/saved', icon: Heart, label: 'Saved Ads' },
      { id: '/dashboard/v2/brands', icon: Globe, label: 'Brands' },
      { id: '/dashboard/v2/categories', icon: Layers, label: 'Categories' },
    ],
  },
  {
    // Standalone items
    items: [
      { id: '/dashboard/v2/hikaru', icon: MessageSquare, label: 'Hikaru AI' },
    ],
  },
  {
    // Disabled items
    items: [
      { id: '/dashboard/v2/downloads', icon: Download, label: 'Downloads', disabled: true, disabledLabel: '(soon)' },
    ],
  },
];

/* HIDDEN: Features removed from sidebar, preserved for future use
  { id: '/dashboard/v2/share-of-voice', icon: PieChart, label: 'Share of Voice' },
  { id: '/dashboard/v2/benchmarks', icon: Scale, label: 'Benchmarking' },
  { id: '/dashboard/v2/competitors', icon: Users, label: 'Competitors' },
*/

const SETTINGS_ITEM: NavItem = { id: '/dashboard/v2/settings', icon: Settings, label: 'Settings' };

export function V2Shell({
  children,
  title,
  insights,
}: {
  children: React.ReactNode;
  title: string;
  insights?: SidebarInsights;
}) {
  const { darkMode, setDarkMode } = useV2();
  const pathname = usePathname();

  return (
    <div className={`min-h-screen flex font-sans ${darkMode ? 'bg-[#101322] text-slate-100' : 'bg-[#f6f6f8] text-slate-900'}`}>
      {/* Sidebar */}
      <aside className={`w-64 border-r flex flex-col h-screen sticky top-0 shrink-0 ${darkMode ? 'border-[#1235e2]/20 bg-[#101322]' : 'border-slate-200 bg-[#f6f6f8]'}`}>
        <div className="p-6 shrink-0 flex items-center gap-2 mb-0">
          <div className="bg-[#1235e2] p-1.5 rounded-lg text-white">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Ad Library Pro</h1>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Analysis Tool</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <nav className="space-y-4">
            {NAV_SECTIONS.map((section, sIdx) => (
              <div key={sIdx}>
                {section.label && (
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-2 px-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {section.label}
                  </div>
                )}
                <div className={`space-y-1 ${section.label ? 'pl-2' : ''}`}>
                  {section.items.map(item => {
                    if (item.disabled) {
                      return (
                        <div
                          key={item.id}
                          title="Not available yet"
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg opacity-40 cursor-not-allowed ${
                            darkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          {item.label}
                          {item.disabledLabel && (
                            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.disabledLabel}</span>
                          )}
                        </div>
                      );
                    }
                    const active = pathname === item.id || (item.id !== '/dashboard/v2' && pathname.startsWith(item.id));
                    return (
                      <Link
                        key={item.id}
                        href={item.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          active
                            ? 'bg-[#1235e2]/10 text-[#1235e2] font-medium'
                            : darkMode
                              ? 'text-slate-400 hover:bg-[#1235e2]/5'
                              : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Settings pinned to bottom */}
        <div className={`shrink-0 border-t px-6 py-4 ${darkMode ? 'border-[#1235e2]/20' : 'border-slate-200'}`}>
          {(() => {
            const active = pathname === SETTINGS_ITEM.id || pathname.startsWith(SETTINGS_ITEM.id);
            const Icon = SETTINGS_ITEM.icon;
            return (
              <Link
                href={SETTINGS_ITEM.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-[#1235e2]/10 text-[#1235e2] font-medium'
                    : darkMode
                      ? 'text-slate-400 hover:bg-[#1235e2]/5'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {SETTINGS_ITEM.label}
              </Link>
            );
          })()}
        </div>

      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className={`h-16 border-b flex items-center justify-between px-8 sticky top-0 z-10 backdrop-blur-sm ${
          darkMode ? 'border-[#1235e2]/20 bg-[#101322]/90' : 'border-slate-200 bg-[#f6f6f8]/90'
        }`}>
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                darkMode ? 'bg-[#1235e2]/10 text-slate-400 hover:bg-[#1235e2]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              darkMode ? 'bg-[#1235e2]/10 text-slate-400' : 'bg-slate-100 text-slate-600'
            }`}>
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-10 w-10 rounded-full bg-[#1235e2]/20 border-2 border-[#1235e2] flex items-center justify-center text-sm font-bold text-[#1235e2]">
              U
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Reusable card wrapper
export function V2Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { darkMode } = useV2();
  return (
    <div className={`rounded-xl border ${darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'} ${className}`}>
      {children}
    </div>
  );
}

// Reusable section heading
export function V2SectionTitle({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        {icon}
        {children}
      </h3>
      {action}
    </div>
  );
}

// Loading skeleton
export function V2Skeleton({ rows = 3 }: { rows?: number }) {
  const { darkMode } = useV2();
  const bg = darkMode ? 'bg-slate-800' : 'bg-slate-200';
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-32 rounded-xl ${bg}`} />
      ))}
    </div>
  );
}

export function formatNumber(num: number | string | null): string {
  if (num === null || num === undefined) return '-';
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n)) return '-';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
