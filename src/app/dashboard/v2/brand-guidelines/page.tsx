'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Palette,
  Loader2,
  Upload,
  X,
  ImageIcon,
  Users,
  Megaphone,
  Save,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Schema & Types
// ---------------------------------------------------------------------------

interface BrandGuidelinesForm {
  brandVoice: string;
  missionStatement: string;
  demographics: string[];
  interests: string[];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  logoKey: string | null;
  referenceImages: { url: string; key: string; name?: string }[];
}

const DEMOGRAPHIC_OPTIONS = [
  { id: 'gen-z-18-24', label: 'Gen Z 18-24' },
  { id: 'millennials-25-40', label: 'Millennials 25-40' },
  { id: 'gen-x-41-55', label: 'Gen X 41-55' },
  { id: 'high-income', label: 'High Income' },
  { id: 'urban-dwellers', label: 'Urban Dwellers' },
] as const;

const INTEREST_OPTIONS = [
  { id: 'tech-early-adopters', label: 'Tech Early Adopters' },
  { id: 'sustainable-living', label: 'Sustainable Living' },
  { id: 'luxury-travel', label: 'Luxury Travel' },
  { id: 'remote-work', label: 'Remote Work' },
] as const;

const MAX_REFERENCE_IMAGES = 10;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TogglePill({
  label,
  selected,
  onToggle,
  darkMode,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  darkMode: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        selected
          ? 'bg-[#1235e2] text-white'
          : darkMode
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
  darkMode,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  darkMode: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <label
          className="w-10 h-10 rounded-lg border cursor-pointer overflow-hidden shrink-0"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value.length === 7 ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 w-0 h-0"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '#' || v === '') {
              onChange(v);
            }
          }}
          className={`w-24 px-2 py-1.5 rounded-lg border text-sm font-mono ${
            darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BrandGuidelinesPage() {
  const { darkMode } = useV2();
  const [loading, setLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [refUploading, setRefUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<BrandGuidelinesForm>({
    defaultValues: {
      brandVoice: '',
      missionStatement: '',
      demographics: [],
      interests: [],
      primaryColor: '#1235e2',
      secondaryColor: '#101322',
      accentColor: '#f6f6f8',
      logoUrl: null,
      logoKey: null,
      referenceImages: [],
    },
  });

  const brandVoice = watch('brandVoice');
  const missionStatement = watch('missionStatement');
  const demographics = watch('demographics');
  const interests = watch('interests');
  const logoUrl = watch('logoUrl');
  const referenceImages = watch('referenceImages');
  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');
  const accentColor = watch('accentColor');

  // Load existing guidelines
  const loadGuidelines = useCallback(async () => {
    try {
      const res = await fetch('/api/brand-guidelines');
      if (res.status === 401) {
        // Not signed in — show empty form, save will prompt
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.guidelines) {
        const g = data.guidelines;
        reset({
          brandVoice: g.brandVoice || '',
          missionStatement: g.missionStatement || '',
          demographics: g.demographics || [],
          interests: g.interests || [],
          primaryColor: g.primaryColor || '#1235e2',
          secondaryColor: g.secondaryColor || '#101322',
          accentColor: g.accentColor || '#f6f6f8',
          logoUrl: g.logoUrl || null,
          logoKey: g.logoKey || null,
          referenceImages: g.referenceImages || [],
        });
      }
    } catch {
      toast.error('Failed to load brand guidelines');
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    loadGuidelines();
  }, [loadGuidelines]);

  // Save handler
  const onSubmit = async (data: BrandGuidelinesForm) => {
    try {
      const res = await fetch('/api/brand-guidelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          referenceImages: data.referenceImages.length > 0 ? data.referenceImages : null,
        }),
      });
      if (res.status === 401) {
        toast.error('Sign in first to save your brand guidelines');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      toast.success('Brand guidelines saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  // Logo upload
  const handleLogoUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error('File too large. Maximum 4MB.');
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'logo');
      const res = await fetch('/api/brand-guidelines/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const { url, key } = await res.json();
      setValue('logoUrl', url, { shouldDirty: true });
      setValue('logoKey', key, { shouldDirty: true });
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  // Reference image upload
  const handleRefUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error('File too large. Maximum 4MB.');
      return;
    }
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
      toast.error(`Maximum ${MAX_REFERENCE_IMAGES} reference images`);
      return;
    }
    setRefUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'reference');
      const res = await fetch('/api/brand-guidelines/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const { url, key } = await res.json();
      setValue('referenceImages', [...referenceImages, { url, key, name: file.name }], { shouldDirty: true });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reference image upload failed');
    } finally {
      setRefUploading(false);
    }
  };

  // Remove reference image
  const removeRefImage = (index: number) => {
    const updated = referenceImages.filter((_, i) => i !== index);
    setValue('referenceImages', updated, { shouldDirty: true });
  };

  // Toggle arrays
  const toggleArrayItem = (field: 'demographics' | 'interests', id: string) => {
    const current = field === 'demographics' ? demographics : interests;
    const updated = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setValue(field, updated, { shouldDirty: true });
  };

  // Loading state
  if (loading) {
    return (
      <V2Shell title="Brand Guidelines">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1235e2]" />
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell title="Brand Guidelines">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
        {/* ---- Brand Voice & Mission ---- */}
        <V2Card className="p-6">
          <V2SectionTitle icon={<Megaphone className="w-5 h-5 text-[#1235e2]" />}>
            Brand Voice &amp; Mission
          </V2SectionTitle>

          <div className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Brand Voice &amp; Personality
              </label>
              <textarea
                {...register('brandVoice')}
                maxLength={2000}
                rows={4}
                placeholder="Describe your brand's tone of voice, personality traits, and communication style..."
                className={`w-full rounded-lg border px-4 py-3 text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <p className={`text-xs mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {(brandVoice || '').length}/2000
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Mission Statement
              </label>
              <textarea
                {...register('missionStatement')}
                maxLength={1000}
                rows={3}
                placeholder="What is your brand's mission or purpose?"
                className={`w-full rounded-lg border px-4 py-3 text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <p className={`text-xs mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {(missionStatement || '').length}/1000
              </p>
            </div>
          </div>
        </V2Card>

        {/* ---- Target Audience ---- */}
        <V2Card className="p-6">
          <V2SectionTitle icon={<Users className="w-5 h-5 text-[#1235e2]" />}>
            Target Audience
          </V2SectionTitle>

          <div className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Demographics
              </label>
              <div className="flex flex-wrap gap-2">
                {DEMOGRAPHIC_OPTIONS.map((opt) => (
                  <TogglePill
                    key={opt.id}
                    label={opt.label}
                    selected={demographics.includes(opt.id)}
                    onToggle={() => toggleArrayItem('demographics', opt.id)}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => (
                  <TogglePill
                    key={opt.id}
                    label={opt.label}
                    selected={interests.includes(opt.id)}
                    onToggle={() => toggleArrayItem('interests', opt.id)}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>
          </div>
        </V2Card>

        {/* ---- Visual Identity ---- */}
        <V2Card className="p-6">
          <V2SectionTitle icon={<Palette className="w-5 h-5 text-[#1235e2]" />}>
            Visual Identity
          </V2SectionTitle>

          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Logo
              </label>
              {logoUrl ? (
                <div className="flex items-start gap-4">
                  <div className={`w-24 h-24 rounded-xl border overflow-hidden flex items-center justify-center ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <img src={logoUrl} alt="Brand logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('logoUrl', null, { shouldDirty: true });
                      setValue('logoKey', null, { shouldDirty: true });
                    }}
                    className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      darkMode
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-red-500 hover:bg-red-50'
                    }`}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className={`w-full max-w-xs border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 transition-colors ${
                    darkMode
                      ? 'border-slate-700 hover:border-[#1235e2]/40 text-slate-400'
                      : 'border-slate-300 hover:border-[#1235e2]/40 text-slate-500'
                  } ${logoUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {logoUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-[#1235e2]" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                  <span className="text-sm font-medium">
                    {logoUploading ? 'Uploading...' : 'Click to upload logo'}
                  </span>
                  <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    PNG, JPG, WebP, SVG. Max 4MB.
                  </span>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Color Swatches */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Brand Colors
              </label>
              <div className="flex flex-wrap gap-6">
                <Controller
                  name="primaryColor"
                  control={control}
                  render={({ field }) => (
                    <ColorSwatch
                      label="Primary"
                      value={field.value}
                      onChange={field.onChange}
                      darkMode={darkMode}
                    />
                  )}
                />
                <Controller
                  name="secondaryColor"
                  control={control}
                  render={({ field }) => (
                    <ColorSwatch
                      label="Secondary"
                      value={field.value}
                      onChange={field.onChange}
                      darkMode={darkMode}
                    />
                  )}
                />
                <Controller
                  name="accentColor"
                  control={control}
                  render={({ field }) => (
                    <ColorSwatch
                      label="Accent"
                      value={field.value}
                      onChange={field.onChange}
                      darkMode={darkMode}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </V2Card>

        {/* ---- Reference Images ---- */}
        <V2Card className="p-6">
          <V2SectionTitle icon={<ImageIcon className="w-5 h-5 text-[#1235e2]" />}>
            Reference Images
          </V2SectionTitle>

          <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Reference images serve as your visual mood board. They are not used directly in AI generation.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {referenceImages.map((img, idx) => (
              <div key={img.key} className="relative group">
                <div className={`aspect-square rounded-xl border overflow-hidden ${
                  darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                }`}>
                  <img
                    src={img.url}
                    alt={img.name || `Reference ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRefImage(idx)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {referenceImages.length < MAX_REFERENCE_IMAGES && (
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                disabled={refUploading}
                className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                  darkMode
                    ? 'border-slate-700 hover:border-[#1235e2]/40 text-slate-500'
                    : 'border-slate-300 hover:border-[#1235e2]/40 text-slate-400'
                } ${refUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {refUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#1235e2]" />
                ) : (
                  <>
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-medium">Add</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {referenceImages.length}/{MAX_REFERENCE_IMAGES} used
          </p>

          <input
            ref={refInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRefUpload(file);
              e.target.value = '';
            }}
          />
        </V2Card>

        {/* ---- Save Button ---- */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              isSubmitting
                ? 'bg-[#1235e2]/60 text-white/70 cursor-not-allowed'
                : 'bg-[#1235e2] text-white hover:bg-[#0e2bc4] active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? 'Saving...' : 'Save Guidelines'}
          </button>
        </div>
      </form>
    </V2Shell>
  );
}
