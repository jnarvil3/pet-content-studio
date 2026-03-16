/**
 * Reel Script Writer
 * Generates Instagram Reel scripts from topic signals using AI (Claude or OpenAI)
 */

import dotenv from 'dotenv';
dotenv.config();

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Signal } from '../types/signal';
import { ReelScript } from '../types/content';
import { BrandConfig } from '../types/brand';

type AIModel = 'claude-sonnet-4' | 'gpt-4o-mini';

export class ReelScriptWriter {
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private modelPreference: AIModel;

  constructor(aiModel?: AIModel) {
    // Use provided model, fallback to env var, then default to claude-sonnet-4
    this.modelPreference = aiModel || (process.env.AI_MODEL_PREFERENCE as AIModel) || 'claude-sonnet-4';

    if (this.modelPreference === 'claude-sonnet-4') {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured - add it to your .env file');
      }
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      console.log('[ReelScriptWriter] Using Claude Sonnet 4 (premium quality)');
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('[ReelScriptWriter] Using GPT-4o-mini (fast & cheap)');
    }
  }

  /**
   * Generate Reel script from a topic signal
   */
  async generateScript(
    signal: Signal,
    brand: BrandConfig,
    viralPattern?: {
      viralHook?: string;
      viralTitle?: string;
      viralContentAngle?: string;
    },
    editFeedback?: string
  ): Promise<ReelScript> {
    const prompt = this.buildScriptPrompt(signal, brand, viralPattern, editFeedback);

    console.log(`[ReelScriptWriter] Generating script for signal #${signal.id}: "${signal.title}"`);
    if (viralPattern?.viralTitle) {
      console.log(`[ReelScriptWriter] Using viral pattern: "${viralPattern.viralTitle}"`);
    }

    try {
      let responseText: string;

      if (this.modelPreference === 'claude-sonnet-4' && this.anthropicClient) {
        // Use Claude Sonnet 4
        const response = await this.anthropicClient.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        // Extract text content from Claude's response
        const textContent = response.content.find(block => block.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Claude response');
        }
        responseText = textContent.text;
      } else if (this.openaiClient) {
        // Use GPT-4o-mini
        const response = await this.openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        responseText = response.choices[0].message.content || '';
      } else {
        throw new Error('No AI client configured');
      }

      const result = JSON.parse(responseText);

      console.log(`[ReelScriptWriter] ✅ Generated ${result.scenes?.length || 0}-scene script (${result.totalDurationTarget}s target) using ${this.modelPreference}`);

      return {
        ...result,
        topicCardId: signal.id.toString()
      } as ReelScript;
    } catch (error: any) {
      console.error('[ReelScriptWriter] Error generating script:', error.message);
      throw error;
    }
  }

  /**
   * Build the system prompt for Reel script generation
   */
  private buildScriptPrompt(
    signal: Signal,
    brand: BrandConfig,
    viralPattern?: {
      viralHook?: string;
      viralTitle?: string;
      viralContentAngle?: string;
    },
    editFeedback?: string
  ): string {
    const brandHandle = brand.handle;

    // Build hook instruction based on viral pattern selection
    let hookInstruction = '';
    if (viralPattern?.viralTitle) {
      hookInstruction = `- REQUIRED: Emulate this PROVEN VIRAL PATTERN:
  * Example viral title: "${viralPattern.viralTitle}"
  ${viralPattern.viralContentAngle ? `* Content approach: "${viralPattern.viralContentAngle}"` : ''}
  ${viralPattern.viralHook ? `* Hook style: "${viralPattern.viralHook}"` : ''}
- Study the pattern above and create a hook that uses the SAME structure/format but adapted to YOUR topic.
- Keep the emotional tone and phrasing style that made the example viral.`;
    } else {
      hookInstruction = `- Use one of these hook formulas (rotate):
  * CURIOSITY: "Most dog owners get this completely wrong."
  * CONTRARIAN: "Stop doing this to your dog. Seriously."
  * QUESTION: "Is your dog actually happy? Here's how to tell."
  * MISTAKE: "This common mistake is stressing your dog out."
  * PERSONAL: "I wish I knew this before getting my puppy."`;
    }

    // Build feedback context if regenerating
    let feedbackContext = '';
    if (editFeedback) {
      feedbackContext = `
---

REVISION REQUEST:
The client reviewed the previous version and requests these changes:
${editFeedback}

Generate a REVISED version that addresses ALL of the feedback above while maintaining quality.

---
`;
    }

    return `You are a Reel scriptwriter for ${brand.name}, a pet industry superapp. Your job is to turn a topic card into a 30–45 second Instagram Reel script.
${feedbackContext}
IMPORTANT — LANGUAGE REQUIREMENT:
Write ALL narration, captions, and the Instagram caption in Brazilian Portuguese (PT-BR).
- Use natural, conversational Brazilian Portuguese — NOT European Portuguese.
- Use informal "voce" (not "tu"). Write how Brazilian pet owners actually talk.
- Hashtags should be in Portuguese (e.g., #cachorro, #petlovers, #dicaspet).
- pexelsSearchTerms must REMAIN IN ENGLISH (Pexels search works best in English).

You write scripts that sound like a knowledgeable dog owner talking directly to camera — natural, conversational, specific. Not a textbook. Not a voiceover for a corporate video. Write how real pet owners talk.

---

TOPIC CARD:
Title: ${signal.title}
Description: ${signal.description || 'N/A'}
Source: ${signal.url || 'N/A'}

---

STRUCTURE: Every Reel has exactly 5 scenes.

SCENE 1 — HOOK (0–3 seconds)
- The most important 3 seconds. Must create a curiosity gap or pattern interrupt.
- Narration: 1 short sentence, max 10 words. Punchy. Surprising.
${hookInstruction}
- The hook should make someone stop scrolling within 1.5 seconds.
- captionText = exact same as narration (displayed as big animated text)

SCENE 2 — PROBLEM (3–12 seconds)
- Set up the problem or context. Make the viewer relate.
- Narration: 2-3 sentences, max 30 words. Conversational.
- captionText: Shortened to key phrase (5-8 words)

SCENE 3 — INSIGHT (12–25 seconds)
- The core value. A surprising fact, stat, or reframe.
- Narration: 2-3 sentences, max 35 words. Include a specific number or data point.
- captionText: The stat or key insight (5-8 words)

SCENE 4 — TIP (25–35 seconds)
- The actionable takeaway. Tell them exactly what to do.
- Narration: 2-3 sentences, max 30 words. Be specific.
- captionText: The action step (5-8 words)

SCENE 5 — CTA (35–45 seconds)
- Warm sign-off with follow prompt.
- Narration: 1-2 sentences, max 15 words. e.g., "Follow for more pet tips. Save this one."
- captionText: "Follow ${brandHandle} 🐾"

---

RULES:
1. Total narration across all scenes should take 30-45 seconds when spoken aloud. Estimate ~150 words per minute (2.5 words per second).
2. Write for the EAR, not the eye. Use short sentences. Use pauses (write "..." for a beat). Avoid complex clauses.
3. Sound human. Use contractions. Be slightly opinionated. Ask rhetorical questions.
4. No medical claims. No specific medication recommendations.
5. pexelsSearchTerms should be 2-3 word phrases featuring dogs/pets. Think about what VIDEO footage would look good (not photos). Example: ["dog playing park", "puppy training treats", "golden retriever walking"]
6. Each scene's captionText is the SHORT on-screen version, not the full narration. It should be scannable in under 2 seconds.

---

OUTPUT FORMAT (return ONLY valid JSON):

{
  "title": "Internal reference title from topic",
  "totalDurationTarget": 40,
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneType": "hook",
      "narration": "Your dog isn't being bad. They're trying to tell you something.",
      "durationEstimate": 3,
      "captionText": "Your dog isn't being bad.",
      "pexelsSearchTerms": ["anxious dog home", "dog looking owner", "stressed puppy"],
      "pexelsVideoOrientation": "portrait"
    },
    {
      "sceneNumber": 2,
      "sceneType": "problem",
      "narration": "Most owners miss these subtle stress signals... and it makes things worse.",
      "durationEstimate": 5,
      "captionText": "Missing the stress signals",
      "pexelsSearchTerms": ["dog stressed home", "worried dog owner", "puppy anxious"],
      "pexelsVideoOrientation": "portrait"
    },
    {
      "sceneNumber": 3,
      "sceneType": "insight",
      "narration": "Research shows 73% of dogs show anxiety signs that go unnoticed. Here's what to watch for.",
      "durationEstimate": 7,
      "captionText": "73% show unnoticed anxiety",
      "pexelsSearchTerms": ["dog behavior research", "pet psychology", "dog body language"],
      "pexelsVideoOrientation": "portrait"
    },
    {
      "sceneNumber": 4,
      "sceneType": "tip",
      "narration": "Start by watching their ears, tail, and breathing. These three tell you everything.",
      "durationEstimate": 5,
      "captionText": "Watch ears, tail, breathing",
      "pexelsSearchTerms": ["dog close up face", "dog tail wagging", "happy dog breathing"],
      "pexelsVideoOrientation": "portrait"
    },
    {
      "sceneNumber": 5,
      "sceneType": "cta",
      "narration": "Follow for more pet tips. Your dog will thank you.",
      "durationEstimate": 3,
      "captionText": "Follow ${brandHandle} 🐾",
      "pexelsSearchTerms": ["happy dog owner", "dog licking face", "cute dog camera"],
      "pexelsVideoOrientation": "portrait"
    }
  ],
  "caption": "Your dog is talking to you—are you listening? 🐕 Watch for these 3 stress signals most owners miss. Drop a 🐾 if you learned something new!",
  "hashtags": ["dogs", "dogbehavior", "petcare", "dogtraining", "petparent"],
  "hookFormula": "curiosity"
}

IMPORTANT:
- pexelsSearchTerms must be 2-3 words, specific to scene, always include dog/pet
- caption should be 50-100 words, start with hook question
- Include exactly 5 hashtags: 2 broad, 2 medium, 1 niche
- hookFormula must be one of: curiosity, contrarian, question, mistake, personal`;
  }
}
