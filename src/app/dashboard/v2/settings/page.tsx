'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  User,
  CreditCard,
  Palette,
  Database,
  LogOut,
  Check,
  X,
  Sun,
  Moon,
  Crown,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionStatus {
  tier: string;
  status: string;
  features: string[];
  limits: Record<string, number | string>;
}

interface OverviewStats {
  totalBrands: number;
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
}

// ---------------------------------------------------------------------------
// Feature comparison data
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  'Real-time ad lookup',
  'Basic demographics',
  'Limited searches',
];

const PRO_FEATURES = [
  'Full database access',
  'Historical trends',
  'Competitor tracking',
  'Benchmarking',
  'CSV/JSON exports',
  'Stored media',
  'Unlimited searches',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { darkMode, setDarkMode } = useV2();
  const { data: session } = useSession();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [subRes, statsRes] = await Promise.all([
          fetch('/api/subscription/status'),
          fetch('/api/dashboard/overview'),
        ]);
        if (subRes.ok) {
          setSubscription(await subRes.json());
        }
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

  const isPro = subscription?.tier === 'pro';
  const statusColor = (() => {
    switch (subscription?.status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'past_due':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return darkMode
          ? 'bg-slate-700/50 text-slate-300 border-slate-600'
          : 'bg-slate-100 text-slate-600 border-slate-300';
    }
  })();

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

        {/* ---- Subscription ---- */}
        <section>
          <V2SectionTitle icon={<CreditCard className="w-5 h-5 text-[#1235e2]" />}>
            Subscription
          </V2SectionTitle>

          <V2Card className="p-6 space-y-6">
            {/* Current plan + status */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {isPro && <Crown className="w-5 h-5 text-[#1235e2]" />}
                <div>
                  <p className="font-semibold text-lg">
                    {isPro ? 'Pro' : 'Free'}{' '}
                    {isPro && <span className={`text-sm font-normal ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>$29/month</span>}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize ${statusColor}`}>
                  {subscription?.status || 'free'}
                </span>
              </div>

              {isPro ? (
                <form action="/app/actions/stripe" method="POST">
                  <input type="hidden" name="action" value="create-portal" />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
                  >
                    Manage Subscription <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors`}
                  onClick={() => {
                    // placeholder - would link to /api/actions/stripe checkout
                  }}
                >
                  Upgrade to Pro <Crown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Feature comparison */}
            <div className={`border-t pt-6 ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'}`}>
              <p className={`text-sm font-semibold mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Plan comparison
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Free column */}
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Free
                  </p>
                  <ul className="space-y-2">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <X className="w-4 h-4 shrink-0 opacity-40" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pro column */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-[#1235e2]">
                    Pro - $29/mo
                  </p>
                  <ul className="space-y-2">
                    {[...FREE_FEATURES, ...PRO_FEATURES].map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <Check className="w-4 h-4 text-[#1235e2] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
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
