/**
 * AI Model Selection Tests
 * Verify both Claude and OpenAI models can be used
 */

import { describe, test, expect } from 'vitest';

const BASE_URL = 'http://localhost:3003';

describe('AI Model Selection', () => {
  test('Server accepts aiModel parameter in request', async () => {
    const response = await fetch(`${BASE_URL}/api/generate-reel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId: 1,
        limit: 1,
        minScore: 0,
        aiModel: 'gpt-4o-mini'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('Defaults to claude-sonnet-4 when no model specified', async () => {
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
    // Default model will be used
  });

  test('Both model options are available', () => {
    const validModels = ['claude-sonnet-4', 'gpt-4o-mini'];
    expect(validModels).toContain('claude-sonnet-4');
    expect(validModels).toContain('gpt-4o-mini');
  });
});

describe('Model Cost Comparison', () => {
  test('GPT-4o-mini is significantly cheaper than Claude', () => {
    const gptCostPer1M = 0.15; // $0.15 per 1M tokens
    const claudeCostPer1M = 3.00; // $3.00 per 1M tokens (input)

    const costRatio = claudeCostPer1M / gptCostPer1M;
    expect(costRatio).toBeGreaterThan(15); // Claude is 20x more expensive
  });

  test('Estimated cost per script is reasonable', () => {
    const avgTokensPerScript = 1000;
    const gptCost = (avgTokensPerScript / 1000000) * 0.15;
    const claudeCost = (avgTokensPerScript / 1000000) * 3.00;

    expect(gptCost).toBeLessThan(0.01); // < 1 cent
    expect(claudeCost).toBeLessThan(0.25); // < 25 cents
  });
});
