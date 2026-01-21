// Content Script for YouTube Summarizer
// Injects UI into YouTube pages and handles user interactions

const BUTTON_ID = 'yt-summarizer-btn';
const OVERLAY_ID = 'yt-summarizer-overlay';

// Initialize on page load
init();

function init() {
  // Listen for YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', onNavigate);

  // Also check on initial load
  if (isVideoPage()) {
    injectButton();
  }
}

function onNavigate() {
  // Clean up old UI
  removeExistingUI();

  // Inject button if on video page
  if (isVideoPage()) {
    // Delay to ensure DOM is ready
    setTimeout(injectButton, 500);
  }
}

function isVideoPage() {
  return window.location.pathname === '/watch';
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

function getVideoTitle() {
  return document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent
    || document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent
    || document.querySelector('#title h1 yt-formatted-string')?.textContent
    || document.title.replace(' - YouTube', '')
    || 'Untitled Video';
}

function removeExistingUI() {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
}

function injectButton() {
  // Don't inject if already exists
  if (document.getElementById(BUTTON_ID)) return;

  // Find the action buttons container
  const actionsContainer = document.querySelector('#actions #top-level-buttons-computed');
  if (!actionsContainer) {
    // Retry if container not found yet
    setTimeout(injectButton, 500);
    return;
  }

  // Create button
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.className = 'yt-summarizer-button';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
    <span>Summarize</span>
  `;
  button.addEventListener('click', handleSummarizeClick);

  actionsContainer.appendChild(button);
}

async function handleSummarizeClick() {
  const videoId = getVideoId();
  const title = getVideoTitle();
  if (!videoId) return;

  // Show loading overlay
  showOverlay({ loading: true });

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SUMMARY',
      videoId,
      title
    });

    if (response.error) {
      showOverlay({ error: response.error });
    } else {
      showOverlay({ summary: response.summary, cached: response.cached });
    }
  } catch (error) {
    showOverlay({ error: error.message || 'Failed to generate summary' });
  }
}

function formatSummaryAsMarkdown(summary, keyPoints, title) {
  let md = `# ${title}\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `## Key Points\n\n`;
  keyPoints.forEach((kp, i) => {
    md += `### ${i + 1}. ${kp.point}\n\n`;
    md += `${kp.importance}\n\n`;
  });
  return md;
}

function formatSummaryAsText(summary, keyPoints, title) {
  let text = `${title}\n${'='.repeat(title.length)}\n\n`;
  text += `SUMMARY\n${'-'.repeat(7)}\n${summary}\n\n`;
  text += `KEY POINTS\n${'-'.repeat(10)}\n`;
  keyPoints.forEach((kp, i) => {
    text += `${i + 1}. ${kp.point}\n`;
    text += `   ${kp.importance}\n\n`;
  });
  return text;
}

function downloadAsFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekToTime(seconds) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    // Start playing if paused
    if (video.paused) {
      video.play();
    }
  }
}

