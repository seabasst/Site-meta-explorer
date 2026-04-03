# Phase 69: Context Injection & Onboarding - Research

**Researched:** 2026-04-03
**Domain:** LLM system prompt engineering, multi-step form UX, conversational data extraction
**Confidence:** HIGH

## Summary

Phase 69 connects the BrandProfile model (Phase 68) to all AI-powered features -- Hikaru chat and Creative Lab flows. The core technical challenge is building a "context compiler" that serializes relevant BrandProfile fields into XML-tagged system prompt sections under ~2K tokens. The secondary challenge is creating two onboarding paths (wizard + AI interview) that feed into the same BrandProfile model.

The codebase is well-prepared for this phase. The Hikaru route already accepts `brandProfileId` from the frontend (line 619 of hikaru page.tsx), but the backend ignores it. The Creative Lab routes still read from the old `BrandGuidelines` model and need migration to `BrandProfile`. Both the brand-selector component and the BrandProfile CRUD API are fully functional.

**Primary recommendation:** Build a single `compileBrandContext(profile, queryHint?)` utility function in `src/lib/brand-context.ts` that both Hikaru and Creative Lab import. Use XML tags for structured injection. Use character-based budgeting (8000 chars ~ 2K tokens) rather than adding a tokenizer dependency.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anthropic SDK | (already in project) | System prompt injection for Hikaru | Already used in route.ts |
| Prisma Client | (already in project) | Fetch BrandProfile by ID | Already used everywhere |
| Zod | (already in project) | Validate wizard form data | Already used in API routes |
| React 19 + Next.js 16 | (already in project) | Wizard UI, state management | Project stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage (Web API) | N/A | Auto-save wizard drafts | Persist incomplete wizard across sessions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chars/4 heuristic for tokens | tiktoken/js-tiktoken | Adds 2MB+ bundle; overkill for a budget heuristic where exact count is unnecessary |
| localStorage drafts | Save partial profile to DB | DB approach is cleaner but adds complexity for "untitled" profiles; localStorage is simpler and sufficient for drafts |
| Separate AI interview endpoint | Special mode in Hikaru | Separate endpoint is cleaner -- different system prompt, different tool set, different output handling |

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    brand-context.ts         # compileBrandContext() - THE core utility
  app/
    api/
      chat/hikaru/route.ts          # Modified: fetch profile, inject context
      brand-profiles/
        interview/route.ts           # NEW: AI interview endpoint
    dashboard/v2/
      onboarding/
        page.tsx                     # NEW: Wizard + interview mode selector
        wizard-steps.tsx             # NEW: Multi-step form component
        interview-chat.tsx           # NEW: Conversational profile builder
      creative-lab/
        page.tsx                     # Modified: show onboarding prompt
      hikaru/
        page.tsx                     # Modified: show onboarding prompt
  components/
    onboarding-prompt.tsx            # NEW: Dismissible "set up your brand" banner
```

### Pattern 1: Context Compiler (Token-Budgeted XML Injection)

**What:** A pure function that takes a BrandProfileFull and returns an XML-tagged string under the token budget. Fields are prioritized by relevance, with variable-length arrays truncated as needed.

**When to use:** Every AI call that needs brand context.

**Example:**
```typescript
// src/lib/brand-context.ts

import type { BrandProfileFull } from './brand-profile-types';

const MAX_CHARS = 7500; // ~1875 tokens, leaves buffer under 2K

interface CompileOptions {
  /** Hint about query type to prioritize relevant fields */
  queryHint?: 'creative' | 'strategy' | 'analysis' | 'general';
  /** Override max chars */
  maxChars?: number;
}

/**
 * Compile a BrandProfile into XML-tagged system prompt context.
 *
 * Priority order (highest first):
 * 1. Brand name + positioning (always included)
 * 2. Brand voice (critical for tone)
 * 3. Audience: demographics, interests, pain points
 * 4. Mission statement
 * 5. Visual identity: colors
 * 6. Competitors (names only)
 *
 * Variable-length arrays (painPoints, demographics, interests) are
 * truncated to fit budget. Visual fields (logoUrl, referenceImages)
 * are excluded from text context -- they flow separately.
 */
