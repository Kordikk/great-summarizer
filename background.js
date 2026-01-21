// Service Worker for YouTube Summarizer Extension
// Handles Gemini API communication for video summarization

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
const MAX_HISTORY_SIZE = 100;

// Message listener - must return true for async responses
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SUMMARY') {
    handleSummaryRequest(request.videoId, request.title)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.type === 'TEST_API_KEY') {
    testApiKey(request.apiKey)
      .then(result => sendResponse({ valid: result }))
      .catch(error => sendResponse({ valid: false, error: error.message }));
    return true;
  }

  if (request.type === 'GET_HISTORY') {
    chrome.storage.local.get('summaryHistory')
      .then(({ summaryHistory = [] }) => sendResponse(summaryHistory));
    return true;
  }

  if (request.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ summaryHistory: [] })
      .then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.type === 'DELETE_HISTORY_ITEM') {
    chrome.storage.local.get('summaryHistory')
      .then(({ summaryHistory = [] }) => {
        const updated = summaryHistory.filter(e => e.videoId !== request.videoId);
        return chrome.storage.local.set({ summaryHistory: updated });
      })
      .then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleSummaryRequest(videoId, title) {
  // Check cache first
  const cached = await getCachedSummary(videoId);
  if (cached) {
    return { success: true, summary: cached.summary, cached: true };
  }

  // Get API key and language from storage
  const { geminiApiKey, summaryLanguage } = await chrome.storage.sync.get(['geminiApiKey', 'summaryLanguage']);
  if (!geminiApiKey) {
    throw new Error('API key not configured. Please set your Gemini API key in the extension options.');
  }

  const language = summaryLanguage || 'English';

  // Generate summary directly from video URL
  const summary = await generateSummary(videoId, geminiApiKey, language);

  // Save to cache
  await saveSummaryToCache(videoId, title || 'Untitled Video', summary);

  return { success: true, summary, cached: false };
}

async function getCachedSummary(videoId) {
  const { summaryHistory = [] } = await chrome.storage.local.get('summaryHistory');
  return summaryHistory.find(entry => entry.videoId === videoId);
}

async function saveSummaryToCache(videoId, title, summary) {
  const { summaryHistory = [] } = await chrome.storage.local.get('summaryHistory');

  // Remove existing entry for this video if present
  const filtered = summaryHistory.filter(e => e.videoId !== videoId);

  // Add new entry at the beginning
  const newEntry = {
    videoId,
    title,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    summary,
    timestamp: Date.now()
  };

  // Keep only most recent MAX_HISTORY_SIZE entries
  const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);

  await chrome.storage.local.set({ summaryHistory: updated });
}

async function generateSummary(videoId, apiKey, language) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            fileData: {
              fileUri: videoUrl,
              mimeType: 'video/mp4'
            }
          },
          {
            text: `Analyze this YouTube video and provide the response in ${language}:

1. A concise overall summary of the main content (2-3 paragraphs)
2. The key points with an explanation of why each point is important
3. If the video has distinct chapters or sections, identify them with:
   - Chapter title
   - Start time in seconds
   - A brief summary of that chapter (1-2 sentences)

Filter out sponsorships, engagement requests (likes/subscribes), and filler content. Focus on the core arguments, facts, and conclusions.`
          }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'A concise 2-3 paragraph summary of the main content'
            },
            keyPoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  point: { type: 'string', description: 'The key point' },
                  importance: { type: 'string', description: 'Why this point is important' }
                },
                required: ['point', 'importance']
              },
              description: '3-5 key points with explanations of their importance'
            },
            chapters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Chapter or section title' },
                  startTime: { type: 'number', description: 'Start time in seconds' },
                  summary: { type: 'string', description: 'Brief 1-2 sentence summary of this chapter' }
                },
                required: ['title', 'startTime', 'summary']
              },
              description: 'Video chapters/sections if identifiable (empty array if no clear chapters)'
            }
          },
          required: ['summary', 'keyPoints', 'chapters']
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `Gemini API request failed (${response.status})`;
    try {
      const error = JSON.parse(text);
      errorMessage = error.error?.message || errorMessage;
    } catch {
      // Response is not JSON (likely HTML error page)
      errorMessage = `${errorMessage}: ${text.substring(0, 100)}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content in Gemini response');
  }

  return JSON.parse(content);
}

async function testApiKey(apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview?key=${apiKey}`);
  return response.ok;
}
