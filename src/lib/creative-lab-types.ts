// ---------------------------------------------------------------------------
// Shared types for AI Creative Generation (Phase 57)
// Used by both API routes and frontend components.
// ---------------------------------------------------------------------------

export interface GenerationSuggestion {
  id: string;
  pillar: string;
  reasoning: string; // User-facing "why" (1 sentence)
  format: string;
  aspectRatio: string; // e.g. "1:1", "9:16", "4:5"
  tone: string;
  visualStyle: string;
  journeyPhase: string;
  copyAngle: string;
  imagePrompt: string; // For Flux Schnell -- no text in images
  priority: 'high' | 'medium' | 'low';
  selected: boolean; // Defaults to true; user can deselect before generation
}

export interface GenerationConfig {
  brandName: string;
  suggestions: GenerationSuggestion[];
  brandContext: {
    colors: string[];
    voice: string | null;
    audience: string[];
  };
  gapSummary: string; // 2-3 sentence overview of gaps found
}

export interface GenerationResult {
  suggestion: GenerationSuggestion;
  status: 'idle' | 'loading' | 'success' | 'error';
  imageUrl: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// UGC Creator Brief types (Phase 58)
// ---------------------------------------------------------------------------

export interface UGCBriefScene {
  sceneNumber: number;
  duration: string;          // e.g. "2-3s", "5-8s"
  shotType: string;          // e.g. "Close-up", "Wide shot", "POV"
  description: string;       // What happens in this scene
  visualNotes: string;       // Lighting, setting, mood
  audioNotes: string;        // What to say or sound effects
}

export interface UGCBrief {
  // Metadata
  brandName: string;
  category: string;
  briefTitle: string;        // e.g. "Unboxing + First Impressions"
  contentType: string;       // e.g. "Review Video", "Testimonial", "How-To"
  platform: string;          // e.g. "TikTok/Reels", "Stories", "Feed"
  duration: string;          // e.g. "30-60 seconds"
  aspectRatio: string;       // e.g. "9:16"

  // Hook (first 2-3 seconds)
  hooks: string[];           // 3 hook options to test

  // Shot list
  scenes: UGCBriefScene[];   // 5-8 scenes

  // Talking points
  talkingPoints: string[];   // 3-5 key messages to hit

  // B-roll suggestions
  brollSuggestions: string[]; // 4-6 B-roll shot ideas

  // CTA
  callToAction: string;      // What the creator should say/show at the end

  // Style guidance
  tone: string;              // e.g. "Casual, authentic, excited but not over-the-top"
  dosAndDonts: {
    dos: string[];
    donts: string[];
  };

  // Brand context (for creator reference)
  keyProductInfo: string;    // 1-2 sentences about the product/brand
  targetAudience: string;    // Who this content should resonate with
}
