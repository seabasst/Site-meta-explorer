# Feature Landscape: Brand Profile & AI Context System (v9.0)

**Domain:** Brand-aware AI assistant for ad intelligence SaaS
**Researched:** 2026-04-03
**Overall confidence:** MEDIUM-HIGH

---

## Table Stakes

Features users expect from any brand-aware AI system. Missing = product feels half-baked.

| # | Feature | Why Expected | Complexity | Dependencies | Notes |
|---|---------|--------------|------------|--------------|-------|
| TS-1 | **Brand Profile CRUD** | Every competitor (Jasper, HubSpot) has this. Users need a place to define who they are. | Low | New `BrandProfile` model | Voice, audience, positioning, competitors, pain points. Extends existing `BrandGuidelines` which already has voice, demographics, colors, logo. |
| TS-2 | **Context injection into Hikaru chat** | If brand profile exists but chat ignores it, the feature is pointless. Users will immediately test "does it know my brand?" | Medium | TS-1 | Prepend brand context to system prompt. Keep under 2K tokens to avoid latency bloat. |
| TS-3 | **Context injection into Creative Lab** | Same as TS-2 but for generation/analysis flows. Creative Director already accepts `brandVoice` and `brandAudience` — needs full profile. | Medium | TS-1 | Visual Bible, Creative Director, and UGC Brief generators all need brand context. Already partially wired (voice + audience). |
| TS-4 | **Brand selector in chat** | If user manages multiple brands/clients (agencies), they need to pick which brand context applies. Without this, multi-brand users are stuck. | Low | TS-1, TS-2 | Dropdown in chat header. Store `activeBrandId` in session/state. |
| TS-5 | **Onboarding wizard (basic)** | First-run experience that populates brand profile. Without guided setup, users stare at empty fields. | Medium | TS-1 | 3-5 step wizard: name/URL, voice/tone, audience, competitors, visual identity. Progressive — can skip and fill later. |
| TS-6 | **Brand profile management UI** | Users need to view/edit their profile after initial setup. Settings page pattern. | Low | TS-1 | Tab-based settings: Voice, Audience, Visual, Competitors, Positioning |

## Differentiators

Features that set this product apart. Not expected, but create competitive advantage.

| # | Feature | Value Proposition | Complexity | Dependencies | Notes |
|---|---------|-------------------|------------|--------------|-------|
| DF-1 | **Auto-enrichment from website** | HubSpot does this — crawl brand URL to auto-populate voice, colors, audience. Saves 10+ minutes of manual input. Makes onboarding feel magical. | Medium-High | TS-1, TS-5 | Scrape website, extract brand voice samples, color palette, product info. Use Claude to synthesize into structured profile. Similar to HubSpot's Breeze "refresh from website" feature. |
| DF-2 | **Auto-enrichment from ad library data** | Unique to this platform. Analyze user's own ads to derive voice, messaging patterns, audience signals. No competitor has this because they lack the ad data. | Medium | TS-1, existing classification data | Query `AdAnalysis`, `AdClassification` for the brand. Synthesize patterns into profile fields. This is the killer differentiator — "we already know your brand from your ads." |
| DF-3 | **Dual-model routing (Haiku fast / Manus deep)** | Quick questions get instant answers (Haiku). Deep research questions get async Manus treatment. Users get speed AND depth without choosing. | High | TS-2, Manus API integration | Router classifies intent: simple lookup/chat -> Haiku/Sonnet (existing Hikaru). Complex research/strategy -> Manus async task with webhook callback. UI shows "researching..." state with progress. |
| DF-4 | **Competitor context in brand profile** | Link competitor brands (already in AdLibraryBrand) to brand profile. All AI responses can reference competitive positioning. | Low-Medium | TS-1, existing brand data | Store array of competitor `brandId` refs. When generating strategy, auto-include competitor data as context. |
| DF-5 | **Brand health dashboard** | Auto-generated overview: how your ads compare to competitors on diversity, reach, format mix. Updated weekly. | Medium | TS-1, DF-4, existing BrandAnalysisCache | Aggregate existing diversity/andromeda scores against competitors. Surface as a dashboard card, not a separate page. |
| DF-6 | **Onboarding with AI interview** | Instead of form fields, conversational AI asks questions and builds profile. "Tell me about your brand" -> structured profile. | Medium | TS-1, TS-5 | Chat-based alternative to wizard forms. Claude extracts structured data from natural language. Impressive but optional — form wizard is the fallback. |
| DF-7 | **Context-aware strategy recommendations** | Creative Lab strategy view uses brand profile to generate personalized gap analysis, not generic category benchmarks. | Medium | TS-3, DF-4 | Strategy view already exists. Add brand positioning + pain points + competitor data to the prompt context. |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| AF-1 | **Full brand guidelines editor (Canva/Figma-style)** | This is a design tool, not an ad intelligence platform. Building font pickers, layout editors, etc. is a rabbit hole. | Store minimal visual identity (colors, logo, reference images). Let users link to external brand guidelines if they want more. Existing `BrandGuidelines` model is sufficient scope. |
| AF-2 | **Real-time Manus streaming** | Manus API is async by design. Trying to fake real-time streaming for deep research tasks creates fragile UX. | Show clear async state: "Researching... usually takes 2-5 minutes." Push notification or email when done. Polling with webhook fallback. |
| AF-3 | **AI model selection UI** | Exposing "choose your AI model" to end users adds complexity without value. Users want answers, not model menus. | Route automatically based on query complexity. Power users can toggle "deep research mode" as a single switch, not a model picker. |
| AF-4 | **Mandatory onboarding** | Blocking users from using the product until they complete brand setup kills activation. Current platform has open-access browsing. | Onboarding is opt-in, prompted but skippable. All features work without a brand profile — profile just makes them better. Show "Set up your brand for personalized insights" nudges. |
| AF-5 | **Per-user brand profiles (no sharing)** | Agencies have teams. If each person creates their own brand profile, data fragments and inconsistencies multiply. | Brand profiles are workspace-level entities. Multiple users can share/access the same brand profile. Plan for this even if v9.0 ships single-user. |
| AF-6 | **Sync Manus results back into brand profile automatically** | Auto-updating profile from AI research outputs without human review is dangerous — AI can hallucinate or misinterpret. | Show Manus research results as "suggested updates" that user reviews and approves before profile changes. |
| AF-7 | **Complex RBAC for brand access** | Premature optimization for v9.0. Don't build role-based access control for brand profiles before you have paying teams. | Simple ownership model. One user owns a brand profile. Sharing comes in a future team/workspace milestone. |

