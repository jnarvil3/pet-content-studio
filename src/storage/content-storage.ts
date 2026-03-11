/**
 * Content Storage - Approval Queue Database
 * Stores generated content and tracks approval status
 */

import Database from 'better-sqlite3';
import { GeneratedContent } from '../types/content';
import * as path from 'path';
import * as fs from 'fs';

export class ContentStorage {
  private db: Database.Database;

  constructor(dbPath: string = './data/content.db') {
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initialize();

    console.log(`[ContentStorage] Connected to content database at ${dbPath}`);
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_id INTEGER NOT NULL,
        content_type TEXT NOT NULL CHECK(content_type IN ('carousel', 'reel')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'published')),

        -- Carousel-specific
        carousel_content TEXT, -- JSON
        carousel_images TEXT, -- JSON array of file paths

        -- Reel-specific
        reel_script TEXT, -- JSON
        reel_video_path TEXT,

        -- Metadata
        source_url TEXT,
        generated_at TEXT NOT NULL,
        approved_at TEXT,
        rejected_at TEXT,
        rejection_reason TEXT,
        published_at TEXT,

        UNIQUE(signal_id, content_type)
      );

      CREATE INDEX IF NOT EXISTS idx_status ON generated_content(status);
      CREATE INDEX IF NOT EXISTS idx_signal_id ON generated_content(signal_id);
      CREATE INDEX IF NOT EXISTS idx_content_type ON generated_content(content_type);
    `);
  }

  /**
   * Save generated content to approval queue
   */
  save(content: GeneratedContent): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO generated_content (
        signal_id, content_type, status,
        carousel_content, carousel_images,
        reel_script, reel_video_path,
        source_url, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      content.signal_id,
      content.content_type,
      content.status,
      content.carousel_content ? JSON.stringify(content.carousel_content) : null,
      content.carousel_images ? JSON.stringify(content.carousel_images) : null,
      content.reel_script ? JSON.stringify(content.reel_script) : null,
      content.reel_video_path || null,
      content.source_url || null,
      content.generated_at
    );

    const id = result.lastInsertRowid as number;
    console.log(`[ContentStorage] Saved content #${id} (signal #${content.signal_id}, ${content.content_type})`);
    return id;
  }

  /**
   * Get content by ID
   */
  get(id: number): GeneratedContent | null {
    const row = this.db.prepare('SELECT * FROM generated_content WHERE id = ?').get(id) as any;
    return row ? this.parseContent(row) : null;
  }

  /**
   * Get all content by status
   */
  getByStatus(status: 'pending' | 'approved' | 'rejected' | 'published'): GeneratedContent[] {
    const rows = this.db.prepare(`
      SELECT * FROM generated_content
      WHERE status = ?
      ORDER BY generated_at DESC
    `).all(status) as any[];

    return rows.map(row => this.parseContent(row));
  }

  /**
   * Get pending content (approval queue)
   */
  getPendingQueue(): GeneratedContent[] {
    return this.getByStatus('pending');
  }

  /**
   * Approve content
   */
  approve(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE generated_content
      SET status = 'approved', approved_at = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), id);
    console.log(`[ContentStorage] ✅ Approved content #${id}`);
  }

  /**
   * Reject content
   */
  reject(id: number, reason?: string): void {
    const stmt = this.db.prepare(`
      UPDATE generated_content
      SET status = 'rejected', rejected_at = ?, rejection_reason = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), reason || null, id);
    console.log(`[ContentStorage] ❌ Rejected content #${id}${reason ? `: ${reason}` : ''}`);
  }

  /**
   * Mark content as published
   */
  markPublished(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE generated_content
      SET status = 'published', published_at = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), id);
    console.log(`[ContentStorage] 📤 Published content #${id}`);
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    published: number;
  } {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM generated_content
    `).get() as any;

    return stats;
  }

  /**
   * Parse database row to GeneratedContent
   */
  private parseContent(row: any): GeneratedContent {
    return {
      id: row.id,
      signal_id: row.signal_id,
      content_type: row.content_type,
      status: row.status,
      carousel_content: row.carousel_content ? JSON.parse(row.carousel_content) : undefined,
      carousel_images: row.carousel_images ? JSON.parse(row.carousel_images) : undefined,
      reel_script: row.reel_script ? JSON.parse(row.reel_script) : undefined,
      reel_video_path: row.reel_video_path || undefined,
      source_url: row.source_url || undefined,
      generated_at: row.generated_at,
      approved_at: row.approved_at || undefined,
      rejected_at: row.rejected_at || undefined,
      rejection_reason: row.rejection_reason || undefined,
      published_at: row.published_at || undefined
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
