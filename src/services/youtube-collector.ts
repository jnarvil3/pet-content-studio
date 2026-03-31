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

    // Search multiple pet-related queries for variety
    const queries = [
      { q: 'dog training tips', categoryId: '15' },
      { q: 'cat behavior funny', categoryId: '15' },
      { q: 'pet care tips 2026', categoryId: '15' },
      { q: 'puppy first time', categoryId: '15' },
      { q: 'dog grooming transformation', categoryId: '15' },
    ];

    const allVideos: YouTubeVideo[] = [];

    for (const query of queries) {
      try {
        const videos = await this.searchAndEnrich(query.q, query.categoryId);
        allVideos.push(...videos);
      } catch (error: any) {
        console.error(`[YouTubeCollector] Error searching "${query.q}":`, error.message);
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
  private async searchAndEnrich(query: string, categoryId: string): Promise<YouTubeVideo[]> {
    // Step 1: Search
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const searchParams = new URLSearchParams({
      key: this.apiKey,
      part: 'snippet',
      type: 'video',
      q: query,
      videoCategoryId: categoryId,
      order: 'viewCount',
      publishedAfter: sevenDaysAgo.toISOString(),
      maxResults: '10',
      regionCode: 'US'
    });

    const searchRes = await fetch(`${YOUTUBE_API}/search?${searchParams}`);
    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(searchData.error.message);
    }

    const items = searchData.items || [];
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

      return {
        video_id: video.id,
        title: snippet.title || '',
        description: (snippet.description || '').substring(0, 500),
        channel_name: snippet.channelTitle || '',
        channel_id: snippet.channelId || '',
        published_at: snippet.publishedAt || new Date().toISOString(),
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        views_per_day: Math.round(viewsPerDay),
        is_viral: engagementRate > 5 || viewsPerDay > 100000,
        tags: snippet.tags || []
      };
    });
  }
}
