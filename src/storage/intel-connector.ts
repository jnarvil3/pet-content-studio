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
    const localPath = path.join(process.cwd(), 'data', 'signals.db');
    this.dbPath = dbPath || process.env.INTEL_DATABASE_PATH || localPath;
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

    const localPath = path.join(process.cwd(), 'data', 'signals.db');
    const isLocalDb = path.resolve(this.dbPath) === path.resolve(localPath);
    const opts = isLocalDb ? {} : { readonly: true };
    this.db = new Database(this.dbPath, opts);
    console.log(`[IntelConnector] Connected to intelligence database at ${this.dbPath}${isLocalDb ? ' (read-write)' : ' (readonly)'}`);
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
