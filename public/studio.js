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

// Status labels (PT-BR)
const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  published: 'Publicado',
  revision_requested: 'Revisao Solicitada'
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

  // Load page-specific data
  if (pageName === 'discover') {
    loadDiscoverData();
  } else if (pageName === 'create') {
    loadCreateData();
  } else if (pageName === 'review') {
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
    document.getElementById('stat-pending').textContent = contentStats.pending || 0;
    document.getElementById('stat-approved').textContent = contentStats.approved || 0;
    document.getElementById('stat-published').textContent = contentStats.published || 0;

    // Load viral stats
    const viralResponse = await fetch('/api/stats');
    const viralData = await viralResponse.json();

    if (viralData.success) {
      document.getElementById('stat-videos').textContent = viralData.data.overall.total || 0;
      document.getElementById('stat-engagement').textContent = (viralData.data.overall.avg_engagement_rate || 0).toFixed(1) + '%';
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
      activityDiv.innerHTML = '<p style="color: #999;">No recent activity</p>';
      return;
    }

    activityDiv.innerHTML = content.slice(0, 5).map(item => `
      <div style="padding: 1rem; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; margin-bottom: 0.25rem;">${item.signal?.title || 'Untitled'}</div>
          <div style="font-size: 0.875rem; color: #666;">${item.content_type === 'carousel' ? '📱 Carrossel' : item.content_type === 'reel' ? '🎥 Reel' : '💼 LinkedIn'} • ${statusLabel(item.status)}</div>
        </div>
        <div style="color: #999; font-size: 0.875rem;">${new Date(item.generated_at).toLocaleDateString()}</div>
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
  await Promise.all([
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
      signalsList.innerHTML = '<p style="color: #999;">No signals available. Run the intelligence collector.</p>';
      return;
    }

    signalsList.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
        ${allSignals.map(signal => `
          <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #667eea;">${signal.relevance_score}</div>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">📄 ${signal.sourceType || 'RSS'}</div>
            </div>
            <div style="font-weight: 600; margin-bottom: 0.5rem; color: #333;">${signal.title}</div>
            <div style="font-size: 0.875rem; color: #666; line-height: 1.4; margin-bottom: 1rem;">${(signal.description || '').substring(0, 150)}...</div>
            <div style="margin-bottom: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; color: #999;">
              📰 ${signal.source} • ${new Date(signal.collected_at).toLocaleDateString()}
            </div>
            <button class="btn btn-primary" style="width: 100%; padding: 0.75rem;" onclick="createFromSignal(${signal.id})">✨ Create from this signal</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading signals:', error);
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
    videosList.innerHTML = '<div class="loading"><div class="spinner" style="border-color: rgba(0,0,0,0.1); border-top-color: #667eea;"></div><p style="color: #666;">Loading videos...</p></div>';

    // Try new trending API first
    const trendingResponse = await fetch(`/api/trending/videos?period=${videoTimePeriod}&petOnly=${videoPetFilter === 'pet'}`);
    const trendingData = await trendingResponse.json();

    if (trendingData.success && trendingData.data) {
      // For 'today' period, also load from viral analyzer for full video list
      if (videoTimePeriod === 'today') {
        try {
          const response = await fetch('/api/trending/videos');
          const data = await response.json();
          if (data.success && data.data.length > 0) {
            allVideos = data.data;

            // Apply pet filter
            if (videoPetFilter === 'pet') {
              allVideos = allVideos.filter(v =>
                isPetRelatedClient(v.content_themes || v.title || '')
              );
            }
          }
        } catch (e) {
          // Viral analyzer not running, use trending data
          allVideos = trendingData.data.videos || [];
        }
      } else {
        // Historical data from snapshots
        allVideos = trendingData.data.items || trendingData.data.videos || [];
      }
    }

    if (allVideos.length === 0) {
      videosList.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No videos found for this filter. Try "All Videos" or a different time period.</p>';
      return;
    }

    // Load Top 10 lists
    await loadTop10Lists();

    // Render filters and videos
    renderVideoFilters();
    renderVideoGrid();
  } catch (error) {
    console.error('Error loading videos:', error);
    document.getElementById('videos-list').innerHTML = '<p style="color: #999;">Could not load viral videos. Make sure the server is running.</p>';
  }
}

