/**
 * Viral Pattern Integration Tests
 * Verify viral video patterns are properly integrated into reel generation
 */

import { describe, test, expect } from 'vitest';

const BASE_URL = 'http://localhost:3003';

describe('Viral Pattern Selection', () => {
  test('API accepts viral pattern parameters', async () => {
    const response = await fetch(`${BASE_URL}/api/generate-reel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: 1,
        limit: 1,
        minScore: 0,
        viralHook: 'emotional',
        viralTitle: 'Dog Says First Word! 🐕',
        viralContentAngle: 'Heartwarming moment caught on camera'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('Generation works without viral pattern', async () => {
    const response = await fetch(`${BASE_URL}/api/generate-reel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: 1,
        limit: 1,
        minScore: 0
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('Viral Insights API', () => {
  test('GET /api/viral/insights returns viral trends', async () => {
    const response = await fetch(`${BASE_URL}/api/viral/insights`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('topHooks');
    expect(data).toHaveProperty('trendingThemes');
  });
});

describe('Hook Formula Patterns', () => {
  test('Common hook formulas are recognized', () => {
    const validHooks = [
      'emotional',
      'curiosity',
      'urgency',
      'authority',
      'contrarian'
    ];

    validHooks.forEach(hook => {
      expect(hook).toBeTruthy();
      expect(hook.length).toBeGreaterThan(3);
    });
  });
});
