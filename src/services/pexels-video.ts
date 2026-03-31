/**
 * Pexels Video API Service
 * Fetches B-roll video clips for Reel scenes
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
  video_pictures: Array<{ picture: string }>;
}

export class PexelsVideoService {
  private apiKey: string;
  private baseUrl = 'https://api.pexels.com/videos';
  private cacheDir: string;

  constructor(cacheDir: string = path.join(process.cwd(), 'data', 'output', 'cache', 'pexels-videos')) {
    this.apiKey = process.env.PEXELS_API_KEY || '';
    this.cacheDir = cacheDir;

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (!this.apiKey || this.apiKey === 'your_pexels_api_key_here') {
      console.log('[PexelsVideoService] ⚠️  No API key configured, video fetching disabled');
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.apiKey && this.apiKey !== 'your_pexels_api_key_here';
  }

  /**
   * Search for videos by query
   */
  async searchVideos(
    query: string,
    options: {
      orientation?: 'portrait' | 'landscape' | 'square';
      size?: 'large' | 'medium' | 'small';
      perPage?: number;
    } = {}
  ): Promise<PexelsVideo[]> {
    if (!this.isEnabled()) {
      console.log('[PexelsVideoService] Skipping video search (no API key)');
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        headers: {
          Authorization: this.apiKey
        },
        params: {
          query,
          orientation: options.orientation || 'portrait',
          size: options.size || 'medium',
          per_page: options.perPage || 5
        }
      });

      const videos = response.data.videos || [];
      console.log(`[PexelsVideoService] Found ${videos.length} videos for "${query}"`);

      return videos;
    } catch (error: any) {
      console.error('[PexelsVideoService] Error searching videos:', error.message);
      return [];
    }
  }

  /**
   * Find best video file for Reels (portrait, good quality)
   */
  getBestVideoFile(video: PexelsVideo): PexelsVideoFile | null {
    // Filter for portrait-ish aspect ratios (9:16 ideal, but accept 3:4 to 9:16)
    const portraitFiles = video.video_files.filter(file => {
      const aspectRatio = file.height / file.width;
      return aspectRatio >= 1.3 && aspectRatio <= 1.8; // Portrait range
    });

    if (portraitFiles.length === 0) {
      return null;
    }

    // Sort by height (prefer higher resolution)
    portraitFiles.sort((a, b) => b.height - a.height);

    // Find HD file (1080p or 720p)
    const hdFile = portraitFiles.find(f => f.height >= 1080 && f.height <= 1920);

    return hdFile || portraitFiles[0];
  }

  /**
   * Download video file
   */
  async downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
    console.log(`[PexelsVideoService] Downloading video...`);

    try {
      const response = await axios.get(videoUrl, {
        responseType: 'stream'
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const writer = fs.createWriteStream(outputPath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`[PexelsVideoService] ✅ Video saved: ${path.basename(outputPath)}`);
    } catch (error: any) {
      console.error('[PexelsVideoService] Error downloading video:', error.message);
      throw error;
    }
  }

  /**
   * Find and download best video for scene
   * Tries multiple search terms until success
   */
  async fetchSceneVideo(
    searchTerms: string[],
    outputPath: string,
    minDuration: number = 5
  ): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Try each search term
    for (const query of searchTerms) {
      const videos = await this.searchVideos(query, { orientation: 'portrait' });

      // Filter for videos longer than needed (so we can trim, not stretch)
      const usableVideos = videos.filter(v => v.duration >= minDuration);

      if (usableVideos.length === 0) {
        console.log(`[PexelsVideoService] No usable videos for "${query}", trying next term...`);
        continue;
      }

      // Get first usable video
      const video = usableVideos[0];
      const videoFile = this.getBestVideoFile(video);

      if (!videoFile) {
        console.log(`[PexelsVideoService] No portrait file found for "${query}", trying next term...`);
        continue;
      }

      // Download video
      await this.downloadVideo(videoFile.link, outputPath);

      console.log(`[PexelsVideoService] ✅ Found video for "${query}" (${video.duration}s, ${videoFile.width}x${videoFile.height})`);
      return outputPath;
    }

    // If all search terms failed, try fallback
    console.log('[PexelsVideoService] All search terms failed, trying fallback...');
    const fallbackTerms = ['cute dog', 'happy puppy', 'dog outdoors'];

    for (const query of fallbackTerms) {
      const videos = await this.searchVideos(query, { orientation: 'portrait' });

      if (videos.length > 0) {
        const video = videos[0];
        const videoFile = this.getBestVideoFile(video);

        if (videoFile) {
          await this.downloadVideo(videoFile.link, outputPath);
          console.log(`[PexelsVideoService] ✅ Using fallback video: "${query}"`);
          return outputPath;
        }
      }
    }

    console.error('[PexelsVideoService] ❌ Could not find any usable videos');
    return null;
  }

  /**
   * Fetch videos for all scenes
   */
  async fetchSceneVideos(
    scenes: Array<{ searchTerms: string[]; sceneNumber: number; duration: number }>,
    outputDir: string,
    prefix: string = 'scene'
  ): Promise<string[]> {
    const videoPaths: string[] = [];

    for (const scene of scenes) {
      const filename = `${prefix}-${scene.sceneNumber}-broll.mp4`;
      const outputPath = path.join(outputDir, filename);

      const videoPath = await this.fetchSceneVideo(
        scene.searchTerms,
        outputPath,
        scene.duration
      );

      videoPaths.push(videoPath || '');

      // Delay to avoid rate limiting
      if (scene.sceneNumber < scenes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = videoPaths.filter(p => p).length;
    console.log(`[PexelsVideoService] ✅ Fetched ${successCount}/${scenes.length} videos`);

    return videoPaths;
  }
}
