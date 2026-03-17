'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, Trash2, ChevronDown, X } from 'lucide-react';
import { useV2 } from '@/app/dashboard/v2/v2-context';
import { useDashboardConfig } from '@/hooks/use-dashboard-config';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) return date.toLocaleDateString();
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

const MAX_CONFIGS = 10;

export function ConfigManager() {
  const { darkMode } = useV2();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    configs,
    isLoaded,
    saveConfig,
    deleteConfig,
    activeConfigId,
    setActiveConfigId,
  } = useDashboardConfig();

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const atLimit = configs.length >= MAX_CONFIGS;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus save input when it appears
  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveInput]);

  function handleSave() {
    if (!saveName.trim()) return;

    const currentFilters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      currentFilters[key] = value;
    });

    const success = saveConfig(saveName, currentFilters);
    if (success) {
      setSaveName('');
      setShowSaveInput(false);
    }
  }

  function handleLoad(id: string) {
    const config = configs.find((c) => c.id === id);
    if (!config) return;

    const params = new URLSearchParams();
    Object.entries(config.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    router.replace(`?${params.toString()}`);
    setActiveConfigId(id);
    setShowDropdown(false);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteConfig(id);
  }

  function handleDeactivate() {
    setActiveConfigId(null);
  }

  if (!isLoaded) return null;

  const activeConfig = configs.find((c) => c.id === activeConfigId);

  const btnBase = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors`;

  return (
    <div className="flex items-center gap-2">
      {/* Active config badge */}
      {activeConfig && (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            darkMode
              ? 'bg-[#1235e2]/20 text-[#6b8cff] border border-[#1235e2]/30'
              : 'bg-[#1235e2]/10 text-[#1235e2] border border-[#1235e2]/20'
          }`}
        >
          {activeConfig.name}
          <button
            onClick={handleDeactivate}
            className="hover:opacity-70 transition-opacity"
            title="Deactivate saved view"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Save View button / inline form */}
      {showSaveInput ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={saveInputRef}
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setShowSaveInput(false);
                setSaveName('');
              }
            }}
            placeholder="View name..."
            maxLength={40}
            className={`px-2.5 py-1.5 rounded-lg text-sm border transition-colors w-40 ${
              darkMode
                ? 'bg-[#1235e2]/5 border-[#1235e2]/20 text-slate-200 placeholder-slate-500 focus:border-[#1235e2]/50'
                : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:border-[#1235e2]/50'
            } outline-none`}
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            className={`${btnBase} ${
              saveName.trim()
                ? 'bg-[#1235e2] text-white hover:bg-[#1235e2]/90'
                : darkMode
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Save
          </button>
          <button
            onClick={() => {
              setShowSaveInput(false);
              setSaveName('');
            }}
            className={`${btnBase} ${
              darkMode
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => !atLimit && setShowSaveInput(true)}
          disabled={atLimit}
          title={atLimit ? 'Maximum 10 saved views' : 'Save current filters as a view'}
          className={`${btnBase} ${
            atLimit
              ? darkMode
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : darkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-[#1235e2]/10'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          Save View
        </button>
      )}

      {/* Saved Views dropdown */}
      {configs.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`${btnBase} ${
              darkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-[#1235e2]/10'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>Saved Views</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showDropdown && (
            <div
              className={`absolute top-full right-0 mt-1 w-64 rounded-xl border shadow-lg z-50 overflow-hidden ${
                darkMode
                  ? 'bg-[#101322] border-[#1235e2]/20'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="py-1">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    onClick={() => handleLoad(config.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                      activeConfigId === config.id
                        ? darkMode
                          ? 'bg-[#1235e2]/10'
                          : 'bg-[#1235e2]/5'
                        : darkMode
                          ? 'hover:bg-[#1235e2]/5'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium truncate ${
                          darkMode ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        {config.name}
                      </div>
                      <div
                        className={`text-xs ${
                          darkMode ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {formatRelativeDate(config.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, config.id)}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                        darkMode
                          ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10'
                          : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Delete saved view"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
