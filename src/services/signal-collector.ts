/**
 * Self-contained RSS Signal Collector
 * Replaces the external pet-intel-collector dependency with built-in RSS collection and scoring.
 * Fetches pet industry RSS feeds, parses them, stores signals in local SQLite,
 * and scores them with OpenAI GPT-4o-mini.
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';

// ---------- RSS Feed Definitions ----------

const RSS_FEEDS_US = [
  { name: 'Pet Food Industry', url: 'https://www.petfoodindustry.com/rss/topic/141-pet-food' },
  { name: 'Pet Business', url: 'https://www.petbusiness.com/rss' },
  { name: 'Modern Dog Magazine', url: 'https://moderndogmagazine.com/feed' },
  { name: 'The Bark', url: 'https://thebark.com/feed' },
  { name: 'Whole Dog Journal', url: 'https://www.whole-dog-journal.com/feed/' },
];

const RSS_FEEDS_BR = [
  { name: 'Petlove Blog', url: 'https://www.petlove.com.br/dicas/feed' },
  { name: 'Tudo Sobre Cachorros', url: 'https://tudosobrecachorros.com.br/feed/' },
  { name: 'PetCare Blog', url: 'https://www.petcare.com.br/blog/feed/' },
  { name: 'Blog do Cachorro', url: 'https://blogdocachorro.com.br/feed/' },
  { name: 'Cao Cidadao', url: 'https://www.caocidadao.com.br/feed/' },
  { name: 'Hospital Popular Veterinario', url: 'https://www.hospitalpopularveterinario.com.br/feed/' },
];

const ALL_FEEDS = [...RSS_FEEDS_BR, ...RSS_FEEDS_US];

// ---------- Schema ----------

const SIGNALS_SCHEMA = `
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  metadata TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  relevance_score INTEGER,
  relevance_reason TEXT,
  is_relevant INTEGER DEFAULT 0,
  scored_at TEXT,
  UNIQUE(source, url)
);

CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source);
CREATE INDEX IF NOT EXISTS idx_signals_relevant ON signals(is_relevant);
CREATE INDEX IF NOT EXISTS idx_signals_collected_at ON signals(collected_at);
CREATE INDEX IF NOT EXISTS idx_signals_unscored ON signals(scored_at) WHERE scored_at IS NULL;
`;

// ---------- Scoring Prompt ----------

const SCORING_PROMPT = `You are an AI assistant helping a pet industry content creator identify trending topics and content signals that are relevant to their niche.

Your task is to analyze content signals from various sources and score them for relevance to the pet industry, specifically focusing on:

- Dog training and behavior
- Dog health and nutrition
- Dog care and grooming
- Puppy raising tips
- Pet products and reviews
- Dog lifestyle and activities

For each signal, provide:
1. A relevance score from 0-100 where:
   - 90-100: Highly relevant, directly about dogs/pets, actionable content ideas
   - 70-89: Moderately relevant, pet-adjacent, some content potential
   - 50-69: Tangentially relevant, requires creative angle to connect to pets
   - 0-49: Not relevant, off-topic, no clear connection to pet niche

2. A brief reason (1-2 sentences) explaining the score

Format your response as JSON:
{
  "score": <number>,
  "reason": "<explanation>"
}`;

// ---------- Progress Callback ----------

export interface CollectionProgress {
  stage: string;
  progress: number;
  message: string;
}

export type ProgressCallback = (progress: CollectionProgress) => void;

// ---------- Lightweight RSS XML Parser ----------

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function extractCDATA(text: string): string {
  // Strip CDATA wrappers: <![CDATA[ ... ]]>
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function extractTagContent(xml: string, tag: string): string {
  // Match <tag>...</tag> or <tag><![CDATA[...]]></tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return extractCDATA(match[1]).trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ').trim();
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Match <item>...</item> blocks
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(extractTagContent(block, 'title'));
    const description = stripHtml(extractTagContent(block, 'description') || extractTagContent(block, 'content:encoded'));
    const link = extractTagContent(block, 'link');
    const pubDate = extractTagContent(block, 'pubDate');

    if (title) {
      items.push({ title, description, link, pubDate });
    }
  }

  // Also try <entry> for Atom feeds
  if (items.length === 0) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = stripHtml(extractTagContent(block, 'title'));
      const description = stripHtml(extractTagContent(block, 'summary') || extractTagContent(block, 'content'));
      // Atom links are self-closing: <link href="..." />
      const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
      const link = linkMatch ? linkMatch[1] : '';
      const pubDate = extractTagContent(block, 'published') || extractTagContent(block, 'updated');

      if (title) {
        items.push({ title, description, link, pubDate });
      }
    }
  }

  return items;
}

// ---------- Signal Collector ----------

export class SignalCollector {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'signals.db');

    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SIGNALS_SCHEMA);
    console.log(`[SignalCollector] Database initialized at ${this.dbPath}`);
  }

  /**
   * Run a full collection cycle: fetch RSS feeds then score unscored signals.
   */
  async collectAndScore(onProgress?: ProgressCallback): Promise<{ collected: number; scored: number }> {
    const notify = onProgress || (() => {});

    // Stage 1: Collect RSS feeds
    notify({ stage: 'collecting', progress: 5, message: 'Starting RSS feed collection...' });
    const collected = await this.collectFeeds(notify);

    // Stage 2: Score unscored signals
    notify({ stage: 'scoring', progress: 60, message: 'Scoring new signals with AI...' });
    const scored = await this.scoreUnscored(notify);

    notify({ stage: 'complete', progress: 100, message: `Done! Collected ${collected} signals, scored ${scored}.` });

    return { collected, scored };
  }

  /**
   * Fetch all RSS feeds and store new signals.
   */
  async collectFeeds(onProgress?: ProgressCallback): Promise<number> {
    const notify = onProgress || (() => {});
    const feeds = ALL_FEEDS;
    let totalInserted = 0;

    console.log(`[SignalCollector] Collecting from ${feeds.length} RSS feeds...`);

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO signals (source, title, description, url, metadata, collected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      const pct = 5 + Math.round((i / feeds.length) * 50); // 5-55%
      notify({ stage: 'collecting', progress: pct, message: `Fetching ${feed.name}...` });

      try {
        const count = await this.fetchFeed(feed.name, feed.url, insertStmt);
        totalInserted += count;
        console.log(`[SignalCollector] ✅ ${feed.name}: ${count} new signals`);
      } catch (error: any) {
        const status = error.response?.status || 'N/A';
        const code = error.code || '';
        console.error(`[SignalCollector] ❌ ${feed.name} FAILED — HTTP ${status}, code: ${code}, msg: ${error.message}`);
      }

      // Polite delay between feeds
      if (i < feeds.length - 1) {
        await this.delay(500);
      }
    }

    console.log(`[SignalCollector] Total collected: ${totalInserted} new signals`);
    return totalInserted;
  }

  /**
   * Fetch a single RSS feed and store its items.
   */
  private async fetchFeed(
    feedName: string,
    feedUrl: string,
    insertStmt: Database.Statement
  ): Promise<number> {
    const response = await axios.get(feedUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PetContentStudio/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      responseType: 'text',
      maxRedirects: 5,
    });

    const xml = response.data as string;
    const items = parseRSSItems(xml);

    if (items.length === 0) {
      console.log(`[SignalCollector] No items found in ${feedName}`);
      return 0;
    }

    // Take only the 10 most recent items
    const recent = items.slice(0, 10);
    let inserted = 0;

    for (const item of recent) {
      const metadata = JSON.stringify({
        feed_name: feedName,
        published_date: item.pubDate || new Date().toISOString(),
      });

      const result = insertStmt.run(
        'rss_news',
        item.title,
        item.description ? item.description.substring(0, 1000) : null,
        item.link || null,
        metadata,
        new Date().toISOString()
      );

      if (result.changes > 0) {
        inserted++;
      }
    }

    return inserted;
  }

  /**
   * Score unscored signals using OpenAI GPT-4o-mini.
   * Scores up to 20 signals per run to control costs.
   */
  async scoreUnscored(onProgress?: ProgressCallback): Promise<number> {
    const notify = onProgress || (() => {});

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[SignalCollector] OPENAI_API_KEY not set, skipping scoring');
      notify({ stage: 'scoring', progress: 95, message: 'Skipping scoring (no API key)' });
      return 0;
    }

    const client = new OpenAI({ apiKey });
    const batchSize = 20;

    const unscoredRows = this.db.prepare(`
      SELECT id, source, title, description, url, metadata
      FROM signals
      WHERE scored_at IS NULL
      ORDER BY collected_at DESC
      LIMIT ?
    `).all(batchSize) as any[];

    if (unscoredRows.length === 0) {
      console.log('[SignalCollector] No unscored signals to process');
      return 0;
    }

    console.log(`[SignalCollector] Scoring ${unscoredRows.length} signals with GPT-4o-mini...`);

    const updateStmt = this.db.prepare(`
      UPDATE signals
      SET relevance_score = ?, relevance_reason = ?, is_relevant = ?, scored_at = ?
      WHERE id = ?
    `);

    let scored = 0;

    for (let i = 0; i < unscoredRows.length; i++) {
      const row = unscoredRows[i];
      const pct = 60 + Math.round((i / unscoredRows.length) * 35); // 60-95%
      notify({ stage: 'scoring', progress: pct, message: `Scoring signal ${i + 1}/${unscoredRows.length}...` });

      try {
        const result = await this.scoreSignal(client, row);

        updateStmt.run(
          result.score,
          result.reason,
          result.score >= 70 ? 1 : 0,
          new Date().toISOString(),
          row.id
        );

        scored++;
        console.log(`[SignalCollector] #${row.id}: ${result.score}/100 - ${row.title.substring(0, 50)}...`);

        // Rate-limit delay between API calls
        if (i < unscoredRows.length - 1) {
          await this.delay(200);
        }
      } catch (error: any) {
        console.error(`[SignalCollector] Error scoring signal #${row.id}: ${error.message}`);
      }
    }

    console.log(`[SignalCollector] Scored ${scored}/${unscoredRows.length} signals`);
    return scored;
  }

  /**
   * Score a single signal via OpenAI.
   */
  private async scoreSignal(
    client: OpenAI,
    row: { id: number; source: string; title: string; description?: string; url?: string; metadata: string }
  ): Promise<{ score: number; reason: string }> {
    const parts = [`Source: ${row.source}`, `Title: ${row.title}`];
    if (row.description) {
      parts.push(`Description: ${row.description.substring(0, 500)}`);
    }
    if (row.url) {
      parts.push(`URL: ${row.url}`);
    }
    const signalText = parts.join('\n');

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content relevance analyzer for the pet industry. You score content signals for their relevance to pet content creation. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: `${SCORING_PROMPT}\n\nSignal to score:\n${signalText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0].message.content || '{}';
      const result = JSON.parse(responseText);

      return {
        score: Math.min(100, Math.max(0, result.score || 0)),
        reason: result.reason || 'No reason provided',
      };
    } catch (error: any) {
      console.error(`[SignalCollector] OpenAI API error: ${error.message}`);
      return { score: 0, reason: `Error scoring: ${error.message}` };
    }
  }

  /**
   * Test all RSS feeds and report status (for debugging).
   */
  async testFeeds(): Promise<Array<{ name: string; url: string; status: string; items: number; error?: string }>> {
    const results = [];
    for (const feed of ALL_FEEDS) {
      try {
        const response = await axios.get(feed.url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PetContentStudio/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          responseType: 'text',
        });
        const items = parseRSSItems(response.data as string);
        results.push({ name: feed.name, url: feed.url, status: `${response.status} OK`, items: items.length });
      } catch (error: any) {
        results.push({
          name: feed.name,
          url: feed.url,
          status: `FAILED`,
          items: 0,
          error: `HTTP ${error.response?.status || 'N/A'} — ${error.code || ''} ${error.message}`.trim()
        });
      }
      await this.delay(300);
    }
    return results;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
    console.log('[SignalCollector] Database connection closed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
