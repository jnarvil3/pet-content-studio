/**
 * Lightweight i18n system for Pet Content Studio
 * Loads translations from /i18n/pt-br.json and provides t() helper
 */

const I18n = {
  translations: {},
  loaded: false,

  async init() {
    try {
      const res = await fetch('/i18n/pt-br.json');
      this.translations = await res.json();
      this.loaded = true;
      this.applyAll();
    } catch (e) {
      console.warn('[i18n] Could not load translations:', e);
    }
  },

  /**
   * Get translated string by key
   * Falls back to key itself if not found
   */
  t(key) {
    return this.translations[key] || key;
  },

  /**
   * Apply translations to all elements with data-i18n attribute
   */
  applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && this.translations[key]) {
        el.textContent = this.translations[key];
      }
    });
    // Also handle placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && this.translations[key]) {
        el.placeholder = this.translations[key];
      }
    });
  }
};

// Shorthand
function t(key) {
  return I18n.t(key);
}

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => I18n.init());
