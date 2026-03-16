/**
 * ElevenLabs Text-to-Speech Service
 * Generates voiceover audio from script narration
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export class ElevenLabsTTS {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = 'pFZP5JQG7iQjIQuC4Bku'; // Lily - multilingual, warm (supports PT-BR)

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';

    if (!this.apiKey || this.apiKey === 'your_elevenlabs_api_key_here') {
      console.log('[ElevenLabsTTS] ⚠️  No API key configured, TTS disabled');
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.apiKey && this.apiKey !== 'your_elevenlabs_api_key_here';
  }

  /**
   * Generate speech audio from text
   */
  async generateSpeech(
    text: string,
    outputPath: string,
    options: TTSOptions = {}
  ): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options.voiceId || this.defaultVoiceId;

    console.log(`[ElevenLabsTTS] Generating speech: "${text.substring(0, 50)}..."`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_multilingual_v2', // Multilingual model for PT-BR support
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.75,
            style: options.style || 0.3,
          }
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write audio file
      fs.writeFileSync(outputPath, Buffer.from(response.data));

      console.log(`[ElevenLabsTTS] ✅ Audio saved: ${path.basename(outputPath)}`);
    } catch (error: any) {
      console.error('[ElevenLabsTTS] Error generating speech:', error.message);
      throw error;
    }
  }

  /**
   * Generate speech for multiple text segments (e.g., Reel scenes)
   */
  async generateSceneAudio(
    texts: string[],
    outputDir: string,
    prefix: string = 'scene',
    options: TTSOptions = {}
  ): Promise<string[]> {
    const outputPaths: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const filename = `${prefix}-${i + 1}.mp3`;
      const outputPath = path.join(outputDir, filename);

      await this.generateSpeech(texts[i], outputPath, options);
      outputPaths.push(outputPath);

      // Small delay to avoid rate limiting
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[ElevenLabsTTS] ✅ Generated ${outputPaths.length} audio files`);
    return outputPaths;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices || [];
    } catch (error: any) {
      console.error('[ElevenLabsTTS] Error fetching voices:', error.message);
      return [];
    }
  }

  /**
   * Estimate duration of text when spoken (rough calculation)
   * Assumes ~150 words per minute (2.5 words per second)
   */
  estimateDuration(text: string): number {
    const words = text.trim().split(/\s+/).length;
    const seconds = words / 2.5;
    return Math.ceil(seconds);
  }
}
