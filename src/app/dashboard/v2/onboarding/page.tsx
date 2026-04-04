'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ChevronLeft, ChevronRight, Check, Sparkles, FileText, MessageSquare } from 'lucide-react';
import { V2Shell } from '../v2-shell';
import { useV2 } from '../v2-context';
import {
  StepBasics,
  StepVoice,
  StepAudience,
  StepCompetitors,
  StepVisual,
} from './wizard-steps';
import type { WizardData } from './wizard-steps';
import { InterviewChat } from './interview-chat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'brand-profile-wizard-draft';
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const STEPS = [
  { id: 'basics', label: 'Brand Basics' },
  { id: 'voice', label: 'Voice & Tone' },
  { id: 'audience', label: 'Audience' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'visual', label: 'Visual Identity' },
] as const;

const INITIAL_DATA: WizardData = {
  name: '',
  websiteUrl: '',
  brandVoice: '',
  positioning: '',
  demographics: '',
  interests: '',
  painPoints: '',
  competitors: [],
  primaryColor: '',
  secondaryColor: '',
  accentColor: '',
  logoUrl: '',
};

// ---------------------------------------------------------------------------
// Draft helpers
// ---------------------------------------------------------------------------

function loadDraft(): WizardData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed.data as WizardData;
  } catch {
    return null;
  }
}

