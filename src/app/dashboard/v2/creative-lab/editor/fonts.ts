/** Curated Google Fonts for the creative editor font picker */
export const CURATED_FONTS: {
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'monospace';
}[] = [
  // Sans-serif
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Space Grotesk', category: 'sans-serif' },

  // Serif
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },

  // Display
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Oswald', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Pacifico', category: 'display' },

  // Monospace
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
];

/** Default font family used by the editor */
export const DEFAULT_FONT = 'Inter';