// Client-side pet classification (mirrors server-side)
function isPetRelatedClient(text) {
  const petKeywords = ['pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper', 'fur baby', 'vet', 'breed'];
  const lower = (text || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

async function loadTop10Lists() {
  try {
    const response = await fetch('/api/trending/hooks');
    const data = await response.json();

    if (data.success) {
      const top10Section = document.getElementById('top10-section');
      if (!top10Section) {
        // Create top 10 section if it doesn't exist
        const videosList = document.getElementById('videos-list');
        videosList.insertAdjacentHTML('afterbegin', '<div id="top10-section"></div>');
      }

      const section = document.getElementById('top10-section');
      const topHooks = data.data.top_hooks.slice(0, 10);
      const topIdeas = data.data.top_content_ideas.slice(0, 10);

      section.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 2px solid #e0e0e0;">
            <h3 style="color: #667eea; margin-bottom: 1rem; font-size: 1.25rem;">🔥 Top 10 Hook Strategies</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${topHooks.map((hook, i) => `
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px; background: ${i === 0 ? 'rgba(245,87,108,0.1)' : '#f9fafb'};">
                  <div style="font-size: 1.25rem; font-weight: 700; color: ${i === 0 ? '#f5576c' : '#999'}; min-width: 30px;">#${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">${hook.hook_formula}</div>
                    <div style="font-size: 0.875rem; color: #666;">${hook.engagement_rate.toFixed(1)}% avg engagement • ${hook.video_count} videos</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 2px solid #e0e0e0;">
            <h3 style="color: #667eea; margin-bottom: 1rem; font-size: 1.25rem;">💡 Top 10 Content Ideas</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${topIdeas.map((idea, i) => `
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px; background: ${i === 0 ? 'rgba(102,126,234,0.1)' : '#f9fafb'};">
                  <div style="font-size: 1.25rem; font-weight: 700; color: ${i === 0 ? '#667eea' : '#999'}; min-width: 30px;">#${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">${idea.content_angle}</div>
                    <div style="font-size: 0.875rem; color: #666;">${idea.avg_engagement_rate.toFixed(1)}% engagement • ${idea.video_count} videos</div>
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
    <div style="margin-bottom: 1rem; color: #666;">Showing ${filtered.length} of ${allVideos.length} videos</div>
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
          ? ''
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
              ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover;" ${thumbnailFallback}>`
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
              ${video.hook_formula ? `<span style="background: rgba(102,126,234,0.1); color: #667eea; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${video.hook_formula}</span>` : ''}
              ${video.emotional_trigger ? `<span style="background: rgba(251,146,60,0.1); color: #fb923c; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${video.emotional_trigger}</span>` : ''}
            </div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">${(video.view_count || 0).toLocaleString()} views</div>
            <button class="btn btn-primary" style="width: 100%; padding: 0.5rem;" onclick="event.stopPropagation(); createFromVideo(${video.id}, '${video.hook_formula || ''}', '${safeTitle}', '${safeAngle}')">✨ Create from this</button>
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
      modelDesc.textContent = 'Fast: GPT-4o-mini for quick iterations';
    } else {
      fastBtn.className = 'btn';
      fastBtn.style = 'flex: 1; padding: 0.5rem; background: white; color: #666; border: 2px solid #e0e0e0; font-size: 0.875rem;';
      premiumBtn.className = 'btn btn-primary';
      premiumBtn.style = 'flex: 1; padding: 0.5rem; font-size: 0.875rem;';
      modelDesc.textContent = 'Premium: Claude Sonnet 4 for viral-quality scripts';
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
    select.innerHTML = '<option value="">-- Select a topic --</option>' +
      signals.map(signal => `
        <option value="${signal.id}">${signal.title} (Score: ${signal.relevance_score})</option>
      `).join('');

    select.addEventListener('change', () => {
      const carouselBtn = document.getElementById('create-carousel-btn');
      const reelBtn = document.getElementById('create-reel-btn');
      const signalId = parseInt(select.value);

      if (signalId) {
        carouselBtn.disabled = false;
        reelBtn.disabled = false;

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
        document.getElementById('viral-context-panel').style.display = 'none';
        const detailsDiv = document.getElementById('signal-details');
        if (detailsDiv) detailsDiv.style.display = 'none';
      }
    });

    // Setup generation buttons
    document.getElementById('create-carousel-btn').addEventListener('click', () => generateContent('carousel'));
    document.getElementById('create-reel-btn').addEventListener('click', () => generateContent('reel'));

  } catch (error) {
    console.error('Error loading create data:', error);
  }
}

async function loadViralContext() {
  try {
    const response = await fetch('/api/trending/hooks');
    const data = await response.json();

    if (data.success) {
      const panel = document.getElementById('viral-context-panel');
      const content = document.getElementById('viral-context-content');

      const topHook = data.data.top_hooks[0];

      content.innerHTML = `
        <div style="margin-bottom: 1rem;">
          <strong>Top Hook Formula:</strong> ${topHook?.hook_formula || 'N/A'} (${(topHook?.engagement_rate || 0).toFixed(1)}% avg engagement)
        </div>
        <div style="margin-bottom: 1rem;">
          <strong>Trending Themes:</strong> ${data.data.top_content_ideas.slice(0, 3).map(idea => idea.content_angle).join(', ')}
        </div>
        <div style="font-size: 0.875rem; color: #666;">
          Based on analysis of viral pet videos from the last 7 days
        </div>
      `;

      panel.style.display = 'block';
    }
  } catch (error) {
    console.error('Could not load viral context:', error);
  }
}

async function generateContent(type) {
  const signalId = document.getElementById('create-signal-select').value;
  if (!signalId) {
    alert('Please select a topic first');
    return;
  }

  // Get buttons and disable them immediately
  const carouselBtn = document.getElementById('create-carousel-btn');
  const reelBtn = document.getElementById('create-reel-btn');

  carouselBtn.disabled = true;
  reelBtn.disabled = true;
  carouselBtn.style.opacity = '0.5';
  carouselBtn.style.cursor = 'not-allowed';
  reelBtn.style.opacity = '0.5';
  reelBtn.style.cursor = 'not-allowed';

  // Show confirmation
  const statusDiv = document.getElementById('generation-status');
  statusDiv.style.display = 'block';
  const contentType = type === 'carousel' ? '📱 Carousel' : '🎥 Reel';
  const aiQuality = selectedAIModel === 'claude-sonnet-4' ? 'Premium (Claude)' : 'Fast (GPT)';

  statusDiv.innerHTML = `
    <div style="text-align: center; padding: 1.5rem; background: rgba(102,126,234,0.1); border-radius: 12px; border: 2px solid #667eea;">
      <p style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">✓ Confirmed: Generating ${contentType}</p>
      <p style="color: #666; font-size: 0.875rem;">AI Quality: ${aiQuality}</p>
    </div>
  `;

  // Small delay to show confirmation
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const endpoint = type === 'carousel' ? '/api/generate' : '/api/generate-reel';

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
          <p style="font-weight: 600; margin-bottom: 1rem;">Generation started!</p>
          <p style="color: #666;">Check the Review queue in a moment.</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="navigateTo('review')">Go to Review Queue</button>
        </div>
      `;
    }
  } catch (error) {
    // Re-enable buttons on error
    carouselBtn.disabled = false;
    reelBtn.disabled = false;
    carouselBtn.style.opacity = '1';
    carouselBtn.style.cursor = 'pointer';
    reelBtn.style.opacity = '1';
    reelBtn.style.cursor = 'pointer';

    statusDiv.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(239,68,68,0.1); border-radius: 12px; color: #ef4444;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">❌</div>
        <p style="font-weight: 600;">Generation failed</p>
        <p style="color: #666; margin-top: 0.5rem;">${error.message}</p>
        <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="document.getElementById('generation-status').style.display='none'">Try Again</button>
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
          <p style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">${progress.message}</p>
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
    carouselBtn.style.opacity = '1';
    carouselBtn.style.cursor = 'pointer';
    reelBtn.style.opacity = '1';
    reelBtn.style.cursor = 'pointer';

    // Show timeout message
    statusDiv.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(251,191,36,0.1); border-radius: 12px; color: #f59e0b;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">⏱️</div>
        <p style="font-weight: 600; margin-bottom: 0.5rem;">Generation taking longer than expected</p>
        <p style="color: #666; font-size: 0.875rem;">The reel is still being generated. Check the Review queue in a few moments.</p>
        <button class="btn btn-primary" style="margin-top: 1rem;" onclick="navigateTo('review')">Go to Review Queue</button>
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

function displayReviewContent(filter) {
  const grid = document.getElementById('review-content-grid');

  let filtered = allContent;
  if (filter !== 'all') {
    filtered = allContent.filter(item => item.status === filter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #999; padding: 3rem;">Nenhum conteudo encontrado</p>';
    return;
  }

  grid.innerHTML = `
    <div style="display: grid; gap: 1.5rem;">
      ${filtered.map(item => `
        <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; background: white;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">${item.signal?.title || 'Untitled'}</div>
              <div style="font-size: 0.875rem; color: #666;">${item.content_type === 'carousel' ? '📱 Carousel' : '🎥 Reel'}</div>
            </div>
            <div style="padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.875rem;
              ${item.status === 'pending' ? 'background: rgba(251,146,60,0.1); color: #fb923c;' : ''}
              ${item.status === 'approved' ? 'background: rgba(34,197,94,0.1); color: #22c55e;' : ''}
              ${item.status === 'rejected' ? 'background: rgba(239,68,68,0.1); color: #ef4444;' : ''}
              ${item.status === 'published' ? 'background: rgba(139,92,246,0.1); color: #8b5cf6;' : ''}
              ${item.status === 'revision_requested' ? 'background: rgba(234,179,8,0.1); color: #eab308;' : ''}
            ">
              ${statusLabel(item.status)}
            </div>
          </div>

          ${item.content_type === 'carousel' && item.carousel_images ? `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto;">
              ${(Array.isArray(item.carousel_images) ? item.carousel_images : JSON.parse(item.carousel_images)).slice(0, 5).map(img => `
                <img src="${img.replace('./output', '/output').replace('output/', '/output/')}" style="height: 120px; border-radius: 8px; border: 2px solid #e0e0e0;">
              `).join('')}
            </div>
          ` : ''}

          ${item.content_type === 'reel' && item.reel_video_path ? `
            <video controls style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 1rem;">
              <source src="${item.reel_video_path.replace('./output', '/output').replace('output/', '/output/')}" type="video/mp4">
            </video>
          ` : ''}

          ${item.carousel_content ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;"><strong>Legenda:</strong> ${item.carousel_content.caption}</div>
              <div style="font-size: 0.875rem; color: #667eea;"><strong>Hashtags:</strong> ${item.carousel_content.hashtags.join(' ')}</div>
            </div>
          ` : ''}

          ${item.reel_script ? `
            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;"><strong>Legenda:</strong> ${item.reel_script.caption}</div>
              <div style="font-size: 0.875rem; color: #667eea;"><strong>Hashtags:</strong> ${item.reel_script.hashtags.join(' ')}</div>
            </div>
          ` : ''}

          ${item.version && item.version > 1 ? `
            <div style="margin-bottom: 0.5rem; font-size: 0.8rem; color: #667eea; font-weight: 600;">v${item.version}</div>
          ` : ''}

          <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
            ${item.status === 'pending' || item.status === 'revision_requested' ? `
              <button class="btn btn-primary" onclick="approveContent(${item.id})">✅ Aprovar</button>
              <button class="btn btn-secondary" onclick="openFeedbackModal(${item.id})">✏️ Solicitar Alteracoes</button>
              <button class="btn btn-secondary" onclick="rejectContent(${item.id})">❌ Rejeitar</button>
            ` : ''}
            ${item.status === 'revision_requested' ? `
              <button class="btn btn-primary" onclick="regenerateContent(${item.id})">🔄 Regenerar</button>
            ` : ''}
            ${item.status === 'approved' ? `
              <button class="btn btn-primary" onclick="publishContent(${item.id})">🚀 Publicar</button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function approveContent(id) {
  try {
    await fetch(`/api/content/${id}/approve`, { method: 'POST' });
    await loadReviewData();
  } catch (error) {
    alert('Failed to approve content');
  }
}

async function rejectContent(id) {
  const reason = prompt('Rejection reason (optional):');
  try {
    await fetch(`/api/content/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'No reason provided' })
    });
    await loadReviewData();
  } catch (error) {
    alert('Failed to reject content');
  }
}

async function publishContent(id) {
  try {
    await fetch(`/api/content/${id}/publish`, { method: 'POST' });
    await loadReviewData();
    await loadDashboardStats();
  } catch (error) {
    alert('Failed to publish content');
  }
}

/**
 * Settings Page
 */
async function loadSettingsData() {
  // Load brand config
  loadBrandConfig();

  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    const budgetDiv = document.getElementById('settings-budget');

    if (data.success && data.data?.costs) {
      const costs = data.data.costs;
      budgetDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Orcamento Mensal</div>
            <div style="font-size: 2rem; font-weight: 700; color: #667eea;">$${costs.budget}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Gasto este Mes</div>
            <div style="font-size: 2rem; font-weight: 700; color: #f5576c;">$${costs.thisMonth.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Restante</div>
            <div style="font-size: 2rem; font-weight: 700; color: #22c55e;">$${costs.remaining.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Orcamento Usado</div>
            <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${costs.percentUsed.toFixed(1)}%</div>
          </div>
        </div>
      `;
    } else {
      // Simple stats display
      budgetDiv.innerHTML = `<p style="color: #666;">Dados de orcamento nao disponiveis</p>`;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function runCollectionPipeline() {
  if (!confirm('This will collect and analyze new viral videos. This can cost $0.03-$0.05 per video. Continue?')) {
    return;
  }

  try {
    const response = await fetch('/api/collection/trigger', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      alert('Collection pipeline started! Check the viral analyzer for progress.');
    } else {
      alert('Failed to start collection: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Failed to start collection pipeline. Make sure viral analyzer is running.');
  }
}

/**
 * Budget indicator in sidebar
 */
async function loadBudget() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    if (data.success) {
      const costs = data.data.costs;
      document.getElementById('budget-text').textContent = `$${costs.thisMonth.toFixed(2)} / $${costs.budget}`;
      document.getElementById('budget-fill').style.width = `${costs.percentUsed}%`;
      document.getElementById('budget-percentage').textContent = `${costs.percentUsed.toFixed(1)}% used`;

      // Color-code based on usage
      const fillEl = document.getElementById('budget-fill');
      if (costs.percentUsed > 90) {
        fillEl.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      } else if (costs.percentUsed > 75) {
        fillEl.style.background = 'linear-gradient(90deg, #fb923c 0%, #f97316 100%)';
      } else {
        fillEl.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
      }
    }
  } catch (error) {
    console.error('Error loading budget:', error);
  }
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
      <p style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">💡 Viral Pattern Selected</p>
      <p style="color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Example:</strong> "${viralTitle}"</p>
      ${contentAngle ? `<p style="color: #666; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Angle:</strong> ${contentAngle}</p>` : ''}
      <p style="color: #666; font-size: 0.875rem;">Select a topic below. Your reel will emulate this viral pattern for maximum engagement!</p>
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

  grid.innerHTML = '<div class="loading"><div class="spinner" style="border-color: rgba(0,0,0,0.1); border-top-color: #667eea;"></div><p style="color: #666;">Loading hooks...</p></div>';

  try {
    const response = await fetch(`/api/trending/hooks?period=${hookTimePeriod}&petOnly=${hookPetFilter === 'pet'}`);
    const data = await response.json();

    if (!data.success) {
      grid.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Could not load hooks data.</p>';
      return;
    }

    const hooks = data.data.hooks || data.data.items || [];

    if (hooks.length === 0) {
      grid.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No hooks found for this filter. Try "All Hooks" or a different time period.</p>';
      return;
    }

    renderHooksGrid(hooks);
  } catch (error) {
    console.error('Error loading hooks:', error);
    grid.innerHTML = '<p style="color: #999;">Could not load hooks. Make sure the server is running.</p>';
  }
}

function renderHooksGrid(hooks) {
  const grid = document.getElementById('hooks-grid');

  grid.innerHTML = `
    <div style="margin-bottom: 1rem; color: #666; font-size: 0.875rem;">Showing ${hooks.length} hook strategies</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
      ${hooks.map((hook, i) => `
        <div style="border: 2px solid ${i === 0 ? '#f5576c' : '#e0e0e0'}; border-radius: 12px; padding: 1.5rem; transition: all 0.2s; ${i === 0 ? 'background: rgba(245,87,108,0.03);' : ''}" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='${i === 0 ? '#f5576c' : '#e0e0e0'}'">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: 700; color: ${i === 0 ? '#f5576c' : i < 3 ? '#667eea' : '#999'};">#${i + 1}</div>
              <div style="font-weight: 700; font-size: 1.1rem; color: #333;">${hook.hook_formula}</div>
            </div>
            ${i === 0 ? '<span style="background: rgba(245,87,108,0.1); color: #f5576c; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">TOP HOOK</span>' : ''}
          </div>
          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(102,126,234,0.1); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem;">
              <span style="color: #667eea; font-weight: 700;">${(hook.avg_engagement_rate || hook.engagement_rate || 0).toFixed(1)}%</span>
              <span style="color: #666;"> avg engagement</span>
            </div>
            <div style="background: rgba(139,92,246,0.1); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem;">
              <span style="color: #8b5cf6; font-weight: 700;">${hook.count || 0}</span>
              <span style="color: #666;"> videos</span>
            </div>
          </div>
          ${hook.examples && hook.examples.length > 0 ? `
            <div style="border-top: 1px solid #e0e0e0; padding-top: 1rem; margin-top: 0.5rem;">
              <div style="font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Examples</div>
              ${hook.examples.slice(0, 2).map(ex => `
                <div style="font-size: 0.875rem; color: #555; margin-bottom: 0.25rem; line-height: 1.3;">
                  "${(ex.title || '').substring(0, 80)}${(ex.title || '').length > 80 ? '...' : ''}"
                  <span style="color: #667eea; font-weight: 600;">(${(ex.engagement_rate || 0).toFixed(1)}%)</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <button class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.625rem;" onclick="selectHook('${(hook.hook_formula || '').replace(/'/g, "\\'")}')">✨ Use This Hook</button>
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
        <p style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">✨ Hook Selected</p>
        <p style="color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Hook Formula:</strong> ${hookFormula}</p>
        <p style="color: #666; font-size: 0.875rem;">Select a topic below. Your content will use this hook formula for maximum engagement!</p>
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
  btn.textContent = '⏳ Starting...';
  btn.style.opacity = '0.6';
  progressDiv.style.display = 'block';

  try {
    const response = await fetch('/api/collection/trigger', { method: 'POST' });
    const { jobId } = await response.json();

    // Connect to SSE for progress updates
    const eventSource = new EventSource(`/api/collection/status/${jobId}`);

    eventSource.addEventListener('message', (event) => {
      const update = JSON.parse(event.data);
      statusText.textContent = update.message;
      progressBar.style.width = `${update.progress}%`;

      if (update.status === 'complete') {
        eventSource.close();
        progressDiv.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🔄 Get Newest Trends';
        btn.style.opacity = '1';

        // Save snapshot of current trends
        fetch('/api/trending/snapshot', { method: 'POST' });

        // Reload data
        loadSignalsList();
        loadVideosList();
        loadHooksList();

        // Show success
        const refreshStatus = document.getElementById('refresh-status');
        refreshStatus.style.display = 'block';
        refreshStatus.textContent = '✓ Updated just now';
        setTimeout(() => { refreshStatus.style.display = 'none'; }, 5000);
      }

      if (update.status === 'error') {
        eventSource.close();
        progressDiv.style.display = 'none';
        btn.disabled = false;
        btn.textContent = '🔄 Get Newest Trends';
        btn.style.opacity = '1';
        alert('Collection failed: ' + update.message);
      }
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      progressDiv.style.display = 'none';
      btn.disabled = false;
      btn.textContent = '🔄 Get Newest Trends';
      btn.style.opacity = '1';
    });

  } catch (error) {
    console.error('Collection trigger error:', error);
    progressDiv.style.display = 'none';
    btn.disabled = false;
    btn.textContent = '🔄 Get Newest Trends';
    btn.style.opacity = '1';
    alert('Failed to start collection: ' + error.message);
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
      helpDiv.innerHTML = '<p style="color: #999;">Could not load help info.</p>';
      return;
    }

    const info = data.data;

    helpDiv.innerHTML = `
      <!-- Platform Overview -->
      <div class="card">
        <h2 class="card-title">🐾 ${info.platform.name}</h2>
        <p style="color: #555; line-height: 1.6; font-size: 1rem;">${info.platform.description}</p>
      </div>

      <!-- How It Works -->
      <div class="card">
        <h2 class="card-title">How It Works</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${info.workflow.map(step => `
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

      <!-- Pages Guide -->
      <div class="card">
        <h2 class="card-title">Pages Guide</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${info.pages.map(page => `
            <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.25rem;">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${page.icon}</div>
              <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">${page.name}</div>
              <div style="color: #666; font-size: 0.875rem; line-height: 1.4;">${page.description}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- External APIs -->
      <div class="card">
        <h2 class="card-title">External APIs & Credits</h2>
        <p style="color: #666; margin-bottom: 1.5rem;">These are the APIs powering the platform. API keys are configured via environment variables.</p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${info.apis.map(api => `
            <div style="border: 2px solid ${api.keyConfigured ? '#e0e0e0' : 'rgba(239,68,68,0.3)'}; border-radius: 12px; padding: 1.25rem; ${!api.keyConfigured ? 'background: rgba(239,68,68,0.03);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 1.1rem; color: #333;">${api.name}</div>
                <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${api.keyConfigured ? 'background: rgba(34,197,94,0.1); color: #22c55e;' : 'background: rgba(239,68,68,0.1); color: #ef4444;'}">${api.keyConfigured ? '✓ Configured' : '✗ Not Configured'}</span>
              </div>
              <div style="color: #555; font-size: 0.875rem; line-height: 1.4; margin-bottom: 0.75rem;">${api.usage}</div>
              <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                <div style="font-size: 0.875rem;">
                  <span style="color: #999;">Cost:</span>
                  <span style="color: #333; font-weight: 600;">${api.costPer}</span>
                </div>
                <div style="font-size: 0.875rem;">
                  <span style="color: #999;">Budget:</span>
                  <span style="color: #667eea; font-weight: 600;">${api.monthlyBudget}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading help data:', error);
    helpDiv.innerHTML = '<div class="card"><p style="color: #999;">Could not load help information. Make sure the server is running.</p></div>';
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
        <h3 style="font-size: 1rem; color: #333; margin-bottom: 0.75rem;">Historico de Feedback</h3>
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

function closeFeedbackModal() {
  document.getElementById('feedback-modal').style.display = 'none';
}

async function submitFeedback() {
  const contentId = document.getElementById('feedback-content-id').value;
  const feedbackText = document.getElementById('feedback-text').value.trim();

  if (!feedbackText) {
    alert('Por favor, descreva as alteracoes desejadas.');
    return;
  }

  try {
    await fetch(`/api/content/${contentId}/request-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback_text: feedbackText })
    });

    closeFeedbackModal();
    await loadReviewData();
  } catch (error) {
    alert('Erro ao enviar feedback');
  }
}

async function regenerateContent(id) {
  if (!confirm('Regenerar este conteudo com base no feedback?')) return;

  try {
    const res = await fetch(`/api/content/${id}/regenerate`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      alert('Regeneracao iniciada! Uma nova versao aparecera em breve.');
      // Reload after a short delay
      setTimeout(() => loadReviewData(), 5000);
    } else {
      alert(data.error || 'Erro ao regenerar');
    }
  } catch (error) {
    alert('Erro ao regenerar conteudo');
  }
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
      alert('Marca salva com sucesso!');
    } else {
      alert('Erro ao salvar configuracao da marca');
    }
  } catch (e) {
    alert('Erro ao salvar configuracao da marca');
  }
}

async function resetBrandConfig() {
  if (!confirm('Restaurar configuracoes padrao da marca?')) return;
  try {
    await fetch('/api/brand/reset', { method: 'POST' });
    await loadBrandConfig();
    alert('Marca restaurada para o padrao');
  } catch (e) {
    alert('Erro ao restaurar');
  }
}