export function compileBrandContext(
  profile: BrandProfileFull,
  options: CompileOptions = {}
): string {
  const { maxChars = MAX_CHARS } = options;
  const sections: string[] = [];
  let charCount = 0;

  function addSection(tag: string, content: string): boolean {
    const xml = `<${tag}>${content}</${tag}>`;
    if (charCount + xml.length > maxChars) return false;
    sections.push(xml);
    charCount += xml.length;
    return true;
  }

  // Always included
  addSection('brand_name', profile.name);

  if (profile.positioning) {
    addSection('positioning', profile.positioning);
  }

  if (profile.brandVoice) {
    addSection('brand_voice', profile.brandVoice.slice(0, 1500));
  }

  if (profile.demographics.length > 0) {
    addSection('target_demographics', profile.demographics.join(', '));
  }

  if (profile.interests.length > 0) {
    addSection('audience_interests', profile.interests.join(', '));
  }

  if (profile.painPoints.length > 0) {
    addSection('customer_pain_points', profile.painPoints.join('; '));
  }

  if (profile.missionStatement) {
    addSection('mission', profile.missionStatement);
  }

  const colors = [
    profile.primaryColor && `primary: ${profile.primaryColor}`,
    profile.secondaryColor && `secondary: ${profile.secondaryColor}`,
    profile.accentColor && `accent: ${profile.accentColor}`,
  ].filter(Boolean);
  if (colors.length > 0) {
    addSection('brand_colors', colors.join(', '));
  }

  if (profile.competitors.length > 0) {
    const competitorNames = profile.competitors
      .map((c) => c.adLibraryBrand.pageName)
      .slice(0, 5);
    addSection('competitors', competitorNames.join(', '));
  }

  if (sections.length === 0) return '';

  return `\n\n<brand_context>\n${sections.join('\n')}\n</brand_context>`;
}
```

### Pattern 2: System Prompt Injection in Hikaru

**What:** Append compiled brand context to the existing HIKARU_SYSTEM_PROMPT before the API call.

**Example:**
```typescript
// In hikaru/route.ts POST handler:

// Fetch brand profile if ID provided
let brandContext = '';
if (brandProfileId) {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      competitors: {
        include: {
          adLibraryBrand: {
            select: { id: true, pageId: true, pageName: true, profilePicUrl: true },
          },
        },
      },
    },
  });
  if (profile) {
    brandContext = compileBrandContext(profile as BrandProfileFull);
  }
}

const systemPrompt = HIKARU_SYSTEM_PROMPT + brandContext;

// Then in the API call:
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemPrompt,
  tools,
  messages: currentMessages,
});
```

### Pattern 3: Multi-Step Wizard with localStorage Drafts

**What:** URL-param based step tracking (`?step=1`), auto-save to localStorage on each field change (debounced), final submit creates/updates BrandProfile via existing API.

**Example:**
```typescript
// Wizard steps definition
const WIZARD_STEPS = [
  { id: 'basics', title: 'Brand Basics', fields: ['name'] },
  { id: 'voice', title: 'Voice & Tone', fields: ['brandVoice', 'positioning'] },
  { id: 'audience', title: 'Target Audience', fields: ['demographics', 'interests', 'painPoints'] },
  { id: 'competitors', title: 'Competitors', fields: ['competitors'] },
  { id: 'visual', title: 'Visual Identity', fields: ['primaryColor', 'secondaryColor', 'accentColor', 'logoUrl'] },
] as const;

// Draft storage key
const DRAFT_KEY = 'brand-profile-wizard-draft';

// Save draft (debounced)
function saveDraft(data: Partial<BrandProfileCreate>) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    data,
    savedAt: Date.now(),
  }));
}

// Load draft on mount
function loadDraft(): Partial<BrandProfileCreate> | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  // Expire after 7 days
  if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
  return parsed.data;
}
```

### Pattern 4: AI Interview Mode (Separate Endpoint)

**What:** A dedicated API route that uses Claude with a specialized system prompt to extract brand profile data from natural conversation. After each exchange, it extracts structured fields and returns both a chat response and partial profile data.

**Example:**
```typescript
// /api/brand-profiles/interview/route.ts