## Feature Dependencies

```
TS-1 (BrandProfile CRUD)
  |
  +---> TS-2 (Context injection: Chat)
  |       |
  |       +---> TS-4 (Brand selector in chat)
  |       +---> DF-3 (Dual-model routing)
  |
  +---> TS-3 (Context injection: Creative Lab)
  |       |
  |       +---> DF-7 (Context-aware strategy)
  |
  +---> TS-5 (Onboarding wizard)
  |       |
  |       +---> DF-1 (Auto-enrich from website)
  |       +---> DF-6 (AI interview onboarding)
  |
  +---> TS-6 (Brand management UI)
  |
  +---> DF-2 (Auto-enrich from ad data)
  |
  +---> DF-4 (Competitor context)
          |
          +---> DF-5 (Brand health dashboard)
```

**Critical path:** TS-1 -> TS-2 + TS-3 -> TS-5 -> DF-1/DF-2 (auto-enrichment)

Everything flows from the BrandProfile model. Context injection (TS-2, TS-3) is the highest-impact follow-up because it makes the profile immediately useful. The onboarding wizard (TS-5) is what makes the profile easy to create.

## MVP Recommendation

**Phase 1 — Foundation (must-ship):**
1. TS-1: BrandProfile data model and API
2. TS-2: Context injection into Hikaru chat
3. TS-3: Context injection into Creative Lab
4. TS-5: Basic onboarding wizard (form-based, 3-5 steps)
5. TS-6: Brand profile settings page

**Phase 2 — Differentiation (should-ship):**
1. DF-2: Auto-enrich from ad library data (unique advantage)
2. DF-4: Competitor context linking
3. TS-4: Brand selector in chat
4. DF-1: Auto-enrich from website crawl

**Phase 3 — Advanced (nice-to-have):**
1. DF-3: Dual-model routing with Manus API
2. DF-5: Brand health dashboard
3. DF-7: Context-aware strategy recommendations
4. DF-6: AI interview onboarding

**Defer indefinitely:**
- AF-1 through AF-7 (anti-features listed above)

## Rationale for Phase Ordering

**Why DF-2 before DF-1:** Auto-enrichment from ad data is unique to this platform and uses existing infrastructure (classifications, analyses already in DB). Website scraping requires new infrastructure (puppeteer/scraping pipeline, HTML parsing). Ship the unique advantage first.

