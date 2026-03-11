/**
 * Dashboard Frontend JavaScript
 */

let allContent = [];
let currentFilter = 'all';

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadSignals();
  loadContent();
  setupFilters();
});

/**
 * Load dashboard stats
 */
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    document.getElementById('stat-total').textContent = stats.total || 0;
    document.getElementById('stat-pending').textContent = stats.pending || 0;
    document.getElementById('stat-approved').textContent = stats.approved || 0;
    document.getElementById('stat-rejected').textContent = stats.rejected || 0;
    document.getElementById('stat-published').textContent = stats.published || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

/**
 * Load available signals
 */
async function loadSignals() {
  try {
    const [signalsResponse, contentResponse] = await Promise.all([
      fetch('/api/signals?limit=10&minScore=70'),
      fetch('/api/content')
    ]);

    const signalsData = await signalsResponse.json();
    const contentData = await contentResponse.json();

    const signals = signalsData.signals || [];
    const usedSignalIds = new Set(contentData.map(c => c.signal_id));

    const signalsList = document.getElementById('signals-list');

    if (signals.length === 0) {
      signalsList.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #666;">
          <h3 style="margin-bottom: 0.5rem;">No signals available</h3>
          <p>Run the intelligence collector to gather trending topics</p>
        </div>
      `;
      return;
    }

    signalsList.innerHTML = signals.map(signal => {
      const isUsed = usedSignalIds.has(signal.id);
      const sourceEmoji = {
        'rss_news': '📰',
        'youtube': '📺',
        'google_trends': '📈',
        'reddit': '💬',
        'instagram': '📸',
        'paa': '❓'
      }[signal.source] || '📄';

      return `
        <div class="signal-card">
          <div class="signal-score">${signal.relevance_score}/100</div>
          <div class="signal-title">${signal.title}</div>
          <div class="signal-source">${sourceEmoji} ${signal.source}</div>
          ${isUsed ? '<div class="signal-used">✅ Generated</div>' : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading signals:', error);
  }
}

/**
 * Refresh signals
 */
async function refreshSignals() {
  await loadSignals();
}

/**
 * Load all content
 */
async function loadContent() {
  try {
    const response = await fetch('/api/content');
    allContent = await response.json();

    // Sort by generated_at (newest first)
    allContent.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));

    displayContent();
  } catch (error) {
    console.error('Error loading content:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
  }
}

/**
 * Display content based on current filter
 */
function displayContent() {
  const grid = document.getElementById('content-grid');
  const loading = document.getElementById('loading');
  const emptyState = document.getElementById('empty-state');

  // Filter content
  let filtered = allContent;
  if (currentFilter !== 'all') {
    filtered = allContent.filter(item => item.status === currentFilter);
  }

  loading.style.display = 'none';

  if (filtered.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML = '';

  filtered.forEach(item => {
    const card = createContentCard(item);
    grid.appendChild(card);
  });
}

/**
 * Create content card element
 */
function createContentCard(item) {
  const card = document.createElement('div');
  card.className = 'content-card';

  // Get signal info
  const signalTitle = item.signal?.title || 'Unknown Signal';
  const signalScore = item.signal?.relevance_score || '?';
  const signalSource = item.signal?.source || '?';

  // Determine content type
  const isReel = item.content_type === 'reel';

  // Get content-specific data
  let caption, hashtags, previewHTML;

  if (isReel) {
    // Reel content
    caption = item.reel_script?.caption || 'No caption';
    hashtags = item.reel_script?.hashtags || [];
    const videoPath = item.reel_video_path;

    if (videoPath) {
      previewHTML = `
        <div class="carousel-preview" style="position: relative;">
          <video
            src="/${videoPath}"
            style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px 12px 0 0;"
            controls
            muted
            loop
          ></video>
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
            🎥 REEL
          </div>
        </div>
      `;
    } else {
      previewHTML = '';
    }
  } else {
    // Carousel content
    const images = item.carousel_images || [];
    caption = item.carousel_content?.caption || 'No caption';
    hashtags = item.carousel_content?.hashtags || [];

    if (images.length > 0) {
      previewHTML = `
        <div class="carousel-preview" id="carousel-${item.id}">
          <img src="/${images[0]}" alt="Slide 1" class="carousel-slide active">
          <div class="carousel-nav">
            ${images.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></div>`).join('')}
          </div>
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
            📸 CAROUSEL
          </div>
        </div>
      `;
    } else {
      previewHTML = '';
    }
  }

  // Status badge
  const statusClass = `status-${item.status}`;
  const statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1);

  // Actions based on status
  let actionsHTML = '';
  if (item.status === 'pending') {
    actionsHTML = `
      <div class="actions">
        <button class="btn btn-approve" onclick="approveContent(${item.id})">✓ Approve</button>
        <button class="btn btn-reject" onclick="rejectContent(${item.id})">✗ Reject</button>
      </div>
    `;
  } else if (item.status === 'approved') {
    actionsHTML = `
      <div class="actions">
        <button class="btn btn-view" onclick="viewContent(${item.id})">View Details</button>
      </div>
    `;
  } else {
    actionsHTML = `
      <div class="actions">
        <button class="btn btn-view" onclick="viewContent(${item.id})">View Details</button>
      </div>
    `;
  }

  card.innerHTML = `
    ${previewHTML}
    <div class="content-info">
      <div class="status-badge ${statusClass}">${statusText}</div>
      <h3 class="content-title">${signalTitle}</h3>
      <div class="content-meta">
        <span>📊 Score: ${signalScore}</span>
        <span>📁 ${signalSource}</span>
        <span>🆔 #${item.id}</span>
      </div>
      <div class="caption">${caption}</div>
      <div class="hashtags">${hashtags.slice(0, 5).map(tag => `#${tag}`).join(' ')}</div>
      ${actionsHTML}
    </div>
  `;

  // Setup carousel navigation (only for carousels)
  if (!isReel && item.carousel_images && item.carousel_images.length > 1) {
    setTimeout(() => setupCarousel(item.id, item.carousel_images), 0);
  }

  return card;
}

/**
 * Setup carousel navigation for a card
 */
function setupCarousel(contentId, images) {
  const carousel = document.getElementById(`carousel-${contentId}`);
  if (!carousel) return;

  const dots = carousel.querySelectorAll('.carousel-dot');
  let currentSlide = 0;

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      currentSlide = index;
      updateCarousel();
    });
  });

  function updateCarousel() {
    const img = carousel.querySelector('img');
    img.src = `/${images[currentSlide]}`;

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  // Auto-advance every 3 seconds
  setInterval(() => {
    currentSlide = (currentSlide + 1) % images.length;
    updateCarousel();
  }, 3000);
}

/**
 * Setup filter buttons
 */
function setupFilters() {
  const buttons = document.querySelectorAll('.filter-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = btn.dataset.filter;
      displayContent();
    });
  });
}

/**
 * Approve content
 */
async function approveContent(id) {
  if (!confirm('Approve this content?')) return;

  try {
    const response = await fetch(`/api/content/${id}/approve`, {
      method: 'POST'
    });

    if (response.ok) {
      await loadStats();
      await loadSignals();
      await loadContent();
    } else {
      alert('Error approving content');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error approving content');
  }
}

/**
 * Reject content
 */
async function rejectContent(id) {
  const reason = prompt('Reason for rejection (optional):');
  if (reason === null) return; // Cancelled

  try {
    const response = await fetch(`/api/content/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'No reason provided' })
    });

    if (response.ok) {
      await loadStats();
      await loadSignals();
      await loadContent();
    } else {
      alert('Error rejecting content');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error rejecting content');
  }
}

