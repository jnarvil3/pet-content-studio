/**
 * Pet Content Studio - Unified App JavaScript
 */

// State
let currentPage = 'dashboard';
let allContent = [];
let allSignals = [];
let currentFilter = 'all';

// Trending filter state
let videoPetFilter = 'pet';
let videoTimePeriod = 'today';
let hookPetFilter = 'pet';
let hookTimePeriod = 'today';

/**
 * Toast notification system (replaces alert())
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const colors = {
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', icon: '✅' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '❌' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: 'ℹ️' },
    warning: { bg: '#fefce8', border: '#eab308', text: '#854d0e', icon: '⚠️' },
    loading: { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6', icon: '⏳' }
  };
  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.style.cssText = `background:${c.bg}; border:2px solid ${c.border}; color:${c.text}; padding:0.875rem 1.25rem; border-radius:10px; font-size:0.9rem; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,0.15); animation:fadeIn 0.3s ease; max-width:380px; display:flex; align-items:center; gap:0.5rem;`;
  toast.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  if (type !== 'loading') {
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
  }
  return toast;
}

/**
 * Confirmation dialog (replaces confirm() / prompt())
 */
function showConfirm(message, { showInput = false, inputPlaceholder = '', okText = 'Confirmar', cancelText = 'Cancelar' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = message;
    const inputWrap = document.getElementById('confirm-input-wrap');
    const input = document.getElementById('confirm-input');
    inputWrap.style.display = showInput ? 'block' : 'none';
    if (showInput) { input.value = ''; input.placeholder = inputPlaceholder; }
    document.getElementById('confirm-ok').textContent = okText;
    document.getElementById('confirm-cancel').textContent = cancelText;
    modal.style.display = 'flex';

    const cleanup = (result) => { modal.style.display = 'none'; resolve(result); };
    document.getElementById('confirm-ok').onclick = () => cleanup(showInput ? input.value : true);
    document.getElementById('confirm-cancel').onclick = () => cleanup(false);
  });
}

// Hook formula display labels (PT-BR, descriptive)
const HOOK_LABELS = {
  curiosity_gap: '🤔 Fato curioso que prende atenção',
  contrarian: '🚫 Opinião contrária ao senso comum',
  emotional: '❤️ Conexão emocional com o pet',
  humor: '😂 Humor e entretenimento',
  shocking_fact: '😲 Dado surpreendente',
  tutorial: '📚 Tutorial passo a passo',
  question_hook: '❓ Pergunta que gera curiosidade',
  question: '❓ Pergunta que gera curiosidade',
  mistake_hook: '⚠️ Erro comum que donos cometem',
  personal: '🗣️ História pessoal com o pet',
  personal_story: '🗣️ História pessoal com o pet',
  number_outcome: '🔢 Lista com resultado específico',
  curiosity: '🤔 Fato curioso que prende atenção',
  transformation: '✨ Antes e depois / transformação',
  before_after: '✨ Antes e depois / transformação',
  challenge: '🏆 Desafio ou teste',
  listicle: '📋 Lista de dicas',
  story: '📖 Narrativa envolvente'
};

function hookLabel(formula) {
  return HOOK_LABELS[formula] || formula;
}

// Status labels (PT-BR)
const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  published: 'Publicado',
  revision_requested: 'Revisão Solicitada'
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupTabs();
  loadAllData();
});

/**
 * Navigation
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      navigateTo(page);
    });
  });
}

function navigateTo(pageName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === pageName) {
      item.classList.add('active');
    }
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(`${pageName}-page`).classList.add('active');

  currentPage = pageName;

  // Always refresh dashboard stats when navigating back
  if (pageName === 'dashboard') {
    loadDashboardStats();
    loadRecentActivity();
  }

  // Load page-specific data
  if (pageName === 'discover') {
    loadDiscoverData();
  } else if (pageName === 'create') {
    // Clear stale signal preview
    const detailsDiv = document.getElementById('signal-details');
    if (detailsDiv) detailsDiv.style.display = 'none';
    const viralPanel = document.getElementById('viral-context-panel');
    if (viralPanel) viralPanel.style.display = 'none';
    loadCreateData();
  } else if (pageName === 'review') {
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
    });
    loadReviewData();
  } else if (pageName === 'settings') {
    loadSettingsData();
  } else if (pageName === 'help') {
    loadHelpData();
  }
}

/**
 * Tabs
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');

      // Update tabs
      tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      const parent = tab.closest('.page');
      parent.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      parent.querySelector(`#${tabId}`).classList.add('active');
    });
  });
}

/**
 * Load all initial data
 */
async function loadAllData() {
  await Promise.all([
    loadDashboardStats(),
    loadBudget(),
    loadRecentActivity()
  ]);
}

/**
 * Dashboard
 */
async function loadDashboardStats() {
  try {
    // Load content stats
    const contentResponse = await fetch('/api/stats');
    const contentStats = await contentResponse.json();

    document.getElementById('stat-total').textContent = contentStats.total || 0;
    document.getElementById('stat-pending').textContent = (contentStats.pending || 0) + (contentStats.revision_requested || 0);
    document.getElementById('stat-approved').textContent = contentStats.approved || 0;
    document.getElementById('stat-published').textContent = contentStats.published || 0;

    // Load viral stats from viral insights endpoint
    try {
      const viralResponse = await fetch('/api/viral/insights?days=30');
      const viralData = await viralResponse.json();

      if (viralData.success && viralData.data?.stats) {
        document.getElementById('stat-videos').textContent = viralData.data.stats.total_analyzed || 0;
        document.getElementById('stat-engagement').textContent = (viralData.data.stats.avg_engagement || 0).toFixed(1) + '%';
      } else {
        document.getElementById('stat-videos').textContent = '0';
        document.getElementById('stat-engagement').textContent = '0%';
      }
    } catch (e) {
      document.getElementById('stat-videos').textContent = '0';
      document.getElementById('stat-engagement').textContent = '0%';
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

async function loadRecentActivity() {
  try {
    const response = await fetch('/api/content?limit=5');
    const content = await response.json();

    const activityDiv = document.getElementById('recent-activity');

    if (content.length === 0) {
      activityDiv.innerHTML = '<p style="color: #999;">Nenhuma atividade recente</p>';
      return;
    }

    activityDiv.innerHTML = content.slice(0, 5).map(item => `
      <div style="padding: 1rem; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''" onclick="navigateTo('review')">
        <div>
          <div style="font-weight: 600; margin-bottom: 0.25rem;">${item.signal?.title || 'Sem título'}</div>
          <div style="font-size: 0.875rem; color: #666;">${item.content_type === 'carousel' ? '📱 Carrossel' : item.content_type === 'reel' ? '🎥 Reel' : '💼 LinkedIn'} • ${statusLabel(item.status)}</div>
        </div>
        <div style="color: #999; font-size: 0.875rem;">${new Date(item.generated_at).toLocaleDateString('pt-BR')}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading recent activity:', error);
  }
}

/**
 * Discover Page
 */
async function loadDiscoverData() {
  await Promise.allSettled([
    loadSignalsList(),
    loadVideosList(),
    loadHooksList()
  ]);
}

async function loadSignalsList() {
  try {
    const response = await fetch('/api/signals?limit=20&minScore=70');
    const data = await response.json();
    allSignals = data.signals || [];

    const signalsList = document.getElementById('signals-list');

    if (allSignals.length === 0) {
      signalsList.innerHTML = '<p style="color: #999;">Nenhum sinal disponível. Execute o coletor de inteligência.</p>';
      return;
    }

    signalsList.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
        ${allSignals.map(signal => `
          <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #4a5abb;">${signal.relevance_score}</div>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">📄 ${signal.sourceType || 'RSS'}</div>
            </div>
            <div style="font-weight: 600; margin-bottom: 0.5rem; color: #333;">${signal.title}</div>
            <div style="font-size: 0.875rem; color: #666; line-height: 1.4; margin-bottom: 1rem;">${(signal.description || '').substring(0, 150)}...</div>
            <div style="margin-bottom: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; color: #999;">
              📰 ${signal.source} • ${new Date(signal.collected_at).toLocaleDateString('pt-BR')}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${signal.url ? `<a href="${signal.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex: 1; padding: 0.75rem; text-align: center; text-decoration: none;">🔗 Ler Artigo</a>` : ''}
              <button class="btn btn-primary" style="flex: 1; padding: 0.75rem;" onclick="createFromSignal(${signal.id})">✨ Criar a partir deste</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading signals:', error);
    const signalsList = document.getElementById('signals-list');
    if (signalsList) signalsList.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Erro ao carregar sinais. Verifique se o coletor de inteligência está configurado.</p>';
  }
}

let allVideos = [];
let videoFilters = { hook: 'all', emotion: 'all', status: 'analyzed' };

function setVideoFilter(filter) {
  videoPetFilter = filter;
  document.getElementById('video-filter-pet').classList.toggle('active', filter === 'pet');
  document.getElementById('video-filter-all').classList.toggle('active', filter === 'all');
  loadVideosList();
}

function setVideoTimePeriod(period) {
  videoTimePeriod = period;
  loadVideosList();
}

async function loadVideosList() {
  try {
    const videosList = document.getElementById('videos-list');
    videosList.innerHTML = '<div class="loading"><div class="spinner" style="border-color: rgba(0,0,0,0.1); border-top-color: #4a5abb;"></div><p style="color: #666;">Carregando vídeos...</p></div>';

    const response = await fetch(`/api/trending/videos?period=today&petOnly=${videoPetFilter === 'pet'}`);
    const data = await response.json();

    if (data.success && data.data) {
      allVideos = (data.data.videos || []).sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    }

    if (allVideos.length === 0) {
      videosList.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Nenhum vídeo encontrado. Execute a coleta de dados primeiro.</p>';
      return;
    }

    // Render video grid directly — sorted by engagement
    videosList.innerHTML = `
      <div style="margin-bottom: 1rem; color: #666; font-size: 0.875rem;">${allVideos.length} vídeos ordenados por engajamento</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
        ${allVideos.map((video, i) => {
          const isTikTok = (video.platform || '').toLowerCase() === 'tiktok';
          const videoUrl = video.url || (isTikTok ? '#' : `https://www.youtube.com/watch?v=${video.video_id}`);
          const thumbnailUrl = video.thumbnail_url || (isTikTok ? '' : `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`);
          const title = (video.title || '').substring(0, 80);
          const engagement = (video.engagement_rate || 0).toFixed(1);
          const views = (video.view_count || 0).toLocaleString('pt-BR');
          const hook = video.hook_formula ? hookLabel(video.hook_formula) : '';

          return `
          <div style="border: 2px solid ${i < 3 ? '#f5576c' : '#e0e0e0'}; border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; ${i < 3 ? 'box-shadow: 0 4px 12px rgba(245,87,108,0.2);' : ''}" onclick="window.open('${videoUrl}', '_blank')">
            <div style="aspect-ratio: 16/9; background: #000; position: relative; overflow: hidden;">
              ${thumbnailUrl
                ? `<img src="${thumbnailUrl}" alt="${(title || 'Vídeo').replace(/"/g, '')}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-size:3rem;">${isTikTok ? '🎵' : '▶️'}</div>`
              }
              <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:white;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:700;">#${i + 1}</div>
              <div style="position:absolute;top:8px;right:8px;background:${isTikTok ? '#00f2ea' : '#ff0000'};color:${isTikTok ? '#000' : '#fff'};padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:700;">${isTikTok ? 'TikTok' : 'YouTube'}</div>
              <div style="position:absolute;bottom:8px;left:8px;background:rgba(245,87,108,0.9);color:white;padding:4px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">${engagement}% engajamento</div>
            </div>
            <div style="padding: 1rem;">
              <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem; font-size: 0.9rem; line-height: 1.3;">${title}</div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
                ${hook ? `<span style="background:rgba(102,126,234,0.1);color:#4a5abb;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:600;">${hook}</span>` : ''}
                ${views !== '0' ? `<span style="color:#999;font-size:0.75rem;">${views} views</span>` : ''}
              </div>
              <button class="btn btn-primary" style="width:100%;padding:0.5rem;font-size:0.85rem;" onclick="event.stopPropagation(); createFromVideo(${video.id || 0}, '${(video.hook_formula || '').replace(/'/g, "\\'")}', '${(video.title || '').replace(/'/g, "\\'").substring(0, 60)}', '')">✨ Criar a partir deste</button>
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading videos:', error);
    document.getElementById('videos-list').innerHTML = '<p style="color: #999;">Não foi possível carregar vídeos virais.</p>';
  }
}

