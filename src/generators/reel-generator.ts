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
  private hasDrawtext: boolean = false;
  private hasXfade: boolean = false;
  private fontPath: string = '';
  private fontBoldPath: string = '';

  constructor(
    brand: BrandConfig,
    outputDir: string = path.join(process.cwd(), 'data', 'output', 'reels'),
    aiModel?: 'claude-sonnet-4' | 'gpt-4o-mini'
  ) {
    this.brand = brand;
    this.scriptWriter = new ReelScriptWriter(aiModel);
    this.tts = new ElevenLabsTTS();
    this.pexels = new PexelsVideoService();
    this.outputDir = outputDir;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Detect fonts and FFmpeg capabilities
    this.detectFonts();
    this.checkFFmpegCapabilities();
  }

  /**
   * Auto-detect available font paths (macOS vs Linux/Docker)
   */
  private detectFonts(): void {
    // Priority: env var > platform-specific paths
    const fontCandidates = [
      process.env.FFMPEG_FONT,
      // Linux / Docker (Debian/Ubuntu with fonts-liberation)
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
      '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
      // macOS
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
    ].filter(Boolean) as string[];

    const boldCandidates = [
      process.env.FFMPEG_FONT_BOLD,
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
      '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    ].filter(Boolean) as string[];

    this.fontPath = fontCandidates.find(f => fs.existsSync(f)) || '';
    this.fontBoldPath = boldCandidates.find(f => fs.existsSync(f)) || this.fontPath;

    if (this.fontPath) {
      console.log(`[ReelGenerator] Font: ${this.fontPath}`);
    } else {
      console.warn('[ReelGenerator] ⚠️ No fonts found — text overlays may fail');
    }
  }

  /**
   * Check which FFmpeg features are available
   */
  private async checkFFmpegCapabilities(): Promise<void> {
    try {
      const { stdout: drawtextCheck } = await execAsync('ffmpeg -filters 2>&1 | grep drawtext || true');
      this.hasDrawtext = drawtextCheck.includes('drawtext');

      const { stdout: xfadeCheck } = await execAsync('ffmpeg -filters 2>&1 | grep xfade || true');
      this.hasXfade = xfadeCheck.includes('xfade');

      if (!this.hasDrawtext) {
        console.warn('[ReelGenerator] ⚠️  FFmpeg missing drawtext filter - text overlays disabled');
      }
      if (!this.hasXfade) {
        console.warn('[ReelGenerator] ⚠️  FFmpeg missing xfade filter - transitions disabled');
      }
    } catch (error) {
      console.warn('[ReelGenerator] Could not check FFmpeg capabilities');
    }
  }

  /**
   * Generate a complete Reel from a signal
   */
  async generate(
    signal: Signal,
    onProgress?: (step: number, totalSteps: number, message: string, estimatedTime?: number) => void,
    options?: {
      viralHook?: string;
      viralVideoId?: number;
      viralTitle?: string;
      viralContentAngle?: string;
      withAudio?: boolean;
    },
    editFeedback?: string,
    previousScript?: ReelScript
  ): Promise<ReelGenerationResult> {
    console.log(`\n[ReelGenerator] Starting generation for signal #${signal.id}`);
    console.log(`[ReelGenerator] Topic: "${signal.title}"`);
    if (options?.viralTitle) {
      console.log(`[ReelGenerator] Using viral pattern: "${options.viralTitle}"`);
      if (options.viralContentAngle) {
        console.log(`[ReelGenerator] Content angle: "${options.viralContentAngle}"`);
      }
    }

    try {
      // Step 1: Generate script with LLM
      onProgress?.(1, 5, 'Writing script...', 50);
      console.log('[ReelGenerator] Step 1/5: Generating script with AI...');
      const script = await this.scriptWriter.generateScript(signal, this.brand, options, editFeedback, previousScript);

      // Step 2: Create output directories
      const reelDir = path.join(this.outputDir, `signal-${signal.id}`);
      const audioDir = path.join(reelDir, 'audio');
      const videoDir = path.join(reelDir, 'video');

      [reelDir, audioDir, videoDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      const withAudio = options?.withAudio !== false && this.tts.isEnabled();

      // Step 3: Generate TTS audio for each scene (if audio enabled)
      let audioPaths: string[] = [];
      if (withAudio) {
        onProgress?.(2, 5, 'Generating voiceover...', 40);
        console.log('[ReelGenerator] Step 2/5: Generating voiceover audio...');
        try {
          const narrations = script.scenes.map(scene => scene.narration);
          audioPaths = await this.tts.generateSceneAudio(
            narrations,
            audioDir,
            `scene`,
            {}
          );
        } catch (ttsError: any) {
          console.warn(`[ReelGenerator] ⚠️ TTS failed (${ttsError.message}) — continuing without audio`);
          audioPaths = [];
        }
      } else {
        onProgress?.(2, 5, 'Skipping audio (no-audio mode)...', 40);
        console.log('[ReelGenerator] Step 2/5: Skipping audio (no-audio mode)');
      }

      // Step 4: Fetch B-roll videos
      onProgress?.(3, 5, 'Fetching B-roll videos...', 30);
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
      onProgress?.(4, 5, 'Compositing video...', 20);
      console.log('[ReelGenerator] Step 4/5: Compositing video with FFmpeg...');
      const finalVideoPath = path.join(reelDir, `reel-final.mp4`);

      if (withAudio && audioPaths.length > 0) {
        await this.composeReelWithFFmpeg(
          script,
          audioPaths,
          videoPaths,
          finalVideoPath
        );
      } else {
        await this.composeReelNoAudio(
          script,
          videoPaths,
          finalVideoPath
        );
      }

      // Step 6: Generate thumbnail
      onProgress?.(5, 5, 'Finalizing...', 5);
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
        reel_video_path: path.relative(process.cwd(), finalVideoPath),
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
   * Enhanced with text overlays, transitions, and watermark
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
        const { stdout: audioDurationStr } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
        );
        const sceneDuration = parseFloat(audioDurationStr.trim());

        // Get video duration
        const { stdout: videoDurationStr } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        const videoDuration = parseFloat(videoDurationStr.trim());

        // Create scene video that matches audio duration
        const sceneVideoPath = path.join(workDir, `scene-${i + 1}-processed.mp4`);

        // Build video filter chain
        let videoFilter = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

        // Add animated text overlay for hook (first scene only) - if drawtext available
        if (this.hasDrawtext && i === 0 && script.scenes[0].narration) {
          const hookText = this.escapeFFmpegText(script.scenes[0].narration);
          // Animated text: fade in at 0.2s, stay for 2.5s, fade out at 2.7s
          videoFilter += `,drawtext=fontfile=${this.fontBoldPath}:text='${hookText}':fontcolor=white:fontsize=64:` +
            `box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2-200:` +
            `enable='between(t,0.2,2.9)':alpha='if(lt(t,0.4),(t-0.2)*5,if(gt(t,2.7),(2.9-t)*5,1))'`;
        }

        // Add subtitle captions matching narration (all scenes, bottom of screen) - if drawtext available
        if (this.hasDrawtext && script.scenes[i].narration) {
          const captionText = this.escapeFFmpegText(script.scenes[i].narration);
          videoFilter += `,drawtext=fontfile=${this.fontPath}:text='${captionText}':fontcolor=white:fontsize=48:` +
            `box=1:boxcolor=black@0.7:boxborderw=15:x=(w-text_w)/2:y=h-150`;
        }

        // Build FFmpeg command based on video length
        let ffmpegCmd: string;

        if (videoDuration < sceneDuration) {
          // Video is too short - loop it to fill the duration
          ffmpegCmd = `ffmpeg -y -stream_loop -1 -i "${videoPath}" -t ${sceneDuration} ` +
            `-vf "${videoFilter}" ` +
            `-c:v libx264 -preset fast -crf 23 -r 25 -an "${sceneVideoPath}" < /dev/null`;
          console.log(`[ReelGenerator] Scene ${i + 1}: Looping ${videoDuration.toFixed(1)}s video to fill ${sceneDuration.toFixed(1)}s`);
        } else {
          // Video is long enough - seek to middle section and trim
          const seekStart = Math.max(0, (videoDuration - sceneDuration) / 2);
          ffmpegCmd = `ffmpeg -y -ss ${seekStart.toFixed(2)} -i "${videoPath}" -t ${sceneDuration} ` +
            `-vf "${videoFilter}" ` +
            `-c:v libx264 -preset fast -crf 23 -r 25 -an "${sceneVideoPath}" < /dev/null`;
          console.log(`[ReelGenerator] Scene ${i + 1}: Trimming ${videoDuration.toFixed(1)}s video to ${sceneDuration.toFixed(1)}s (seek: ${seekStart.toFixed(1)}s)`);
        }

        // Process the video
        await execAsync(ffmpegCmd);

        sceneVideos.push(sceneVideoPath);
        console.log(`[ReelGenerator] Processed scene ${i + 1} video (${sceneDuration.toFixed(2)}s)${i === 0 ? ' with hook overlay' : ''}`);
      }

      if (sceneVideos.length === 0) {
        throw new Error('No scene videos were processed');
      }

      // Step 2: Concatenate scene videos with crossfade transitions (if available)
      const concatenatedVideoPath = path.join(workDir, 'concatenated-video.mp4');
      let videoListPath: string | null = null;

      if (sceneVideos.length === 1) {
        // Single scene - no transitions needed
        await execAsync(
          `ffmpeg -y -i "${sceneVideos[0]}" -c:v libx264 -preset fast -crf 23 -r 25 "${concatenatedVideoPath}" < /dev/null`
        );
      } else if (this.hasXfade) {
        // Multiple scenes - add crossfade transitions (0.5s each)
        await this.concatenateWithTransitions(sceneVideos, concatenatedVideoPath, 0.5);
      } else {
        // Fallback: simple concatenation without transitions
        videoListPath = path.join(workDir, 'video-list.txt');
        const videoList = sceneVideos.map(p => `file '${path.resolve(p)}'`).join('\n');
        fs.writeFileSync(videoListPath, videoList);

        await execAsync(
          `ffmpeg -y -f concat -safe 0 -i "${videoListPath}" ` +
          `-c:v libx264 -preset fast -crf 23 -r 25 "${concatenatedVideoPath}" < /dev/null`
        );

        if (fs.existsSync(videoListPath)) {
          fs.unlinkSync(videoListPath);
        }
      }

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

      // Step 5: Combine final video and audio, add watermark
      const watermarkFilter = this.buildWatermarkFilter();

      if (watermarkFilter) {
        // With watermark
        await execAsync(
          `ffmpeg -y -i "${concatenatedVideoPath}" -i "${combinedAudioPath}" ` +
          `-vf "${watermarkFilter}" ` +
          `-c:v libx264 -preset fast -crf 23 -c:a aac -shortest "${outputPath}" < /dev/null`
        );
        console.log('[ReelGenerator] ✅ Applied brand watermark');
      } else {
        // Without watermark (no re-encode needed)
        await execAsync(
          `ffmpeg -y -i "${concatenatedVideoPath}" -i "${combinedAudioPath}" ` +
          `-c:v copy -c:a aac -shortest "${outputPath}" < /dev/null`
        );
      }

      // Cleanup temp files
      const tempFiles = [...sceneVideos, concatenatedVideoPath, audioListPath, combinedAudioPath];
      if (videoListPath) tempFiles.push(videoListPath);

      tempFiles.forEach(file => {
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
   * Compose reel without audio — uses script duration estimates
   */
  private async composeReelNoAudio(
    script: ReelScript,
    videoPaths: string[],
    outputPath: string
  ): Promise<void> {
    try {
      const workDir = path.dirname(outputPath);
      const sceneVideos: string[] = [];

      for (let i = 0; i < script.scenes.length; i++) {
        const videoPath = videoPaths[i];
        const sceneDuration = script.scenes[i].durationEstimate || 5;

        if (!videoPath || !fs.existsSync(videoPath)) {
          console.warn(`[ReelGenerator] Missing video for scene ${i + 1}, skipping`);
          continue;
        }

        const { stdout: videoDurationStr } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        const videoDuration = parseFloat(videoDurationStr.trim());

        const sceneVideoPath = path.join(workDir, `scene-${i + 1}-processed.mp4`);
        let videoFilter = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

        // Add text overlay with narration text (since there's no audio)
        if (this.hasDrawtext && script.scenes[i].narration) {
          const captionText = this.escapeFFmpegText(script.scenes[i].narration);
          videoFilter += `,drawtext=fontfile=${this.fontPath}:text='${captionText}':fontcolor=white:fontsize=48:` +
            `box=1:boxcolor=black@0.7:boxborderw=15:x=(w-text_w)/2:y=h-150`;
        }

        let ffmpegCmd: string;
        if (videoDuration < sceneDuration) {
          ffmpegCmd = `ffmpeg -y -stream_loop -1 -i "${videoPath}" -t ${sceneDuration} ` +
            `-vf "${videoFilter}" -c:v libx264 -preset fast -crf 23 -r 25 -an "${sceneVideoPath}" < /dev/null`;
        } else {
          const seekStart = Math.max(0, (videoDuration - sceneDuration) / 2);
          ffmpegCmd = `ffmpeg -y -ss ${seekStart.toFixed(2)} -i "${videoPath}" -t ${sceneDuration} ` +
            `-vf "${videoFilter}" -c:v libx264 -preset fast -crf 23 -r 25 -an "${sceneVideoPath}" < /dev/null`;
        }

        await execAsync(ffmpegCmd);
        sceneVideos.push(sceneVideoPath);
        console.log(`[ReelGenerator] Processed scene ${i + 1} (${sceneDuration}s, no audio)`);
      }

      if (sceneVideos.length === 0) {
        throw new Error('No scene videos were processed');
      }

      // Concatenate scenes
      if (sceneVideos.length === 1) {
        await execAsync(`ffmpeg -y -i "${sceneVideos[0]}" -c copy "${outputPath}" < /dev/null`);
      } else {
        const videoListPath = path.join(workDir, 'video-list.txt');
        const videoList = sceneVideos.map(p => `file '${path.resolve(p)}'`).join('\n');
        fs.writeFileSync(videoListPath, videoList);
        await execAsync(
          `ffmpeg -y -f concat -safe 0 -i "${videoListPath}" -c:v libx264 -preset fast -crf 23 -r 25 "${outputPath}" < /dev/null`
        );
        if (fs.existsSync(videoListPath)) fs.unlinkSync(videoListPath);
      }

      // Cleanup
      sceneVideos.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
      console.log(`[ReelGenerator] ✅ Video composed (no audio): ${path.basename(outputPath)}`);
    } catch (error: any) {
      console.error('[ReelGenerator] Error composing video (no audio):', error.message);
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

  /**
   * Concatenate videos with smooth crossfade transitions
   */
  private async concatenateWithTransitions(
    videoPaths: string[],
    outputPath: string,
    transitionDuration: number = 0.5
  ): Promise<void> {
    try {
      // Get actual duration of each video
      const durations: number[] = [];
      for (const videoPath of videoPaths) {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        durations.push(parseFloat(stdout.trim()));
      }

      // Build complex filter for crossfade transitions
      const inputs = videoPaths.map(p => `-i "${p}"`).join(' ');

      let filterComplex = '';
      let previousLabel = '0:v';
      let cumulativeDuration = 0;

      for (let i = 1; i < videoPaths.length; i++) {
        const currentLabel = `${i}:v`;
        const outputLabel = i === videoPaths.length - 1 ? '' : `v${i}`;

        // Calculate offset: cumulative duration of all previous clips minus transition overlap
        const offset = cumulativeDuration - (i > 1 ? transitionDuration : 0);

        if (i === 1) {
          // First transition: 0:v crossfades with 1:v
          filterComplex = `[${previousLabel}][${currentLabel}]xfade=transition=fade:duration=${transitionDuration}:offset=${durations[0] - transitionDuration}${outputLabel ? `[${outputLabel}]` : ''}`;
          cumulativeDuration = durations[0] + durations[1] - transitionDuration;
        } else {
          // Subsequent transitions
          const prevLabel = `v${i - 1}`;
          const prevOffset = cumulativeDuration - transitionDuration;
          filterComplex += `;[${prevLabel}][${currentLabel}]xfade=transition=fade:duration=${transitionDuration}:offset=${prevOffset}${outputLabel ? `[${outputLabel}]` : ''}`;
          cumulativeDuration += durations[i] - transitionDuration;
        }

        previousLabel = outputLabel || 'out';
      }

      await execAsync(
        `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" ` +
        `-c:v libx264 -preset fast -crf 23 -r 25 "${outputPath}" < /dev/null`
      );

      console.log(`[ReelGenerator] ✅ Applied ${videoPaths.length - 1} crossfade transitions`);
    } catch (error: any) {
      console.warn('[ReelGenerator] Failed to apply transitions, falling back to simple concat:', error.message);
      // Fallback: simple concatenation without transitions
      const videoListPath = path.join(path.dirname(outputPath), 'video-list.txt');
      const videoList = videoPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
      fs.writeFileSync(videoListPath, videoList);

      await execAsync(
        `ffmpeg -y -f concat -safe 0 -i "${videoListPath}" ` +
        `-c:v libx264 -preset fast -crf 23 -r 25 "${outputPath}" < /dev/null`
      );

      if (fs.existsSync(videoListPath)) {
        fs.unlinkSync(videoListPath);
      }
    }
  }

  /**
   * Build watermark filter for brand overlay
   * Returns null if no watermark configured
   */
  private buildWatermarkFilter(): string | null {
    // Check for watermark/logo file
    const possibleLogoPaths = [
      './assets/logo.png',
      './assets/watermark.png',
      './public/logo.png',
      path.join(__dirname, '../../assets/logo.png')
    ];

    const logoPath = possibleLogoPaths.find(p => fs.existsSync(p));

    if (logoPath) {
      // Overlay logo in bottom-right corner (20px padding)
      // Scale logo to 120px width maintaining aspect ratio
      return `movie=${logoPath},scale=120:-1[wm];[in][wm]overlay=W-w-20:H-h-20[out]`;
    }

    // Fallback: Text watermark with brand handle (only if drawtext is available)
    if (!this.hasDrawtext) {
      console.log('[ReelGenerator] Skipping watermark — drawtext filter not available');
      return null;
    }

    const brandHandle = this.brand.handle || '@surestepautomation';
    const escapedHandle = this.escapeFFmpegText(brandHandle);

    return `drawtext=fontfile=${this.fontPath}:text='${escapedHandle}':` +
      `fontcolor=white@0.6:fontsize=24:x=W-tw-20:y=H-th-20`;
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeFFmpegText(text: string): string {
    return text
      .replace(/\\/g, '\\\\\\\\')  // Backslashes
      .replace(/'/g, '')            // Remove single quotes/apostrophes (they break the filter)
      .replace(/:/g, '\\:')         // Colons
      .replace(/%/g, '\\%')         // Percent signs
      .replace(/\n/g, ' ')          // Newlines to spaces
      .substring(0, 100);           // Limit length
  }
}
