// Popup script for YouTube Summarizer

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const optionsBtn = document.getElementById('options-btn');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Check if API key is configured
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');

  if (geminiApiKey) {
    statusEl.className = 'status success';
    statusEl.textContent = 'API key configured. Ready to summarize!';
    optionsBtn.textContent = 'Update API Key';
  } else {
    statusEl.className = 'status warning';
    statusEl.textContent = 'No API key configured. Please add your Gemini API key to get started.';
    optionsBtn.textContent = 'Configure API Key';
  }

  // Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show target content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });

      // Load history when switching to history tab
      if (targetTab === 'history') {
        loadHistory();
      }
    });
  });

  // Clear history button
  document.getElementById('clear-history').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      loadHistory();
    }
  });

  // History item click handler
  document.getElementById('history-list').addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (item) {
      const videoId = item.dataset.videoId;
      chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
    }
  });
});

async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('empty-history');
  const countEl = document.getElementById('history-count');
  const clearBtn = document.getElementById('clear-history');

  if (!history || history.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    countEl.textContent = '';
    clearBtn.style.display = 'none';
    return;
  }

  listEl.style.display = 'block';
  emptyEl.style.display = 'none';
  countEl.textContent = `${history.length} video${history.length === 1 ? '' : 's'} summarized`;
  clearBtn.style.display = 'block';

  listEl.innerHTML = history.map(entry => `
    <div class="history-item" data-video-id="${escapeHtml(entry.videoId)}">
      <img src="${escapeHtml(entry.thumbnail)}" alt="" class="thumbnail">
      <div class="info">
        <div class="title">${escapeHtml(entry.title)}</div>
        <div class="date">${formatDate(entry.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
