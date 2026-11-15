'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  User,
  Palette,
  Database,
  LogOut,
  Sun,
  Moon,
  AlertTriangle,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewStats {
  totalBrands: number;
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { darkMode, setDarkMode } = useV2();
  const { data: session } = useSession();

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const statsRes = await fetch('/api/dashboard/overview');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch {
        // silently fail - page still usable without this data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);


  if (loading) {
    return (
      <V2Shell title="Settings">
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  return (
    <V2Shell title="Settings">
      <div className="max-w-3xl space-y-8">

        {/* ---- Profile ---- */}
        <section>
          <V2SectionTitle icon={<User className="w-5 h-5 text-[#1235e2]" />}>
            Profile
          </V2SectionTitle>

          <V2Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Name
                </label>
                <div className={`px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                  {session?.user?.name || 'Not set'}
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Email
                </label>
                <div className={`px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                  {session?.user?.email || 'Not set'}
                </div>
              </div>
            </div>
          </V2Card>
        </section>


        {/* ---- Appearance ---- */}
        <section>
          <V2SectionTitle icon={<Palette className="w-5 h-5 text-[#1235e2]" />}>
            Appearance
          </V2SectionTitle>

          <V2Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Theme</p>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Switch between dark and light mode
                </p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-9 w-[4.5rem] items-center rounded-full transition-colors ${
                  darkMode ? 'bg-[#1235e2]' : 'bg-slate-300'
                }`}
              >
                <span className="sr-only">Toggle theme</span>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow transition-transform ${
                    darkMode ? 'translate-x-9' : 'translate-x-1'
                  }`}
                >
                  {darkMode ? <Moon className="w-4 h-4 text-[#1235e2]" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </span>
              </button>
            </div>
          </V2Card>
        </section>

        {/* ---- Data / Usage ---- */}
        <section>
          <V2SectionTitle icon={<Database className="w-5 h-5 text-[#1235e2]" />}>
            Data &amp; Usage
          </V2SectionTitle>

          <V2Card className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Brands tracked', value: stats?.totalBrands },
                { label: 'Total snapshots', value: stats?.totalAds },
                { label: 'Active ads', value: stats?.activeAds },
                { label: 'Inactive ads', value: stats?.inactiveAds },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-2xl font-bold text-[#1235e2]">
                    {formatNumber(item.value ?? null)}
                  </p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </V2Card>
        </section>

        {/* ---- Danger Zone ---- */}
        <section>
          <V2SectionTitle icon={<AlertTriangle className="w-5 h-5 text-red-500" />}>
            Danger Zone
          </V2SectionTitle>

          <V2Card className="p-6 border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Sign out</p>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  End your current session
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </V2Card>
        </section>
      </div>
    </V2Shell>
  );
}
