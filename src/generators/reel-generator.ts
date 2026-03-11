/**
 * Reel Generator Pipeline
 * Orchestrates the full Reel generation process:
 * Signal → Script → TTS → B-roll → FFmpeg Composition
 */

import { Signal } from '../types/signal';
import { BrandConfig } from '../types/brand';
import { ReelScript, GeneratedContent } from '../types/content';
import { ReelScriptWriter } from './reel-script-writer';
import { ElevenLabsTTS } from '../services/elevenlabs-tts';
import { PexelsVideoService } from '../services/pexels-video';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ReelGenerationResult {
  content: GeneratedContent;
  videoPath: string;
  script: ReelScript;
}

export class ReelGenerator {
  private scriptWriter: ReelScriptWriter;
  private tts: ElevenLabsTTS;
  private pexels: PexelsVideoService;
  private brand: BrandConfig;
  private outputDir: string;

  constructor(brand: BrandConfig, outputDir: string = './output/reels') {
    this.brand = brand;
    this.scriptWriter = new ReelScriptWriter();
    this.tts = new ElevenLabsTTS();
    this.pexels = new PexelsVideoService();
    this.outputDir = outputDir;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Generate a complete Reel from a signal
   */
  async generate(signal: Signal): Promise<ReelGenerationResult> {
    console.log(`\n[ReelGenerator] Starting generation for signal #${signal.id}`);
    console.log(`[ReelGenerator] Topic: "${signal.title}"`);

    try {
      // Step 1: Generate script with LLM
      console.log('[ReelGenerator] Step 1/5: Generating script with AI...');
      const script = await this.scriptWriter.generateScript(signal, this.brand);

      // Step 2: Create output directories
      const reelDir = path.join(this.outputDir, `signal-${signal.id}`);
      const audioDir = path.join(reelDir, 'audio');
      const videoDir = path.join(reelDir, 'video');

      [reelDir, audioDir, videoDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Step 3: Generate TTS audio for each scene
      console.log('[ReelGenerator] Step 2/5: Generating voiceover audio...');
      const narrations = script.scenes.map(scene => scene.narration);
      const audioPaths = await this.tts.generateSceneAudio(
        narrations,
        audioDir,
        `scene`,
        {}
      );

      // Step 4: Fetch B-roll videos
      console.log('[ReelGenerator] Step 3/5: Fetching B-roll videos...');
      const sceneVideoData = script.scenes.map(scene => ({
        searchTerms: scene.pexelsSearchTerms,
        sceneNumber: scene.sceneNumber,
        duration: scene.durationEstimate
      }));

      const videoPaths = await this.pexels.fetchSceneVideos(
        sceneVideoData,
        videoDir,
        'scene'
      );

      // Step 5: Composite everything with FFmpeg
      console.log('[ReelGenerator] Step 4/5: Compositing video with FFmpeg...');
      const finalVideoPath = path.join(reelDir, `reel-final.mp4`);

      await this.composeReelWithFFmpeg(
        script,
        audioPaths,
        videoPaths,
        finalVideoPath
      );

      // Step 6: Generate thumbnail
      console.log('[ReelGenerator] Step 5/5: Generating thumbnail...');
      const thumbnailPath = path.join(reelDir, 'thumbnail.jpg');
      await this.generateThumbnail(finalVideoPath, thumbnailPath);

      // Create metadata file
      const metadata = {
        signal_id: signal.id,
        signal_title: signal.title,
        signal_url: signal.url,
        relevance_score: signal.relevance_score,
        script: script,
        generated_at: new Date().toISOString()
      };

      const metadataPath = path.join(reelDir, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Create GeneratedContent object
      const generatedContent: GeneratedContent = {
        signal_id: signal.id,
        content_type: 'reel',
        status: 'pending',
        reel_script: script,
        reel_video_path: finalVideoPath,
        source_url: signal.url,
        generated_at: new Date().toISOString()
      };

      console.log(`[ReelGenerator] ✅ Complete! Saved to: ${reelDir}`);
      console.log(`[ReelGenerator] Duration: ~${script.totalDurationTarget}s`);
      console.log(`[ReelGenerator] Caption: ${script.caption.substring(0, 50)}...`);
      console.log(`[ReelGenerator] Hashtags: ${script.hashtags.join(' ')}\n`);

      return {
        content: generatedContent,
        videoPath: finalVideoPath,
        script
      };
    } catch (error: any) {
      console.error(`[ReelGenerator] ❌ Error generating reel:`, error.message);
      throw error;
    }
  }

  /**
   * Compose Reel using FFmpeg
   * Concatenates scene videos with their matching audio
   */
  private async composeReelWithFFmpeg(
    script: ReelScript,
    audioPaths: string[],
    videoPaths: string[],
    outputPath: string
  ): Promise<void> {
    try {
      const workDir = path.dirname(outputPath);
      const sceneVideos: string[] = [];

      // Step 1: Get duration of each audio file and create matching video clips
      for (let i = 0; i < audioPaths.length; i++) {
        const audioPath = audioPaths[i];
        const videoPath = videoPaths[i];

        if (!fs.existsSync(audioPath) || !videoPath || !fs.existsSync(videoPath)) {
          console.warn(`[ReelGenerator] Missing audio or video for scene ${i + 1}, skipping`);
          continue;
        }

        // Get audio duration for this scene
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
        );
        const sceneDuration = parseFloat(stdout.trim());

        // Create scene video that matches audio duration
        const sceneVideoPath = path.join(workDir, `scene-${i + 1}-processed.mp4`);

        // Scale, crop, and trim/loop video to match audio duration with consistent framerate
        await execAsync(
          `ffmpeg -y -stream_loop -1 -i "${videoPath}" -t ${sceneDuration} ` +
          `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
          `-c:v libx264 -preset fast -crf 23 -r 25 -an "${sceneVideoPath}" < /dev/null`
        );

        sceneVideos.push(sceneVideoPath);
        console.log(`[ReelGenerator] Processed scene ${i + 1} video (${sceneDuration.toFixed(2)}s)`);
      }

      if (sceneVideos.length === 0) {
        throw new Error('No scene videos were processed');
      }

      // Step 2: Concatenate all scene videos (re-encode to avoid timing issues)
      const videoListPath = path.join(workDir, 'video-list.txt');
      const videoList = sceneVideos.map(p => `file '${path.resolve(p)}'`).join('\n');
      fs.writeFileSync(videoListPath, videoList);

      const concatenatedVideoPath = path.join(workDir, 'concatenated-video.mp4');
      await execAsync(
        `ffmpeg -y -f concat -safe 0 -i "${videoListPath}" ` +
        `-c:v libx264 -preset fast -crf 23 -r 25 "${concatenatedVideoPath}" < /dev/null`
      );

      // Step 3: Concatenate all audio files
      const audioListPath = path.join(workDir, 'audio-list.txt');
      const audioList = audioPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
      fs.writeFileSync(audioListPath, audioList);

      const combinedAudioPath = path.join(workDir, 'combined-audio.mp3');
      await execAsync(
        `ffmpeg -y -f concat -safe 0 -i "${audioListPath}" -c copy "${combinedAudioPath}" < /dev/null`
      );

      // Step 4: Get total duration
      const { stdout: durationOut } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${combinedAudioPath}"`
      );
      const totalDuration = parseFloat(durationOut.trim());
      console.log(`[ReelGenerator] Total duration: ${totalDuration.toFixed(2)}s`);

      // Step 5: Combine final video and audio
      await execAsync(
        `ffmpeg -y -i "${concatenatedVideoPath}" -i "${combinedAudioPath}" ` +
        `-c:v copy -c:a aac -shortest "${outputPath}" < /dev/null`
      );

      // Cleanup temp files
      [...sceneVideos, videoListPath, concatenatedVideoPath, audioListPath, combinedAudioPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      console.log(`[ReelGenerator] ✅ Video composed: ${path.basename(outputPath)}`);
    } catch (error: any) {
      console.error('[ReelGenerator] Error composing video:', error.message);
      throw error;
    }
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
    try {
      await execAsync(
        `ffmpeg -y -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf scale=540:960 "${thumbnailPath}" < /dev/null`
      );
      console.log(`[ReelGenerator] ✅ Thumbnail generated`);
    } catch (error: any) {
      console.warn('[ReelGenerator] Could not generate thumbnail:', error.message);
    }
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpeg(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }
}