function showOverlay(state) {
  // Remove existing overlay
  document.getElementById(OVERLAY_ID)?.remove();

  // Create overlay container with Shadow DOM for style isolation
  const container = document.createElement('div');
  container.id = OVERLAY_ID;

  const shadow = container.attachShadow({ mode: 'open' });

  // Add styles to shadow DOM
  const styles = document.createElement('style');
  styles.textContent = `
    .overlay {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 400px;
      height: 500px;
      min-width: 300px;
      min-height: 200px;
      background: var(--yt-spec-base-background, #fff);
      color: var(--yt-spec-text-primary, #0f0f0f);
      border-radius: 12px;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      overflow: hidden;
      font-family: 'YouTube Sans', 'Roboto', sans-serif;
      resize: both;
      display: flex;
      flex-direction: column;
    }

    :host-context([dark]) .overlay,
    :host-context(html[dark]) .overlay {
      background: #212121;
      color: #fff;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }

    :host-context([dark]) .header,
    :host-context(html[dark]) .header {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }

    .header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: inherit;
      opacity: 0.7;
    }

    .close-btn:hover {
      opacity: 1;
    }

    .content {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      gap: 16px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-top-color: #065fd4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    :host-context([dark]) .spinner,
    :host-context(html[dark]) .spinner {
      border-color: rgba(255, 255, 255, 0.1);
      border-top-color: #3ea6ff;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      color: #c00;
      padding: 16px;
    }

    :host-context([dark]) .error,
    :host-context(html[dark]) .error {
      color: #ff4444;
    }

    .summary-title {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 12px 0;
    }

    .summary-text {
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .takeaways {
      margin: 0;
      padding-left: 20px;
    }

    .takeaways li {
      margin-bottom: 12px;
      line-height: 1.5;
    }

    .takeaways li strong {
      display: block;
      margin-bottom: 4px;
    }

    .importance {
      margin: 0;
      font-size: 14px;
      opacity: 0.8;
    }

    .takeaways-header {
      font-weight: 500;
      margin-bottom: 8px;
    }

    .cached-badge {
      background: #4caf50;
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    :host-context([dark]) .action-buttons,
    :host-context(html[dark]) .action-buttons {
      border-top-color: rgba(255, 255, 255, 0.1);
    }

    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      background: rgba(0, 0, 0, 0.05);
      color: inherit;
      transition: background 0.2s;
    }

    .action-btn:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    :host-context([dark]) .action-btn,
    :host-context(html[dark]) .action-btn {
      background: rgba(255, 255, 255, 0.1);
    }

    :host-context([dark]) .action-btn:hover,
    :host-context(html[dark]) .action-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .action-btn.success {
      background: #4caf50;
      color: white;
    }

    .export-dropdown {
      position: relative;
      flex: 1;
    }

    .export-menu {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      margin-bottom: 4px;
      background: var(--yt-spec-base-background, #fff);
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      display: none;
    }

    .export-menu.show {
      display: block;
    }

    :host-context([dark]) .export-menu,
    :host-context(html[dark]) .export-menu {
      background: #333;
    }

    .export-option {
      display: block;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: none;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      color: inherit;
    }

    .export-option:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    :host-context([dark]) .export-option:hover,
    :host-context(html[dark]) .export-option:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .share-dropdown {
      position: relative;
      flex: 1;
    }

    .share-menu {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      margin-bottom: 4px;
      background: var(--yt-spec-base-background, #fff);
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      display: none;
    }

    .share-menu.show {
      display: block;
    }

    :host-context([dark]) .share-menu,
    :host-context(html[dark]) .share-menu {
      background: #333;
    }

    .share-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: none;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      color: inherit;
    }

    .share-option:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    :host-context([dark]) .share-option:hover,
    :host-context(html[dark]) .share-option:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .chapters-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    :host-context([dark]) .chapters-section,
    :host-context(html[dark]) .chapters-section {
      border-top-color: rgba(255, 255, 255, 0.1);
    }

    .chapters-header {
      font-weight: 500;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chapters-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chapter-item {
      display: flex;
      gap: 10px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .chapter-item:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    :host-context([dark]) .chapter-item:hover,
    :host-context(html[dark]) .chapter-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .chapter-timestamp {
      font-family: monospace;
      font-size: 12px;
      color: #065fd4;
      background: rgba(6, 95, 212, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    :host-context([dark]) .chapter-timestamp,
    :host-context(html[dark]) .chapter-timestamp {
      color: #3ea6ff;
      background: rgba(62, 166, 255, 0.2);
    }

    .chapter-content {
      flex: 1;
      min-width: 0;
    }

    .chapter-title {
      font-weight: 500;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .chapter-summary {
      font-size: 12px;
      opacity: 0.8;
      line-height: 1.4;
    }
  `;

  // Build content based on state
  let content = '';

  if (state.loading) {
    content = `
      <div class="header">
        <h3>Summarizing Video...</h3>
        <button class="close-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="content">
        <div class="loading">
          <div class="spinner"></div>
          <span>Analyzing transcript...</span>
        </div>
      </div>
    `;
  } else if (state.error) {
    content = `
      <div class="header">
        <h3>Summary</h3>
        <button class="close-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="content">
        <div class="error">${escapeHtml(state.error)}</div>
      </div>
    `;
  } else if (state.summary) {
    const { summary, keyPoints, chapters } = state.summary;
    const keyPointsList = keyPoints.map(kp => `
      <li>
        <strong>${escapeHtml(kp.point)}</strong>
        <p class="importance">${escapeHtml(kp.importance)}</p>
      </li>
    `).join('');

    // Build chapters section if chapters exist
    const chaptersHtml = chapters && chapters.length > 0 ? `
      <div class="chapters-section">
        <div class="chapters-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z"/>
          </svg>
          Chapters
        </div>
        <div class="chapters-list">
          ${chapters.map(ch => `
            <div class="chapter-item" data-time="${ch.startTime}">
              <span class="chapter-timestamp">${formatTimestamp(ch.startTime)}</span>
              <div class="chapter-content">
                <div class="chapter-title">${escapeHtml(ch.title)}</div>
                <div class="chapter-summary">${escapeHtml(ch.summary)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    content = `
      <div class="header">
        <h3>Summary${state.cached ? '<span class="cached-badge">Cached</span>' : ''}</h3>
        <button class="close-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="content">
        <p class="summary-text">${escapeHtml(summary)}</p>
        <div class="takeaways-header">Key Points:</div>
        <ul class="takeaways">${keyPointsList}</ul>

        <div class="action-buttons">
          <button class="action-btn copy-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy
          </button>
          <div class="export-dropdown">
            <button class="action-btn export-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Export
            </button>
            <div class="export-menu">
              <button class="export-option" data-format="markdown">Markdown (.md)</button>
              <button class="export-option" data-format="text">Plain Text (.txt)</button>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <button class="action-btn watch-later-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
            </svg>
            Watch Later
          </button>
          <button class="action-btn skip-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
            Skip
          </button>
          <div class="share-dropdown">
            <button class="action-btn share-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
              Share
            </button>
            <div class="share-menu">
              <button class="share-option" data-platform="twitter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Share on X
              </button>
              <button class="share-option" data-platform="linkedin">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
                Share on LinkedIn
              </button>
            </div>
          </div>
        </div>

        ${chaptersHtml}
      </div>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = content;

  shadow.appendChild(styles);
  shadow.appendChild(overlay);

  // Add close button handler
  shadow.querySelector('.close-btn')?.addEventListener('click', () => {
    container.remove();
  });

  // Add copy/export handlers if summary is displayed
  if (state.summary) {
    const { summary, keyPoints } = state.summary;

    // Copy to clipboard handler
    const copyBtn = shadow.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const title = getVideoTitle();
        const text = formatSummaryAsText(summary, keyPoints, title);
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Copied!
          `;
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Copy
            `;
            copyBtn.classList.remove('success');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    }

    // Export dropdown toggle
    const exportBtn = shadow.querySelector('.export-btn');
    const exportMenu = shadow.querySelector('.export-menu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', () => {
        exportMenu.classList.toggle('show');
      });

      // Close menu when clicking outside
      shadow.addEventListener('click', (e) => {
        if (!e.target.closest('.export-dropdown')) {
          exportMenu.classList.remove('show');
        }
      });
    }

    // Export option handlers
    const exportOptions = shadow.querySelectorAll('.export-option');
    exportOptions.forEach(option => {
      option.addEventListener('click', () => {
        const format = option.dataset.format;
        const title = getVideoTitle();
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

        if (format === 'markdown') {
          const content = formatSummaryAsMarkdown(summary, keyPoints, title);
          downloadAsFile(content, `${safeTitle}_summary.md`);
        } else {
          const content = formatSummaryAsText(summary, keyPoints, title);
          downloadAsFile(content, `${safeTitle}_summary.txt`);
        }
        exportMenu.classList.remove('show');
      });
    });

    // Watch Later button handler
    const watchLaterBtn = shadow.querySelector('.watch-later-btn');
    if (watchLaterBtn) {
      watchLaterBtn.addEventListener('click', () => {
        // Find YouTube's save/watch later button
        const saveBtn = document.querySelector('ytd-menu-renderer button[aria-label*="Save"]')
          || document.querySelector('button[aria-label*="Save to playlist"]');

        if (saveBtn) {
          saveBtn.click();
          // YouTube opens a menu - find and click "Watch later"
          setTimeout(() => {
            const watchLaterOption = Array.from(document.querySelectorAll('yt-formatted-string'))
              .find(el => el.textContent?.includes('Watch later'));
            if (watchLaterOption) {
              watchLaterOption.closest('ytd-playlist-add-to-option-renderer, tp-yt-paper-item')?.click();
            }
          }, 300);
        }

        // Show feedback
        watchLaterBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Added!
        `;
        watchLaterBtn.classList.add('success');
        setTimeout(() => {
          watchLaterBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
            </svg>
            Watch Later
          `;
          watchLaterBtn.classList.remove('success');
        }, 2000);
      });
    }

    // Skip button handler - close overlay and go to next video
    const skipBtn = shadow.querySelector('.skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        container.remove();
        // Click YouTube's next button
        const nextBtn = document.querySelector('.ytp-next-button');
        if (nextBtn) {
          nextBtn.click();
        }
      });
    }

    // Share dropdown toggle
    const shareBtn = shadow.querySelector('.share-btn');
    const shareMenu = shadow.querySelector('.share-menu');
    if (shareBtn && shareMenu) {
      shareBtn.addEventListener('click', () => {
        shareMenu.classList.toggle('show');
        // Close export menu if open
        exportMenu?.classList.remove('show');
      });

      shadow.addEventListener('click', (e) => {
        if (!e.target.closest('.share-dropdown')) {
          shareMenu.classList.remove('show');
        }
      });
    }

    // Share option handlers
    const shareOptions = shadow.querySelectorAll('.share-option');
    shareOptions.forEach(option => {
      option.addEventListener('click', () => {
        const platform = option.dataset.platform;
        const title = getVideoTitle();
        const videoUrl = `https://www.youtube.com/watch?v=${getVideoId()}`;
        const summaryText = summary.substring(0, 200) + '...';

        let shareUrl;
        if (platform === 'twitter') {
          const text = `${title}\n\n${summaryText}`;
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(videoUrl)}`;
        } else if (platform === 'linkedin') {
          shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(videoUrl)}`;
        }

        if (shareUrl) {
          window.open(shareUrl, '_blank', 'width=600,height=400');
        }
        shareMenu.classList.remove('show');
      });
    });

    // Chapter timestamp click handlers
    const chapterItems = shadow.querySelectorAll('.chapter-item');
    chapterItems.forEach(item => {
      item.addEventListener('click', () => {
        const time = parseInt(item.dataset.time, 10);
        seekToTime(time);

        // Visual feedback - briefly highlight
        item.style.background = 'rgba(6, 95, 212, 0.2)';
        setTimeout(() => {
          item.style.background = '';
        }, 300);
      });
    });
  }

  // Add drag functionality
  const header = shadow.querySelector('.header');
  if (header) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.close-btn')) return;
      isDragging = true;
      const rect = overlay.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      overlay.style.right = 'auto';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      overlay.style.left = (e.clientX - offsetX) + 'px';
      overlay.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  document.body.appendChild(container);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