**Why DF-3 (Manus) in Phase 3:** Manus API integration is the highest complexity item and introduces external dependency risk (API availability, credit costs, async UX patterns). The core value of v9.0 — brand-aware AI — ships fully in Phase 1-2 without Manus. Manus adds depth, not breadth.

**Why DF-4 before DF-5:** Competitor linking is low complexity and unlocks the health dashboard. Without competitor links, the dashboard has nothing to compare against.

## Competitive Landscape Reference

| Competitor | Brand Context | Onboarding | Multi-model | Auto-enrichment |
|------------|--------------|------------|-------------|-----------------|
| **Jasper** | Full brand IQ: voice, knowledge base, audience personas, visual identity | Upload samples or URL crawl | Single model with agent routing | Website crawl, document upload |
| **HubSpot Breeze** | Brand identity: voice, tone, ICP, products, competitors | AI-generated from website crawl | Single Breeze model | Website crawl, CRM data |
| **Microsoft Copilot** | Brand kits: templates, assets, guidelines | Admin-managed brand kits | Multi-model (best model per task) | Connected data sources |
| **Adobe Brand Concierge** | First-party data + approved content | Enterprise setup | Adobe AI models | First-party data integration |
| **This platform (v9.0)** | Brand profile + ad intelligence data | Wizard + auto-enrich from ads | Sonnet (fast) + Manus (deep) | Ad data + website crawl |

**This platform's unique angle:** No competitor has real-time ad intelligence data to auto-populate brand context. Jasper knows your voice from uploaded documents; this platform knows your voice from your actual running ads and your competitors' ads. That is the differentiator to emphasize in Phase 2 (DF-2).

## Key Design Decisions to Make

1. **BrandProfile vs. extend BrandGuidelines?** Current `BrandGuidelines` has voice, demographics, colors, logo. v9.0 adds positioning, competitors, pain points, audience personas. Recommend: new `BrandProfile` model that references (or replaces) `BrandGuidelines`. Don't overload the existing model.

2. **Context token budget:** Brand context injected into prompts must stay under ~2,000 tokens to avoid latency/cost inflation. Need a `serializeBrandContext()` function that produces a concise, structured summary.

3. **Onboarding trigger:** When does the wizard appear? Recommend: first visit to Creative Lab or Hikaru chat shows a soft prompt ("Set up your brand for better results"). Never block access.

4. **Manus credit economics:** Manus uses a credit-based system. Deep research tasks can be expensive. Need clear UX to set expectations ("This deep analysis uses 1 research credit") and potentially gate behind subscription tiers.

## Sources

- [HubSpot Brand Identity Context](https://knowledge.hubspot.com/branding/generate-your-brand-identity-context-with-ai) - Confidence: HIGH
- [HubSpot Brand Voice Setup](https://knowledge.hubspot.com/branding/set-up-brand-voice-using-ai) - Confidence: HIGH
- [Jasper Brand IQ](https://www.jasper.ai/brand-iq) - Confidence: HIGH
- [Jasper AI Knowledge Layer announcement](https://www.prnewswire.com/news-releases/jasper-launches-the-industrys-first-ai-knowledge-layer-built-specifically-for-marketing-302302233.html) - Confidence: HIGH
- [Microsoft 365 Copilot Brand Kits](https://support.microsoft.com/en-us/topic/create-and-manage-official-brand-kits-in-the-microsoft-365-copilot-app-6bc8a5a7-5697-466b-9e1f-302a38d44afc) - Confidence: HIGH
- [Adobe Brand Concierge](https://business.adobe.com/products/brand-concierge.html) - Confidence: MEDIUM
- [IDC on model routing](https://www.idc.com/resource-center/blog/the-future-of-ai-is-model-routing/) - Confidence: MEDIUM
- [Manus API Documentation](https://manus.im/docs/integrations/manus-api) - Confidence: MEDIUM (could not fetch full docs)
- [Manus Webhooks](https://open.manus.im/docs/webhooks) - Confidence: MEDIUM
- [VentureBeat on brand-context AI](https://venturebeat.com/ai/brand-context-ai-the-missing-requirement-for-marketing-ai/) - Confidence: MEDIUM
- [BlueOcean context-aware AI](https://www.blueocean.ai/blog/why-context-aware-ai-is-the-competitive-advantage-for-marketing-leaders) - Confidence: MEDIUM
- [SaaS onboarding best practices](https://designrevision.com/blog/saas-onboarding-best-practices) - Confidence: HIGH
- [Userpilot on onboarding wizards](https://userpilot.com/blog/onboarding-wizard/) - Confidence: HIGH
