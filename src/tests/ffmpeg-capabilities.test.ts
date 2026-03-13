/**
 * FFmpeg Capabilities Tests
 * Verify FFmpeg installation and available features
 */

import { describe, test, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('FFmpeg Capabilities', () => {
  test('FFmpeg is installed', async () => {
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      expect(stdout).toContain('ffmpeg version');
    } catch (error) {
      throw new Error('FFmpeg is not installed. Install with: brew install ffmpeg');
    }
  });

  test('FFmpeg has drawtext filter (for text overlays)', async () => {
    try {
      const { stdout } = await execAsync('ffmpeg -filters 2>&1 | grep drawtext');
      expect(stdout).toContain('drawtext');
    } catch (error) {
      console.warn('⚠️  FFmpeg missing drawtext filter. Text overlays will be disabled.');
      console.warn('   To enable: brew reinstall ffmpeg --with-freetype');
    }
  });

  test('FFmpeg has xfade filter (for transitions)', async () => {
    try {
      const { stdout } = await execAsync('ffmpeg -filters 2>&1 | grep xfade');
      expect(stdout).toContain('xfade');
    } catch (error) {
      console.warn('⚠️  FFmpeg missing xfade filter. Transitions will be disabled.');
    }
  });

  test('FFmpeg has libx264 encoder (for output)', async () => {
    try {
      const { stdout } = await execAsync('ffmpeg -encoders 2>&1 | grep libx264');
      expect(stdout).toContain('libx264');
    } catch (error) {
      throw new Error('FFmpeg missing libx264 encoder. Reinstall FFmpeg.');
    }
  });

  test('FFmpeg configuration includes necessary libraries', async () => {
    const { stdout } = await execAsync('ffmpeg -version');
    const config = stdout.split('\n').find(line => line.includes('configuration:')) || '';

    const hasX264 = config.includes('--enable-libx264');
    const hasGPL = config.includes('--enable-gpl');

    expect(hasX264).toBe(true);
    expect(hasGPL).toBe(true);

    // Warn about missing features
    if (!config.includes('freetype')) {
      console.warn('⚠️  FFmpeg compiled without freetype. Text overlays unavailable.');
      console.warn('   Reinstall: brew reinstall ffmpeg');
    }
  });
});