const INTERVIEW_SYSTEM_PROMPT = `You are a brand strategist helping a user define their brand profile through conversation. Your goal is to extract these fields naturally:

- Brand name
- Brand voice/tone description
- Market positioning
- Target demographics
- Audience interests
- Customer pain points
- Mission statement

Ask one focused question at a time. After each user response, extract any profile fields you can identify. Be conversational and encouraging. After 3-5 exchanges, summarize what you've gathered and ask if anything is missing.

Respond with JSON in this exact format:
{
  "message": "Your conversational response here",
  "extractedFields": {
    "name": "...",         // null if not yet extracted
    "brandVoice": "...",   // null if not yet extracted
    ...
  },
  "completeness": 0.0-1.0,  // How complete the profile is
  "nextQuestion": "hint about what to ask next"
}`;
```

### Anti-Patterns to Avoid
- **Fetching full profile on every chat turn:** Fetch once at conversation start, cache in the request. The system prompt is static for the conversation.
- **Including image URLs in text context:** Visual identity (logos, reference images) should flow separately to image-generation pipelines, not consume text token budget.
- **Blocking access behind onboarding:** The onboarding prompt must always be dismissible. Store dismissal in localStorage.
- **Using BrandGuidelines and BrandProfile simultaneously:** Migrate Creative Lab to BrandProfile completely; do not maintain two systems.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer | chars/4 heuristic | 2K token budget is approximate; exact counting is overkill. Claude's context window is 200K -- a 10% overrun on 2K tokens is negligible |
| Form validation | Custom validators | Zod schemas (already exist) | createSchema in brand-profiles/route.ts already validates all fields |
| Draft persistence | Custom sync engine | localStorage with JSON.stringify | Simple, works offline, no server round-trips needed for drafts |
| Multi-step form state | Complex state machine | useState + URL params | 3-5 steps is simple enough for linear state; no need for XState or similar |

**Key insight:** This phase is integration work, not greenfield. The BrandProfile CRUD API exists, the form validation exists, the BrandSelector exists. The context compiler is the only truly new utility -- everything else is wiring existing pieces together.

## Common Pitfalls

### Pitfall 1: Brand Context in Streaming Agentic Loop
**What goes wrong:** The Hikaru route uses an agentic loop (up to 8 iterations). If you fetch the brand profile inside the loop, you waste DB queries. If the system prompt changes between iterations, it breaks conversation coherence.
**Why it happens:** The route re-creates the messages.create() call on each iteration.
**How to avoid:** Fetch the profile ONCE before the loop. Build the system prompt ONCE. Pass it to every client.messages.create() call.
**Warning signs:** Multiple DB queries per chat turn in logs.

### Pitfall 2: Creative Lab BrandGuidelines Migration Breaks
**What goes wrong:** The generate-config and generate-batch routes use `BrandGuidelines` which is keyed by userId (single per user). BrandProfile is keyed by userId + isActive (multiple profiles, one active). Simply swapping the Prisma query will work, but the field mapping is slightly different.
**Why it happens:** BrandGuidelines has no `positioning`, `painPoints`, `missionStatement`, or `name` fields. BrandProfile has all of these.
**How to avoid:** Map the query correctly: `prisma.brandProfile.findFirst({ where: { userId, isActive: true } })`. The generate-config route reads `brandVoice`, `primaryColor`, `secondaryColor`, `accentColor`, `demographics`, `interests`, `logoUrl`, `referenceImages` -- all of which exist on BrandProfile with identical field names.
**Warning signs:** `null` brand context in generated images after migration.

### Pitfall 3: Onboarding Prompt Shows After Profile Already Exists
**What goes wrong:** The "set up your brand" prompt keeps showing even after the user has profiles.
**Why it happens:** Checking profile existence requires an API call. If you use localStorage to track dismissal, it persists across sessions even after the user creates a profile.
**How to avoid:** Two-tier check: (1) fetch profile count from API, (2) if count > 0, never show prompt. If count === 0, show unless dismissed (localStorage flag). Clear localStorage flag is irrelevant because count > 0 takes priority.
**Warning signs:** Banner flashing (shows briefly then hides after API returns).

### Pitfall 4: AI Interview Extracts Poor-Quality Data
**What goes wrong:** Free-form conversation produces vague, overly long brand voice descriptions or misinterprets casual comments as brand positioning.
**Why it happens:** LLM extraction from conversation is inherently noisy.
**How to avoid:** After the interview, show the user the extracted profile as a pre-filled wizard for review and editing. Never auto-save interview results without confirmation.
**Warning signs:** Users complaining that their brand voice description is "weird" or contains conversation artifacts.

### Pitfall 5: Hikaru Doesn't Receive brandProfileId
**What goes wrong:** The frontend sends `brandProfileId` in the request body (line 619), but the backend destructures only `messages` (line 943).
**Why it happens:** The backend was written before brand context injection was planned.
**How to avoid:** Update the destructuring: `const { messages, brandProfileId } = await request.json();`
**Warning signs:** Brand context never appears in Hikaru responses even when profile is selected.

## Code Examples

### Context Compiler Integration Points

**Hikaru route.ts (key modification):**
```typescript
// Line ~943: Update destructuring
const { messages, brandProfileId } = await request.json();