// Client-side pet classification (mirrors server-side)
function isPetRelatedClient(text) {
  const petKeywords = [
    // English
    'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper', 'fur baby', 'vet', 'breed',
    // Portuguese
    'cachorro', 'cachorra', 'gato', 'gata', 'filhote', 'cão', 'cadela', 'gatinho', 'gatinha', 'animal de estimação', 'animais', 'veterinário', 'veterinaria', 'raça', 'pets', 'canil', 'felino', 'canino', 'bichinho', 'peludo', 'patinha', 'banho e tosa', 'ração', 'petshop', 'pet shop', 'cãozinho', 'doguinho', 'miau', 'latido', 'pata', 'focinho'
  ];
  const lower = (text || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

async function loadTop10Lists() {
  try {
    const response = await fetch('/api/trending/hooks');
    const data = await response.json();

    if (data.success && data.data) {
      const top10Section = document.getElementById('top10-section');
      if (!top10Section) {
        const videosList = document.getElementById('videos-list');
        videosList.insertAdjacentHTML('afterbegin', '<div id="top10-section"></div>');
      }

      const section = document.getElementById('top10-section');
      const topHooks = (data.data.hooks || []).slice(0, 10);
      const topIdeas = (data.data.hooks || []).filter(h => h.examples?.length > 0).slice(0, 10);

      section.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 2px solid #e0e0e0;">
            <h3 style="color: #4a5abb; margin-bottom: 1rem; font-size: 1.25rem;">🔥 Top 10 Estratégias de Gancho</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${topHooks.map((hook, i) => `
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px; background: ${i === 0 ? 'rgba(245,87,108,0.1)' : '#f9fafb'};">
                  <div style="font-size: 1.25rem; font-weight: 700; color: ${i === 0 ? '#f5576c' : '#999'}; min-width: 30px;">#${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">${hookLabel(hook.hook_formula)}</div>
                    <div style="font-size: 0.875rem; color: #666;">${(hook.avg_engagement_rate || 0).toFixed(1)}% engajamento médio • ${hook.count || 0} ${(hook.count || 0) === 1 ? 'vídeo' : 'vídeos'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 2px solid #e0e0e0;">
            <h3 style="color: #4a5abb; margin-bottom: 1rem; font-size: 1.25rem;">💡 Exemplos de Conteúdo Viral</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${topIdeas.map((idea, i) => `
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px; background: ${i === 0 ? 'rgba(102,126,234,0.1)' : '#f9fafb'};">
                  <div style="font-size: 1.25rem; font-weight: 700; color: ${i === 0 ? '#4a5abb' : '#999'}; min-width: 30px;">#${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">${idea.examples?.[0]?.title || hookLabel(idea.hook_formula)}</div>
                    <div style="font-size: 0.875rem; color: #666;">${(idea.avg_engagement_rate || 0).toFixed(1)}% engajamento • ${idea.count || 0} ${(idea.count || 0) === 1 ? 'vídeo' : 'vídeos'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading Top 10 lists:', error);
  }
}

function renderVideoFilters() {
  const videosList = document.getElementById('videos-list');

  // Get unique values for filters
  const hookFormulas = ['all', ...new Set(allVideos.map(v => v.hook_formula).filter(h => h))];
  const emotions = ['all', ...new Set(allVideos.map(v => v.emotional_trigger).filter(e => e))];

  const filtersSection = document.getElementById('video-filters');
  if (!filtersSection) {
    videosList.insertAdjacentHTML('beforeend', '<div id="video-filters"></div>');
  }

  const section = document.getElementById('video-filters');
  section.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; border: 2px solid #e0e0e0;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Hook Formula</label>
          <select id="filter-hook" style="width: 100%; padding: 0.5rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.875rem;">
            ${hookFormulas.map(h => `<option value="${h}" ${videoFilters.hook === h ? 'selected' : ''}>${h === 'all' ? 'All Hooks' : h}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Emotional Trigger</label>
          <select id="filter-emotion" style="width: 100%; padding: 0.5rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.875rem;">
            ${emotions.map(e => `<option value="${e}" ${videoFilters.emotion === e ? 'selected' : ''}>${e === 'all' ? 'All Emotions' : e}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Min Engagement</label>
          <input type="number" id="filter-engagement" value="0" min="0" max="100" step="0.1" style="width: 100%; padding: 0.5rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.875rem;" placeholder="0%">
        </div>
      </div>
    </div>
    <div id="video-grid"></div>
  `;

  // Add event listeners
  document.getElementById('filter-hook').addEventListener('change', (e) => {
    videoFilters.hook = e.target.value;
    renderVideoGrid();
  });
  document.getElementById('filter-emotion').addEventListener('change', (e) => {
    videoFilters.emotion = e.target.value;
    renderVideoGrid();
  });
  document.getElementById('filter-engagement').addEventListener('input', (e) => {
    videoFilters.minEngagement = parseFloat(e.target.value) || 0;
    renderVideoGrid();
  });
}

function renderVideoGrid() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  // Apply filters
  let filtered = allVideos.filter(video => {
    if (videoFilters.hook !== 'all' && video.hook_formula !== videoFilters.hook) return false;
    if (videoFilters.emotion !== 'all' && video.emotional_trigger !== videoFilters.emotion) return false;
    if (videoFilters.minEngagement && video.engagement_rate < videoFilters.minEngagement) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #999; padding: 3rem;">No videos match your filters</p>';
    return;
  }

  grid.innerHTML = `
    <div style="margin-bottom: 1rem; color: #666;">Mostrando ${filtered.length} de ${allVideos.length} vídeos</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
      ${filtered.map(video => {
        const platform = video.platform || 'youtube';
        const isTikTok = platform === 'tiktok';
        const videoUrl = isTikTok
          ? video.url || `https://www.tiktok.com/@user/video/${video.video_id}`
          : `https://www.youtube.com/watch?v=${video.video_id}`;
        const thumbnailUrl = isTikTok
          ? (video.thumbnail_url || video.thumbnails?.cover_url || '')
          : `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
        const thumbnailFallback = isTikTok
          ? `onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#00f2ea,#ff0050);color:white;font-size:3rem;\\'>🎵</div>'+ this.parentElement.innerHTML"`
          : `onerror="this.src='https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg'"`;
        const platformBadge = isTikTok
          ? '<span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">🎵 TikTok</span>'
          : '<span style="position: absolute; top: 8px; left: 8px; background: rgba(255,0,0,0.85); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">▶ YouTube</span>';
        const safeTitle = (video.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeAngle = (video.content_angle || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `
        <div style="border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.borderColor='${isTikTok ? '#00f2ea' : '#f5576c'}'" onmouseout="this.style.borderColor='#e0e0e0'" onclick="window.open('${videoUrl}', '_blank')">
          <div style="aspect-ratio: ${isTikTok ? '9/16' : '16/9'}; max-height: 250px; background: #000; position: relative; overflow: hidden;">
            ${thumbnailUrl
              ? `<img src="${thumbnailUrl}" alt="${(video.title || 'Vídeo').replace(/"/g, '').substring(0, 80)}" style="width: 100%; height: 100%; object-fit: cover;" ${thumbnailFallback}>`
              : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #00f2ea, #ff0050); color: white; font-size: 3rem;">🎵</div>`
            }
            ${platformBadge}
            <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
              ${formatDuration(video.duration_seconds || video.duration)}
            </div>
          </div>
          <div style="padding: 1rem;">
            <div style="font-weight: 600; margin-bottom: 0.5rem; line-height: 1.3; color: #333;">${video.title}</div>
            ${video.channel_name ? `<div style="font-size: 0.8rem; color: #999; margin-bottom: 0.5rem;">${video.channel_name}</div>` : ''}
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
              <span style="background: rgba(245,87,108,0.1); color: #f5576c; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${(video.engagement_rate || 0).toFixed(1)}% engagement</span>
              ${video.hook_formula ? `<span style="background: rgba(102,126,234,0.1); color: #4a5abb; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${hookLabel(video.hook_formula)}</span>` : ''}
              ${video.emotional_trigger ? `<span style="background: rgba(251,146,60,0.1); color: #fb923c; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${video.emotional_trigger}</span>` : ''}
            </div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">${(video.view_count || 0).toLocaleString()} views</div>
            <button class="btn btn-primary" style="width: 100%; padding: 0.5rem;" onclick="event.stopPropagation(); createFromVideo(${video.id}, '${video.hook_formula || ''}', '${safeTitle}', '${safeAngle}')">✨ Criar a partir deste</button>
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

/**
 * Create Page
 */
// AI Model selection state
let selectedAIModel = 'claude-sonnet-4'; // default to premium

async function loadCreateData() {
  // Setup AI model toggle
  const fastBtn = document.getElementById('model-fast-btn');
  const premiumBtn = document.getElementById('model-premium-btn');
  const modelDesc = document.getElementById('model-description');

  function updateModelSelection(model) {
    selectedAIModel = model;
    if (model === 'gpt-4o-mini') {
      fastBtn.className = 'btn btn-primary';
      fastBtn.style = 'flex: 1; padding: 0.5rem; font-size: 0.875rem;';
      premiumBtn.className = 'btn';
      premiumBtn.style = 'flex: 1; padding: 0.5rem; background: white; color: #666; border: 2px solid #e0e0e0; font-size: 0.875rem;';
      modelDesc.textContent = 'Rápido: GPT-4o-mini para iterações rápidas';
    } else {
      fastBtn.className = 'btn';
      fastBtn.style = 'flex: 1; padding: 0.5rem; background: white; color: #666; border: 2px solid #e0e0e0; font-size: 0.875rem;';
      premiumBtn.className = 'btn btn-primary';
      premiumBtn.style = 'flex: 1; padding: 0.5rem; font-size: 0.875rem;';
      modelDesc.textContent = 'Premium: Claude Sonnet 4 para scripts de qualidade viral';
    }
  }

  fastBtn.addEventListener('click', () => updateModelSelection('gpt-4o-mini'));
  premiumBtn.addEventListener('click', () => updateModelSelection('claude-sonnet-4'));

  // Load signals into dropdown
  try {
    const response = await fetch('/api/signals?limit=20&minScore=70');
    const data = await response.json();
    const signals = data.signals || [];

    const select = document.getElementById('create-signal-select');
    select.innerHTML = '<option value="">-- Selecione um tópico --</option>' +
      signals.map(signal => `
        <option value="${signal.id}">${signal.title} (Score: ${signal.relevance_score})</option>
      `).join('');

    select.addEventListener('change', () => {
      const carouselBtn = document.getElementById('create-carousel-btn');
      const reelBtn = document.getElementById('create-reel-btn');
      const linkedinBtn = document.getElementById('create-linkedin-btn');
      const signalId = parseInt(select.value);

      if (signalId) {
        carouselBtn.disabled = false;
        reelBtn.disabled = false;
        linkedinBtn.disabled = false;

        // Show signal details
        const signal = signals.find(s => s.id === signalId);
        const detailsDiv = document.getElementById('signal-details');
        if (signal && detailsDiv) {
          detailsDiv.style.display = 'block';
          detailsDiv.innerHTML = `
            <div style="background: #f9fafb; border-radius: 12px; padding: 1.5rem; border: 2px solid #e0e0e0;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                <h3 style="color: #333; font-size: 1.125rem; margin: 0;">${signal.title}</h3>
                <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; font-weight: 600;">${signal.relevance_score} score</span>
              </div>
              <p style="color: #666; font-size: 0.875rem; line-height: 1.5; margin: 0;">${signal.description}</p>
              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; color: #999;">
                📰 ${signal.source}
              </div>
            </div>
          `;
        }

        loadViralContext();
      } else {
        carouselBtn.disabled = true;
        reelBtn.disabled = true;
        linkedinBtn.disabled = true;
        document.getElementById('viral-context-panel').style.display = 'none';
        const detailsDiv = document.getElementById('signal-details');
        if (detailsDiv) detailsDiv.style.display = 'none';
      }
    });

    // Setup generation buttons
    const contentTypeBtns = [
      document.getElementById('create-carousel-btn'),
      document.getElementById('create-reel-btn'),
      document.getElementById('create-linkedin-btn')
    ];

    contentTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active state from all buttons
        contentTypeBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = '';
          b.style.color = '';
          b.style.borderColor = '';
        });
        // Add active state to clicked button
        btn.classList.add('active');
        btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        btn.style.color = 'white';
        btn.style.borderColor = '#667eea';

        const typeMap = {
          'create-carousel-btn': 'carousel',
          'create-reel-btn': 'reel',
          'create-linkedin-btn': 'linkedin'
        };
        generateContent(typeMap[btn.id]);
      });
    });

  } catch (error) {
    console.error('Error loading create data:', error);
  }
}

async function loadViralContext() {
  try {
    const response = await fetch('/api/viral/insights');
    const data = await response.json();

    if (data.success && data.data) {
      const panel = document.getElementById('viral-context-panel');
      const content = document.getElementById('viral-context-content');

      const hooks = data.data.topHooks || [];
      const themes = (data.data.trendingThemes || []).slice(0, 5);
      const stats = data.data.stats || {};
      const topHook = hooks[0];

      if (!topHook) {
        panel.style.display = 'none';
        return;
      }

      content.innerHTML = `
        <div style="margin-bottom: 1rem;">
          <strong>Melhor gancho:</strong> ${hookLabel(topHook.hook_formula)} (${(topHook.avg_engagement_rate || 0).toFixed(1)}% engajamento)
        </div>
        ${themes.length > 0 ? `<div style="margin-bottom: 1rem;">
          <strong>Temas em alta:</strong> ${[...new Set(themes.flatMap(t => { try { const parsed = JSON.parse(t.content_themes); return Array.isArray(parsed) ? parsed : [t.content_themes]; } catch { return [t.content_themes || '']; } }).filter(Boolean))].slice(0, 8).join(', ') || 'N/A'}
        </div>` : ''}
        <div style="font-size: 0.875rem; color: #666;">
          Baseado na análise de ${stats.total_analyzed || 0} vídeos virais de pet
        </div>
      `;

      panel.style.display = 'block';
    }
  } catch (error) {
    console.error('Could not load viral context:', error);
  }
}

let isGenerating = false;

async function generateContent(type) {
  if (isGenerating) {
    showToast('Geração já em andamento...', 'warning');
    return;
  }

  const signalId = document.getElementById('create-signal-select').value;
  if (!signalId) {
    showToast('Selecione um sinal primeiro', 'warning');
    return;
  }

  isGenerating = true;

  // Get buttons and disable them immediately
  const carouselBtn = document.getElementById('create-carousel-btn');
  const reelBtn = document.getElementById('create-reel-btn');
  const linkedinBtn = document.getElementById('create-linkedin-btn');

  // Confirmation before generation
  const contentTypeLabels = { carousel: '📱 Carrossel', reel: '🎥 Reel', linkedin: '💼 LinkedIn' };
  const contentType = contentTypeLabels[type] || type;
  const aiQuality = selectedAIModel === 'claude-sonnet-4' ? 'Premium (~$0.20)' : 'Rápido (~$0.01)';

  const confirmed = await showConfirm(`Gerar ${contentType}?\n\nQualidade: ${aiQuality}\nIsso vai consumir créditos da API.`, { okText: 'Gerar', cancelText: 'Cancelar' });
  if (!confirmed) return;

  [carouselBtn, reelBtn, linkedinBtn].forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });

  const statusDiv = document.getElementById('generation-status');
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = `
    <div style="text-align: center; padding: 1.5rem; background: rgba(102,126,234,0.1); border-radius: 12px; border: 2px solid #667eea;">
      <p style="color: #4a5abb; font-weight: 600; margin-bottom: 0.5rem;">Gerando ${contentType}...</p>
      <p style="color: #666; font-size: 0.875rem;">Qualidade IA: ${aiQuality}</p>
    </div>
  `;

  try {
    const endpoints = { carousel: '/api/generate', reel: '/api/generate-reel', linkedin: '/api/generate-linkedin' };
    const endpoint = endpoints[type] || '/api/generate';

    // Build request body
    const requestBody = {
      signalId: parseInt(signalId),
      limit: 1,
      minScore: 0,
      aiModel: selectedAIModel // Pass selected AI model
    };

    // Add viral pattern if selected
    if (selectedViralPattern) {
      requestBody.viralHook = selectedViralPattern.hookFormula;
      requestBody.viralVideoId = selectedViralPattern.videoId;
      requestBody.viralTitle = selectedViralPattern.viralTitle;
      requestBody.viralContentAngle = selectedViralPattern.contentAngle;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Generation failed');
    }

    // For reels, show progress
    if (type === 'reel') {
      await pollProgress(signalId, statusDiv, carouselBtn, reelBtn);
    } else {
      // Re-enable buttons for carousels (they complete quickly)
      setTimeout(() => {
        carouselBtn.disabled = false;
        reelBtn.disabled = false;
        carouselBtn.style.opacity = '1';
        carouselBtn.style.cursor = 'pointer';
        reelBtn.style.opacity = '1';
        reelBtn.style.cursor = 'pointer';
      }, 2000);
      // Carousels are fast
      statusDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: rgba(34,197,94,0.1); border-radius: 12px; color: #22c55e;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
          <p style="font-weight: 600; margin-bottom: 1rem;">Geração iniciada!</p>
          <p style="color: #666;">Confira na fila de revisão em breve.</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadDashboardStats(); navigateTo('review')">Ir para Revisão</button>
        </div>
      `;
    }
  } catch (error) {
    // Re-enable buttons on error
    carouselBtn.disabled = false;
    reelBtn.disabled = false;
    linkedinBtn.disabled = false;
    carouselBtn.style.opacity = '1';
    carouselBtn.style.cursor = 'pointer';
    reelBtn.style.opacity = '1';
    reelBtn.style.cursor = 'pointer';
    linkedinBtn.style.opacity = '1';
    linkedinBtn.style.cursor = 'pointer';
    isGenerating = false;

    statusDiv.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(239,68,68,0.1); border-radius: 12px; color: #ef4444;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">❌</div>
        <p style="font-weight: 600;">Generation failed</p>
        <p style="color: #666; margin-top: 0.5rem;">${error.message}</p>
        <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="document.getElementById('generation-status').style.display='none'">Tentar Novamente</button>
      </div>
    `;
  }
}

async function pollProgress(signalId, statusDiv, carouselBtn, reelBtn) {
  let lastStep = 0;
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/progress/${signalId}`);
      const progress = await response.json();

      if (!progress.inProgress) {
        // Generation complete - re-enable buttons
        clearInterval(pollInterval);

        // Re-enable buttons
        carouselBtn.disabled = false;
        reelBtn.disabled = false;
        carouselBtn.style.opacity = '1';
        carouselBtn.style.cursor = 'pointer';
        reelBtn.style.opacity = '1';
        reelBtn.style.cursor = 'pointer';

        statusDiv.innerHTML = `
          <div style="text-align: center; padding: 2rem; background: rgba(34,197,94,0.1); border-radius: 12px; color: #22c55e;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
            <p style="font-weight: 600; margin-bottom: 1rem;">Reel complete!</p>
            <button class="btn btn-primary" onclick="viewCompletedReel()">View in Review Queue</button>
          </div>
        `;
        return;
      }

      // Show progress
      const percent = Math.round((progress.step / progress.totalSteps) * 100);
      statusDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: rgba(102,126,234,0.1); border-radius: 12px;">
          <div style="margin-bottom: 1rem;">
            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden;">
              <div style="width: ${percent}%; height: 100%; background: #667eea; transition: width 0.3s ease;"></div>
            </div>
          </div>
          <p style="color: #4a5abb; font-weight: 600; margin-bottom: 0.5rem;">${progress.message}</p>
          <p style="color: #666; font-size: 0.875rem;">Step ${progress.step}/${progress.totalSteps} • ${progress.estimatedTimeRemaining || 0}s remaining</p>
        </div>
      `;
    } catch (error) {
      console.error('Progress poll error:', error);
    }
  }, 1000);

  // Timeout after 2 minutes
  setTimeout(() => {
    clearInterval(pollInterval);

    // Re-enable buttons on timeout
    carouselBtn.disabled = false;
    reelBtn.disabled = false;
    linkedinBtn.disabled = false;
    carouselBtn.style.opacity = '1';
    carouselBtn.style.cursor = 'pointer';
    reelBtn.style.opacity = '1';
    reelBtn.style.cursor = 'pointer';
    linkedinBtn.style.opacity = '1';
    linkedinBtn.style.cursor = 'pointer';
    isGenerating = false;

    // Show timeout message
    statusDiv.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(251,191,36,0.1); border-radius: 12px; color: #f59e0b;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">⏱️</div>
        <p style="font-weight: 600; margin-bottom: 0.5rem;">Generation taking longer than expected</p>
        <p style="color: #666; font-size: 0.875rem;">The reel is still being generated. Confira na fila de revisão em alguns instantes.</p>
        <button class="btn btn-primary" style="margin-top: 1rem;" onclick="navigateTo('review')">Ir para Revisão</button>
      </div>
    `;
  }, 120000);
}

function createFromSignal(signalId) {
  navigateTo('create');
  setTimeout(() => {
    document.getElementById('create-signal-select').value = signalId;
    document.getElementById('create-signal-select').dispatchEvent(new Event('change'));
  }, 100);
}

function viewCompletedReel() {
  navigateTo('review');
  // Force reload review content after navigation
  setTimeout(() => {
    loadReviewData();
  }, 200);
}

/**
 * Review Page
 */
async function loadReviewData() {
  try {
    const response = await fetch('/api/content');
    allContent = await response.json();

    // Update filter button counts
    const counts = { all: allContent.length };
    allContent.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const filter = btn.getAttribute('data-filter');
      const count = counts[filter] || 0;
      const label = btn.textContent.replace(/\s*\(\d+\)/, '');
      btn.textContent = `${label} (${count})`;
    });

    displayReviewContent(currentFilter);

    // Setup filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        displayReviewContent(currentFilter);
      });
    });
  } catch (error) {
    console.error('Error loading review data:', error);
  }
}

async function displayReviewContent(filter) {
  const grid = document.getElementById('review-content-grid');

  let filtered = allContent;
  if (filter !== 'all') {
    filtered = allContent.filter(item => item.status === filter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #999; padding: 3rem;">Nenhum conteúdo encontrado</p>';
    return;
  }

  // Load feedback for all visible items in batches of 3 to avoid overwhelming server
  const feedbackMap = {};
  const batchSize = 3;
  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    await Promise.all(batch.map(async item => {
      try {
        const res = await fetch(`/api/content/${item.id}/feedback`);
        if (res.ok) {
          feedbackMap[item.id] = await res.json();
        } else {
          feedbackMap[item.id] = [];
        }
      } catch (e) { feedbackMap[item.id] = []; }
    }));
  }

  const contentTypeLabel = (t) => t === 'carousel' ? '📱 Carrossel' : t === 'reel' ? '🎥 Reel' : '💼 LinkedIn';

  const statusColors = {
    pending: { bg: 'rgba(251,146,60,0.1)', fg: '#fb923c', border: '#fb923c' },
    revision_requested: { bg: 'rgba(234,179,8,0.15)', fg: '#ca8a04', border: '#eab308' },
    approved: { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e', border: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444', border: '#ef4444' },
    published: { bg: 'rgba(139,92,246,0.1)', fg: '#8b5cf6', border: '#8b5cf6' }
  };

  grid.innerHTML = `
    <div style="display: grid; gap: 1.5rem;">
      ${filtered.map(item => {
        const feedback = feedbackMap[item.id] || [];
        const pendingFb = feedback.filter(f => f.status === 'pending');
        const addressedFb = feedback.filter(f => f.status === 'addressed');
        const sc = statusColors[item.status] || statusColors.pending;

        return `
        <div style="border: 2px solid ${sc.border}; border-radius: 12px; padding: 1.5rem; background: white;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">${item.signal?.title || 'Sem titulo'}</div>
              <div style="display: flex; gap: 0.75rem; align-items: center; font-size: 0.8rem; color: #999; margin-top: 0.25rem; flex-wrap: wrap;">
                <span>${contentTypeLabel(item.content_type)}</span>
                <span>•</span>
                <span>Criado em ${new Date(item.generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span style="background: ${item.version > 1 ? '#ede9fe' : '#f3f4f6'}; color: ${item.version > 1 ? '#7c3aed' : '#6b7280'}; padding: 1px 8px; border-radius: 10px; font-weight: 600;">v${item.version || 1}</span>
                ${feedback.length > 0 ? `<span style="color: #4a5abb;">📝 ${feedback.length} feedback${feedback.length > 1 ? 's' : ''}</span>` : ''}
              </div>
            </div>
            <div style="padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.8rem; white-space: nowrap; background: ${sc.bg}; color: ${sc.fg};">
              ${statusLabel(item.status)}
            </div>
          </div>

          ${item.status === 'revision_requested' ? `
          <!-- Revision requested banner -->
          <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
            <div style="font-weight: 600; color: #a16207; margin-bottom: 0.5rem;">⏳ Alterações solicitadas</div>
            ${pendingFb.length > 0 ? pendingFb.map(f => `
              <div style="background: white; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; border-left: 3px solid #eab308;">
                <div style="color: #333; font-size: 0.875rem;">${f.feedback_text}</div>
                <div style="color: #a3a3a3; font-size: 0.7rem; margin-top: 0.25rem;">${new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            `).join('') : '<div style="font-size: 0.875rem; color: #92400e;">Aguardando regeneração...</div>'}
            <div style="font-size: 0.8rem; color: #a16207; margin-top: 0.5rem;">Clique em <strong>Regenerar com Alterações</strong> para criar uma nova versão.</div>
          </div>
          ` : ''}

          ${item.status === 'rejected' && item.rejection_reason && item.rejection_reason !== 'Sem motivo informado' ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
            <div style="font-size: 0.8rem; font-weight: 600; color: #dc2626; margin-bottom: 0.25rem;">Motivo da rejeição:</div>
            <div style="font-size: 0.875rem; color: #7f1d1d;">${item.rejection_reason}</div>
          </div>
          ` : ''}

          <!-- Content preview -->
          ${item.content_type === 'carousel' && item.carousel_images ? `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
              ${(Array.isArray(item.carousel_images) ? item.carousel_images : JSON.parse(item.carousel_images)).slice(0, 5).map((img, idx) => {
                let imgUrl = img;
                if (img.includes('/output/')) imgUrl = '/output/' + img.split('/output/').pop();
                else if (img.startsWith('./output')) imgUrl = img.replace('./output', '/output');
                else if (img.startsWith('output/')) imgUrl = '/' + img;
                return `
                <div style="position: relative; flex-shrink: 0;">
                  <img src="${imgUrl}" alt="Slide ${idx+1} do carrossel" style="height: 140px; border-radius: 8px; border: 2px solid #e0e0e0;">
                  <div style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">${idx+1}/5</div>
                  <a href="${imgUrl}" download style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; font-size: 0.7rem; padding: 3px 6px; border-radius: 4px; text-decoration: none; cursor: pointer;" title="Baixar slide ${idx+1}">⬇</a>
                </div>
              `}).join('')}
            </div>
            <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin-bottom: 1rem;" onclick="downloadAllSlides(${item.id})">⬇️ Baixar todos os slides</button>
          ` : ''}

          ${item.content_type === 'reel' && item.reel_video_path ? (() => {
            const videoSrc = item.reel_video_path.replace('./output', '/output').replace('output/', '/output/');
            const posterSrc = videoSrc.replace(/\/[^/]+$/, '/thumbnail.jpg');
            return `
            <div style="margin-bottom: 1rem;">
              <video controls poster="${posterSrc}" preload="metadata" style="width: 100%; max-width: 300px; border-radius: 8px; background: #000;">
                <source src="${videoSrc}" type="video/mp4">
              </video>
              <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.75rem;">
                ${item.reel_script ? `<span style="font-size: 0.8rem; color: #666;">
                  Duração: ~${item.reel_script.totalDurationTarget}s • ${item.reel_script.scenes?.length || 0} cenas
                </span>` : ''}
                <a href="${videoSrc}" download class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; text-decoration: none;">⬇️ Baixar vídeo</a>
              </div>
            </div>`;
          })() : ''}

          ${item.carousel_content ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.8rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Legenda</div>
              <div style="font-size: 0.875rem; color: #666; line-height: 1.5;">${item.carousel_content.caption}</div>
              <div style="font-size: 0.8rem; color: #4a5abb; margin-top: 0.5rem;">${item.carousel_content.hashtags.map(h => h.startsWith('#') ? h : '#'+h).join(' ')}</div>
            </div>
          ` : ''}

          ${item.reel_script ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.8rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">Legenda</div>
              <div style="font-size: 0.875rem; color: #666; line-height: 1.5;">${item.reel_script.caption}</div>
              <div style="font-size: 0.8rem; color: #4a5abb; margin-top: 0.5rem;">${item.reel_script.hashtags.map(h => h.startsWith('#') ? h : '#'+h).join(' ')}</div>
            </div>
          ` : ''}

          ${item.linkedin_content ? `
            <div style="background: #f0f4ff; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #0077b5;">
              <div style="font-weight: 700; color: #0077b5; margin-bottom: 0.5rem;">${item.linkedin_content.headline}</div>
              <div id="linkedin-body-${item.id}" style="font-size: 0.875rem; color: #333; white-space: pre-line; line-height: 1.6; margin-bottom: 0.75rem;">${((item.linkedin_content.body || '').substring(0, 300).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}${item.linkedin_content.body?.length > 300 ? '...' : ''}</div>
              ${item.linkedin_content.body?.length > 300 ? `<button style="background:none; border:none; color:#0077b5; cursor:pointer; font-size:0.85rem; font-weight:600; padding:0; margin-bottom:0.75rem;" onclick="toggleLinkedInBody(${item.id}, this)">Ver mais ▾</button>` : ''}
              <div style="font-size: 0.8rem; color: #0077b5;">${(item.linkedin_content.hashtags || []).map(h => '#' + h).join(' ')}</div>
              ${item.linkedin_content.ctaText ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666; font-style: italic;">${item.linkedin_content.ctaText}</div>` : ''}
              <button class="btn btn-secondary" style="margin-top: 0.75rem; font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="copyLinkedIn(${item.id})">📋 Copiar Texto</button>
            </div>
          ` : ''}

          ${addressedFb.length > 0 ? `
          <details style="margin-bottom: 0.75rem;">
            <summary style="font-size: 0.8rem; color: #16a34a; cursor: pointer; padding: 0.25rem 0;">
              ✅ ${addressedFb.length} alteraç${addressedFb.length > 1 ? 'ões atendidas' : 'ão atendida'}
            </summary>
            <div style="padding-top: 0.5rem;">
              ${addressedFb.map(f => `
                <div style="background: #f0fdf4; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; font-size: 0.8rem; border-left: 3px solid #22c55e;">
                  <span style="color: #333;">${f.feedback_text}</span>
                  <span style="color: #22c55e; margin-left: 0.25rem;">✓</span>
                </div>
              `).join('')}
            </div>
          </details>
          ` : ''}

          <!-- Actions -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding-top: 0.75rem; border-top: 1px solid #f0f0f0;">
            ${item.status === 'pending' ? `
              <button class="btn btn-primary" onclick="approveContent(${item.id})">✅ Aprovar</button>
              <button class="btn btn-secondary" onclick="openFeedbackModal(${item.id})">✏️ Solicitar Alterações</button>
              <button class="btn btn-secondary" style="color: #ef4444; border-color: #fecaca;" onclick="rejectContent(${item.id})">❌ Rejeitar</button>
            ` : ''}
            ${item.status === 'revision_requested' ? `
              <button class="btn btn-primary" style="background: linear-gradient(135deg, #eab308, #ca8a04);" onclick="regenerateContent(${item.id})">🔄 Regenerar com Alterações</button>
              <button class="btn btn-primary" onclick="approveContent(${item.id})">✅ Aprovar Assim Mesmo</button>
              <button class="btn btn-secondary" onclick="openFeedbackModal(${item.id})">✏️ Mais Feedback</button>
            ` : ''}
            ${item.status === 'approved' ? `
              <button class="btn btn-primary" onclick="publishContent(${item.id})">🚀 Publicar</button>
              <button class="btn btn-secondary" onclick="openFeedbackModal(${item.id})">✏️ Solicitar Alterações</button>
            ` : ''}
            ${item.status === 'published' ? `
              <span style="font-size: 0.8rem; color: #8b5cf6; font-weight: 500;">Publicado em ${item.published_at ? new Date(item.published_at).toLocaleDateString('pt-BR') : '-'}</span>
            ` : ''}
            ${item.status === 'rejected' ? `
              <button class="btn btn-secondary" onclick="openFeedbackModal(${item.id})">✏️ Solicitar Nova Versão</button>
            ` : ''}
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

async function downloadAllSlides(contentId) {
  const item = allContent.find(c => c.id === contentId);
  if (!item?.carousel_images) return;
  const images = Array.isArray(item.carousel_images) ? item.carousel_images : JSON.parse(item.carousel_images);
  for (let i = 0; i < images.length; i++) {
    let url = images[i];
    if (url.includes('/output/')) url = '/output/' + url.split('/output/').pop();
    else if (url.startsWith('./output')) url = url.replace('./output', '/output');
    else if (url.startsWith('output/')) url = '/' + url;
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Small delay between downloads so browser doesn't block them
    await new Promise(r => setTimeout(r, 300));
  }
  showToast(`${images.length} slides baixados`, 'success');
}

function toggleLinkedInBody(id, btn) {
  const el = document.getElementById(`linkedin-body-${id}`);
  const item = allContent.find(c => c.id === id);
  if (!el || !item?.linkedin_content?.body) return;

  const isExpanded = btn.textContent.includes('menos');
  if (isExpanded) {
    el.innerHTML = (item.linkedin_content.body.substring(0, 300).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')) + '...';
    btn.textContent = 'Ver mais ▾';
  } else {
    el.innerHTML = item.linkedin_content.body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    btn.textContent = 'Ver menos ▴';
  }
}

function copyLinkedIn(id) {
  const item = allContent.find(c => c.id === id);
  if (!item?.linkedin_content) return;
  const text = item.linkedin_content.headline + '\n\n' + item.linkedin_content.body + '\n\n' + (item.linkedin_content.hashtags || []).map(h => '#' + h).join(' ');
  navigator.clipboard.writeText(text);
}

async function approveContent(id) {
  try {
    await fetch(`/api/content/${id}/approve`, { method: 'POST' });
    showToast('Conteúdo aprovado!', 'success');
    await loadReviewData();
  } catch (error) {
    showToast('Erro ao aprovar conteúdo', 'error');
  }
}

async function rejectContent(id) {
  const reason = await showConfirm('Motivo da rejeição (obrigatório):', { showInput: true, inputPlaceholder: 'Descreva por que está rejeitando...', okText: 'Rejeitar', cancelText: 'Cancelar' });
  if (reason === false) return;
  if (!reason || (typeof reason === 'string' && !reason.trim())) {
    setTimeout(() => showToast('Informe o motivo da rejeição', 'error', 5000), 150);
    return;
  }
  try {
    await fetch(`/api/content/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() })
    });
    showToast('Conteúdo rejeitado', 'info');
    await loadReviewData();
  } catch (error) {
    showToast('Erro ao rejeitar conteúdo', 'error');
  }
}

