/**
 * Snapshot Manager Service
 * Manages historical trending data snapshots for videos and hooks
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface TrendingSnapshot {
  id?: number;
  snapshot_date: string;
  snapshot_period: string;
  data_type: 'videos' | 'hooks' | 'themes';
  top_items: any[];
  pet_only: boolean;
  total_analyzed: number;
  avg_engagement: number;
  created_at: string;
}

export interface HistoricalData {
  period: string;
  startDate: string;
  endDate: string;
  items: any[];
  totalAnalyzed: number;
  avgEngagement: number;
}

export class SnapshotManager {
  private db: Database.Database;

  constructor(dbPath: string = './data/content.db') {
    const resolvedPath = path.resolve(dbPath);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    console.log(`[SnapshotManager] Connected to database: ${resolvedPath}`);
  }

  /**
   * Create a daily snapshot of trending data
   */
  async createDailySnapshot(
    date: string,
    dataType: 'videos' | 'hooks' | 'themes',
    topItems: any[],
    petOnly: boolean,
    totalAnalyzed: number = 0,
    avgEngagement: number = 0.0
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trending_snapshots (
        snapshot_date,
        snapshot_period,
        data_type,
        top_items,
        pet_only,
        total_analyzed,
        avg_engagement,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      date,
      'daily',
      dataType,
      JSON.stringify(topItems),
      petOnly ? 1 : 0,
      totalAnalyzed,
      avgEngagement,
      new Date().toISOString()
    );

    console.log(`[SnapshotManager] Created ${dataType} snapshot for ${date} (pet: ${petOnly})`);
  }

  /**
   * Get historical trending data for a specific period
   */
  async getHistoricalData(
    period: 'today' | '7days' | '30days' | '90days',
    dataType: 'videos' | 'hooks' | 'themes',
    petOnly: boolean
  ): Promise<HistoricalData> {
    const { startDate, endDate } = this.calculateDateRange(period);

    // Query snapshots within the date range
    const stmt = this.db.prepare(`
      SELECT * FROM trending_snapshots
      WHERE data_type = ?
      AND pet_only = ?
      AND snapshot_date >= ?
      AND snapshot_date <= ?
      ORDER BY snapshot_date DESC
    `);

    const snapshots = stmt.all(
      dataType,
      petOnly ? 1 : 0,
      startDate,
      endDate
    ) as any[];

    console.log(`[SnapshotManager] Found ${snapshots.length} snapshots for ${dataType} (${period}, pet: ${petOnly})`);

    // If no snapshots found and period is 'today', return empty data
    // (live data will be fetched by the API endpoint as fallback)
    if (snapshots.length === 0) {
      return {
        period,
        startDate,
        endDate,
        items: [],
        totalAnalyzed: 0,
        avgEngagement: 0.0
      };
    }

    // Aggregate items from all snapshots
    const aggregatedItems = new Map<string, any>();
    let totalAnalyzed = 0;
    let avgEngagement = 0.0;
    let snapshotCount = 0;

    for (const snapshot of snapshots) {
      const items = JSON.parse(snapshot.top_items);

      // Merge items (for hooks/themes, accumulate engagement rates)
      for (const item of items) {
        const key = this.getItemKey(dataType, item);

        if (aggregatedItems.has(key)) {
          const existing = aggregatedItems.get(key)!;
          // Average engagement rates across snapshots
          existing.avg_engagement_rate =
            (existing.avg_engagement_rate + (item.avg_engagement_rate || item.engagement_rate || 0)) / 2;
          existing.count = (existing.count || 0) + (item.count || 1);
        } else {
          aggregatedItems.set(key, { ...item });
        }
      }

      totalAnalyzed += snapshot.total_analyzed || 0;
      avgEngagement += snapshot.avg_engagement || 0.0;
      snapshotCount++;
    }

    // Calculate average engagement across snapshots
    if (snapshotCount > 0) {
      avgEngagement /= snapshotCount;
    }

    // Convert map to array and sort by engagement
    const items = Array.from(aggregatedItems.values()).sort((a, b) => {
      const aRate = a.avg_engagement_rate || a.engagement_rate || 0;
      const bRate = b.avg_engagement_rate || b.engagement_rate || 0;
      return bRate - aRate;
    });

    return {
      period,
      startDate,
      endDate,
      items: items.slice(0, 20), // Top 20
      totalAnalyzed,
      avgEngagement
    };
  }

  /**
   * Get a unique key for an item (used for aggregation)
   */
  private getItemKey(dataType: string, item: any): string {
    switch (dataType) {
      case 'hooks':
        return item.hook_formula || item.formula || 'unknown';
      case 'videos':
        return item.id || item.video_id || item.url || String(Math.random());
      case 'themes':
        return item.content_themes || item.theme || 'unknown';
      default:
        return String(Math.random());
    }
  }

  /**
   * Calculate date range from period string
   */
  private calculateDateRange(period: string): { startDate: string; endDate: string } {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0]; // Today (YYYY-MM-DD)

    let startDate: string;

    switch (period) {
      case 'today':
        startDate = endDate;
        break;
      case '7days':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0];
        break;
      case '30days':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case '90days':
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(now.getDate() - 90);
        startDate = ninetyDaysAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = endDate;
    }

    return { startDate, endDate };
  }

  /**
   * Clean up old snapshots (older than retention period)
   */
  async cleanupOldSnapshots(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      DELETE FROM trending_snapshots
      WHERE snapshot_date < ?
    `);

    const result = stmt.run(cutoffDateStr);
    const deletedCount = result.changes;

    if (deletedCount > 0) {
      console.log(`[SnapshotManager] Cleaned up ${deletedCount} snapshots older than ${cutoffDateStr}`);
    }

    return deletedCount;
  }

  /**
   * Get snapshot statistics
   */
  getStats(): {
    totalSnapshots: number;
    oldestSnapshot: string | null;
    newestSnapshot: string | null;
    snapshotsByType: Record<string, number>;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        MIN(snapshot_date) as oldest,
        MAX(snapshot_date) as newest
      FROM trending_snapshots
    `);

    const result: any = stmt.get();

    const typeStmt = this.db.prepare(`
      SELECT data_type, COUNT(*) as count
      FROM trending_snapshots
      GROUP BY data_type
    `);

    const typeCounts = typeStmt.all() as any[];
    const snapshotsByType: Record<string, number> = {};
    typeCounts.forEach(row => {
      snapshotsByType[row.data_type] = row.count;
    });

    return {
      totalSnapshots: result.total || 0,
      oldestSnapshot: result.oldest || null,
      newestSnapshot: result.newest || null,
      snapshotsByType
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    console.log('[SnapshotManager] Database connection closed');
  }
}
