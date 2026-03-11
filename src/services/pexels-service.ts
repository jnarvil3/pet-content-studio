/**
 * Pexels API Service
 * Fetches relevant stock photos for carousel backgrounds
 */

import axios from 'axios';

export interface PexelsPhoto {
  id: number;
  url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
  photographer: string;
}

export class PexelsService {
  private apiKey: string;
  private baseUrl = 'https://api.pexels.com/v1';

  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY || '';

    if (!this.apiKey || this.apiKey === 'your_pexels_api_key_here') {
      console.log('[PexelsService] ⚠️  No API key configured, background images disabled');
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.apiKey && this.apiKey !== 'your_pexels_api_key_here';
  }

  /**
   * Search for photos by query
   */
  async searchPhotos(query: string, limit: number = 3): Promise<PexelsPhoto[]> {
    if (!this.isEnabled()) {
      console.log('[PexelsService] Skipping photo search (no API key)');
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        headers: {
          Authorization: this.apiKey
        },
        params: {
          query,
          per_page: limit,
          orientation: 'portrait', // 4:5 works best with portrait
          size: 'large'
        }
      });

      const photos = response.data.photos || [];
      console.log(`[PexelsService] Found ${photos.length} photos for "${query}"`);

      return photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        src: photo.src,
        photographer: photo.photographer
      }));
    } catch (error: any) {
      console.error('[PexelsService] Error fetching photos:', error.message);
      return [];
    }
  }

  /**
   * Get photos for a topic (extracts keywords from topic title)
   */
  async getPhotosForTopic(topicTitle: string, limit: number = 3): Promise<PexelsPhoto[]> {
    if (!this.isEnabled()) {
      return [];
    }

    // Extract pet-related keywords
    const query = this.extractSearchQuery(topicTitle);
    console.log(`[PexelsService] Searching for: "${query}" (from topic: "${topicTitle}")`);

    return await this.searchPhotos(query, limit);
  }

  /**
   * Extract search query from topic title
   * Focus on pet-related visual keywords
   */
  private extractSearchQuery(title: string): string {
    const lower = title.toLowerCase();

    // Pet types
    if (lower.includes('dog') || lower.includes('puppy') || lower.includes('canine')) {
      // Try to extract specific breed or activity
      if (lower.includes('training')) return 'dog training';
      if (lower.includes('agility')) return 'dog agility course';
      if (lower.includes('walking')) return 'person walking dog';
      if (lower.includes('playing')) return 'dog playing';
      if (lower.includes('grooming')) return 'dog grooming';
      if (lower.includes('health') || lower.includes('vet')) return 'veterinarian dog';
      if (lower.includes('food') || lower.includes('eating')) return 'dog eating';
      if (lower.includes('behavior')) return 'happy dog owner';
      if (lower.includes('puppy')) return 'cute puppy';
      return 'happy dog';
    }

    if (lower.includes('cat') || lower.includes('kitten') || lower.includes('feline')) {
      if (lower.includes('playing')) return 'cat playing';
      if (lower.includes('grooming')) return 'cat grooming';
      return 'happy cat';
    }

    // Default to general pet imagery
    return 'pet owner happy';
  }

  /**
   * Get best photo URL from results (large size for quality)
   */
  getBestPhotoUrl(photo: PexelsPhoto): string {
    return photo.src.large2x || photo.src.large;
  }
}
