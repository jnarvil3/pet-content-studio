/**
 * Content Storage - Approval Queue Database
 * Stores generated content and tracks approval status
 */

import Database from 'better-sqlite3';
import { GeneratedContent, ContentFeedback } from '../types/content';
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
        content_type TEXT NOT NULL CHECK(content_type IN ('carousel', 'reel', 'linkedin')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'published', 'revision_requested')),

        -- Carousel-specific
        carousel_content TEXT, -- JSON
        carousel_images TEXT, -- JSON array of file paths

        -- Reel-specific
        reel_script TEXT, -- JSON
        reel_video_path TEXT,

        -- LinkedIn-specific
        linkedin_content TEXT, -- JSON

        -- Version tracking
        version INTEGER DEFAULT 1,
        parent_id INTEGER REFERENCES generated_content(id),

        -- Metadata
        source_url TEXT,
        generated_at TEXT NOT NULL,
        approved_at TEXT,
        rejected_at TEXT,
        rejection_reason TEXT,
        published_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_status ON generated_content(status);
      CREATE INDEX IF NOT EXISTS idx_signal_id ON generated_content(signal_id);
      CREATE INDEX IF NOT EXISTS idx_content_type ON generated_content(content_type);
      CREATE TABLE IF NOT EXISTS content_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        feedback_type TEXT NOT NULL CHECK(feedback_type IN ('edit_request', 'rejection', 'comment')),
        feedback_text TEXT NOT NULL,
        specific_changes TEXT, -- JSON
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'addressed', 'dismissed')),
        created_at TEXT NOT NULL,
        addressed_at TEXT,
        FOREIGN KEY (content_id) REFERENCES generated_content(id)
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_content ON content_feedback(content_id);

      CREATE TABLE IF NOT EXISTS trending_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT NOT NULL,
        snapshot_period TEXT NOT NULL,
        data_type TEXT NOT NULL,
        top_items TEXT NOT NULL,
        pet_only INTEGER DEFAULT 0,
        total_analyzed INTEGER DEFAULT 0,
        avg_engagement REAL DEFAULT 0.0,
        created_at TEXT NOT NULL,
        UNIQUE(snapshot_date, snapshot_period, data_type, pet_only)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshot_date ON trending_snapshots(snapshot_date);
      CREATE INDEX IF NOT EXISTS idx_data_type ON trending_snapshots(data_type);
      CREATE INDEX IF NOT EXISTS idx_pet_only ON trending_snapshots(pet_only);
    `);

    // Migrate existing tables (must run before creating indexes on new columns)
    this.migrate();

    // Create indexes that depend on migrated columns
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_parent_id ON generated_content(parent_id);
    `);
  }

  /**
   * Run schema migrations for existing databases
   */
  private migrate(): void {
    const cols = this.db.prepare("PRAGMA table_info(generated_content)").all() as any[];
    const colNames = cols.map((c: any) => c.name);

    if (!colNames.includes('version')) {
      this.db.exec(`ALTER TABLE generated_content ADD COLUMN version INTEGER DEFAULT 1`);
    }
    if (!colNames.includes('parent_id')) {
      this.db.exec(`ALTER TABLE generated_content ADD COLUMN parent_id INTEGER REFERENCES generated_content(id)`);
    }
    if (!colNames.includes('linkedin_content')) {
      this.db.exec(`ALTER TABLE generated_content ADD COLUMN linkedin_content TEXT`);
    }

    // Drop the old UNIQUE constraint by recreating the table if needed
    // Check if the unique constraint exists (signal_id, content_type)
    const indexes = this.db.prepare("PRAGMA index_list(generated_content)").all() as any[];
    const hasUniqueConstraint = indexes.some((idx: any) => idx.unique === 1 && idx.name.includes('sqlite_autoindex'));
    if (hasUniqueConstraint) {
      // Recreate table without the UNIQUE constraint
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS generated_content_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          signal_id INTEGER NOT NULL,
          content_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          carousel_content TEXT,
          carousel_images TEXT,
          reel_script TEXT,
          reel_video_path TEXT,
          linkedin_content TEXT,
          version INTEGER DEFAULT 1,
          parent_id INTEGER REFERENCES generated_content_new(id),
          source_url TEXT,
          generated_at TEXT NOT NULL,
          approved_at TEXT,
          rejected_at TEXT,
          rejection_reason TEXT,
          published_at TEXT
        );
        INSERT OR IGNORE INTO generated_content_new SELECT
          id, signal_id, content_type, status,
          carousel_content, carousel_images, reel_script, reel_video_path,
          linkedin_content, version, parent_id,
          source_url, generated_at, approved_at, rejected_at, rejection_reason, published_at
        FROM generated_content;
        DROP TABLE generated_content;
        ALTER TABLE generated_content_new RENAME TO generated_content;
      `);
    }
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
        linkedin_content,
        version, parent_id,
        source_url, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      content.signal_id,
      content.content_type,
      content.status,
      content.carousel_content ? JSON.stringify(content.carousel_content) : null,
      content.carousel_images ? JSON.stringify(content.carousel_images) : null,
      content.reel_script ? JSON.stringify(content.reel_script) : null,
      content.reel_video_path || null,
      content.linkedin_content ? JSON.stringify(content.linkedin_content) : null,
      content.version || 1,
      content.parent_id || null,
      content.source_url || null,
      content.generated_at
    );

    const id = result.lastInsertRowid as number;
    console.log(`[ContentStorage] Saved content #${id} (signal #${content.signal_id}, ${content.content_type}, v${content.version || 1})`);
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
  getByStatus(status: 'pending' | 'approved' | 'rejected' | 'published' | 'revision_requested'): GeneratedContent[] {
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
   * Request revision on content
   */
  requestRevision(id: number): void {
    this.db.prepare(`
      UPDATE generated_content SET status = 'revision_requested' WHERE id = ?
    `).run(id);
    console.log(`[ContentStorage] Revision requested for content #${id}`);
  }

  /**
   * Save feedback for a content item
   */
  saveFeedback(feedback: ContentFeedback): number {
    const result = this.db.prepare(`
      INSERT INTO content_feedback (content_id, feedback_type, feedback_text, specific_changes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      feedback.content_id,
      feedback.feedback_type,
      feedback.feedback_text,
      feedback.specific_changes ? JSON.stringify(feedback.specific_changes) : null,
      feedback.status || 'pending',
      feedback.created_at
    );
    return result.lastInsertRowid as number;
  }

  /**
   * Get feedback for a content item
   */
  getFeedback(contentId: number): ContentFeedback[] {
    const rows = this.db.prepare(`
      SELECT * FROM content_feedback WHERE content_id = ? ORDER BY created_at DESC
    `).all(contentId) as any[];
    return rows.map(r => ({
      ...r,
      specific_changes: r.specific_changes ? JSON.parse(r.specific_changes) : undefined
    }));
  }

  /**
   * Mark feedback as addressed
   */
  addressFeedback(feedbackId: number): void {
    this.db.prepare(`
      UPDATE content_feedback SET status = 'addressed', addressed_at = ? WHERE id = ?
    `).run(new Date().toISOString(), feedbackId);
  }

  /**
   * Get version chain for a content item (all versions of same signal+type)
   */
  getVersions(contentId: number): GeneratedContent[] {
    const content = this.get(contentId);
    if (!content) return [];

    // Find the root (original)
    let rootId = contentId;
    if (content.parent_id) {
      let parent = this.get(content.parent_id);
      while (parent?.parent_id) {
        rootId = parent.id!;
        parent = this.get(parent.parent_id);
      }
      if (parent) rootId = parent.id!;
    }

    // Get all versions in the chain
    const rows = this.db.prepare(`
      WITH RECURSIVE version_chain(id) AS (
        SELECT ?
        UNION ALL
        SELECT gc.id FROM generated_content gc
        JOIN version_chain vc ON gc.parent_id = vc.id
      )
      SELECT g.* FROM generated_content g
      JOIN version_chain v ON g.id = v.id
      ORDER BY g.version ASC
    `).all(rootId) as any[];

    return rows.map(r => this.parseContent(r));
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
    revision_requested: number;
  } {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'revision_requested' THEN 1 ELSE 0 END) as revision_requested
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
      linkedin_content: row.linkedin_content ? JSON.parse(row.linkedin_content) : undefined,
      version: row.version || 1,
      parent_id: row.parent_id || undefined,
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
