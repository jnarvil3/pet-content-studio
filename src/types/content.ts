/**
 * Content Generation Types
 */

export interface CarouselSlide {
  slideNumber: number;
  title: string;
  body: string | null;
  stat: {
    number: string;
    context: string;
  } | null;
  pexelsSearchQuery: string;
  layoutHint: 'hook' | 'problem' | 'insight' | 'tip' | 'cta';
  commentPrompt?: string;
}

export interface CarouselContent {
  slides: CarouselSlide[];
  caption: string;
  hashtags: string[];
  hookFormula: 'curiosity_gap' | 'contrarian' | 'mistake_hook' | 'personal_specific' | 'question_hook' | 'number_outcome';
}

export interface ReelScene {
  sceneNumber: number;            // 1-5
  sceneType: 'hook' | 'problem' | 'insight' | 'tip' | 'cta';
  narration: string;              // Text the TTS will read aloud
  durationEstimate: number;       // Estimated seconds for this scene
  captionText: string;            // On-screen text overlay (shorter than narration)
  pexelsSearchTerms: string[];    // 2-3 search queries to try for B-roll
  pexelsVideoOrientation: 'portrait'; // Always portrait for Reels
}

export interface ReelScript {
  topicCardId: string;
  title: string;                  // Internal reference title
  totalDurationTarget: number;    // Target duration in seconds (30-45)
  scenes: ReelScene[];
  caption: string;                // Instagram caption text
  hashtags: string[];             // 5 hashtags
  hookFormula: 'curiosity' | 'contrarian' | 'question' | 'mistake' | 'personal';
}

export interface GeneratedContent {
  id?: number;
  signal_id: number;
  content_type: 'carousel' | 'reel' | 'linkedin';
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'revision_requested';

  // Carousel-specific
  carousel_content?: CarouselContent;
  carousel_images?: string[]; // File paths to PNG slides

  // Reel-specific
  reel_script?: ReelScript;
  reel_video_path?: string; // Path to MP4

  // LinkedIn-specific
  linkedin_content?: LinkedInPost;

  // Version tracking
  version?: number;
  parent_id?: number;

  // Metadata
  source_url?: string;
  generated_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  published_at?: string;
}

export interface LinkedInPost {
  headline: string;
  body: string;
  hashtags: string[];
  ctaText: string;
  imagePrompt?: string;
}

export interface ContentFeedback {
  id?: number;
  content_id: number;
  feedback_type: 'edit_request' | 'rejection' | 'comment';
  feedback_text: string;
  specific_changes?: Array<{ field: string; current?: string; requested: string }>;
  status: 'pending' | 'addressed' | 'dismissed';
  created_at: string;
  addressed_at?: string;
}