/**
 * View content details in modal
 */
async function viewContent(id) {
  try {
    const response = await fetch(`/api/content/${id}`);
    const content = await response.json();

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = content.signal?.title || 'Content Details';

    const signal = content.signal;
    const isReel = content.content_type === 'reel';

    let contentHTML = '';

    if (isReel) {
      // Reel content
      const reelScript = content.reel_script;
      const videoPath = content.reel_video_path;

      const scenesHTML = (reelScript?.scenes || []).map((scene, i) => `
        <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px; margin-bottom: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">Scene ${scene.sceneNumber}: ${scene.sceneType.toUpperCase()}</h4>
          <p><strong>Narration:</strong> ${scene.narration}</p>
          <p><strong>Caption:</strong> ${scene.captionText}</p>
          <p><strong>Duration:</strong> ~${scene.durationEstimate}s</p>
          <p><strong>Search terms:</strong> ${scene.pexelsSearchTerms.join(', ')}</p>
        </div>
      `).join('');

      contentHTML = `
        <div style="margin-bottom: 2rem;">
          <h3>🎥 Reel Video</h3>
          ${videoPath ? `
            <video
              src="/${videoPath}"
              controls
              style="width: 100%; max-width: 400px; border-radius: 12px; margin-top: 1rem;"
            ></video>
          ` : '<p>No video available</p>'}
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Caption</h3>
          <p style="line-height: 1.6;">${reelScript?.caption || 'No caption'}</p>
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Hashtags</h3>
          <p style="color: #667eea;">${(reelScript?.hashtags || []).map(tag => `#${tag}`).join(' ')}</p>
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Script Details</h3>
          <p><strong>Hook Formula:</strong> ${reelScript?.hookFormula || 'N/A'}</p>
          <p><strong>Target Duration:</strong> ${reelScript?.totalDurationTarget || 0}s</p>
          <p><strong>Number of Scenes:</strong> ${reelScript?.scenes?.length || 0}</p>
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Scenes Breakdown</h3>
          ${scenesHTML}
        </div>
      `;
    } else {
      // Carousel content
      const images = content.carousel_images || [];
      const carouselContent = content.carousel_content;

      const slidesHTML = images.map((img, i) => `
        <div>
          <h3>Slide ${i + 1}${i === 0 ? ' (Hook)' : i === images.length - 1 ? ' (CTA)' : ''}</h3>
          <img src="/${img}" class="slide-full" alt="Slide ${i + 1}">
        </div>
      `).join('');

      contentHTML = `
        <div style="margin-bottom: 2rem;">
          <h3>Caption</h3>
          <p style="line-height: 1.6;">${carouselContent?.caption || 'No caption'}</p>
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Hashtags</h3>
          <p style="color: #667eea;">${(carouselContent?.hashtags || []).map(tag => `#${tag}`).join(' ')}</p>
        </div>

        <div style="margin-bottom: 2rem;">
          <h3>Slides</h3>
          ${slidesHTML}
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h3>Source Signal</h3>
        <p><strong>Title:</strong> ${signal?.title || 'N/A'}</p>
        <p><strong>Description:</strong> ${signal?.description || 'N/A'}</p>
        <p><strong>Relevance Score:</strong> ${signal?.relevance_score || '?'}/100</p>
        <p><strong>Reason:</strong> ${signal?.relevance_reason || 'N/A'}</p>
        <p><strong>Source:</strong> <a href="${signal?.url || '#'}" target="_blank">${signal?.url || 'N/A'}</a></p>
      </div>

      ${contentHTML}

      <div>
        <h3>Metadata</h3>
        <p><strong>Type:</strong> ${isReel ? '🎥 Reel' : '📸 Carousel'}</p>
        <p><strong>Status:</strong> ${content.status}</p>
        <p><strong>Generated:</strong> ${new Date(content.generated_at).toLocaleString()}</p>
        ${content.approved_at ? `<p><strong>Approved:</strong> ${new Date(content.approved_at).toLocaleString()}</p>` : ''}
        ${content.rejected_at ? `<p><strong>Rejected:</strong> ${new Date(content.rejected_at).toLocaleString()}</p>` : ''}
        ${content.rejection_reason ? `<p><strong>Rejection Reason:</strong> ${content.rejection_reason}</p>` : ''}
      </div>
    `;

    modal.classList.add('active');
  } catch (error) {
    console.error('Error loading content details:', error);
    alert('Error loading content details');
  }
}

/**
 * Close modal
 */
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
}

// Close modal on background click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') {
    closeModal();
  }
});

/**
 * Show generation form
 */
function showGenerateInstructions() {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  modalTitle.textContent = '✨ Generate Carousels';

  modalBody.innerHTML = `
    <div style="line-height: 1.8;">
      <p style="margin-bottom: 2rem; color: #666;">
        Select how many carousels to generate from your top-scoring signals:
      </p>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">
          Number of carousels:
        </label>
        <input
          type="number"
          id="gen-limit"
          value="3"
          min="1"
          max="50"
          style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
        />
      </div>

      <div style="margin-bottom: 2rem;">
        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">
          Minimum relevance score:
        </label>
        <input
          type="number"
          id="gen-score"
          value="80"
          min="0"
          max="100"
          style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
        />
        <small style="color: #666;">Signals with scores below this will be skipped</small>
      </div>

      <div id="gen-status" style="display: none; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
      </div>

      <div style="display: flex; gap: 1rem;">
        <button
          class="btn btn-view"
          style="flex: 1; padding: 1rem; font-size: 1.1rem;"
          onclick="startGeneration()"
          id="gen-button"
        >
          🚀 Start Generation
        </button>
        <button
          class="btn"
          style="flex: 0 0 auto; padding: 1rem; background: #e0e0e0; color: #333;"
          onclick="closeModal()"
        >
          Cancel
        </button>
      </div>

      <p style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 8px; color: #856404;">
        <strong>⚡ Cost:</strong> ~$0.0015 per carousel using GPT-4o-mini<br>
        <strong>⏱️ Time:</strong> ~10-15 seconds per carousel
      </p>
    </div>
  `;

  modal.classList.add('active');
}

/**
 * Show reel generation form
 */
function showGenerateReelInstructions() {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  modalTitle.textContent = '🎥 Generate Reels';

  modalBody.innerHTML = `
    <div style="line-height: 1.8;">
      <p style="margin-bottom: 2rem; color: #666;">
        Generate Instagram Reels with AI voiceover, B-roll video, and captions:
      </p>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">
          Number of reels:
        </label>
        <input
          type="number"
          id="gen-reel-limit"
          value="1"
          min="1"
          max="10"
          style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
        />
      </div>

      <div style="margin-bottom: 2rem;">
        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">
          Minimum relevance score:
        </label>
        <input
          type="number"
          id="gen-reel-score"
          value="80"
          min="0"
          max="100"
          style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;"
        />
        <small style="color: #666;">Signals with scores below this will be skipped</small>
      </div>

      <div id="gen-reel-status" style="display: none; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
      </div>

      <div style="display: flex; gap: 1rem;">
        <button
          class="btn btn-view"
          style="flex: 1; padding: 1rem; font-size: 1.1rem;"
          onclick="startReelGeneration()"
          id="gen-reel-button"
        >
          🚀 Start Generation
        </button>
        <button
          class="btn"
          style="flex: 0 0 auto; padding: 1rem; background: #e0e0e0; color: #333;"
          onclick="closeModal()"
        >
          Cancel
        </button>
      </div>

      <p style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 8px; color: #856404;">
        <strong>⚡ Cost:</strong> ~$0.12 per reel (OpenAI + ElevenLabs)<br>
        <strong>⏱️ Time:</strong> ~60-120 seconds per reel<br>
        <strong>🎬 Output:</strong> 30-45s MP4 video (1080x1920)
      </p>
    </div>
  `;

  modal.classList.add('active');
}

/**
 * Start reel generation
 */
async function startReelGeneration() {
  const limit = parseInt(document.getElementById('gen-reel-limit').value);
  const minScore = parseInt(document.getElementById('gen-reel-score').value);
  const button = document.getElementById('gen-reel-button');
  const status = document.getElementById('gen-reel-status');

  // Validate inputs
  if (!limit || limit < 1) {
    alert('Please enter a valid number of reels (minimum 1)');
    return;
  }

  if (!minScore || minScore < 0 || minScore > 100) {
    alert('Please enter a valid score (0-100)');
    return;
  }

  // Disable button and show status
  button.disabled = true;
  button.textContent = '⏳ Generating...';
  status.style.display = 'block';
  status.style.background = '#d1ecf1';
  status.style.color = '#0c5460';
  status.innerHTML = `
    <strong>🎥 Generation started!</strong><br>
    Generating ${limit} reel(s) from signals with score ≥ ${minScore}...<br>
    <small>This will take about ${limit * 90} seconds. The page will refresh automatically when complete.</small>
  `;

  try {
    const response = await fetch('/api/generate-reel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, minScore })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Generation failed');
    }

    status.style.background = '#d4edda';
    status.style.color = '#155724';

    const estimatedTime = result.count * 90; // 90 seconds per reel

    status.innerHTML = `
      <strong>✅ ${result.message}</strong><br>
      Generating ${result.count} reel(s) in the background...<br>
      <small>Estimated time: ${estimatedTime} seconds. The page will auto-refresh when complete.</small>
    `;

    // Auto-refresh after delay (90 seconds per reel + 10 second buffer)
    setTimeout(() => {
      window.location.reload();
    }, (estimatedTime + 10) * 1000);

  } catch (error) {
    status.style.background = '#f8d7da';
    status.style.color = '#721c24';
    status.innerHTML = `
      <strong>❌ Error:</strong> ${error.message}<br>
      ${error.message.includes('No signals') ? '<small>Try lowering the minimum score or run the intelligence collector first.</small>' : ''}
    `;
    button.disabled = false;
    button.textContent = '🚀 Start Generation';
  }
}

/**
 * Start carousel generation
 */
async function startGeneration() {
  const limit = parseInt(document.getElementById('gen-limit').value);
  const minScore = parseInt(document.getElementById('gen-score').value);
  const button = document.getElementById('gen-button');
  const status = document.getElementById('gen-status');

  // Validate inputs
  if (!limit || limit < 1) {
    alert('Please enter a valid number of carousels (minimum 1)');
    return;
  }

  if (!minScore || minScore < 0 || minScore > 100) {
    alert('Please enter a valid score (0-100)');
    return;
  }

  // Disable button and show status
  button.disabled = true;
  button.textContent = '⏳ Generating...';
  status.style.display = 'block';
  status.style.background = '#d1ecf1';
  status.style.color = '#0c5460';
  status.innerHTML = `
    <strong>🎨 Generation started!</strong><br>
    Generating ${limit} carousel(s) from signals with score ≥ ${minScore}...<br>
    <small>This will take about ${limit * 12} seconds. The page will refresh automatically when complete.</small>
  `;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, minScore })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Generation failed');
    }

    status.style.background = '#d4edda';
    status.style.color = '#155724';

    const estimatedTime = result.count * 15; // 15 seconds per carousel

    status.innerHTML = `
      <strong>✅ ${result.message}</strong><br>
      Generating ${result.count} carousel(s) in the background...<br>
      <small>Estimated time: ${estimatedTime} seconds. The page will auto-refresh when complete.</small>
    `;

    // Auto-refresh after delay (15 seconds per carousel + 5 second buffer)
    setTimeout(() => {
      window.location.reload();
    }, (estimatedTime + 5) * 1000);

  } catch (error) {
    status.style.background = '#f8d7da';
    status.style.color = '#721c24';
    status.innerHTML = `
      <strong>❌ Error:</strong> ${error.message}<br>
      ${error.message.includes('No signals') ? '<small>Try lowering the minimum score or run the intelligence collector first.</small>' : ''}
    `;
    button.disabled = false;
    button.textContent = '🚀 Start Generation';
  }
}
