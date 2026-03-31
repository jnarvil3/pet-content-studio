/**
 * Brand Configuration Loader
 */

import { BrandConfig, defaultBrandConfig } from '../types/brand';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load brand configuration
 * Priority: brand.json (UI-saved) > env vars > defaults
 */
export function loadBrandConfig(): BrandConfig {
  const configPath = path.join(__dirname, '../../config/brand.json');

  let config = { ...defaultBrandConfig };
  let customConfig: any = {};

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      customConfig = JSON.parse(configFile);

      console.log('[BrandConfig] Loaded custom brand configuration');

      // Merge with defaults
      config = {
        ...defaultBrandConfig,
        ...customConfig,
        colors: { ...defaultBrandConfig.colors, ...customConfig.colors },
        fonts: { ...defaultBrandConfig.fonts, ...customConfig.fonts },
        voice: { ...defaultBrandConfig.voice, ...customConfig.voice },
        ctas: { ...defaultBrandConfig.ctas, ...customConfig.ctas }
      };
    } catch (error) {
      console.error('[BrandConfig] Error loading custom config, using defaults:', error);
    }
  } else {
    console.log('[BrandConfig] No custom config found, using defaults');
    console.log('[BrandConfig] Create config/brand.json to customize');
  }

  // Env vars are fallback only — they fill in when brand.json doesn't have the field
  // Once the user saves via UI, brand.json has the field and env vars are ignored
  if (process.env.BRAND_NAME && !('name' in customConfig)) {
    config.name = process.env.BRAND_NAME;
  }
  if (process.env.BRAND_HANDLE && !('handle' in customConfig)) {
    config.handle = process.env.BRAND_HANDLE;
  }

  return config;
}

/**
 * Save brand configuration to file
 */
export function saveBrandConfig(config: BrandConfig): void {
  const configPath = path.join(__dirname, '../../config/brand.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('[BrandConfig] Saved brand configuration to', configPath);
}

/**
 * Get brand config singleton
 */
let brandConfigInstance: BrandConfig | null = null;

export function getBrandConfig(): BrandConfig {
  if (!brandConfigInstance) {
    brandConfigInstance = loadBrandConfig();
  }
  return brandConfigInstance;
}

/**
 * Clear brand config cache (call after saving new config)
 */
export function clearBrandCache(): void {
  brandConfigInstance = null;
}
