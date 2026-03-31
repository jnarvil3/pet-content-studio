/**
 * Carousel Slide HTML Template Generator
 * Creates 1080x1080px Instagram-ready slide HTML for Puppeteer
 */

import { CarouselSlide } from '../types/content';
import { BrandConfig } from '../types/brand';

export class CarouselTemplate {
  private brand: BrandConfig;

  constructor(brand: BrandConfig) {
    this.brand = brand;
  }

  /**
   * Generate HTML for a single carousel slide
   */
  generateSlideHTML(slide: CarouselSlide, totalSlides: number, backgroundUrl?: string): string {
    const layoutHint = slide.layoutHint || 'content';

    if (layoutHint === 'hook') {
      return this.generateHookSlide(slide, totalSlides, backgroundUrl);
    } else if (layoutHint === 'cta') {
      return this.generateCTASlide(slide, totalSlides);
    } else if (layoutHint === 'insight' && slide.stat) {
      return this.generateStatSlide(slide, totalSlides, backgroundUrl);
    } else {
      return this.generateContentSlide(slide, totalSlides, backgroundUrl);
    }
  }

  /**
   * SLIDE 1: Hook slide (large centered text + swipe cue + background image)
   */
  private generateHookSlide(slide: CarouselSlide, totalSlides: number, backgroundUrl?: string): string {
    const hasBackground = backgroundUrl && backgroundUrl.trim() !== '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1080px;
      height: 1350px;
      ${hasBackground ? `
        background-image: url('${backgroundUrl}');
        background-size: cover;
        background-position: center;
      ` : `background: linear-gradient(135deg, ${this.brand.colors.primary} 0%, ${this.brand.colors.secondary} 100%);`}
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 100px 34px;
      font-family: ${this.brand.fonts.heading};
      position: relative;
      overflow: hidden;
    }

    ${hasBackground ? `
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.15) 0%,
        rgba(0, 0, 0, 0.40) 40%,
        rgba(0, 0, 0, 0.75) 70%,
        rgba(0, 0, 0, 0.85) 100%
      );
      z-index: 0;
    }
    ` : ''}

    /* Safe zone: 1012x1350 centered */
    .safe-zone {
      width: 100%;
      max-width: 1012px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .slide-number {
      position: absolute;
      top: 50px;
      right: 50px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 28px;
      font-weight: 500;
      z-index: 1;
    }

    .hook-text {
      color: #ffffff;
      font-size: 60px;
      font-weight: 800;
      line-height: 1.2;
      text-align: center;
      text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
      margin-bottom: 60px;
      letter-spacing: -0.5px;
    }

    .swipe-cue {
      display: flex;
      align-items: center;
      gap: 12px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 32px;
      font-weight: 600;
      animation: pulse 2s ease-in-out infinite;
    }

    .swipe-arrow {
      font-size: 48px;
      animation: slideRight 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    @keyframes slideRight {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(10px); }
    }

    .brand-handle {
      position: absolute;
      bottom: 50px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 32px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="safe-zone">
    <div class="slide-number">1/${totalSlides}</div>
    <h1 class="hook-text">${this.escapeHTML(slide.title || slide.body)}</h1>
    <div class="swipe-cue">
      <span>Swipe</span>
      <span class="swipe-arrow">→</span>
    </div>
    <div class="brand-handle">${this.escapeHTML(this.brand.handle)}</div>
  </div>
</body>
</html>
    `;
  }

  /**
   * SLIDE 3: Stat slide (prominent number + context)
   */
  private generateStatSlide(slide: CarouselSlide, totalSlides: number, backgroundUrl?: string): string {
    const hasBackground = backgroundUrl && backgroundUrl.trim() !== '';
    const stat = slide.stat!;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1080px;
      height: 1350px;
      ${hasBackground ? `
        background-image: url('${backgroundUrl}');
        background-size: cover;
        background-position: center;
      ` : `background-color: ${this.brand.colors.background};`}
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 120px 34px;
      font-family: ${this.brand.fonts.body};
      position: relative;
      overflow: hidden;
    }

    ${hasBackground ? `
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.15) 0%,
        rgba(0, 0, 0, 0.40) 40%,
        rgba(0, 0, 0, 0.75) 70%,
        rgba(0, 0, 0, 0.85) 100%
      );
      z-index: 0;
    }
    ` : ''}

    .safe-zone {
      width: 100%;
      max-width: 1012px;
      position: relative;
      z-index: 1;
      text-align: center;
    }

    .slide-number {
      position: absolute;
      top: 50px;
      right: 50px;
      ${hasBackground ? 'color: rgba(255, 255, 255, 0.6);' : `color: ${this.brand.colors.primary};`}
      font-size: 28px;
      font-weight: 600;
      z-index: 1;
    }

    .stat-number {
      ${hasBackground ? 'color: #ffffff;' : `color: ${this.brand.colors.primary};`}
      font-size: 96px;
      font-weight: 900;
      margin-bottom: 20px;
      font-family: ${this.brand.fonts.heading};
      line-height: 1;
      text-shadow: ${hasBackground ? '0 6px 40px rgba(0,0,0,0.6)' : 'none'};
      letter-spacing: -2px;
    }

    .stat-context {
      ${hasBackground ? 'color: rgba(255, 255, 255, 0.95);' : `color: ${this.brand.colors.text};`}
      font-size: 36px;
      font-weight: 600;
      margin-bottom: 50px;
      line-height: 1.3;
      ${hasBackground ? 'text-shadow: 0 3px 20px rgba(0,0,0,0.5);' : ''}
    }

    .title {
      ${hasBackground ? 'color: #ffffff;' : `color: ${this.brand.colors.primary};`}
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 30px;
      font-family: ${this.brand.fonts.heading};
      line-height: 1.2;
    }

    .body {
      ${hasBackground ? 'color: rgba(255, 255, 255, 0.9);' : `color: ${this.brand.colors.text};`}
      font-size: 28px;
      font-weight: ${hasBackground ? '500' : '400'};
      line-height: 1.5;
      ${hasBackground ? 'text-shadow: 0 2px 15px rgba(0,0,0,0.4);' : ''}
    }
  </style>
</head>
<body>
  <div class="slide-number">${slide.slideNumber}/${totalSlides}</div>
  <div class="safe-zone">
    <div class="stat-number">${this.escapeHTML(stat.number)}</div>
    <div class="stat-context">${this.escapeHTML(stat.context)}</div>
    ${slide.title ? `<h2 class="title">${this.escapeHTML(slide.title)}</h2>` : ''}
    ${slide.body ? `<p class="body">${this.escapeHTML(slide.body)}</p>` : ''}
  </div>
</body>
</html>
    `;
  }

  /**
   * SLIDES 2 & 4: Content slides (heading + body with background image)
   */
  private generateContentSlide(slide: CarouselSlide, totalSlides: number, backgroundUrl?: string): string {
    const hasBackground = backgroundUrl && backgroundUrl.trim() !== '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1080px;
      height: 1350px;
      ${hasBackground ? `
        background-image: url('${backgroundUrl}');
        background-size: cover;
        background-position: center;
      ` : `background-color: ${this.brand.colors.background};`}
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 120px 34px;
      font-family: ${this.brand.fonts.body};
      position: relative;
      overflow: hidden;
    }

    ${hasBackground ? `
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%);
      z-index: 0;
    }
    ` : ''}

    .safe-zone {
      width: 100%;
      max-width: 1012px;
      position: relative;
      z-index: 1;
    }

    .slide-number {
      position: absolute;
      top: 50px;
      right: 50px;
      ${hasBackground ? 'color: rgba(255, 255, 255, 0.9);' : `color: ${this.brand.colors.primary};`}
      font-size: 28px;
      font-weight: 600;
      z-index: 1;
    }

    .heading {
      ${hasBackground ? 'color: #ffffff;' : `color: ${this.brand.colors.primary};`}
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 40px;
      font-family: ${this.brand.fonts.heading};
      line-height: 1.2;
      ${hasBackground ? 'text-shadow: 0 3px 20px rgba(0,0,0,0.5);' : ''}
    }

    .body {
      ${hasBackground ? 'color: rgba(255, 255, 255, 0.95);' : `color: ${this.brand.colors.text};`}
      font-size: 28px;
      font-weight: ${hasBackground ? '500' : '400'};
      line-height: 1.6;
      ${hasBackground ? 'text-shadow: 0 2px 15px rgba(0,0,0,0.4);' : ''}
    }

    ${!hasBackground ? `
    .accent-bar {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 400px;
      background: ${this.brand.colors.accent || this.brand.colors.primary};
      border-radius: 0 8px 8px 0;
      z-index: 0;
    }
    ` : ''}
  </style>
