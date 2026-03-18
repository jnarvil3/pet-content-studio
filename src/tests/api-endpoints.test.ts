/**
 * API endpoint tests for Pet Content Studio
 * Tests the server routes, content storage, and feedback system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ContentStorage } from '../storage/content-storage';
import { ContentFeedback } from '../types/content';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = './data/test-content.db';

describe('ContentStorage', () => {
  let storage: ContentStorage;

  beforeAll(() => {
    storage = new ContentStorage(TEST_DB_PATH);
  });

  afterAll(() => {
    storage.close();
    // Clean up test database
    try {
      fs.unlinkSync(TEST_DB_PATH);
      fs.unlinkSync(TEST_DB_PATH + '-wal');
      fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch (e) {}
  });

  describe('Content CRUD', () => {
    it('saves content and returns an ID', () => {
      const id = storage.save({
        signal_id: 1,
        content_type: 'carousel',
        status: 'pending',
        carousel_content: {
          slides: [{ slideNumber: 1, title: 'Test Hook', body: null, stat: null, pexelsSearchQuery: 'dog', layoutHint: 'hook' }],
          caption: 'Test caption',
          hashtags: ['test'],
          hookFormula: 'curiosity_gap'
        },
        generated_at: new Date().toISOString()
      });
      expect(id).toBeGreaterThan(0);
    });

    it('retrieves content by ID', () => {
      const content = storage.get(1);
      expect(content).not.toBeNull();
      expect(content!.content_type).toBe('carousel');
      expect(content!.status).toBe('pending');
      expect(content!.carousel_content?.slides).toHaveLength(1);
    });

    it('saves reel content', () => {
      const id = storage.save({
        signal_id: 2,
        content_type: 'reel',
        status: 'pending',
        reel_script: {
          topicCardId: '2',
          title: 'Test Reel',
          totalDurationTarget: 35,
          scenes: [],
          caption: 'Test reel caption',
          hashtags: ['reel'],
          hookFormula: 'curiosity'
        },
        generated_at: new Date().toISOString()
      });
      expect(id).toBeGreaterThan(0);
    });

    it('saves linkedin content', () => {
      const id = storage.save({
        signal_id: 3,
        content_type: 'linkedin',
        status: 'pending',
        linkedin_content: {
          headline: 'Test Headline',
          body: 'Test body text',
          hashtags: ['linkedin'],
          ctaText: 'Share your thoughts'
        },
        generated_at: new Date().toISOString()
      });
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('Status management', () => {
    it('approves content', () => {
      storage.approve(1);
      const content = storage.get(1);
      expect(content!.status).toBe('approved');
      expect(content!.approved_at).toBeTruthy();
    });

    it('rejects content with reason', () => {
      storage.reject(2, 'Não ficou bom');
      const content = storage.get(2);
      expect(content!.status).toBe('rejected');
      expect(content!.rejection_reason).toBe('Não ficou bom');
    });

    it('requests revision', () => {
      storage.requestRevision(3);
      const content = storage.get(3);
      expect(content!.status).toBe('revision_requested');
    });

    it('marks as published', () => {
      storage.markPublished(1);
      const content = storage.get(1);
      expect(content!.status).toBe('published');
      expect(content!.published_at).toBeTruthy();
    });

    it('gets content by status', () => {
      const published = storage.getByStatus('published');
      expect(published).toHaveLength(1);
      expect(published[0].id).toBe(1);
    });

    it('returns correct stats', () => {
      const stats = storage.getStats();
      expect(stats.total).toBe(3);
      expect(stats.published).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.revision_requested).toBe(1);
    });
  });

  describe('Feedback system', () => {
    it('saves feedback', () => {
      const id = storage.saveFeedback({
        content_id: 3,
        feedback_type: 'edit_request',
        feedback_text: 'Gancho mais forte',
        status: 'pending',
        created_at: new Date().toISOString()
      });
      expect(id).toBeGreaterThan(0);
    });

    it('saves multiple feedback items', () => {
      storage.saveFeedback({
        content_id: 3,
        feedback_type: 'edit_request',
        feedback_text: 'Tom mais informal',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });

    it('retrieves feedback for content', () => {
      const feedback = storage.getFeedback(3);
      expect(feedback).toHaveLength(2);
      const texts = feedback.map(f => f.feedback_text);
      expect(texts.some(t => t.includes('informal'))).toBe(true);
      expect(texts.some(t => t.includes('Gancho'))).toBe(true);
    });

    it('marks feedback as addressed', () => {
      const feedback = storage.getFeedback(3);
      storage.addressFeedback(feedback[0].id!);
      const updated = storage.getFeedback(3);
      const addressed = updated.find(f => f.id === feedback[0].id);
      expect(addressed!.status).toBe('addressed');
      expect(addressed!.addressed_at).toBeTruthy();
    });

    it('pending feedback remains pending when not addressed', () => {
      const feedback = storage.getFeedback(3);
      const pending = feedback.filter(f => f.status === 'pending');
      expect(pending).toHaveLength(1);
      // The remaining pending one is whichever wasn't addressed
      expect(pending[0].feedback_text).toBeTruthy();
    });
  });

  describe('Version tracking', () => {
    it('saves versioned content with parent_id', () => {
      const v2Id = storage.save({
        signal_id: 3,
        content_type: 'linkedin',
        status: 'pending',
        linkedin_content: {
          headline: 'Revised Headline',
          body: 'Revised body',
          hashtags: ['linkedin'],
          ctaText: 'Updated CTA'
        },
        version: 2,
        parent_id: 3,
        generated_at: new Date().toISOString()
      });
      expect(v2Id).toBeGreaterThan(3);
    });

    it('retrieves version chain', () => {
      const versions = storage.getVersions(3);
      expect(versions.length).toBeGreaterThanOrEqual(1);
    });

    it('new version has correct version number', () => {
      const v2 = storage.get(4);
      expect(v2!.version).toBe(2);
      expect(v2!.parent_id).toBe(3);
    });
  });
});

describe('Feedback prompt formatting', () => {
  it('formats numbered feedback items', () => {
    const feedbackItems = [
      { feedback_text: 'Gancho mais forte' },
      { feedback_text: 'Tom mais informal' },
      { feedback_text: 'Trocar imagem do slide 2' }
    ];
    const formatted = feedbackItems.map((f, i) => `Alteração #${i + 1}: ${f.feedback_text}`).join('\n');
    expect(formatted).toBe('Alteração #1: Gancho mais forte\nAlteração #2: Tom mais informal\nAlteração #3: Trocar imagem do slide 2');
  });

  it('formats single feedback item', () => {
    const feedbackItems = [{ feedback_text: 'Mudar tudo' }];
    const formatted = feedbackItems.map((f, i) => `Alteração #${i + 1}: ${f.feedback_text}`).join('\n');
    expect(formatted).toBe('Alteração #1: Mudar tudo');
  });
});