function saveDraft(data: WizardData) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ data, savedAt: Date.now() })
    );
  } catch {
    // localStorage full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Wrapper (Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

export default function OnboardingPageWrapper() {
  return (
    <Suspense>
      <OnboardingPage />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

function OnboardingPage() {
  const { darkMode } = useV2();
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState<'wizard' | 'interview'>(
    modeParam === 'interview' ? 'interview' : 'wizard'
  );

  const stepParam = parseInt(searchParams.get('step') || '1', 10);
  const currentStep = Math.max(1, Math.min(stepParam, STEPS.length));

  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const draftLoaded = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load draft on mount
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    const draft = loadDraft();
    if (draft) {
      setData(draft);
    }
  }, []);

  // Auto-save draft (debounced 500ms)
  const debouncedSave = useCallback((wizardData: WizardData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveDraft(wizardData), 500);
  }, []);

  function handleChange(updates: Partial<WizardData>) {
    setData((prev) => {
      const next = { ...prev, ...updates };
      debouncedSave(next);
      return next;
    });
  }

  // Navigation
  function goToStep(step: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(step));
    router.replace(`/dashboard/v2/onboarding?${params.toString()}`, {
      scroll: false,
    });
  }

  function handleBack() {
    if (currentStep > 1) goToStep(currentStep - 1);
  }

  function handleNext() {
    if (currentStep < STEPS.length) {
      goToStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  }

  // Submit
  async function handleSubmit() {
    if (!data.name.trim()) {
      setSubmitError('Brand name is required.');
      goToStep(1);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // Build payload -- split comma-separated strings into arrays
    const payload: Record<string, unknown> = {
      name: data.name.trim(),
    };

    if (data.brandVoice.trim()) payload.brandVoice = data.brandVoice.trim();
    if (data.positioning.trim()) payload.positioning = data.positioning.trim();

    const demographics = data.demographics
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (demographics.length > 0) payload.demographics = demographics;

    const interests = data.interests
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (interests.length > 0) payload.interests = interests;

    const painPoints = data.painPoints
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (painPoints.length > 0) payload.painPoints = painPoints;

    if (data.primaryColor.match(/^#[0-9a-fA-F]{6}$/))
      payload.primaryColor = data.primaryColor;
    if (data.secondaryColor.match(/^#[0-9a-fA-F]{6}$/))
      payload.secondaryColor = data.secondaryColor;
    if (data.accentColor.match(/^#[0-9a-fA-F]{6}$/))
      payload.accentColor = data.accentColor;

    if (data.logoUrl.trim()) payload.logoUrl = data.logoUrl.trim();

    try {
      const res = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.details?.fieldErrors
            ? Object.values(err.details.fieldErrors).flat().join(', ')
            : err.error || 'Failed to create profile'
        );
      }

      const result = await res.json();
      const profileId = result.profile?.id;

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);

      // Link competitors if any were selected
      if (data.competitors.length > 0 && profileId) {
        await Promise.allSettled(
          data.competitors.map((comp) =>
            fetch(`/api/brand-profiles/${profileId}/competitors`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adLibraryBrandId: comp.adLibraryBrandId }),
            })
          )
        );
      }

      // Redirect to Hikaru with new brand selected
      router.push(
        profileId
          ? `/dashboard/v2/hikaru?brand=${profileId}`
          : '/dashboard/v2/hikaru'
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong'
      );
      setSubmitting(false);
    }
  }

  const isLastStep = currentStep === STEPS.length;
  const canProceed = currentStep === 1 ? data.name.trim().length >= 3 : true;

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  function handleInterviewComplete(profileId: string) {
    router.push(`/dashboard/v2/hikaru?brand=${profileId}`);
  }

  function selectMode(m: 'wizard' | 'interview') {
    setMode(m);
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', m);
    if (m === 'interview') params.delete('step');
    router.replace(`/dashboard/v2/onboarding?${params.toString()}`, { scroll: false });
  }

  return (
    <V2Shell title="Set up your brand">
      <div className="max-w-2xl mx-auto pt-4">
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            {
              id: 'wizard' as const,
              icon: FileText,
              label: 'Step-by-step wizard',
              desc: 'Fill in your brand details one step at a time',
            },
            {
              id: 'interview' as const,
              icon: MessageSquare,
              label: 'AI interview',
              desc: 'Tell us about your brand in a conversation',
            },
          ].map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => selectMode(id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                mode === id
                  ? 'border-[#1235e2] bg-[#1235e2]/5 ring-1 ring-[#1235e2]/20'
                  : darkMode
                    ? 'border-slate-700 hover:border-slate-600 bg-transparent'
                    : 'border-slate-200 hover:border-slate-300 bg-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  mode === id
                    ? 'text-[#1235e2]'
                    : darkMode
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  mode === id
                    ? 'text-[#1235e2]'
                    : darkMode
                      ? 'text-slate-300'
                      : 'text-slate-700'
                }`}
              >
                {label}
              </span>
              <span
                className={`text-xs ${
                  mode === id
                    ? darkMode
                      ? 'text-[#1235e2]/70'
                      : 'text-[#1235e2]/60'
                    : muted
                }`}
              >
                {desc}
              </span>
            </button>
          ))}
        </div>

        {/* Interview mode */}
        {mode === 'interview' && (
          <>
            <InterviewChat darkMode={darkMode} onComplete={handleInterviewComplete} />
            {/* Skip link */}
            <div className="text-center mt-6 mb-4">
              <button
                onClick={() => router.push('/dashboard/v2/hikaru')}
                className={`text-xs ${muted} hover:underline`}
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        {/* Wizard mode */}
        {mode === 'wizard' && (
          <>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-1 mb-10">
              {STEPS.map((step, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => goToStep(stepNum)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#1235e2] text-white'
                          : isCompleted
                            ? darkMode
                              ? 'bg-[#1235e2]/20 text-[#1235e2]'
                              : 'bg-[#1235e2]/10 text-[#1235e2]'
                            : darkMode
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <span>{stepNum}</span>
                      )}
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`w-6 h-px mx-1 ${
                          isCompleted
                            ? 'bg-[#1235e2]/40'
                            : darkMode
                              ? 'bg-slate-800'
                              : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step title */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-[#1235e2]" />
              </div>
              <h2 className="text-xl font-bold mb-1">
                {STEPS[currentStep - 1].label}
              </h2>
              <p className={`text-sm ${muted}`}>
                {currentStep === 1 && 'Start with the basics about your brand.'}
                {currentStep === 2 &&
                  'Define how your brand communicates and positions itself.'}
                {currentStep === 3 && 'Tell us about the people you want to reach.'}
                {currentStep === 4 &&
                  'Add brands you compete with for better benchmarking.'}
                {currentStep === 5 &&
                  'Add your brand colors and logo for visual consistency.'}
              </p>
            </div>

            {/* Step content */}
            <div
              className={`rounded-xl border p-6 mb-6 ${
                darkMode
                  ? 'bg-[#1235e2]/5 border-[#1235e2]/10'
                  : 'bg-white border-slate-200'
              }`}
            >
              {currentStep === 1 && (
                <StepBasics data={data} onChange={handleChange} darkMode={darkMode} />
              )}
              {currentStep === 2 && (
                <StepVoice data={data} onChange={handleChange} darkMode={darkMode} />
              )}
              {currentStep === 3 && (
                <StepAudience
                  data={data}
                  onChange={handleChange}
                  darkMode={darkMode}
                />
              )}
              {currentStep === 4 && (
                <StepCompetitors
                  data={data}
                  onChange={handleChange}
                  darkMode={darkMode}
                />
              )}
              {currentStep === 5 && (
                <StepVisual data={data} onChange={handleChange} darkMode={darkMode} />
              )}
            </div>

            {/* Error */}
            {submitError && (
              <div
                className={`rounded-lg border px-4 py-3 mb-4 text-sm ${
                  darkMode
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}
              >
                {submitError}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === 1
                    ? 'opacity-0 pointer-events-none'
                    : darkMode
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceed || submitting}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  canProceed && !submitting
                    ? 'bg-[#1235e2] text-white hover:bg-[#0f2dc4]'
                    : 'bg-[#1235e2]/40 text-white/60 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : isLastStep ? (
                  <>
                    Create Profile
                    <Check className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Skip link */}
            <div className="text-center mt-6 mb-4">
              <button
                onClick={() => router.push('/dashboard/v2/hikaru')}
                className={`text-xs ${muted} hover:underline`}
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </V2Shell>
  );
}
