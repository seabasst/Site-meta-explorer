// Template type system for the text overlay editor
// Defines layer structure and template definitions consumed by react-konva renderer

export interface TemplateLayer {
  id: string;
  type: 'image' | 'text' | 'rect';
  x: number;
  y: number;
  width: number;
  height: number;

  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'bold' | 'italic' | 'bold italic' | 'normal';
  fill?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  padding?: number;

  // Semantic role for editing UI
  role?: 'headline' | 'body' | 'cta';

  // Image-specific
  src?: string;
  editable?: boolean;

  // Shape-specific
  cornerRadius?: number;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;

  // Color customization
  colorRole?: 'primary' | 'secondary' | 'accent' | 'background';
}

export interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  width: number;
  height: number;
  format: string;
  layers: TemplateLayer[];
  defaults: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}

/** Map of layer IDs to partial overrides — used for editing state */
export type EditMap = Record<string, Partial<TemplateLayer>>;
