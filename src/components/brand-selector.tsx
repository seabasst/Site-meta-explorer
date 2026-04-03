'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

interface BrandProfile {
  id: string;
  name: string;
  isActive: boolean;
}

interface BrandSelectorProps {
  darkMode: boolean;
  onBrandChange?: (profileId: string | null) => void;
}

export function BrandSelector({ darkMode, onBrandChange }: BrandSelectorProps) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const brandParam = searchParams.get('brand');
  const activeProfile = profiles.find((p) => p.isActive);
  const selectedProfile = brandParam
    ? profiles.find((p) => p.id === brandParam)
    : activeProfile;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/brand-profiles');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const loaded: BrandProfile[] = (data.profiles || []).map((p: BrandProfile) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
      }));
      setProfiles(loaded);

      // If ?brand= param exists and differs from active, sync
      if (brandParam && loaded.length > 0) {
        const paramProfile = loaded.find((p: BrandProfile) => p.id === brandParam);
        if (paramProfile && !paramProfile.isActive) {
          // Set this profile as active
          await fetch(`/api/brand-profiles/${paramProfile.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true }),
          });
          setProfiles((prev) =>
            prev.map((p) => ({ ...p, isActive: p.id === paramProfile.id }))
          );
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [brandParam]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProfiles();
    } else if (authStatus === 'unauthenticated') {
      setLoading(false);
    }
  }, [authStatus, loadProfiles]);

  // Select a profile
  const handleSelect = async (profile: BrandProfile) => {
    setOpen(false);
    setSwitching(profile.id);
    try {
      // Persist active state
      await fetch(`/api/brand-profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      setProfiles((prev) =>
        prev.map((p) => ({ ...p, isActive: p.id === profile.id }))
      );

      // Update URL param
      const params = new URLSearchParams(searchParams.toString());
      params.set('brand', profile.id);
      router.replace(`?${params.toString()}`, { scroll: false });

      onBrandChange?.(profile.id);
    } catch {
      // silently fail
    } finally {
      setSwitching(null);
    }
  };

  // Don't render for unauthenticated users
  if (authStatus !== 'authenticated' || (!loading && profiles.length === 0 && !session)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`h-9 w-36 rounded-lg animate-pulse ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
    );
  }

  // No profiles - show create link
  if (profiles.length === 0) {
    return (
      <Link
        href="/dashboard/v2/settings/brand-profiles"
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
          darkMode
            ? 'text-slate-400 hover:text-[#1235e2] hover:bg-[#1235e2]/10'
            : 'text-slate-500 hover:text-[#1235e2] hover:bg-[#1235e2]/5'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
        Create brand profile
      </Link>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
          darkMode
            ? 'border-[#1235e2]/20 text-slate-300 hover:border-[#1235e2]/40 hover:bg-[#1235e2]/5'
            : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
        style={{ height: '36px' }}
      >
        <span className="w-2 h-2 rounded-full bg-[#1235e2] shrink-0" />
        <span className="truncate max-w-[140px]">
          {selectedProfile?.name || 'No brand selected'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
          darkMode ? 'text-slate-500' : 'text-slate-400'
        }`} />
      </button>

      {open && (
        <div className={`absolute z-30 top-full mt-1 left-0 w-56 rounded-lg border shadow-lg py-1 ${
          darkMode ? 'bg-[#181b2e] border-[#1235e2]/20' : 'bg-white border-slate-200'
        }`}>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              disabled={switching === profile.id}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                profile.id === selectedProfile?.id
                  ? darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-[#1235e2]/5 text-[#1235e2]'
                  : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/5' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {switching === profile.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  profile.isActive ? 'bg-[#1235e2]' : darkMode ? 'bg-slate-600' : 'bg-slate-300'
                }`} />
              )}
              <span className="truncate">{profile.name}</span>
              {profile.isActive && (
                <span className={`ml-auto text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  active
                </span>
              )}
            </button>
          ))}
          <div className={`border-t mt-1 pt-1 ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
            <Link
              href="/dashboard/v2/settings/brand-profiles"
              className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                darkMode
                  ? 'text-slate-400 hover:text-[#1235e2] hover:bg-[#1235e2]/5'
                  : 'text-slate-500 hover:text-[#1235e2] hover:bg-slate-50'
              }`}
              onClick={() => setOpen(false)}
            >
              <Plus className="w-3.5 h-3.5" />
              Manage profiles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
