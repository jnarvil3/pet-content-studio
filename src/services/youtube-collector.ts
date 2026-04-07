/**
 * YouTube Trending Video Collector
 * Fetches real trending pet videos via YouTube Data API v3
 * Stores results in the viral_signals table
 */

import { ViralSignalsConnector } from '../storage/viral-signals-connector';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

interface YouTubeVideo {
  video_id: string;
  title: string;
  description: string;
  channel_name: string;
  channel_id: string;
  published_at: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  engagement_rate: number;
  views_per_day: number;
  is_viral: boolean;
  tags: string[];
  hook_formula: string;
  emotional_trigger: string;
}

export class YouTubeCollector {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      console.log('[YouTubeCollector] ⚠️ No YOUTUBE_API_KEY configured');
    }
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Collect trending pet videos and store in viral_signals DB
   */
  async collect(viralConnector: ViralSignalsConnector): Promise<{ collected: number; viral: number }> {
    if (!this.isEnabled()) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    console.log('[YouTubeCollector] Fetching trending pet videos...');

    // Mix of pet-specific and general topic queries
    // YouTube sorts by viewCount so we get the most-watched for each topic
    // Pet filter on the frontend separates them by title keywords
    const queries = [
      // Pet
      'dog training',
      'funny cats',
      'puppy',
      'dog grooming',
      'pet rescue',
      // General (broad topics that get high views)
      'cooking recipe',
      'fitness workout',
      'travel vlog',
      'DIY home',
      'tech review',
    ];

    const allVideos: YouTubeVideo[] = [];

    // Source 1: YouTube's actual trending/mostPopular list
    try {
      const trending = await this.getMostPopular();
      allVideos.push(...trending);
      console.log(`[YouTubeCollector] Trending: ${trending.length} videos`);
    } catch (error: any) {
      console.error(`[YouTubeCollector] Error fetching trending:`, error.message);
    }

    // Source 2: Search queries for specific topics
    for (const query of queries) {
      try {
        const videos = await this.searchAndEnrich(query);
        allVideos.push(...videos);
      } catch (error: any) {
        console.error(`[YouTubeCollector] Error searching "${query}":`, error.message);
      }
    }

    // Deduplicate by video_id
    const seen = new Set<string>();
    const unique = allVideos.filter(v => {
      if (seen.has(v.video_id)) return false;
      seen.add(v.video_id);
      return true;
    });

    console.log(`[YouTubeCollector] Found ${unique.length} unique videos`);

    // Store in viral_signals DB
    const inserted = viralConnector.insertYouTubeVideos(unique);
    const viralCount = unique.filter(v => v.is_viral).length;

    console.log(`[YouTubeCollector] ✅ Inserted ${inserted} new videos (${viralCount} viral)`);
    return { collected: inserted, viral: viralCount };
  }

  /**
   * Search YouTube and enrich with stats
   */
  /**
   * Public search: custom query + region code
   */
  async searchVideos(query: string, regionCode: string = 'BR', maxResults: number = 10, relevanceLanguage?: string): Promise<any[]> {
    if (!this.isEnabled()) throw new Error('YOUTUBE_API_KEY not configured');
    return this.searchAndEnrich(query, regionCode, maxResults, relevanceLanguage);
  }

  private async searchAndEnrich(query: string, regionCode: string = 'US', maxResults: number = 10, relevanceLanguage?: string): Promise<YouTubeVideo[]> {
    // Step 1: Search — no category filter (too restrictive), 30 day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const params: Record<string, string> = {
      key: this.apiKey,
      part: 'snippet',
      type: 'video',
      q: query,
      order: 'viewCount',
      publishedAfter: thirtyDaysAgo.toISOString(),
      maxResults: String(maxResults),
      regionCode
    };

    // Filter results by language relevance when specified
    if (relevanceLanguage) {
      params.relevanceLanguage = relevanceLanguage;
    }

    const searchParams = new URLSearchParams(params);

    const searchUrl = `${YOUTUBE_API}/search?${searchParams}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(`YouTube API: ${searchData.error.message} (${searchData.error.code})`);
    }

    const items = searchData.items || [];
    console.log(`[YouTubeCollector] "${query}" → ${items.length} results`);
    if (items.length === 0) return [];

    // Step 2: Get video stats
    const videoIds = items.map((v: any) => v.id?.videoId).filter(Boolean).join(',');

    const statsParams = new URLSearchParams({
      key: this.apiKey,
      part: 'statistics,snippet,contentDetails',
      id: videoIds
    });

    const statsRes = await fetch(`${YOUTUBE_API}/videos?${statsParams}`);
    const statsData = await statsRes.json();

    if (statsData.error) {
      throw new Error(statsData.error.message);
    }

    // Step 3: Build enriched video objects
    return (statsData.items || []).map((video: any) => {
      const snippet = video.snippet || {};
      const stats = video.statistics || {};

      const viewCount = parseInt(stats.viewCount || '0');
      const likeCount = parseInt(stats.likeCount || '0');
      const commentCount = parseInt(stats.commentCount || '0');

      const engagementRate = viewCount > 0
        ? ((likeCount + commentCount) / viewCount) * 100
        : 0;

      const publishedAt = new Date(snippet.publishedAt || new Date());
      const daysSince = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));
      const viewsPerDay = viewCount / daysSince;

      const title = snippet.title || '';
      const { hook, emotion } = YouTubeCollector.detectHookAndEmotion(title);

      return {
        video_id: video.id,
        title,
        description: (snippet.description || '').substring(0, 500),
        channel_name: snippet.channelTitle || '',
        channel_id: snippet.channelId || '',
        language: snippet.defaultLanguage || snippet.defaultAudioLanguage || '',
        published_at: snippet.publishedAt || new Date().toISOString(),
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        views_per_day: Math.round(viewsPerDay),
        is_viral: engagementRate > 5 || viewsPerDay > 100000,
        tags: snippet.tags || [],
        hook_formula: hook,
        emotional_trigger: emotion
      };
    });
  }

  /**
   * Get YouTube's actual trending/most popular videos (no search query needed)
   */
  private async getMostPopular(): Promise<YouTubeVideo[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      part: 'snippet,statistics',
      chart: 'mostPopular',
      maxResults: '25',
      regionCode: 'US'
    });

    const res = await fetch(`${YOUTUBE_API}/videos?${params}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(`YouTube API: ${data.error.message}`);
    }

    return (data.items || []).map((video: any) => {
      const snippet = video.snippet || {};
      const stats = video.statistics || {};

      const viewCount = parseInt(stats.viewCount || '0');
      const likeCount = parseInt(stats.likeCount || '0');
      const commentCount = parseInt(stats.commentCount || '0');

      const engagementRate = viewCount > 0
        ? ((likeCount + commentCount) / viewCount) * 100
        : 0;

      const publishedAt = new Date(snippet.publishedAt || new Date());
      const daysSince = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));
      const viewsPerDay = viewCount / daysSince;

      const title = snippet.title || '';
      const { hook, emotion } = YouTubeCollector.detectHookAndEmotion(title);

      return {
        video_id: video.id,
        title,
        description: (snippet.description || '').substring(0, 500),
        channel_name: snippet.channelTitle || '',
        channel_id: snippet.channelId || '',
        language: snippet.defaultLanguage || snippet.defaultAudioLanguage || '',
        published_at: snippet.publishedAt || new Date().toISOString(),
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        views_per_day: Math.round(viewsPerDay),
        is_viral: engagementRate > 5 || viewsPerDay > 100000,
        tags: snippet.tags || [],
        hook_formula: hook,
        emotional_trigger: emotion
      };
    });
  }

  /**
   * Detect hook formula and emotional trigger from video title (pattern matching, no LLM)
   */
  static detectHookAndEmotion(title: string): { hook: string; emotion: string } {
    const t = title.toLowerCase();

    // Hook formula detection
    let hook = 'curiosity_gap'; // default
    if (/^\d+\s/.test(t) || /top \d+/i.test(t)) hook = 'number_outcome';
    else if (/\?/.test(t)) hook = 'question_hook';
    else if (/stop|don'?t|never|wrong|mistake|worst/i.test(t)) hook = 'contrarian';
    else if (/how (i|to|we)/i.test(t)) hook = 'personal_specific';
    else if (/hack|trick|secret|tip/i.test(t)) hook = 'quick_hack';
    else if (/transform|before.?after|glow.?up/i.test(t)) hook = 'transformation';
    else if (/pov|when you|that moment/i.test(t)) hook = 'pov_scenario';
    else if (/doctor|vet|expert|pro |chef/i.test(t)) hook = 'authority_reveal';
    else if (/😱|😭|🤯|shock|unbelievable|insane|crazy/i.test(t)) hook = 'novelty_shock';

    // Emotional trigger detection
    let emotion = 'curiosity'; // default
    if (/funny|😂|🤣|hilarious|lol|comedy/i.test(t)) emotion = 'joy';
    else if (/scary|danger|warning|⚠|😱/i.test(t)) emotion = 'fear';
    else if (/sad|😭|cry|rescue|save|emotional/i.test(t)) emotion = 'empathy';
    else if (/satisfying|asmr|relaxing|calm/i.test(t)) emotion = 'satisfaction';
    else if (/shock|unbelievable|insane|🤯/i.test(t)) emotion = 'surprise';
    else if (/hack|trick|easy|simple|quick/i.test(t)) emotion = 'curiosity';
    else if (/trust|honest|real|truth/i.test(t)) emotion = 'trust';
    else if (/wrong|stop|worst|angry/i.test(t)) emotion = 'anger';

    return { hook, emotion };
  }
}
