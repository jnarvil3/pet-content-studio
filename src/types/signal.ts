/**
 * Signal Types - matches intelligence collector output
 */

export interface Signal {
  id: number;
  source: string;
  title: string;
  description?: string;
  url?: string;
  metadata: Record<string, any>;
  collected_at: string;
  relevance_score?: number;
  relevance_reason?: string;
  is_relevant?: boolean;
  scored_at?: string;
}

export interface ContentRequest {
  signal_id: number;
  signal: Signal;
  content_type: 'carousel' | 'reel';
  priority: 'low' | 'medium' | 'high';
  requested_at: string;
}