// Before the while loop (~line 968): Fetch and compile
let systemPrompt = HIKARU_SYSTEM_PROMPT;
if (brandProfileId) {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      competitors: {
        include: { adLibraryBrand: { select: { id: true, pageId: true, pageName: true, profilePicUrl: true } } },
      },
    },
  });
  if (profile) {
    systemPrompt += compileBrandContext(profile as BrandProfileFull);
  }
}

// Line ~974: Use dynamic system prompt
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemPrompt,  // was: HIKARU_SYSTEM_PROMPT
  tools,
  messages: currentMessages,
});
```

**Creative Lab generate-config migration (key modification):**
```typescript
// Replace lines 77-109 (BrandGuidelines fetch) with:
try {
  const session = await auth();
  if (session?.user?.id) {
    const activeProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
    });
    if (activeProfile) {
      brandVoice = activeProfile.brandVoice?.slice(0, 200) ?? null;
      primaryColor = activeProfile.primaryColor;
      secondaryColor = activeProfile.secondaryColor;
      accentColor = activeProfile.accentColor;
      brandColors = [primaryColor, secondaryColor, accentColor].filter(
        (c): c is string => !!c
      );
      brandAudience = [
        ...(activeProfile.demographics || []),
        ...(activeProfile.interests || []),
      ];
      logoUrl = activeProfile.logoUrl;
      if (activeProfile.referenceImages) {
        const refs = activeProfile.referenceImages as Array<{ url: string; name?: string }>;
        referenceImages = refs.filter((r) => r.url);
      }
    }
  }
} catch {
  // Non-blocking
}
```

### Soft Onboarding Prompt Component
```typescript
// src/components/onboarding-prompt.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';

const DISMISS_KEY = 'onboarding-prompt-dismissed';

