/**
 * Intelligence Collector Database Connector
 * Reads signals from the pet-intel-collector database
 */

import Database from 'better-sqlite3';
import { Signal } from '../types/signal';
import * as path from 'path';
import * as fs from 'fs';

export class IntelConnector {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Always use the same path as SignalCollector to avoid mismatches
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'signals.db');
    console.log(`[IntelConnector] DB path: ${this.dbPath}`);
    this.tryConnect();
  }

  /**
   * Attempt to connect to the database. Called on construction and
   * lazily on each query so that signals created by the built-in
   * SignalCollector become visible without a server restart.
   */
  private tryConnect(): void {
    if (this.db) return;
    if (!fs.existsSync(this.dbPath)) return;

    this.db = new Database(this.dbPath);
    console.log(`[IntelConnector] Connected to intelligence database at ${this.dbPath}`);
  }

  /**
   * Get all relevant signals (score >= 70) that haven't been used yet
   */
  getRelevantSignals(limit: number = 50): Signal[] {
    this.tryConnect();
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT * FROM signals
      WHERE is_relevant = 1
      AND scored_at IS NOT NULL
      ORDER BY relevance_score DESC, collected_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => this.parseSignal(row));
  }

  /**
   * Get a specific signal by ID
   */
  getSignal(id: number): Signal | null {
    this.tryConnect();
    if (!this.db) return null;
    const row = this.db.prepare(`
      SELECT * FROM signals
      WHERE id = ?
    `).get(id) as any;

    return row ? this.parseSignal(row) : null;
  }

  /**
   * Get top signals above a certain score
   */
  getTopSignals(minScore: number = 80, limit: number = 20): Signal[] {
    this.tryConnect();
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT * FROM signals
      WHERE relevance_score >= ?
      AND scored_at IS NOT NULL
      ORDER BY relevance_score DESC, collected_at DESC
      LIMIT ?
    `).all(minScore, limit) as any[];

    return rows.map(row => this.parseSignal(row));
  }

  /**
   * Search signals by keyword (title or description)
   * Uses word-boundary-aware patterns to avoid substring false positives
   * (e.g. "cat" should not match "locations")
   */
  searchByKeyword(keyword: string, limit: number = 10): Signal[] {
    this.tryConnect();
    if (!this.db) return [];

    // For multi-word phrases, simple substring match is fine (specific enough)
    // For single words, use word-boundary patterns to avoid false positives
    const isPhrase = keyword.includes(' ');
    if (isPhrase) {
      const pattern = `%${keyword}%`;
      const rows = this.db.prepare(`
        SELECT * FROM signals
        WHERE (title LIKE ? OR description LIKE ?)
        AND scored_at IS NOT NULL
        AND relevance_score >= 50
        ORDER BY relevance_score DESC, collected_at DESC
        LIMIT ?
      `).all(pattern, pattern, limit) as any[];
      return rows.map(row => this.parseSignal(row));
    }

    // Single word: only search titles (descriptions are too noisy) with word-boundary patterns
    const startPattern = `${keyword} %`;
    const midPattern = `% ${keyword} %`;
    const endPattern = `% ${keyword}`;
    const exactPattern = keyword;
    const rows = this.db.prepare(`
      SELECT * FROM signals
      WHERE (title LIKE ? OR title LIKE ? OR title LIKE ? OR title = ?)
      AND scored_at IS NOT NULL
      AND relevance_score >= 50
      ORDER BY relevance_score DESC, collected_at DESC
      LIMIT ?
    `).all(startPattern, midPattern, endPattern, exactPattern, limit) as any[];

    return rows.map(row => this.parseSignal(row));
  }

  /**
   * Get signals by source
   */
  getSignalsBySource(source: string, limit: number = 20): Signal[] {
    this.tryConnect();
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT * FROM signals
      WHERE source = ?
      AND is_relevant = 1
      ORDER BY relevance_score DESC, collected_at DESC
      LIMIT ?
    `).all(source, limit) as any[];

    return rows.map(row => this.parseSignal(row));
  }

  /**
   * Parse database row to Signal type
   */
  private parseSignal(row: any): Signal {
    return {
      id: row.id,
      source: row.source,
      title: row.title,
      description: row.description,
      url: row.url,
      metadata: JSON.parse(row.metadata),
      collected_at: row.collected_at,
      relevance_score: row.relevance_score,
      relevance_reason: row.relevance_reason,
      is_relevant: row.is_relevant === 1,
      scored_at: row.scored_at
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db?.close();
  }
}
