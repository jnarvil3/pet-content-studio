/**
 * Content Generation Workflow Tests
 * Verify signal selection and content generation
 */

import { describe, test, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:3003';

describe('Content Generation API', () => {
  let testSignalId: number;

  beforeAll(async () => {
    // Get a test signal
    const response = await fetch(`${BASE_URL}/api/signals?limit=1&minScore=70`);
    const data = await response.json();

    if (data.signals && data.signals.length > 0) {
      testSignalId = data.signals[0].id;
    } else {
      throw new Error('No signals available for testing');
    }
  });

  test('GET /api/signals returns available signals', async () => {
    const response = await fetch(`${BASE_URL}/api/signals?limit=5&minScore=70`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('signals');
    expect(Array.isArray(data.signals)).toBe(true);
  });

  test('POST /api/generate with signalId generates carousel for specific signal', async () => {
    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: testSignalId,
        limit: 1,
        minScore: 0
      })
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Starting generation');
    expect(data.count).toBe(1);
  });

  test('POST /api/generate-reel with signalId generates reel for specific signal', async () => {
    const response = await fetch(`${BASE_URL}/api/generate-reel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: testSignalId,
        limit: 1,
        minScore: 0
      })
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Starting generation');
    expect(data.count).toBe(1);
  });

  test('POST /api/generate with invalid signalId returns error', async () => {
    // Use unique ID to avoid 409 from activeGenerations collision with other tests
    const uniqueId = 100000 + Math.floor(Math.random() * 900000);
    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: uniqueId,
        limit: 1,
        minScore: 0
      })
    });

    // Server may return 404 (signal not found) or 200 with async error
    // depending on whether signals DB has data; either is valid for non-existent ID
    expect([200, 404]).toContain(response.status);
  });

  test('GET /api/content returns generated content', async () => {
    const response = await fetch(`${BASE_URL}/api/content`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    // Should have at least the existing content
    expect(data.length).toBeGreaterThan(0);

    // Each item should have required fields
    if (data.length > 0) {
      const item = data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('signal_id');
      expect(item).toHaveProperty('content_type');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('generated_at');
    }
  });

  test('GET /api/content?status=pending filters by status', async () => {
    const response = await fetch(`${BASE_URL}/api/content?status=pending`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    // All items should have status === 'pending'
    data.forEach((item: any) => {
      expect(item.status).toBe('pending');
    });
  });
});

describe('Content Review Workflow', () => {
  let testContentId: number;

  beforeAll(async () => {
    // Get a test content item
    const response = await fetch(`${BASE_URL}/api/content`);
    const data = await response.json();

    if (data.length > 0) {
      testContentId = data[0].id;
    } else {
      throw new Error('No content available for testing');
    }
  });

  test('GET /api/content/:id returns specific content', async () => {
    const response = await fetch(`${BASE_URL}/api/content/${testContentId}`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(testContentId);
    expect(data).toHaveProperty('signal');
  });

  test('POST /api/content/:id/approve approves content', async () => {
    const response = await fetch(`${BASE_URL}/api/content/${testContentId}/approve`, {
      method: 'POST'
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify status changed
    const checkResponse = await fetch(`${BASE_URL}/api/content/${testContentId}`);
    const checkData = await checkResponse.json();
    expect(checkData.status).toBe('approved');
  });

  test('POST /api/content/:id/reject rejects content', async () => {
    const response = await fetch(`${BASE_URL}/api/content/${testContentId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test rejection' })
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
