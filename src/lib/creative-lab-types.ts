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
