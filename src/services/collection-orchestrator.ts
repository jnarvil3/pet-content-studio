/**
 * Collection Orchestrator Service
 * Manages background collection jobs using the built-in SignalCollector.
 * No longer spawns external child processes.
 */

import { EventEmitter } from 'events';
import { SignalCollector } from './signal-collector';

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
    console.log('[CollectionOrchestrator] Service initialized (built-in collector)');
  }

  /**
   * Trigger a new collection job.
   */
  async triggerCollection(): Promise<string> {
    const jobId = `job-${Date.now()}`;
    const job: CollectionJob = {
      jobId,
      status: 'running',
      stage: 'initializing',
      progress: 0,
      message: 'Starting collection...',
      startedAt: new Date(),
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
   * Run the built-in collection process.
   */
  private async runCollection(jobId: string): Promise<void> {
    let collector: SignalCollector | null = null;

    try {
      collector = new SignalCollector();

      this.updateJob(jobId, {
        stage: 'collecting',
        progress: 5,
        message: 'Collecting pet intelligence from RSS feeds...',
      });

      const result = await collector.collectAndScore((progress) => {
        this.updateJob(jobId, {
          stage: progress.stage,
          progress: progress.progress,
          message: progress.message,
        });
      });

      this.updateJob(jobId, {
        status: 'complete',
        stage: 'complete',
        progress: 100,
        message: `Coleta concluida! ${result.collected} sinais coletados, ${result.scored} pontuados.`,
        completedAt: new Date(),
      });
    } catch (error: any) {
      this.updateJob(jobId, {
        status: 'error',
        stage: 'error',
        progress: 0,
        message: error.message || 'Collection failed',
        error: error.stack,
        completedAt: new Date(),
      });
    } finally {
      if (collector) {
        collector.close();
      }
    }
  }

  /**
   * Update job status and emit event.
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
   * Get job status.
   */
  getJob(jobId: string): CollectionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs.
   */
  getAllJobs(): CollectionJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed jobs older than 1 hour.
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