export function OnboardingPrompt({ darkMode }: { darkMode: boolean }) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) { setChecked(true); return; }
    if (localStorage.getItem(DISMISS_KEY)) { setChecked(true); return; }

    // Check if user has any brand profiles
    fetch('/api/brand-profiles')
      .then((r) => r.json())
      .then((data) => {
        if (!data.profiles || data.profiles.length === 0) {
          setVisible(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [session]);

  if (!checked || !visible) return null;

  return (
    <div className={`rounded-xl border p-4 mb-4 flex items-center gap-3 ${
      darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/20' : 'bg-blue-50 border-blue-100'
    }`}>
      <Sparkles className="w-5 h-5 text-[#1235e2] shrink-0" />
      <div className="flex-1 text-sm">
        <strong>Set up your brand profile</strong> to get personalized AI insights.
        <Link href="/dashboard/v2/onboarding" className="text-[#1235e2] ml-1 hover:underline">
          Get started
        </Link>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setVisible(false);
        }}
        className={`p-1 rounded ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrandGuidelines (single per user) | BrandProfile (multiple per user, one active) | Phase 68 (current milestone) | Creative Lab must migrate from BrandGuidelines to BrandProfile |
| No brand context in AI | XML-tagged context injection | Phase 69 (this phase) | All AI features become brand-aware |

**Deprecated/outdated:**
- `BrandGuidelines` model: Should NOT be removed yet (may need data migration), but all new code should read from `BrandProfile`. After Phase 69, BrandGuidelines becomes dead code.

## Field Mapping: BrandGuidelines vs BrandProfile

| BrandGuidelines Field | BrandProfile Equivalent | Notes |
|----------------------|------------------------|-------|
| brandVoice | brandVoice | Same type and purpose |
| missionStatement | missionStatement | Same |
| demographics | demographics | Same (String[]) |
| interests | interests | Same (String[]) |
| logoUrl | logoUrl | Same |
| logoKey | logoKey | Same |
| primaryColor | primaryColor | Same |
| secondaryColor | secondaryColor | Same |
| accentColor | accentColor | Same |
| referenceImages | referenceImages | Same (Json) |
| (none) | name | NEW - brand name |
| (none) | positioning | NEW - market positioning |
| (none) | painPoints | NEW - customer pain points |
| (none) | isActive | NEW - multi-profile support |
| (none) | competitors | NEW - relation to AdLibraryBrand |

**Migration is a simple query swap.** No field renaming needed. BrandProfile is a strict superset.

## Open Questions

1. **Should Hikaru's personality adapt based on brand context?**
   - What we know: Currently Hikaru always speaks as a "senior creative strategist." With brand context, it could adapt recommendations to the brand's industry and voice.
   - What's unclear: Whether to add brand-specific behavior instructions (e.g., "Frame all recommendations in terms of {brand}'s positioning") or just inject the context and let Claude figure it out.
   - Recommendation: Start simple -- inject context only. Claude will naturally reference the brand context. Add explicit behavior instructions in a follow-up if needed.

2. **What happens when user has no auth session?**
   - What we know: The v2 dashboard doesn't require auth for browsing. BrandProfile requires auth (userId). The BrandSelector already returns null for unauthenticated users.
   - What's unclear: Should onboarding prompt show for unauthenticated users? Should it prompt login first?
   - Recommendation: Only show onboarding prompt for authenticated users with no profiles. Unauthenticated users see no prompt and get no brand context -- same experience as today.

3. **Data migration from BrandGuidelines to BrandProfile**
   - What we know: Some users may have BrandGuidelines data but no BrandProfile.
   - What's unclear: How many users have BrandGuidelines? Should we auto-migrate?
   - Recommendation: Defer migration to a separate script. This phase should make Creative Lab read from BrandProfile. If BrandProfile is empty but BrandGuidelines exists, the user sees the onboarding prompt to set up their (new) profile.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/app/api/chat/hikaru/route.ts` -- current Hikaru implementation, agentic loop structure
- Codebase inspection: `src/app/api/creative-lab/generate-config/route.ts` -- current BrandGuidelines usage
- Codebase inspection: `src/app/api/creative-lab/generate-batch/route.ts` -- current BrandGuidelines usage
- Codebase inspection: `prisma/schema.prisma` -- BrandProfile and BrandGuidelines models
- Codebase inspection: `src/lib/brand-profile-types.ts` -- TypeScript interfaces
- Codebase inspection: `src/components/brand-selector.tsx` -- existing UI integration
- Codebase inspection: `src/app/dashboard/v2/hikaru/page.tsx` -- frontend already sends brandProfileId

### Secondary (MEDIUM confidence)
- XML-tagged prompt sections: Standard pattern used by Anthropic's own documentation for structured system prompts
- chars/4 heuristic: Well-known approximation for Claude tokenization (actual varies by content but close enough for budgeting)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in the project
- Architecture: HIGH - patterns derived directly from reading the codebase
- Context compiler: HIGH - straightforward string serialization with budget
- Wizard UX: HIGH - standard multi-step form pattern
- AI interview: MEDIUM - extraction quality depends on prompt engineering; pattern is sound but results may need iteration
- BrandGuidelines migration: HIGH - field-by-field mapping confirms it is a simple query swap

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain, no external dependency changes expected)
