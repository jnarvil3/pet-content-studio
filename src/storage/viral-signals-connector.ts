/**
 * Viral Signals Database Connector
 * Reads viral content metrics from the viral-social-media-analyzer database
 */

import Database from 'better-sqlite3';
import * as path from 'path';

export interface ViralHook {
  hook_formula: string;
  count: number;
  avg_engagement_rate: number;
  examples?: ViralVideoExample[];
}

export interface ViralVideoExample {
  title: string;
  engagement_rate: number;
  content_angle?: string;
}

export interface ViralTheme {
  content_themes: string;
  engagement_rate: number;
  title: string;
  url: string;
}

export interface ViralPattern {
  viral_pattern: string;
  emotional_trigger: string;
  hook_formula: string;
  engagement_rate: number;
  title: string;
  collected_at: string;
}

export interface ViralStats {
  total_analyzed: number;
  avg_engagement: number;
  top_platform: string;
  date_range_days: number;
}

export class ViralSignalsConnector {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '../../../../viral-social-media-analyzer/data/viral-signals.db');
    const finalPath = dbPath || process.env.VIRAL_DATABASE_PATH || defaultPath;

    this.db = new Database(finalPath);
    // Flush WAL data so we can read recently written rows
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)');
    } catch (e) {
      // Ignore if WAL mode not active
    }
    console.log(`[ViralSignalsConnector] Connected to viral signals database at ${finalPath}`);
  }

  /**
   * Get top performing hook formulas from recent viral content
   * Now includes actual video examples for each hook type
   */
  getTopViralHooks(days: number = 7, limit: number = 10, includeExamples: boolean = true): ViralHook[] {
    let effectiveDays = days;
    let rows = this._queryHooks(effectiveDays, limit);

    // Widen date range if no results found
    if (rows.length === 0 && effectiveDays < 90) {
      for (const fallback of [30, 90]) {
        if (fallback <= effectiveDays) continue;
        rows = this._queryHooks(fallback, limit);
        if (rows.length > 0) { effectiveDays = fallback; break; }
      }
    }

    if (includeExamples) {
      for (const hook of rows) {
        hook.examples = this.getHookExamples(hook.hook_formula, effectiveDays, 3);
      }
    }

    return rows;
  }

  private _queryHooks(days: number, limit: number): ViralHook[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return this.db.prepare(`
      SELECT
        hook_formula,
        COUNT(*) as count,
        AVG(engagement_rate) as avg_engagement_rate
      FROM viral_signals
      WHERE hook_formula IS NOT NULL
        AND text_analyzed_at IS NOT NULL
        AND collected_at >= ?
      GROUP BY hook_formula
      ORDER BY avg_engagement_rate DESC, count DESC
      LIMIT ?
    `).all(cutoffDate, limit) as ViralHook[];
  }

  /**
   * Get specific video examples for a hook formula
   */
  private getHookExamples(hookFormula: string, days: number = 7, limit: number = 3): ViralVideoExample[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const examples = this.db.prepare(`
      SELECT
        title,
        engagement_rate,
        content_angle
      FROM viral_signals
      WHERE hook_formula = ?
        AND text_analyzed_at IS NOT NULL
        AND collected_at >= ?
        AND engagement_rate > 0
      ORDER BY engagement_rate DESC
      LIMIT ?
    `).all(hookFormula, cutoffDate, limit) as ViralVideoExample[];

    return examples;
  }

  /**
   * Get trending content themes from viral videos
   */
  getTrendingThemes(days: number = 7, limit: number = 20): ViralTheme[] {
    let rows = this._queryThemes(days, limit);

    if (rows.length === 0 && days < 90) {
      for (const fallback of [30, 90]) {
        if (fallback <= days) continue;
        rows = this._queryThemes(fallback, limit);
        if (rows.length > 0) break;
      }
    }

    return rows;
  }

  private _queryThemes(days: number, limit: number): ViralTheme[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return this.db.prepare(`
      SELECT
        content_themes,
        engagement_rate,
        title,
        url
      FROM viral_signals
      WHERE content_themes IS NOT NULL
        AND text_analyzed_at IS NOT NULL
        AND collected_at >= ?
      ORDER BY engagement_rate DESC
      LIMIT ?
    `).all(cutoffDate, limit) as ViralTheme[];
  }

  /**
   * Get viral patterns with emotional triggers
   */
  getViralPatterns(days: number = 7, limit: number = 10): ViralPattern[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const rows = this.db.prepare(`
      SELECT
        viral_pattern,
        emotional_trigger,
        hook_formula,
        engagement_rate,
        title,
        collected_at
      FROM viral_signals
      WHERE viral_pattern IS NOT NULL
        AND emotional_trigger IS NOT NULL
        AND text_analyzed_at IS NOT NULL
        AND collected_at >= ?
      ORDER BY engagement_rate DESC
      LIMIT ?
    `).all(cutoffDate, limit) as ViralPattern[];

    return rows;
  }

  /**
   * Get overall viral statistics
   */
  getViralStats(days: number = 7): ViralStats {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_analyzed,
        AVG(engagement_rate) as avg_engagement,
        (SELECT platform FROM viral_signals
         WHERE collected_at >= ?
         GROUP BY platform
         ORDER BY COUNT(*) DESC
         LIMIT 1) as top_platform
      FROM viral_signals
      WHERE text_analyzed_at IS NOT NULL
        AND collected_at >= ?
    `).get(cutoffDate, cutoffDate) as any;

    return {
      total_analyzed: stats.total_analyzed || 0,
      avg_engagement: stats.avg_engagement || 0,
      top_platform: stats.top_platform || 'unknown',
      date_range_days: days
    };
  }

  /**
   * Get best performing emotional triggers
   */
  getTopEmotionalTriggers(days: number = 7, limit: number = 5): Array<{trigger: string, avg_engagement: number, count: number}> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const rows = this.db.prepare(`
      SELECT
        emotional_trigger as trigger,
        AVG(engagement_rate) as avg_engagement,
        COUNT(*) as count
      FROM viral_signals
      WHERE emotional_trigger IS NOT NULL
        AND text_analyzed_at IS NOT NULL
        AND collected_at >= ?
      GROUP BY emotional_trigger
      ORDER BY avg_engagement DESC
      LIMIT ?
    `).all(cutoffDate, limit) as any[];

    return rows;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
