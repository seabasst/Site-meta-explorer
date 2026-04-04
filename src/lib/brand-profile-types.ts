/**
 * Brand Profile types for v9.0 Brand Profile & AI Context System.
 *
 * BrandProfile is the core data model that stores a user's brand identity,
 * audience, positioning, and competitor links. Each user can have multiple
 * profiles, with one active at a time.
 */

// ---------------------------------------------------------------------------
// Nested types
// ---------------------------------------------------------------------------

/** Reference image stored in R2 */
export interface ReferenceImage {
  url: string;
  key: string;
  name?: string;
}

/** Competitor entry with nested AdLibraryBrand info */
export interface BrandCompetitorWithBrand {
  id: string;
  profileId: string;
  adLibraryBrandId: string;
  notes: string | null;
  createdAt: Date;
  adLibraryBrand: {
    id: string;
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
  };
}

// ---------------------------------------------------------------------------
// Full profile (returned from API)
// ---------------------------------------------------------------------------

/** Full brand profile including competitors with their brand info */
export interface BrandProfileFull {
  id: string;
  userId: string;
  name: string;

  // Brand Voice & Positioning
  brandVoice: string | null;
  missionStatement: string | null;
  positioning: string | null;

  // Audience
  painPoints: string[];
  demographics: string[];
  interests: string[];

  // Visual Identity
  logoUrl: string | null;
  logoKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  referenceImages: ReferenceImage[] | null;

  // State
  isActive: boolean;

  // Enrichment tracking
  enrichedAt: Date | null;
  enrichmentSource: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Relations
  competitors: BrandCompetitorWithBrand[];
}

// ---------------------------------------------------------------------------
// Create / Update payloads
// ---------------------------------------------------------------------------

/** Fields for creating a new brand profile (name required, rest optional) */
export interface BrandProfileCreate {
  name: string;
  brandVoice?: string | null;
  missionStatement?: string | null;
  positioning?: string | null;
  painPoints?: string[];
  demographics?: string[];
  interests?: string[];
  logoUrl?: string | null;
  logoKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  referenceImages?: ReferenceImage[] | null;
}

/** Partial update fields (all optional) */
export interface BrandProfileUpdate {
  name?: string;
  brandVoice?: string | null;
  missionStatement?: string | null;
  positioning?: string | null;
  painPoints?: string[];
  demographics?: string[];
  interests?: string[];
  logoUrl?: string | null;
  logoKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  referenceImages?: ReferenceImage[] | null;
  isActive?: boolean;
}
