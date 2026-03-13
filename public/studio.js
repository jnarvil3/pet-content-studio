/**
 * Pet Content Studio - Unified App JavaScript
 */

// State
let currentPage = 'dashboard';
let allContent = [];
let allSignals = [];
let currentFilter = 'all';

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
    const viralResponse = await fetch('http://localhost:3001/api/stats');
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
          <div style="font-size: 0.875rem; color: #666;">${item.content_type === 'carousel' ? '📱 Carousel' : '🎥 Reel'} • ${item.status}</div>
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
    loadVideosList()
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
          <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#e0e0e0'" onclick="createFromSignal(${signal.id})">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #667eea;">${signal.relevance_score}</div>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">📄 ${signal.sourceType || 'RSS'}</div>
            </div>
            <div style="font-weight: 600; margin-bottom: 0.5rem; color: #333;">${signal.title}</div>
            <div style="font-size: 0.875rem; color: #666; line-height: 1.4;">${(signal.description || '').substring(0, 120)}...</div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; font-size: 0.875rem; color: #999;">
              📰 ${signal.source} • ${new Date(signal.collected_at).toLocaleDateString()}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading signals:', error);
  }
}

async function loadVideosList() {
  try {
    const response = await fetch('http://localhost:3001/api/videos?limit=20&analyzed_only=true');
    const data = await response.json();

    const videosList = document.getElementById('videos-list');

    if (!data.success || data.data.length === 0) {
      videosList.innerHTML = '<p style="color: #999;">No viral videos analyzed yet.</p>';
      return;
    }

    const videos = data.data;

    videosList.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        ${videos.map(video => `
          <div style="border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.borderColor='#f5576c'" onmouseout="this.style.borderColor='#e0e0e0'">
            <div style="aspect-ratio: 16/9; background: #000; position: relative;">
              <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${video.video_id}" frameborder="0" allowfullscreen></iframe>
            </div>
            <div style="padding: 1rem;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; line-height: 1.3; color: #333;">${video.title}</div>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="background: rgba(245,87,108,0.1); color: #f5576c; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${video.engagement_rate.toFixed(1)}% engagement</span>
                <span style="background: rgba(102,126,234,0.1); color: #667eea; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${video.hook_formula || 'unknown'}</span>
              </div>
              <div style="font-size: 0.875rem; color: #666;">${(video.view_count || 0).toLocaleString()} views</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading videos:', error);
    document.getElementById('videos-list').innerHTML = '<p style="color: #999;">Could not load viral videos. Make sure viral analyzer is running on port 3001.</p>';
  }
}

/**
 * Create Page
 */
async function loadCreateData() {
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

      if (select.value) {
        carouselBtn.disabled = false;
        reelBtn.disabled = false;
        loadViralContext();
      } else {
        carouselBtn.disabled = true;
        reelBtn.disabled = true;
        document.getElementById('viral-context-panel').style.display = 'none';
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
    const response = await fetch('http://localhost:3001/api/trends/today');
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

  const statusDiv = document.getElementById('generation-status');
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = `
    <div style="text-align: center; padding: 2rem; background: rgba(102,126,234,0.1); border-radius: 12px;">
      <div class="spinner"></div>
      <p style="color: #667eea; font-weight: 600;">Generating ${type}... This may take a minute.</p>
    </div>
  `;

  try {
    const endpoint = type === 'carousel' ? '/api/generate' : '/api/generate-reel';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1, minScore: 0 }) // Will use selected signal
    });

    const result = await response.json();

    if (result.success) {
      statusDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: rgba(34,197,94,0.1); border-radius: 12px; color: #22c55e;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
          <p style="font-weight: 600; margin-bottom: 1rem;">Generation started successfully!</p>
          <p style="color: #666;">Your ${type} will appear in the Review queue when complete.</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="navigateTo('review')">Go to Review Queue</button>
        </div>
      `;
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error) {
    statusDiv.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(239,68,68,0.1); border-radius: 12px; color: #ef4444;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">❌</div>
        <p style="font-weight: 600;">Generation failed</p>
        <p style="color: #666; margin-top: 0.5rem;">${error.message}</p>
      </div>
    `;
  }
}

function createFromSignal(signalId) {
  navigateTo('create');
  setTimeout(() => {
    document.getElementById('create-signal-select').value = signalId;
    document.getElementById('create-signal-select').dispatchEvent(new Event('change'));
  }, 100);
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
    grid.innerHTML = '<p style="text-align: center; color: #999; padding: 3rem;">No content found</p>';
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
            ">
              ${item.status.toUpperCase()}
            </div>
          </div>

          ${item.content_type === 'carousel' && item.carousel_images ? `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto;">
              ${JSON.parse(item.carousel_images).slice(0, 5).map(img => `
                <img src="${img.replace('./output', '/output')}" style="height: 120px; border-radius: 8px; border: 2px solid #e0e0e0;">
              `).join('')}
            </div>
          ` : ''}

          ${item.content_type === 'reel' && item.reel_video_path ? `
            <video controls style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 1rem;">
              <source src="${item.reel_video_path.replace('./output', '/output')}" type="video/mp4">
            </video>
          ` : ''}

          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            ${item.status === 'pending' ? `
              <button class="btn btn-primary" onclick="approveContent(${item.id})">✅ Approve</button>
              <button class="btn btn-secondary" onclick="rejectContent(${item.id})">❌ Reject</button>
            ` : ''}
            ${item.status === 'approved' ? `
              <button class="btn btn-primary" onclick="publishContent(${item.id})">🚀 Mark Published</button>
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
  try {
    const response = await fetch('http://localhost:3001/api/stats');
    const data = await response.json();

    if (data.success) {
      const budgetDiv = document.getElementById('settings-budget');
      const costs = data.data.costs;

      budgetDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Monthly Budget</div>
            <div style="font-size: 2rem; font-weight: 700; color: #667eea;">$${costs.budget}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Spent This Month</div>
            <div style="font-size: 2rem; font-weight: 700; color: #f5576c;">$${costs.thisMonth.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Remaining</div>
            <div style="font-size: 2rem; font-weight: 700; color: #22c55e;">$${costs.remaining.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.5rem;">Budget Used</div>
            <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${costs.percentUsed.toFixed(1)}%</div>
          </div>
        </div>
      `;
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
    const response = await fetch('http://localhost:3001/api/collect', { method: 'POST' });
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
    const response = await fetch('http://localhost:3001/api/stats');
    const data = await response.json();

    if (data.success) {
      const costs = data.data.costs;
      document.getElementById('budget-text').textContent = `$${costs.thisMonth.toFixed(2)} / $${costs.budget}`;
      document.getElementById('budget-fill').style.width = `${costs.percentUsed}%`;
    }
  } catch (error) {
    console.error('Error loading budget:', error);
  }
}
