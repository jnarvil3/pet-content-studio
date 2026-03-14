/**
 * TikTok Integration Tests
 * Verify TikTok-related trending endpoints, pet filtering, and collection trigger
 */

import { describe, test, expect } from 'vitest';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3003';

describe('Trending Videos API', () => {
  test('GET /api/trending/videos returns success with default params', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/videos`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('period');
    expect(result.data).toHaveProperty('videos');
    expect(result.data).toHaveProperty('stats');
    expect(Array.isArray(result.data.videos)).toBe(true);
  });

  test('GET /api/trending/videos?period=today returns today data', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/videos?period=today`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.period).toBe('today');
    expect(result.data).toHaveProperty('hooks');
    expect(result.data.stats).toHaveProperty('totalAnalyzed');
    expect(result.data.stats).toHaveProperty('avgEngagement');
  });

  test('GET /api/trending/videos?petOnly=true filters to pet content', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/videos?petOnly=true`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.petOnly).toBe(true);
    expect(Array.isArray(result.data.videos)).toBe(true);
  });

  test('GET /api/trending/videos?petOnly=false returns unfiltered results', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/videos?petOnly=false`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.petOnly).toBe(false);
  });

  test('petOnly=true returns subset of unfiltered results', async () => {
    const [allResponse, petResponse] = await Promise.all([
      fetch(`${BASE_URL}/api/trending/videos?petOnly=false&period=today`),
      fetch(`${BASE_URL}/api/trending/videos?petOnly=true&period=today`),
    ]);

    const allData = await allResponse.json();
    const petData = await petResponse.json();

    expect(allData.success).toBe(true);
    expect(petData.success).toBe(true);

    // Pet-filtered results should be <= all results
    expect(petData.data.videos.length).toBeLessThanOrEqual(allData.data.videos.length);
  });
});

describe('Trending Hooks API', () => {
  test('GET /api/trending/hooks returns success with default params', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/hooks`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('period');
    expect(result.data).toHaveProperty('hooks');
    expect(result.data).toHaveProperty('stats');
    expect(Array.isArray(result.data.hooks)).toBe(true);
  });

  test('GET /api/trending/hooks?period=today returns today data', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/hooks?period=today`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.period).toBe('today');
    expect(result.data.stats).toHaveProperty('totalAnalyzed');
    expect(result.data.stats).toHaveProperty('avgEngagement');
  });

  test('GET /api/trending/hooks?petOnly=true filters hooks to pet content', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/hooks?petOnly=true`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.petOnly).toBe(true);
    expect(Array.isArray(result.data.hooks)).toBe(true);
  });

  test('GET /api/trending/hooks?petOnly=false returns unfiltered hooks', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/hooks?petOnly=false`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.petOnly).toBe(false);
  });

  test('petOnly=true returns subset of unfiltered hooks', async () => {
    const [allResponse, petResponse] = await Promise.all([
      fetch(`${BASE_URL}/api/trending/hooks?petOnly=false&period=today`),
      fetch(`${BASE_URL}/api/trending/hooks?petOnly=true&period=today`),
    ]);

    const allData = await allResponse.json();
    const petData = await petResponse.json();

    expect(allData.success).toBe(true);
    expect(petData.success).toBe(true);

    // Pet-filtered hooks should be <= all hooks
    expect(petData.data.hooks.length).toBeLessThanOrEqual(allData.data.hooks.length);
  });
});

describe('isPetRelated filtering (via trending endpoints)', () => {
  test('pet-filtered videos contain pet-related themes when results exist', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/videos?petOnly=true&period=today`);
    const result = await response.json();

    expect(result.success).toBe(true);

    const petKeywords = [
      'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal',
      'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper',
      'fur baby', 'vet', 'breed',
    ];

    // Each returned video should have pet-related content_themes
    for (const video of result.data.videos) {
      if (video.content_themes) {
        const lower = video.content_themes.toLowerCase();
        const hasPetKeyword = petKeywords.some(kw => lower.includes(kw));
        expect(hasPetKeyword).toBe(true);
      }
    }
  });

  test('pet-filtered hooks have pet-related examples when results exist', async () => {
    const response = await fetch(`${BASE_URL}/api/trending/hooks?petOnly=true&period=today`);
    const result = await response.json();

    expect(result.success).toBe(true);

    const petKeywords = [
      'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal',
      'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper',
      'fur baby', 'vet', 'breed',
    ];

    // Each returned hook should have at least one pet-related example
    for (const hook of result.data.hooks) {
      if (hook.examples && hook.examples.length > 0) {
        const hasPetExample = hook.examples.some((ex: any) => {
          const titleMatch = petKeywords.some(kw => (ex.title || '').toLowerCase().includes(kw));
          const angleMatch = petKeywords.some(kw => (ex.content_angle || '').toLowerCase().includes(kw));
          return titleMatch || angleMatch;
        });
        expect(hasPetExample).toBe(true);
      }
    }
  });
});

describe('Help / API Info', () => {
  test('GET /api/help/info returns platform info', async () => {
    const response = await fetch(`${BASE_URL}/api/help/info`);
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('platform');
    expect(result.data.platform.name).toBe('Pet Content Studio');
    expect(result.data).toHaveProperty('pages');
    expect(result.data).toHaveProperty('apis');
    expect(result.data).toHaveProperty('workflow');
  });

  test('GET /api/help/info includes TikTok API entry', async () => {
    const response = await fetch(`${BASE_URL}/api/help/info`);
    const result = await response.json();

    expect(result.success).toBe(true);

    const apis = result.data.apis;
    expect(Array.isArray(apis)).toBe(true);

    const tiktokApi = apis.find((api: any) => api.name.toLowerCase().includes('tiktok'));
    expect(tiktokApi).toBeDefined();
    expect(tiktokApi.name).toBe('TikTok Scraper API');
    expect(tiktokApi.usage).toContain('TikTok');
    expect(tiktokApi).toHaveProperty('keyConfigured');
  });

  test('GET /api/help/info includes all expected API entries', async () => {
    const response = await fetch(`${BASE_URL}/api/help/info`);
    const result = await response.json();

    const apiNames = result.data.apis.map((api: any) => api.name);
    expect(apiNames).toContain('OpenAI (GPT-4o)');
    expect(apiNames).toContain('Anthropic (Claude Sonnet 4)');
    expect(apiNames).toContain('ElevenLabs');
    expect(apiNames).toContain('Pexels');
    expect(apiNames).toContain('YouTube Data API');
    expect(apiNames).toContain('TikTok Scraper API');
  });

  test('GET /api/help/info workflow steps are in order', async () => {
    const response = await fetch(`${BASE_URL}/api/help/info`);
    const result = await response.json();

    const steps = result.data.workflow;
    expect(steps.length).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].step).toBe(i + 1);
      expect(steps[i]).toHaveProperty('title');
      expect(steps[i]).toHaveProperty('description');
    }
  });
});

describe('Collection Trigger API', () => {
  test('POST /api/collection/trigger returns a jobId', async () => {
    const response = await fetch(`${BASE_URL}/api/collection/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('jobId');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  test('POST /api/collection/trigger returns unique jobIds', async () => {
    const [response1, response2] = await Promise.all([
      fetch(`${BASE_URL}/api/collection/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch(`${BASE_URL}/api/collection/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);

    const result1 = await response1.json();
    const result2 = await response2.json();

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.jobId).not.toBe(result2.jobId);
  });
});
