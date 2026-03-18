/**
 * Brand Configuration Types
 */

export interface BrandConfig {
  // Brand Identity
  name: string;
  handle: string;
  tagline?: string;

  // Visual Identity
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    text: string;
    background: string;
  };

  fonts: {
    heading: string;
    body: string;
    accent?: string;
  };

  logo?: {
    path: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };

  // Content Voice
  voice: {
    tone: string[]; // e.g., ['friendly', 'educational', 'trustworthy']
    forbidden_words: string[];
    forbidden_claims: string[]; // e.g., 'guaranteed', 'miracle', 'cure'
  };

  // CTAs
  ctas: {
    carousel: string[];
    reel: string[];
    default: string;
  };

  // Services (for context)
  services: string[];

  // Extracted brand profile (from uploaded documents)
  profile?: BrandProfile;
}

/**
 * Extracted brand knowledge from uploaded documents
 */
export interface BrandProfile {
  voice: {
    tone_adjectives: string[];
    writing_style: string;
    example_phrases: string[];
    forbidden_words: string[];
    forbidden_claims: string[];
  };
  visual: {
    primary_color?: string;
    secondary_color?: string;
    font_style?: string;
    logo_usage_rules?: string;
  };
  content_rules: {
    topics_to_emphasize: string[];
    topics_to_avoid: string[];
    target_audience: string;
    cta_style: string;
  };
  brand_story: string;
  extracted_at: string;
  extraction_model: string;
}

export const defaultBrandConfig: BrandConfig = {
  name: 'SureStep Automation',
  handle: '@surestepautomation',
  tagline: 'Your complete pet care platform',

  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#4caf50',
    text: '#333333',
    background: '#ffffff'
  },

  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif'
  },

  voice: {
    tone: ['friendly', 'educational', 'trustworthy', 'caring'],
    forbidden_words: ['miracle', 'cure', 'guaranteed', 'always', 'never'],
    forbidden_claims: [
      'guaranteed results',
      'cure any disease',
      'miracle treatment',
      'FDA approved' // unless actually true
    ]
  },

  ctas: {
    carousel: [
      'Save this for later! 📌',
      'Follow for more pet care tips',
      'Link in bio for our services',
      'Share with a fellow pet parent',
      'Tag a friend who needs this'
    ],
    reel: [
      'Follow for more',
      'Save for later',
      'Try our app - link in bio',
      'Book now - link in bio'
    ],
    default: 'Follow for more pet care tips'
  },

  services: [
    'dog walking',
    'veterinary care',
    'doggie daycare',
    'dog food delivery',
    'pet grooming'
  ]
};
