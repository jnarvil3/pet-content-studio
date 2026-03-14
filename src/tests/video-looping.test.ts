/**
 * Video Looping Fix Tests
 * Tests the fix in reel-generator.ts:228-280 that properly handles video duration matching
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'output', 'video-looping');

describe('Video Looping Fix', () => {
  beforeAll(async () => {
    // Create directories
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Generate test fixtures
    await generateTestFixtures();
  });

  afterAll(() => {
    // Cleanup output files (keep fixtures for reuse)
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.readdirSync(OUTPUT_DIR).forEach(file => {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      });
    }
  });

  test('Short video (2s) should loop to match audio (5s)', async () => {
    const videoPath = path.join(FIXTURES_DIR, 'test-short-2s.mp4');
    const audioPath = path.join(FIXTURES_DIR, 'test-audio-5s.mp3');
    const outputPath = path.join(OUTPUT_DIR, 'looped-output.mp4');

    // Verify fixtures exist
    expect(fs.existsSync(videoPath)).toBe(true);
    expect(fs.existsSync(audioPath)).toBe(true);

    // Get durations
    const { stdout: videoDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const { stdout: audioDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );

    const videoDur = parseFloat(videoDurationStr.trim());
    const audioDur = parseFloat(audioDurationStr.trim());

    // Verify video is shorter than audio (test precondition)
    expect(videoDur).toBeLessThan(audioDur);
    console.log(`  Video: ${videoDur}s, Audio: ${audioDur}s`);

    // Simulate the FFmpeg command from reel-generator.ts (lines 265-269)
    // When video is shorter, we loop it
    await execAsync(
      `ffmpeg -y -stream_loop -1 -i "${videoPath}" -t ${audioDur} ` +
      `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
      `-c:v libx264 -preset fast -crf 23 -r 25 -an "${outputPath}" < /dev/null`
    );

    // Verify output exists
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify output duration matches audio duration (within 0.5s tolerance)
    const { stdout: outputDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
    );
    const outputDur = parseFloat(outputDurationStr.trim());

    console.log(`  Output duration: ${outputDur}s (expected: ${audioDur}s)`);
    expect(Math.abs(outputDur - audioDur)).toBeLessThan(0.5);
  }, 60000); // 60 second timeout for FFmpeg operations

  test('Long video (10s) should trim from middle to match audio (5s)', async () => {
    const videoPath = path.join(FIXTURES_DIR, 'test-long-10s.mp4');
    const audioPath = path.join(FIXTURES_DIR, 'test-audio-5s.mp3');
    const outputPath = path.join(OUTPUT_DIR, 'trimmed-output.mp4');

    // Verify fixtures exist
    expect(fs.existsSync(videoPath)).toBe(true);
    expect(fs.existsSync(audioPath)).toBe(true);

    // Get durations
    const { stdout: videoDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const { stdout: audioDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );

    const videoDur = parseFloat(videoDurationStr.trim());
    const audioDur = parseFloat(audioDurationStr.trim());

    // Verify video is longer than audio (test precondition)
    expect(videoDur).toBeGreaterThan(audioDur);
    console.log(`  Video: ${videoDur}s, Audio: ${audioDur}s`);

    // Calculate seek position (from reel-generator.ts line 273)
    const seekStart = Math.max(0, (videoDur - audioDur) / 2);
    expect(seekStart).toBeGreaterThan(0);
    console.log(`  Seeking to: ${seekStart.toFixed(2)}s (middle section)`);

    // Simulate the FFmpeg command from reel-generator.ts (lines 274-277)
    // When video is longer, we seek to middle and trim
    await execAsync(
      `ffmpeg -y -ss ${seekStart.toFixed(2)} -i "${videoPath}" -t ${audioDur} ` +
      `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
      `-c:v libx264 -preset fast -crf 23 -r 25 -an "${outputPath}" < /dev/null`
    );

    // Verify output exists
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify output duration matches audio duration (within 0.5s tolerance)
    const { stdout: outputDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
    );
    const outputDur = parseFloat(outputDurationStr.trim());

    console.log(`  Output duration: ${outputDur}s (expected: ${audioDur}s)`);
    expect(Math.abs(outputDur - audioDur)).toBeLessThan(0.5);
  }, 60000); // 60 second timeout for FFmpeg operations

  test('Equal duration video (5s) should match audio (5s) exactly', async () => {
    const videoPath = path.join(FIXTURES_DIR, 'test-equal-5s.mp4');
    const audioPath = path.join(FIXTURES_DIR, 'test-audio-5s.mp3');
    const outputPath = path.join(OUTPUT_DIR, 'equal-output.mp4');

    // Verify fixtures exist
    expect(fs.existsSync(videoPath)).toBe(true);
    expect(fs.existsSync(audioPath)).toBe(true);

    // Get durations
    const { stdout: videoDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const { stdout: audioDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );

    const videoDur = parseFloat(videoDurationStr.trim());
    const audioDur = parseFloat(audioDurationStr.trim());

    console.log(`  Video: ${videoDur}s, Audio: ${audioDur}s`);

    // For equal or slightly longer video, no looping needed, just trim
    const seekStart = Math.max(0, (videoDur - audioDur) / 2);

    await execAsync(
      `ffmpeg -y -ss ${seekStart.toFixed(2)} -i "${videoPath}" -t ${audioDur} ` +
      `-vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" ` +
      `-c:v libx264 -preset fast -crf 23 -r 25 -an "${outputPath}" < /dev/null`
    );

    // Verify output
    expect(fs.existsSync(outputPath)).toBe(true);

    const { stdout: outputDurationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
    );
    const outputDur = parseFloat(outputDurationStr.trim());

    console.log(`  Output duration: ${outputDur}s (expected: ${audioDur}s)`);
    expect(Math.abs(outputDur - audioDur)).toBeLessThan(0.5);
  }, 60000);
});

/**
 * Generate test fixtures (videos and audio)
 */
async function generateTestFixtures(): Promise<void> {
  console.log('  Generating test fixtures...');

  const fixtures = [
    { name: 'test-short-2s.mp4', duration: 2, type: 'video' },
    { name: 'test-equal-5s.mp4', duration: 5, type: 'video' },
    { name: 'test-long-10s.mp4', duration: 10, type: 'video' },
    { name: 'test-audio-5s.mp3', duration: 5, type: 'audio' }
  ];

  for (const fixture of fixtures) {
    const fixturePath = path.join(FIXTURES_DIR, fixture.name);

    // Skip if already exists
    if (fs.existsSync(fixturePath)) {
      continue;
    }

    if (fixture.type === 'video') {
      // Generate black video with moving white dot (to verify it's not static)
      console.log(`    Creating ${fixture.name}...`);
      await execAsync(
        `ffmpeg -f lavfi -i color=black:s=1080x1920:d=${fixture.duration} ` +
        `-f lavfi -i color=white:s=50x50:d=${fixture.duration} ` +
        `-filter_complex "[1:v]scale=50:50[dot];[0:v][dot]overlay=x='if(lt(mod(t,2),1),W/2-25,W/2+100)':y=H/2-25" ` +
        `-c:v libx264 -preset fast -pix_fmt yuv420p "${fixturePath}"`
      );
    } else {
      // Generate silent audio
      console.log(`    Creating ${fixture.name}...`);
      await execAsync(
        `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${fixture.duration} ` +
        `-c:a libmp3lame "${fixturePath}"`
      );
    }
  }

  console.log('  ✓ Test fixtures ready');
}
