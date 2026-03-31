/**
 * Viral Signals Database Connector
 * Reads viral content metrics from the viral-social-media-analyzer database
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

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
  thumbnail_url?: string;
  video_id?: string;
  platform?: string;
  channel_name?: string;
  view_count?: number;
  hook_formula?: string;
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
  private db: Database.Database | null = null;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '../../../../viral-social-media-analyzer/data/viral-signals.db');
    const finalPath = dbPath || process.env.VIRAL_DATABASE_PATH || defaultPath;

    if (fs.existsSync(finalPath)) {
      this.db = new Database(finalPath);
      // Flush WAL data so we can read recently written rows
      try {
        this.db.pragma('wal_checkpoint(PASSIVE)');
      } catch (e) {
        // Ignore if WAL mode not active
      }
      console.log(`[ViralSignalsConnector] Connected to viral signals database at ${finalPath}`);
    } else {
      console.warn(`[ViralSignalsConnector] Database not found at ${finalPath} — running without viral signals`);
    }
  }

  /**
   * Get top performing hook formulas from recent viral content
   * Now includes actual video examples for each hook type
   */
  getTopViralHooks(days: number = 7, limit: number = 10, includeExamples: boolean = true): ViralHook[] {
    if (!this.db) return [];
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
    if (!this.db) return [];
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
    if (!this.db) return [];
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
    if (!this.db) return [];
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
    if (!this.db) return [];
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return this.db.prepare(`
      SELECT
        content_themes,
        engagement_rate,
        title,
        url,
        thumbnail_url,
        video_id,
        platform,
        channel_name,
        view_count,
        hook_formula
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
    if (!this.db) return [];
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
    if (!this.db) return { total_analyzed: 0, avg_engagement: 0, top_platform: 'unknown', date_range_days: days };
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
    if (!this.db) return [];
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
   * Insert real YouTube videos from the collector
   */
  insertYouTubeVideos(videos: any[]): number {
    this.ensureDb();
    this.ensureTable();

    const stmt = this.db!.prepare(`
      INSERT OR IGNORE INTO viral_signals (
        platform, video_id, url, title, description,
        channel_id, channel_name, published_at, collected_at,
        view_count, like_count, comment_count,
        engagement_rate, views_per_day, is_viral,
        thumbnail_url, tags,
        text_analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    let inserted = 0;
    for (const v of videos) {
      const result = stmt.run(
        'youtube', v.video_id, `https://youtube.com/watch?v=${v.video_id}`,
        v.title, v.description,
        v.channel_id, v.channel_name, v.published_at, new Date().toISOString(),
        v.view_count, v.like_count, v.comment_count,
        v.engagement_rate, v.views_per_day, v.is_viral ? 1 : 0,
        v.thumbnail_url, JSON.stringify(v.tags || [])
      );
      if (result.changes > 0) inserted++;
    }

    return inserted;
  }

  /**
   * Ensure DB connection exists (create if needed for Railway)
   */
  private ensureDb(): void {
    if (!this.db) {
      const defaultPath = path.join(__dirname, '../../../../viral-social-media-analyzer/data/viral-signals.db');
      const finalPath = process.env.VIRAL_DATABASE_PATH || defaultPath;
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(finalPath);
      this.db.pragma('journal_mode = WAL');
    }
  }

  /**
   * Ensure table exists
   */
  private ensureTable(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS viral_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        video_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        channel_id TEXT,
        channel_name TEXT,
        published_at TEXT NOT NULL,
        collected_at TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        engagement_rate REAL DEFAULT 0,
        views_per_day INTEGER DEFAULT 0,
        is_viral INTEGER DEFAULT 0,
        thumbnail_url TEXT,
        tags TEXT,
        hook_formula TEXT,
        emotional_trigger TEXT,
        viral_pattern TEXT,
        content_angle TEXT,
        content_themes TEXT,
        text_analyzed_at TEXT,
        visual_analyzed_at TEXT,
        text_analysis_cost REAL DEFAULT 0,
        visual_analysis_cost REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        duration TEXT,
        UNIQUE(platform, video_id)
      )
    `);
  }

  /**
   * Seed the database with realistic demo data for pet content trending videos and hooks.
   * Creates the viral_signals table if it doesn't exist, then inserts sample rows.
   * Returns the number of rows inserted.
   */
  seedDemoData(): number {
    // If no DB connection, create one (handles Railway/demo deployments with no pre-existing DB)
    if (!this.db) {
      const defaultPath = path.join(__dirname, '../../../../viral-social-media-analyzer/data/viral-signals.db');
      const finalPath = process.env.VIRAL_DATABASE_PATH || defaultPath;
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(finalPath);
      this.db.pragma('journal_mode = WAL');
      console.log(`[ViralSignalsConnector] Created new database at ${finalPath}`);
    }

    // Ensure table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS viral_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        video_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        channel_id TEXT,
        channel_name TEXT,
        published_at TEXT NOT NULL,
        collected_at TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        engagement_rate REAL DEFAULT 0.0,
        views_per_day INTEGER DEFAULT 0,
        is_viral INTEGER DEFAULT 0,
        duration INTEGER,
        tags TEXT,
        thumbnail_url TEXT,
        hook_formula TEXT,
        emotional_trigger TEXT,
        viral_pattern TEXT,
        content_angle TEXT,
        content_themes TEXT,
        top_comments TEXT,
        text_analyzed_at TEXT,
        frames_extracted INTEGER DEFAULT 0,
        frames_path TEXT,
        visual_analysis TEXT,
        visual_analyzed_at TEXT,
        text_analysis_cost REAL DEFAULT 0.0,
        visual_analysis_cost REAL DEFAULT 0.0,
        total_cost REAL DEFAULT 0.0,
        UNIQUE(platform, video_id)
      );
      CREATE INDEX IF NOT EXISTS idx_viral ON viral_signals(is_viral) WHERE is_viral = 1;
      CREATE INDEX IF NOT EXISTS idx_collected_at ON viral_signals(collected_at);
      CREATE INDEX IF NOT EXISTS idx_engagement_rate ON viral_signals(engagement_rate);
    `);

    const now = new Date().toISOString();
    const today = new Date();
    const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString();

    const demoVideos = [
      {
        platform: 'youtube', video_id: 'demo_yt_001',
        url: 'https://www.youtube.com/watch?v=demo_yt_001',
        title: '5 Erros que Todo Dono de Cachorro Comete (e não sabe!)',
        description: 'Veterinário revela os erros mais comuns que prejudicam a saúde do seu pet.',
        channel_name: 'Dr. Pet Saúde', channel_id: 'UCdemo001',
        view_count: 2_840_000, like_count: 187_000, comment_count: 14_200,
        engagement_rate: 7.1, views_per_day: 142_000, is_viral: 1,
        duration: 482, thumbnail_url: '',
        hook_formula: 'curiosity_gap', emotional_trigger: 'anxiety',
        viral_pattern: 'Numbered list of mistakes creates urgency; pet owners feel compelled to check if they are guilty.',
        content_angle: 'Create a carousel debunking each myth with vet-approved alternatives.',
        content_themes: '["dog care","pet health","veterinary tips"]',
        published_at: daysAgo(2), collected_at: daysAgo(1),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_001',
        url: 'https://www.tiktok.com/@petlovers/video/demo_tt_001',
        title: 'POV: Seu gato descobre que a ração acabou',
        description: 'A reação do meu gato quando percebe que o pote está vazio. Dramático demais!',
        channel_name: 'Gatos Loucos BR', channel_id: 'tt_demo001',
        view_count: 5_120_000, like_count: 892_000, comment_count: 31_400,
        engagement_rate: 18.0, views_per_day: 1_024_000, is_viral: 1,
        duration: 28, thumbnail_url: '',
        hook_formula: 'pov_scenario', emotional_trigger: 'joy',
        viral_pattern: 'Relatable POV format with exaggerated pet reaction drives massive sharing among cat owners.',
        content_angle: 'Adapt the POV format with different pet situations for carousel series.',
        content_themes: '["cat behavior","pet humor","relatable content"]',
        published_at: daysAgo(1), collected_at: now,
      },
      {
        platform: 'youtube', video_id: 'demo_yt_002',
        url: 'https://www.youtube.com/watch?v=demo_yt_002',
        title: 'Adestrador revela: o ÚNICO comando que seu cachorro precisa saber',
        description: 'Técnica de adestramento que muda completamente o comportamento do cão em 7 dias.',
        channel_name: 'Mundo Canino', channel_id: 'UCdemo002',
        view_count: 1_670_000, like_count: 124_000, comment_count: 8_900,
        engagement_rate: 8.0, views_per_day: 238_571, is_viral: 1,
        duration: 614, thumbnail_url: '',
        hook_formula: 'contrarian', emotional_trigger: 'surprise',
        viral_pattern: 'Contrarian claim ("only ONE command") challenges conventional wisdom and sparks debate in comments.',
        content_angle: 'Create a step-by-step training carousel using the contrarian angle.',
        content_themes: '["dog training","pet behavior","obedience"]',
        published_at: daysAgo(3), collected_at: daysAgo(1),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_002',
        url: 'https://www.tiktok.com/@nutrivet/video/demo_tt_002',
        title: 'A ração que veterinários NUNCA dariam para seus pets',
        description: 'Veterinária analisa rótulos das rações mais vendidas e o resultado é chocante.',
        channel_name: 'Dra. Nutri Vet', channel_id: 'tt_demo002',
        view_count: 3_450_000, like_count: 567_000, comment_count: 42_300,
        engagement_rate: 17.7, views_per_day: 690_000, is_viral: 1,
        duration: 45, thumbnail_url: '',
        hook_formula: 'authority_reveal', emotional_trigger: 'anxiety',
        viral_pattern: 'Expert authority combined with negative reveal ("NEVER") creates fear of missing out on critical info.',
        content_angle: 'Carousel comparing pet food brands with vet-approved ratings.',
        content_themes: '["pet nutrition","dog food","cat food","veterinary advice"]',
        published_at: daysAgo(1), collected_at: now,
      },
      {
        platform: 'youtube', video_id: 'demo_yt_003',
        url: 'https://www.youtube.com/watch?v=demo_yt_003',
        title: 'Transformação INCRÍVEL: cachorro de rua resgatado em 30 dias',
        description: 'Acompanhe a jornada de recuperação de um cão abandonado até sua adoção.',
        channel_name: 'Resgata Pet', channel_id: 'UCdemo003',
        view_count: 4_210_000, like_count: 389_000, comment_count: 22_100,
        engagement_rate: 9.8, views_per_day: 601_428, is_viral: 1,
        duration: 723, thumbnail_url: '',
        hook_formula: 'transformation', emotional_trigger: 'empathy',
        viral_pattern: 'Before/after transformation narrative with emotional rescue story drives high save and share rates.',
        content_angle: 'Create a transformation carousel showing rescue journey milestones.',
        content_themes: '["pet rescue","adoption","transformation","animal welfare"]',
        published_at: daysAgo(4), collected_at: daysAgo(2),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_003',
        url: 'https://www.tiktok.com/@catwhisperer/video/demo_tt_003',
        title: 'Seu gato faz isso? Pode ser um sinal de doença grave',
        description: '3 comportamentos comuns que indicam que seu gato precisa ir ao veterinário urgente.',
        channel_name: 'Cat Whisperer BR', channel_id: 'tt_demo003',
        view_count: 2_890_000, like_count: 412_000, comment_count: 28_700,
        engagement_rate: 15.3, views_per_day: 963_333, is_viral: 1,
        duration: 38, thumbnail_url: '',
        hook_formula: 'curiosity_gap', emotional_trigger: 'fear',
        viral_pattern: 'Health scare curiosity gap makes cat owners watch to check their pet, then share to warn friends.',
        content_angle: 'Educational carousel with symptoms checklist and when to visit the vet.',
        content_themes: '["cat health","pet symptoms","veterinary care"]',
        published_at: daysAgo(2), collected_at: daysAgo(1),
      },
      {
        platform: 'youtube', video_id: 'demo_yt_004',
        url: 'https://www.youtube.com/watch?v=demo_yt_004',
        title: 'Golden Retriever conhece o bebê pela primeira vez - reação emocionante',
        description: 'A reação mais fofa que você vai ver hoje. Golden Retriever encontra o bebê recém-nascido da família.',
        channel_name: 'Família Pet', channel_id: 'UCdemo004',
        view_count: 8_920_000, like_count: 743_000, comment_count: 18_500,
        engagement_rate: 8.5, views_per_day: 1_784_000, is_viral: 1,
        duration: 312, thumbnail_url: '',
        hook_formula: 'emotional_hook', emotional_trigger: 'joy',
        viral_pattern: 'Universal emotional moment (pet meets baby) triggers massive organic sharing across demographics.',
        content_angle: 'Heartwarming moment carousel with tips for introducing pets to newborns.',
        content_themes: '["golden retriever","pets and babies","heartwarming","family pets"]',
        published_at: daysAgo(3), collected_at: daysAgo(1),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_004',
        url: 'https://www.tiktok.com/@dogtrainer/video/demo_tt_004',
        title: 'Truque de 3 segundos que faz qualquer cachorro parar de puxar a guia',
        description: 'Técnica simples que funciona com qualquer raça. Sem equipamentos especiais.',
        channel_name: 'Adestra Fácil', channel_id: 'tt_demo004',
        view_count: 1_950_000, like_count: 287_000, comment_count: 19_800,
        engagement_rate: 15.7, views_per_day: 650_000, is_viral: 1,
        duration: 34, thumbnail_url: '',
        hook_formula: 'quick_hack', emotional_trigger: 'surprise',
        viral_pattern: 'Specific time claim ("3 seconds") combined with universal dog owner frustration creates irresistible click.',
        content_angle: 'Step-by-step training hack carousel with visual demonstrations.',
        content_themes: '["dog training","leash training","quick tips","pet hacks"]',
        published_at: daysAgo(1), collected_at: now,
      },
      {
        platform: 'youtube', video_id: 'demo_yt_005',
        url: 'https://www.youtube.com/watch?v=demo_yt_005',
        title: 'Alimentação natural para cães: guia completo do veterinário',
        description: 'Tudo sobre alimentação natural (AN) para cachorro: receitas, proporções e cuidados.',
        channel_name: 'Vet Natural', channel_id: 'UCdemo005',
        view_count: 1_340_000, like_count: 98_000, comment_count: 7_200,
        engagement_rate: 7.8, views_per_day: 191_428, is_viral: 1,
        duration: 1024, thumbnail_url: '',
        hook_formula: 'authority_reveal', emotional_trigger: 'trust',
        viral_pattern: 'Authority figure (veterinarian) providing comprehensive guide on trending health topic builds trust and saves.',
        content_angle: 'Natural feeding guide carousel with recipes and nutritional breakdown.',
        content_themes: '["natural feeding","pet nutrition","dog diet","homemade dog food"]',
        published_at: daysAgo(5), collected_at: daysAgo(3),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_005',
        url: 'https://www.tiktok.com/@petgroomer/video/demo_tt_005',
        title: 'Antes e depois: banho e tosa que transformou esse Poodle',
        description: 'Poodle chegou todo embaraçado e saiu uma verdadeira celebridade. Resultado incrível!',
        channel_name: 'Pet Glamour', channel_id: 'tt_demo005',
        view_count: 4_780_000, like_count: 621_000, comment_count: 15_900,
        engagement_rate: 13.3, views_per_day: 956_000, is_viral: 1,
        duration: 42, thumbnail_url: '',
        hook_formula: 'transformation', emotional_trigger: 'satisfaction',
        viral_pattern: 'Visual before/after transformation is highly satisfying and shareable; grooming content has broad appeal.',
        content_angle: 'Grooming transformation carousel with coat care tips.',
        content_themes: '["pet grooming","poodle","transformation","banho e tosa"]',
        published_at: daysAgo(2), collected_at: daysAgo(1),
      },
      {
        platform: 'youtube', video_id: 'demo_yt_006',
        url: 'https://www.youtube.com/watch?v=demo_yt_006',
        title: 'Por que seu cachorro te segue até o banheiro (a verdade)',
        description: 'Comportamento canino explicado: o que realmente significa quando seu cão não te larga.',
        channel_name: 'Comportamento Animal', channel_id: 'UCdemo006',
        view_count: 2_150_000, like_count: 156_000, comment_count: 11_400,
        engagement_rate: 7.8, views_per_day: 307_142, is_viral: 1,
        duration: 387, thumbnail_url: '',
        hook_formula: 'curiosity_gap', emotional_trigger: 'curiosity',
        viral_pattern: 'Universal relatable behavior ("follows you to the bathroom") combined with promise of explanation drives clicks.',
        content_angle: 'Dog behavior myths carousel explaining common behaviors.',
        content_themes: '["dog behavior","pet psychology","canine habits"]',
        published_at: daysAgo(4), collected_at: daysAgo(2),
      },
      {
        platform: 'tiktok', video_id: 'demo_tt_006',
        url: 'https://www.tiktok.com/@exoticpets/video/demo_tt_006',
        title: 'Esse é o animal de estimação mais incomum que já tive',
        description: 'Conheça meu sugar glider! Tudo que você precisa saber sobre esse pet exótico.',
        channel_name: 'Pets Exóticos BR', channel_id: 'tt_demo006',
        view_count: 6_340_000, like_count: 987_000, comment_count: 45_200,
        engagement_rate: 16.3, views_per_day: 1_268_000, is_viral: 1,
        duration: 52, thumbnail_url: '',
        hook_formula: 'novelty_shock', emotional_trigger: 'surprise',
        viral_pattern: 'Unusual/exotic pet creates novelty shock that stops scrolling; comment section drives algorithm with debate.',
        content_angle: 'Exotic pets carousel featuring unique animals people can legally own.',
        content_themes: '["exotic pets","sugar glider","unusual pets","pet care"]',
        published_at: daysAgo(1), collected_at: now,
      },
      {
        platform: 'youtube', video_id: 'demo_yt_007',
        url: 'https://www.youtube.com/watch?v=demo_yt_007',
        title: 'Veterinária reage aos piores "conselhos" de pet do TikTok',
        description: 'Analisando os vídeos mais perigosos sobre cuidados com animais que viralizam no TikTok.',
        channel_name: 'Dra. Vet Reage', channel_id: 'UCdemo007',
        view_count: 3_670_000, like_count: 298_000, comment_count: 21_600,
        engagement_rate: 8.7, views_per_day: 524_285, is_viral: 1,
        duration: 845, thumbnail_url: '',
        hook_formula: 'contrarian', emotional_trigger: 'anger',
        viral_pattern: 'Expert debunking bad advice creates strong emotional response and platform cross-pollination (TikTok to YouTube).',
        content_angle: 'Myth-busting carousel debunking dangerous pet care trends.',
        content_themes: '["pet myths","veterinary reaction","tiktok debunk","pet safety"]',
        published_at: daysAgo(3), collected_at: daysAgo(1),
      },
    ];

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO viral_signals (
        platform, video_id, url, title, description,
        channel_id, channel_name, published_at, collected_at,
        view_count, like_count, comment_count, engagement_rate,
        views_per_day, is_viral, duration, thumbnail_url,
        hook_formula, emotional_trigger, viral_pattern,
        content_angle, content_themes, text_analyzed_at
      ) VALUES (
        @platform, @video_id, @url, @title, @description,
        @channel_id, @channel_name, @published_at, @collected_at,
        @view_count, @like_count, @comment_count, @engagement_rate,
        @views_per_day, @is_viral, @duration, @thumbnail_url,
        @hook_formula, @emotional_trigger, @viral_pattern,
        @content_angle, @content_themes, @text_analyzed_at
      )
    `);

    const insertMany = this.db.transaction((videos: any[]) => {
      for (const v of videos) {
        insert.run({ ...v, text_analyzed_at: now });
      }
    });

    insertMany(demoVideos);
    console.log(`[ViralSignalsConnector] Seeded ${demoVideos.length} demo viral signals`);
    return demoVideos.length;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db?.close();
  }
}