async function publishContent(id) {
  try {
    await fetch(`/api/content/${id}/publish`, { method: 'POST' });
    showToast('Conteúdo marcado como publicado!', 'success');
    await loadReviewData();
    await loadDashboardStats();
  } catch (error) {
    showToast('Erro ao publicar conteúdo', 'error');
  }
}

/**
 * Settings Page
 */
async function loadSettingsData() {
  // Load brand config and profile
  loadBrandConfig();
  loadBrandProfile();

  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    const budgetDiv = document.getElementById('settings-budget');

    if (data.success && data.data?.costs) {
      const costs = data.data.costs;
      budgetDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Orçamento Mensal</div>
            <div style="font-size: 2rem; font-weight: 700; color: #4a5abb;">$${costs.budget}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Gasto este Mês</div>
            <div style="font-size: 2rem; font-weight: 700; color: #f5576c;">$${costs.thisMonth.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Restante</div>
            <div style="font-size: 2rem; font-weight: 700; color: #22c55e;">$${costs.remaining.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Orçamento Usado</div>
            <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${costs.percentUsed.toFixed(1)}%</div>
          </div>
        </div>
      `;
    } else {
      // Simple stats display
      budgetDiv.innerHTML = `<p style="color: #666;">Dados de orçamento não disponíveis</p>`;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function runCollectionPipeline() {
  const ok = await showConfirm('Isso vai coletar e analisar novos vídeos virais. Pode custar $0.03-$0.05 por vídeo. Continuar?', { okText: 'Iniciar', cancelText: 'Cancelar' });
  if (!ok) {
    return;
  }

  const btn = document.getElementById('settings-collection-btn');
  const statusSpan = document.getElementById('settings-collection-status');

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Iniciando...';
    btn.style.opacity = '0.6';
  }

  try {
    const response = await fetch('/api/collection/trigger', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showToast('Coleta iniciada com sucesso! Os dados serão atualizados em breve.', 'success');
      if (statusSpan) {
        statusSpan.style.display = 'inline';
        statusSpan.style.color = '#27ae60';
        statusSpan.textContent = '✅ Coleta iniciada com sucesso! Os dados serão atualizados em breve.';
        setTimeout(() => { statusSpan.style.display = 'none'; }, 10000);
      }
    } else {
      showToast('Erro ao iniciar coleta: ' + (result.error || 'Erro desconhecido'), 'error');
      if (statusSpan) {
        statusSpan.style.display = 'inline';
        statusSpan.style.color = '#e74c3c';
        statusSpan.textContent = '❌ ' + (result.error || 'Erro desconhecido');
        setTimeout(() => { statusSpan.style.display = 'none'; }, 10000);
      }
    }
  } catch (error) {
    showToast('Erro ao iniciar pipeline de coleta', 'error');
    if (statusSpan) {
      statusSpan.style.display = 'inline';
      statusSpan.style.color = '#e74c3c';
      statusSpan.textContent = '❌ Erro ao iniciar pipeline de coleta';
      setTimeout(() => { statusSpan.style.display = 'none'; }, 10000);
    }
  } finally {
    if (btn) {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Iniciar Coleta';
        btn.style.opacity = '1';
      }, 5000);
    }
  }
}

/**
 * Budget indicator in sidebar
 */
async function loadBudget() {
  // Budget is not tracked server-side currently, show static estimate
  const budgetTotal = 15;
  document.getElementById('budget-text').textContent = `$0 / $${budgetTotal}`;
  document.getElementById('budget-fill').style.width = '0%';
  document.getElementById('budget-percentage').textContent = 'Sem dados de custo';
}

/**
 * Utilities
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Store selected viral pattern for generation
let selectedViralPattern = null;

async function createFromVideo(videoId, hookFormula, viralTitle, contentAngle) {
  // Store the selected viral pattern with specific example
  selectedViralPattern = {
    videoId,
    hookFormula,
    viralTitle,
    contentAngle
  };

  // Navigate to Create page and show guidance
  navigateTo('create');

  const statusDiv = document.getElementById('generation-status');
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = `
    <div style="padding: 1.5rem; background: rgba(102,126,234,0.1); border-radius: 12px; border-left: 4px solid #667eea;">
      <p style="color: #4a5abb; font-weight: 600; margin-bottom: 0.5rem;">💡 Viral Pattern Selected</p>
      <p style="color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Example:</strong> "${viralTitle}"</p>
      ${contentAngle ? `<p style="color: #666; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Angle:</strong> ${contentAngle}</p>` : ''}
      <p style="color: #666; font-size: 0.875rem;">Selecione um tópico abaixo. Seu reel vai usar este padrão viral para máximo engajamento!</p>
    </div>
  `;

  // Scroll to signal selector
  setTimeout(() => {
    document.getElementById('create-signal-select').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function getHookEngagement(hookFormula) {
  // Placeholder - could fetch from viral insights
  const engagementRates = {
    'emotional': '5.8',
    'curiosity': '5.5',
    'urgency': '5.2',
    'authority': '4.9'
  };
  return engagementRates[hookFormula] || '5.0';
}

/**
 * Hooks Tab
 */
function setHookFilter(filter) {
  hookPetFilter = filter;
  document.getElementById('hook-filter-pet').classList.toggle('active', filter === 'pet');
  document.getElementById('hook-filter-all').classList.toggle('active', filter === 'all');
  loadHooksList();
}

function setHookTimePeriod(period) {
  hookTimePeriod = period;
  loadHooksList();
}

async function loadHooksList() {
  const grid = document.getElementById('hooks-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading"><div class="spinner" style="border-color: rgba(0,0,0,0.1); border-top-color: #4a5abb;"></div><p style="color: #666;">Carregando padrões virais...</p></div>';

  try {
    const response = await fetch(`/api/trending/hooks?period=today&petOnly=${hookPetFilter === 'pet'}`);
    const data = await response.json();

    if (!data.success) {
      grid.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Não foi possível carregar dados.</p>';
      return;
    }

    const hooks = (data.data.hooks || []).sort((a, b) => (b.avg_engagement_rate || 0) - (a.avg_engagement_rate || 0));

    if (hooks.length === 0) {
      grid.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Nenhum padrão encontrado. Execute a coleta de dados primeiro.</p>';
      return;
    }

    renderHooksGrid(hooks);
  } catch (error) {
    console.error('Error loading hooks:', error);
    grid.innerHTML = '<p style="color: #999;">Não foi possível carregar padrões virais.</p>';
  }
}

function renderHooksGrid(hooks) {
  const grid = document.getElementById('hooks-grid');

  grid.innerHTML = `
    <div style="margin-bottom: 1rem; color: #666; font-size: 0.875rem;">${hooks.length} estratégias de gancho encontradas</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
      ${hooks.map((hook, i) => `
        <div style="border: 2px solid ${i === 0 ? '#f5576c' : '#e0e0e0'}; border-radius: 12px; padding: 1.5rem; transition: all 0.2s; ${i === 0 ? 'background: rgba(245,87,108,0.03);' : ''}" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='${i === 0 ? '#f5576c' : '#e0e0e0'}'">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: 700; color: ${i === 0 ? '#f5576c' : i < 3 ? '#4a5abb' : '#999'};">#${i + 1}</div>
              <div style="font-weight: 700; font-size: 1.1rem; color: #333;">${hookLabel(hook.hook_formula)}</div>
            </div>
            ${i === 0 ? '<span style="background: rgba(245,87,108,0.1); color: #f5576c; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">MAIS VIRAL</span>' : ''}
          </div>
          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(102,126,234,0.1); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem;">
              <span style="color: #4a5abb; font-weight: 700;">${(hook.avg_engagement_rate || hook.engagement_rate || 0).toFixed(1)}%</span>
              <span style="color: #666;"> engajamento médio</span>
            </div>
            <div style="background: rgba(139,92,246,0.1); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem;">
              <span style="color: #8b5cf6; font-weight: 700;">${hook.count || 0}</span>
              <span style="color: #666;"> ${(hook.count || 0) === 1 ? 'vídeo' : 'vídeos'}</span>
            </div>
          </div>
          ${hook.examples && hook.examples.length > 0 ? `
            <div style="border-top: 1px solid #e0e0e0; padding-top: 1rem; margin-top: 0.5rem;">
              <div style="font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Exemplos reais</div>
              ${hook.examples.slice(0, 2).map(ex => `
                <div style="font-size: 0.875rem; color: #555; margin-bottom: 0.25rem; line-height: 1.3;">
                  "${(ex.title || '').substring(0, 80)}${(ex.title || '').length > 80 ? '...' : ''}"
                  <span style="color: #4a5abb; font-weight: 600;">(${(ex.engagement_rate || 0).toFixed(1)}%)</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <button class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.625rem;" onclick="selectHook('${(hook.hook_formula || '').replace(/'/g, "\\'")}')">✨ Usar este Gancho</button>
        </div>
      `).join('')}
    </div>
  `;
}

function selectHook(hookFormula) {
  // Store hook for use in creation
  selectedViralPattern = {
    hookFormula,
    videoId: null,
    viralTitle: '',
    contentAngle: hookFormula
  };

  navigateTo('create');

  setTimeout(() => {
    const statusDiv = document.getElementById('generation-status');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = `
      <div style="padding: 1.5rem; background: rgba(102,126,234,0.1); border-radius: 12px; border-left: 4px solid #667eea;">
        <p style="color: #4a5abb; font-weight: 600; margin-bottom: 0.5rem;">✨ Gancho Selecionado</p>
        <p style="color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Gancho:</strong> ${hookLabel(hookFormula)}</p>
        <p style="color: #666; font-size: 0.875rem;">Selecione um tópico abaixo. Seu conteúdo vai usar este gancho para máximo engajamento!</p>
      </div>
    `;

    document.getElementById('create-signal-select').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

/**
 * Collection Trigger (Refresh)
 */
async function triggerCollection() {
  const btn = document.getElementById('refresh-signals-btn');
  const progressDiv = document.getElementById('collection-progress');
  const statusText = document.getElementById('collection-status');
  const progressBar = document.getElementById('collection-progress-bar');

  btn.disabled = true;
  btn.textContent = '⏳ Iniciando...';
  btn.style.opacity = '0.6';
  progressDiv.style.display = 'block';
  statusText.textContent = 'Enviando requisição...';
  progressBar.style.width = '10%';

  try {
    const response = await fetch('/api/collection/trigger', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      // Show success feedback immediately instead of polling SSE
      statusText.textContent = 'Coleta iniciada com sucesso!';
      progressBar.style.width = '100%';

      showToast('Coleta iniciada com sucesso! Os dados serão atualizados em breve.', 'success');

      // Show inline status near the button
      const refreshStatus = document.getElementById('refresh-status');
      refreshStatus.style.display = 'block';
      refreshStatus.textContent = '✅ Coleta iniciada com sucesso! Os dados serão atualizados em breve.';

      // Hide progress bar after a short delay
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 2000);

      // Re-enable button after a cooldown to prevent double-triggers
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '🔄 Atualizar Tendências';
        btn.style.opacity = '1';
      }, 5000);

      // Reload data after a delay to pick up new results
      setTimeout(() => {
        loadSignalsList();
        loadVideosList();
        loadHooksList();
        refreshStatus.textContent = '✓ Dados recarregados';
        setTimeout(() => { refreshStatus.style.display = 'none'; }, 5000);
      }, 15000);
    } else {
      progressDiv.style.display = 'none';
      btn.disabled = false;
      btn.textContent = '🔄 Atualizar Tendências';
      btn.style.opacity = '1';
      showToast('Erro ao iniciar coleta: ' + (result.error || 'Erro desconhecido'), 'error');
    }

  } catch (error) {
    console.error('Collection trigger error:', error);
    progressDiv.style.display = 'none';
    btn.disabled = false;
    btn.textContent = '🔄 Atualizar Tendências';
    btn.style.opacity = '1';
    showToast('Erro ao iniciar coleta: ' + error.message, 'error');
  }
}

/**
 * Help Page
 */
async function loadHelpData() {
  const helpDiv = document.getElementById('help-content');

  try {
    const response = await fetch('/api/help/info');
    const data = await response.json();

    if (!data.success) {
      helpDiv.innerHTML = '<p style="color: #999;">Não foi possível carregar informações.</p>';
      return;
    }

    const info = data.data;

    // Translate workflow/pages to PT-BR
    const workflowPtBr = [
      { step: 1, title: 'Coletar Inteligência', description: 'Feeds RSS e tendências do YouTube são coletados e pontuados por relevância para conteúdo pet.' },
      { step: 2, title: 'Analisar Padrões Virais', description: 'Vídeos com melhor desempenho são analisados para ganchos, gatilhos emocionais e padrões de engajamento.' },
      { step: 3, title: 'Descobrir Sinais', description: 'Navegue pelos sinais de conteúdo classificados na aba Descobrir.' },
      { step: 4, title: 'Gerar Conteúdo', description: 'Selecione um sinal, escolha a qualidade da IA e gere um carrossel, reel ou post LinkedIn.' },
      { step: 5, title: 'Revisar e Publicar', description: 'Revise o conteúdo gerado, aprove ou solicite alterações, e marque como publicado.' }
    ];

    const pagesPtBr = [
      { icon: '📊', name: 'Painel', description: 'Visão geral do pipeline de conteúdo, estatísticas e ações rápidas.' },
      { icon: '🔍', name: 'Descobrir', description: 'Explore sinais de conteúdo (RSS), vídeos em alta e padrões de ganchos virais.' },
      { icon: '✏️', name: 'Criar', description: 'Gere carrosseis (5 slides), reels (30-45s com narração) ou posts LinkedIn a partir de um sinal.' },
      { icon: '✅', name: 'Revisar', description: 'Revise conteúdo gerado. Aprove, solicite alterações ou rejeite. Filtre por status.' },
      { icon: '⚙️', name: 'Configurações', description: 'Configure a marca (cores, tom, serviços), orçamento e pipeline de coleta.' },
      { icon: '❓', name: 'Ajuda', description: 'Guia da plataforma, fluxo de trabalho e informações de APIs.' }
    ];

    helpDiv.innerHTML = `
      <div class="card">
        <h2 class="card-title">🐾 ${info.platform.name}</h2>
        <p style="color: #555; line-height: 1.6; font-size: 1rem;">Plataforma de geração de conteúdo com IA para redes sociais focada no mercado pet. Combina análise de tendências virais com sinais de conteúdo inteligente para criar carrosseis e reels de alto engajamento para Instagram e posts para LinkedIn.</p>
      </div>

      <div class="card">
        <h2 class="card-title">Como Funciona</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${workflowPtBr.map(step => `
            <div style="display: flex; gap: 1rem; align-items: start; padding: 1rem; background: #f9fafb; border-radius: 8px;">
              <div style="min-width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;">${step.step}</div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">${step.title}</div>
                <div style="color: #666; font-size: 0.875rem; line-height: 1.4;">${step.description}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">Guia de Páginas</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${pagesPtBr.map(page => `
            <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.25rem;">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${page.icon}</div>
              <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">${page.name}</div>
              <div style="color: #666; font-size: 0.875rem; line-height: 1.4;">${page.description}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">APIs Externas e Créditos</h2>
        <p style="color: #666; margin-bottom: 1.5rem;">APIs que alimentam a plataforma. Chaves configuradas via variáveis de ambiente.</p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${info.apis.map(api => `
            <div style="border: 2px solid ${api.keyConfigured ? '#e0e0e0' : 'rgba(239,68,68,0.3)'}; border-radius: 12px; padding: 1.25rem; ${!api.keyConfigured ? 'background: rgba(239,68,68,0.03);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 1.1rem; color: #333;">${api.name}</div>
                <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${api.keyConfigured ? 'background: rgba(34,197,94,0.1); color: #22c55e;' : 'background: rgba(239,68,68,0.1); color: #ef4444;'}">${api.keyConfigured ? '✓ Configurada' : '✗ Não Configurada'}</span>
              </div>
              <div style="color: #555; font-size: 0.875rem; line-height: 1.4; margin-bottom: 0.75rem;">${api.usage}</div>
              <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                <div style="font-size: 0.875rem;">
                  <span style="color: #999;">Custo:</span>
                  <span style="color: #333; font-weight: 600;">${api.costPer}</span>
                </div>
                <div style="font-size: 0.875rem;">
                  <span style="color: #999;">Orçamento:</span>
                  <span style="color: #4a5abb; font-weight: 600;">${api.monthlyBudget}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading help data:', error);
    helpDiv.innerHTML = '<div class="card"><p style="color: #999;">Não foi possível carregar informações de ajuda.</p></div>';
  }
}

/**
 * Feedback Modal
 */
async function openFeedbackModal(contentId) {
  document.getElementById('feedback-content-id').value = contentId;
  document.getElementById('feedback-text').value = '';
  document.getElementById('feedback-modal').style.display = 'flex';

  // Load existing feedback
  try {
    const res = await fetch(`/api/content/${contentId}/feedback`);
    const feedback = await res.json();
    const historyDiv = document.getElementById('feedback-history');

    if (feedback.length > 0) {
      historyDiv.innerHTML = `
        <h3 style="font-size: 1rem; color: #333; margin-bottom: 0.75rem;">Histórico de Feedback</h3>
        ${feedback.map(f => `
          <div style="padding: 0.75rem; background: ${f.status === 'addressed' ? '#f0fdf4' : '#fefce8'}; border-radius: 8px; margin-bottom: 0.5rem; font-size: 0.875rem;">
            <div style="color: #333;">${f.feedback_text}</div>
            <div style="color: #999; font-size: 0.75rem; margin-top: 0.25rem;">
              ${new Date(f.created_at).toLocaleDateString('pt-BR')} - ${f.status === 'addressed' ? 'Atendido' : 'Pendente'}
            </div>
          </div>
        `).join('')}
      `;
    } else {
      historyDiv.innerHTML = '';
    }
  } catch (e) {
    console.error('Error loading feedback:', e);
  }
}

function resetDiscoverTab() {
  // Reset to Sinais de Conteúdo tab
  const discoverPage = document.getElementById('discover-page');
  if (discoverPage) {
    discoverPage.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    discoverPage.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));
  }
}

function addFeedbackChip(text) {
  const textarea = document.getElementById('feedback-text');
  const chip = event.target;
  const isSelected = chip.classList.contains('selected');

  if (isSelected) {
    // Remove the text line from textarea
    const lines = textarea.value.split('\n').filter(line => line.trim() !== text.trim());
    textarea.value = lines.join('\n');
    chip.classList.remove('selected');
  } else {
    const current = textarea.value.trim();
    textarea.value = current ? current + '\n' + text : text;
    chip.classList.add('selected');
  }
  textarea.focus();
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal').style.display = 'none';
}

async function submitFeedback() {
  const contentId = document.getElementById('feedback-content-id').value;
  const feedbackText = document.getElementById('feedback-text').value.trim();

  if (!feedbackText) {
    showToast('Por favor, descreva as alterações desejadas.', 'warning');
    return;
  }

  const preciseMode = document.getElementById('precise-mode-toggle')?.checked || false;
  closeFeedbackModal();

  try {
    // Submit feedback
    await fetch(`/api/content/${contentId}/request-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback_text: feedbackText })
    });

    // Auto-trigger regeneration
    const res = await fetch(`/api/content/${contentId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preciseMode })
    });
    const data = await res.json();

    if (data.success) {
      await loadReviewData();
      // Start tracking progress inline
      trackRegenProgress(contentId);
    } else {
      showToast(data.error || 'Erro ao regenerar', 'error');
      await loadReviewData();
    }
  } catch (error) {
    showToast('Erro ao enviar feedback', 'error');
  }
}

async function regenerateContent(id) {
  try {
    const res = await fetch(`/api/content/${id}/regenerate`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      trackRegenProgress(id);
    } else {
      showToast(data.error || 'Erro ao regenerar', 'error');
    }
  } catch (error) {
    showToast('Erro ao regenerar conteúdo', 'error');
  }
}

/**
 * Track regeneration progress inline in the review card
 */
function trackRegenProgress(contentId) {
  const progressKey = `regen-${contentId}`;

  // Insert progress bar into the page
  const progressEl = document.createElement('div');
  progressEl.id = `progress-${contentId}`;
  progressEl.style.cssText = 'position:fixed;bottom:2rem;right:2rem;background:white;border:2px solid #667eea;border-radius:12px;padding:1.25rem;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:1000;min-width:320px;max-width:400px;';
  progressEl.innerHTML = `
    <div style="font-weight:600;color:#333;margin-bottom:0.75rem;">🔄 Gerando nova versão...</div>
    <div style="margin-bottom:0.5rem;">
      <div style="width:100%;height:8px;background:#e0e0e0;border-radius:4px;overflow:hidden;">
        <div id="regen-bar-${contentId}" style="width:10%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);transition:width 0.5s;border-radius:4px;"></div>
      </div>
    </div>
    <div id="regen-msg-${contentId}" style="font-size:0.85rem;color:#666;">Iniciando...</div>
    <div id="regen-step-${contentId}" style="font-size:0.75rem;color:#999;margin-top:0.25rem;">Passo 1/5</div>
  `;
  document.body.appendChild(progressEl);

  let attempts = 0;

  // Sequential polling — waits for each request to complete before scheduling next
  const poll = async () => {
    if (attempts >= 60) {
      progressEl.remove();
      showToast('Regeneração está demorando. Recarregue a página em breve.', 'warning');
      loadReviewData();
      return;
    }
    attempts++;

    try {
      const progRes = await fetch(`/api/progress/${progressKey}`);
      const prog = await progRes.json();

      if (prog.inProgress || prog.step) {
        const step = prog.step || 0;
        const total = prog.totalSteps || 5;
        const pct = Math.round((step / total) * 100);
        const bar = document.getElementById(`regen-bar-${contentId}`);
        const msg = document.getElementById(`regen-msg-${contentId}`);
        const stepEl = document.getElementById(`regen-step-${contentId}`);
        if (bar) bar.style.width = `${pct}%`;
        if (msg) msg.textContent = prog.message || 'Processando...';
        if (stepEl) stepEl.textContent = `Passo ${step}/${total}`;

        // Check if done
        if (step >= total) {
          if (bar) bar.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
          if (msg) msg.style.color = '#16a34a';
          setTimeout(async () => {
            progressEl.remove();
            await loadReviewData();
            showToast('Nova versão pronta!', 'success');
          }, 2000);
          return; // Stop polling
        }
      }
    } catch (e) {
      // Server may be busy, just retry
    }

    // Schedule next poll (sequential, not overlapping)
    setTimeout(poll, 2500);
  };

  poll();
}

/**
 * Brand Configuration
 */
async function loadBrandConfig() {
  try {
    const res = await fetch('/api/brand');
    if (res.ok) {
      const brand = await res.json();
      document.getElementById('brand-name').value = brand.name || '';
      document.getElementById('brand-handle').value = brand.handle || '';
      document.getElementById('brand-color-primary').value = brand.colors?.primary || '#667eea';
      document.getElementById('brand-color-secondary').value = brand.colors?.secondary || '#764ba2';
      document.getElementById('brand-color-accent').value = brand.colors?.accent || '#4caf50';
      document.getElementById('brand-tone').value = (brand.voice?.tone || []).join(', ');
      document.getElementById('brand-services').value = (brand.services || []).join(', ');
    }
  } catch (e) {
    console.error('Error loading brand config:', e);
  }
}

async function saveBrandConfig() {
  const brandName = document.getElementById('brand-name').value.trim();
  if (!brandName) {
    showToast('Nome da marca é obrigatório', 'warning');
    document.getElementById('brand-name').style.borderColor = '#ef4444';
    document.getElementById('brand-name').focus();
    return;
  }
  document.getElementById('brand-name').style.borderColor = '#e0e0e0';

  const config = {
    name: document.getElementById('brand-name').value,
    handle: document.getElementById('brand-handle').value,
    colors: {
      primary: document.getElementById('brand-color-primary').value,
      secondary: document.getElementById('brand-color-secondary').value,
      accent: document.getElementById('brand-color-accent').value
    },
    voice: {
      tone: document.getElementById('brand-tone').value.split(',').map(s => s.trim()).filter(Boolean)
    },
    services: document.getElementById('brand-services').value.split(',').map(s => s.trim()).filter(Boolean)
  };

  try {
    const res = await fetch('/api/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      showToast('Marca salva com sucesso!', 'success');
    } else {
      showToast('Erro ao salvar configuracao da marca', 'error');
    }
  } catch (e) {
    showToast('Erro ao salvar configuracao da marca', 'error');
  }
}

// Brand file upload
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('brand-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const statusEl = document.getElementById('upload-status');
      const tier = document.getElementById('extraction-tier').value;
      statusEl.textContent = `Enviando ${file.name}...`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tier', tier);

      try {
        const res = await fetch('/api/brand/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
          statusEl.innerHTML = `<span style="color: #22c55e;">✅ ${file.name} enviado. Extraindo conhecimento da marca...</span>`;
          showToast('Arquivo enviado! A IA está extraindo o perfil da marca...', 'loading');

          // Poll for profile completion
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            try {
              const profileRes = await fetch('/api/brand/profile');
              const profile = await profileRes.json();
              if (profile.extracted_at) {
                clearInterval(poll);
                statusEl.innerHTML = `<span style="color: #22c55e;">✅ Perfil da marca extraído com sucesso!</span>`;
                showToast('Perfil da marca extraído! Tom: ' + (profile.voice?.tone_adjectives?.join(', ') || 'extraído'), 'success', 6000);
                loadBrandProfile();
                loadBrandConfig();
              }
            } catch (e) {}
            if (attempts >= 30) {
              clearInterval(poll);
              statusEl.innerHTML = `<span style="color: #666;">Processamento pode levar mais tempo. Recarregue a página em breve.</span>`;
            }
          }, 3000);
        } else {
          statusEl.textContent = data.error || 'Erro no upload';
          showToast('Erro ao enviar arquivo', 'error');
        }
      } catch (error) {
        statusEl.textContent = 'Erro ao enviar arquivo';
        showToast('Erro no upload', 'error');
      }

      fileInput.value = '';
    });
  }
});

async function loadBrandProfile() {
  try {
    const res = await fetch('/api/brand/profile');
    const profile = await res.json();
    const statusDiv = document.getElementById('brand-profile-status');
    if (!statusDiv) return;

    if (profile.extracted_at) {
      statusDiv.innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem; font-size: 0.875rem;">
          <div style="font-weight: 600; color: #16a34a; margin-bottom: 0.5rem;">✅ Perfil da Marca Ativo</div>
          <div style="color: #333; margin-bottom: 0.25rem;"><strong>Tom:</strong> ${(profile.voice?.tone_adjectives || []).join(', ')}</div>
          <div style="color: #333; margin-bottom: 0.25rem;"><strong>Público:</strong> ${profile.content_rules?.target_audience || '-'}</div>
          <div style="color: #333; margin-bottom: 0.25rem;"><strong>Enfatizar:</strong> ${(profile.content_rules?.topics_to_emphasize || []).join(', ')}</div>
          ${profile.voice?.forbidden_words?.length > 0 ? `<div style="color: #dc2626; margin-bottom: 0.25rem;"><strong>Proibido:</strong> ${profile.voice.forbidden_words.join(', ')}</div>` : ''}
          <div style="color: #999; font-size: 0.75rem; margin-top: 0.5rem;">Extraído em ${new Date(profile.extracted_at).toLocaleDateString('pt-BR')} com ${profile.extraction_model}</div>
        </div>
      `;
    }
  } catch (e) {}
}

async function resetBrandConfig() {
  const ok = await showConfirm('Restaurar configurações padrão da marca?', { okText: 'Restaurar', cancelText: 'Cancelar' });
  if (!ok) return;
  try {
    await fetch('/api/brand/reset', { method: 'POST' });
    await loadBrandConfig();
    showToast('Marca restaurada para o padrão', 'success');
  } catch (e) {
    showToast('Erro ao restaurar', 'error');
  }
}
