'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Megaphone,
  Palette,
  Settings,
  Moon,
  Sun,
  LayoutDashboard,
  Globe,
  Download,
  Heart,
  Layers,
  MessageSquare,
  Users,
  LogIn,
  LogOut,
  ChevronDown,
  Inbox,
  Database,
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
      // v1 ad library — older but more complete in places (jobs, raw search,
      // brand-detail tables). Lives outside the v2 shell; clicking this
      // navigates the user to /dashboard/ad-library and uses v1's own layout.
      { id: '/dashboard/ad-library', icon: Database, label: 'Ad Library (v1)' },
    ],
  },
  {
    label: 'Inspiration',
    items: [
      { id: '/dashboard/v2/ads', icon: Megaphone, label: 'Ads' },
      { id: '/dashboard/v2/saved', icon: Heart, label: 'Saved Ads' },
      { id: '/dashboard/v2/brands', icon: Globe, label: 'Brands' },
      { id: '/dashboard/v2/creators', icon: Users, label: 'Creators' },
      { id: '/dashboard/v2/categories', icon: Layers, label: 'Categories' },
    ],
  },
  {
    // Standalone items
    items: [
      { id: '/dashboard/v2/hikaru', icon: MessageSquare, label: 'Hikaru AI' },
      { id: '/dashboard/v2/requests', icon: Inbox, label: 'Requests' },
      { id: '/dashboard/v2/settings/brand-profiles', icon: Palette, label: 'Brand Profiles' },
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
  { id: '/dashboard/v2/creative-lab', icon: Wand2, label: 'Creative Lab' },
  { id: '/dashboard/v2/share-of-voice', icon: PieChart, label: 'Share of Voice' },
  { id: '/dashboard/v2/benchmarks', icon: Scale, label: 'Benchmarking' },
  { id: '/dashboard/v2/competitors', icon: Users, label: 'Competitors' },
*/

const SETTINGS_ITEM: NavItem = { id: '/dashboard/v2/settings', icon: Settings, label: 'Settings' };

function UserMenu({ darkMode }: { darkMode: boolean }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (status === 'loading') {
    return <div className={`h-10 w-10 rounded-full animate-pulse ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />;
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          darkMode
            ? 'bg-[#1235e2] text-white hover:bg-[#0e2bc4]'
            : 'bg-[#1235e2] text-white hover:bg-[#0e2bc4]'
        }`}
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </button>
    );
  }

  const initials = (session.user.name || session.user.email || 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
          darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-100'
        }`}
      >
        <div className="h-9 w-9 rounded-full bg-[#1235e2]/20 border-2 border-[#1235e2] flex items-center justify-center text-sm font-bold text-[#1235e2]">
          {initials}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-lg py-2 z-50 ${
          darkMode ? 'bg-[#181b2e] border-[#1235e2]/20' : 'bg-white border-slate-200'
        }`}>
          <div className={`px-4 py-2 border-b ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
            <p className={`text-sm font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
              {session.user.name || 'User'}
            </p>
            <p className={`text-xs truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {session.user.email}
            </p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut({ callbackUrl: '/dashboard/v2' }); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
              darkMode
                ? 'text-slate-300 hover:bg-[#1235e2]/10'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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
            {/* Notification bell removed — it was a non-functional placeholder
                with no onClick, no aria-label, and no tooltip (scope 2 P1).
                When we actually build notifications, bring back as a real
                <button> with aria-label="Notifications" + onClick. */}
            <UserMenu darkMode={darkMode} />
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
