/**
 * Brand Configuration Loader
 */

import { BrandConfig, defaultBrandConfig } from '../types/brand';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load brand configuration
 * First tries to load from config/brand.json, falls back to defaults
 */
export function loadBrandConfig(): BrandConfig {
  const configPath = path.join(__dirname, '../../config/brand.json');

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      const customConfig = JSON.parse(configFile);

      console.log('[BrandConfig] Loaded custom brand configuration');

      // Merge with defaults
      return {
        ...defaultBrandConfig,
        ...customConfig,
        colors: { ...defaultBrandConfig.colors, ...customConfig.colors },
        fonts: { ...defaultBrandConfig.fonts, ...customConfig.fonts },
        voice: { ...defaultBrandConfig.voice, ...customConfig.voice },
        ctas: { ...defaultBrandConfig.ctas, ...customConfig.ctas }
      };
    } catch (error) {
      console.error('[BrandConfig] Error loading custom config, using defaults:', error);
      return defaultBrandConfig;
    }
  } else {
    console.log('[BrandConfig] No custom config found, using defaults');
    console.log('[BrandConfig] Create config/brand.json to customize');
    return defaultBrandConfig;
  }
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