</head>
<body>
  ${!hasBackground ? '<div class="accent-bar"></div>' : ''}
  <div class="slide-number">${slide.slideNumber}/${totalSlides}</div>
  <div class="safe-zone">
    ${slide.title ? `<h2 class="heading">${this.escapeHTML(slide.title)}</h2>` : ''}
    <p class="body">${this.escapeHTML(slide.body)}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * SLIDE 5: CTA slide (centered text + branding)
   */
  private generateCTASlide(slide: CarouselSlide, totalSlides: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1080px;
      height: 1350px;
      background: linear-gradient(135deg, ${this.brand.colors.secondary} 0%, ${this.brand.colors.primary} 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 120px 34px;
      font-family: ${this.brand.fonts.heading};
      position: relative;
    }

    .safe-zone {
      width: 100%;
      max-width: 1012px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
    }

    .slide-number {
      position: absolute;
      top: 50px;
      right: 50px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 28px;
      font-weight: 500;
    }

    .cta-heading {
      color: ${this.brand.colors.background};
      font-size: 62px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 50px;
      line-height: 1.2;
    }

    .cta-body {
      color: rgba(255, 255, 255, 0.95);
      font-size: 40px;
      font-weight: 400;
      text-align: center;
      line-height: 1.4;
    }

    .brand-footer {
      position: absolute;
      bottom: 70px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .brand-name {
      color: ${this.brand.colors.background};
      font-size: 40px;
      font-weight: 700;
    }

    .brand-handle {
      color: rgba(255, 255, 255, 0.85);
      font-size: 32px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="safe-zone">
    <div class="slide-number">${slide.slideNumber}/${totalSlides}</div>
    ${slide.title ? `<h2 class="cta-heading">${this.escapeHTML(slide.title)}</h2>` : ''}
    <p class="cta-body">${this.escapeHTML(slide.body)}</p>
  </div>
  <div class="brand-footer">
    <div class="brand-name">${this.escapeHTML(this.brand.name)}</div>
    <div class="brand-handle">${this.escapeHTML(this.brand.handle)}</div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Escape HTML to prevent injection
   */
  private escapeHTML(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
