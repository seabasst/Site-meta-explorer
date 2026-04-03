'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Trash2,
  Star,
  StarOff,
  Palette,
} from 'lucide-react';
import { V2Shell, V2Card } from '../../v2-shell';
import { useV2 } from '../../v2-context';
import { BrandProfileForm } from './brand-profile-form';
import type { BrandProfileFull } from '@/lib/brand-profile-types';

export default function BrandProfilesPage() {
  const { darkMode } = useV2();
  const [profiles, setProfiles] = useState<BrandProfileFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const selectedProfile = profiles.find((p) => p.id === selectedId) || null;

  // Load profiles
  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/brand-profiles');
      if (res.status === 401) {
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load profiles');
      const data = await res.json();
      setProfiles(data.profiles || []);
      // Auto-select first profile if none selected
      if (!selectedId && data.profiles?.length > 0) {
        setSelectedId(data.profiles[0].id);
      }
    } catch {
      toast.error('Failed to load brand profiles');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Create profile
  const handleCreate = async () => {
    if (!newName.trim() || newName.trim().length < 3) {
      toast.error('Name must be at least 3 characters');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.status === 401) {
        toast.error('Sign in to create a brand profile');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create profile');
      }
      const data = await res.json();
      setProfiles((prev) => [data.profile, ...prev]);
      setSelectedId(data.profile.id);
      setNewName('');
      toast.success('Profile created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  };

  // Delete profile
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand profile? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/brand-profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        const remaining = profiles.filter((p) => p.id !== id);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success('Profile deleted');
      // Reload to get updated active status
      loadProfiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  // Set as active
  const handleSetActive = async (id: string) => {
    setActivating(id);
    try {
      const res = await fetch(`/api/brand-profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to activate');
      }
      // Update local state: deactivate all, activate selected
      setProfiles((prev) =>
        prev.map((p) => ({ ...p, isActive: p.id === id }))
      );
      toast.success('Profile set as active');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setActivating(null);
    }
  };

  // Handle profile update from form
  const handleProfileUpdate = (updated: BrandProfileFull) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  if (loading) {
    return (
      <V2Shell title="Brand Profiles">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1235e2]" />
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell title="Brand Profiles">
      <div className="flex gap-6 h-[calc(100vh-10rem)]">
        {/* Left sidebar - profile list */}
        <div className="w-72 shrink-0 flex flex-col">
          {/* Create new */}
          <V2Card className="p-3 mb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="New profile name..."
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className={`p-2 rounded-lg transition-colors ${
                  creating || !newName.trim()
                    ? 'opacity-50 cursor-not-allowed'
                    : 'bg-[#1235e2] text-white hover:bg-[#0e2bc4]'
                }`}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
          </V2Card>

          {/* Profile list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {profiles.length === 0 ? (
              <div className={`text-center py-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Palette className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No profiles yet</p>
                <p className="text-xs mt-1">Create your first brand profile above</p>
              </div>
            ) : (
              profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`group rounded-lg border transition-colors cursor-pointer ${
                    selectedId === profile.id
                      ? darkMode
                        ? 'border-[#1235e2]/40 bg-[#1235e2]/10'
                        : 'border-[#1235e2]/40 bg-[#1235e2]/5'
                      : darkMode
                        ? 'border-[#1235e2]/10 bg-[#1235e2]/5 hover:border-[#1235e2]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium flex-1 truncate ${
                        selectedId === profile.id
                          ? 'text-[#1235e2]'
                          : darkMode ? 'text-slate-200' : 'text-slate-900'
                      }`}>
                        {profile.name}
                      </p>
                      {profile.isActive && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[#1235e2]/20 text-[#1235e2] font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    {/* Action buttons - visible on hover */}
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!profile.isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(profile.id);
                          }}
                          disabled={activating === profile.id}
                          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                            darkMode
                              ? 'text-slate-400 hover:text-[#1235e2] hover:bg-[#1235e2]/10'
                              : 'text-slate-500 hover:text-[#1235e2] hover:bg-[#1235e2]/5'
                          }`}
                        >
                          {activating === profile.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Star className="w-3 h-3" />
                          )}
                          Set active
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(profile.id);
                        }}
                        disabled={deleting === profile.id}
                        className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                          darkMode
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {deleting === profile.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right side - edit form */}
        <div className="flex-1 min-w-0">
          <V2Card className="p-6 h-full overflow-y-auto">
            {selectedProfile ? (
              <BrandProfileForm
                profile={selectedProfile}
                onUpdate={handleProfileUpdate}
                darkMode={darkMode}
              />
            ) : (
              <div className={`flex flex-col items-center justify-center h-full ${
                darkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <Palette className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">
                  {profiles.length === 0
                    ? 'Create a profile to get started'
                    : 'Select a profile to edit'}
                </p>
              </div>
            )}
          </V2Card>
        </div>
      </div>
    </V2Shell>
  );
}
