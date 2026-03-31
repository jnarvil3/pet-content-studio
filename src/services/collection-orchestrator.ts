/**
 * Collection Orchestrator Service
 * Manages background collection processes for pet intelligence and viral video analysis
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface CollectionJob {
  jobId: string;
  status: 'running' | 'complete' | 'error';
  stage: string;
  progress: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class CollectionOrchestrator extends EventEmitter {
  private jobs = new Map<string, CollectionJob>();

  constructor() {
    super();
    console.log('[CollectionOrchestrator] Service initialized');
  }

  /**
   * Trigger new collection from both intel collector and viral analyzer
   */
  async triggerCollection(): Promise<string> {
    const jobId = `job-${Date.now()}`;
    const job: CollectionJob = {
      jobId,
      status: 'running',
      stage: 'initializing',
      progress: 0,
      message: 'Starting collection...',
      startedAt: new Date()
    };

    this.jobs.set(jobId, job);
    console.log(`[CollectionOrchestrator] Started job ${jobId}`);

    // Run collection in background (don't await)
    this.runCollection(jobId).catch(error => {
      console.error(`[CollectionOrchestrator] Job ${jobId} failed:`, error);
    });

    return jobId;
  }

  /**
   * Run the collection process
   */
  private async runCollection(jobId: string): Promise<void> {
    try {
      // Note: We're running collections in series to avoid overwhelming system resources
      // In production, consider running in parallel with resource limits

      // Stage 1: Pet Intel Collector (RSS, trends, etc.)
      this.updateJob(jobId, {
        stage: 'pet-intel',
        progress: 10,
        message: 'Collecting pet intelligence from RSS feeds and trends...'
      });

      await this.runPetIntelCollector(jobId);

      // Stage 2: Viral Video Analyzer
      this.updateJob(jobId, {
        stage: 'viral-analyzer',
        progress: 60,
        message: 'Analyzing viral videos and extracting patterns...'
      });

      await this.runViralAnalyzer(jobId);

      // Stage 3: Complete
      this.updateJob(jobId, {
        status: 'complete',
        stage: 'complete',
        progress: 100,
        message: 'Coleta concluída! Novos dados de tendências disponíveis.',
        completedAt: new Date()
      });

    } catch (error: any) {
      this.updateJob(jobId, {
        status: 'error',
        stage: 'error',
        progress: 0,
        message: error.message || 'Collection failed',
        error: error.stack,
        completedAt: new Date()
      });
    }
  }

  /**
   * Run pet intel collector process
   */
  private async runPetIntelCollector(jobId: string): Promise<void> {
    const collectorPath = path.join(__dirname, '../../../pet-intel-collector');

    return new Promise((resolve, reject) => {
      // Check if path exists
      const fs = require('fs');
      if (!fs.existsSync(collectorPath)) {
        console.warn(`[CollectionOrchestrator] Pet intel collector not found at ${collectorPath}, skipping...`);
        resolve(); // Don't fail, just skip
        return;
      }

      this.updateJob(jobId, {
        progress: 20,
        message: 'Running pet intel collector (npm run collect)...'
      });

      const proc = spawn('npm', ['run', 'collect'], {
        cwd: collectorPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
        // Update progress based on output keywords
        if (output.includes('Fetching') || output.includes('Collecting')) {
          this.updateJob(jobId, { progress: 30, message: 'Fetching pet content signals...' });
        } else if (output.includes('Scoring') || output.includes('Analyzing')) {
          this.updateJob(jobId, { progress: 45, message: 'Scoring content relevance...' });
        }
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error('[Pet Intel Collector]', data.toString());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`[CollectionOrchestrator] Pet intel collector completed successfully`);
          this.updateJob(jobId, { progress: 50, message: 'Pet intel collection complete' });
          resolve();
        } else {
          const error = new Error(`Pet intel collector failed with code ${code}: ${errorOutput}`);
          console.error('[CollectionOrchestrator]', error.message);
          reject(error);
        }
      });

      proc.on('error', (error) => {
        console.error('[CollectionOrchestrator] Failed to spawn pet intel collector:', error);
        reject(error);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        proc.kill();
        reject(new Error('Pet intel collector timed out after 5 minutes'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Run viral analyzer process
   */
  private async runViralAnalyzer(jobId: string): Promise<void> {
    const analyzerPath = path.join(__dirname, '../../../../viral-social-media-analyzer');

    return new Promise((resolve, reject) => {
      // Check if path exists
      const fs = require('fs');
      if (!fs.existsSync(analyzerPath)) {
        console.warn(`[CollectionOrchestrator] Viral analyzer not found at ${analyzerPath}, skipping...`);
        resolve(); // Don't fail, just skip
        return;
      }

      this.updateJob(jobId, {
        progress: 65,
        message: 'Running viral video analyzer (npm start)...'
      });

      const proc = spawn('npm', ['start'], {
        cwd: analyzerPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
        // Update progress based on output keywords
        if (output.includes('Fetching') || output.includes('videos')) {
          this.updateJob(jobId, { progress: 70, message: 'Fetching viral videos...' });
        } else if (output.includes('Analyzing') || output.includes('transcripts')) {
          this.updateJob(jobId, { progress: 80, message: 'Analyzing video patterns...' });
        } else if (output.includes('Extracting') || output.includes('hooks')) {
          this.updateJob(jobId, { progress: 90, message: 'Extracting hooks and patterns...' });
        }
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error('[Viral Analyzer]', data.toString());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`[CollectionOrchestrator] Viral analyzer completed successfully`);
          this.updateJob(jobId, { progress: 95, message: 'Viral analysis complete' });
          resolve();
        } else {
          const error = new Error(`Viral analyzer failed with code ${code}: ${errorOutput}`);
          console.error('[CollectionOrchestrator]', error.message);
          reject(error);
        }
      });

      proc.on('error', (error) => {
        console.error('[CollectionOrchestrator] Failed to spawn viral analyzer:', error);
        reject(error);
      });

      // Timeout after 10 minutes (viral analysis takes longer)
      setTimeout(() => {
        proc.kill();
        reject(new Error('Viral analyzer timed out after 10 minutes'));
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Update job status and emit event
   */
  private updateJob(jobId: string, updates: Partial<CollectionJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn(`[CollectionOrchestrator] Job ${jobId} not found`);
      return;
    }

    Object.assign(job, updates);

    if (updates.status === 'complete' || updates.status === 'error') {
      job.completedAt = new Date();
    }

    console.log(`[CollectionOrchestrator] Job ${jobId}: ${job.message} (${job.progress}%)`);
    this.emit('job-update', job);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): CollectionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): CollectionJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed jobs older than 1 hour
   */
  clearOldJobs(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleared = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'complete' || job.status === 'error') &&
        job.completedAt &&
        job.completedAt < oneHourAgo
      ) {
        this.jobs.delete(jobId);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[CollectionOrchestrator] Cleared ${cleared} old jobs`);
    }

    return cleared;
  }
}
