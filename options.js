// Options page script for YouTube Summarizer

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const languageSelect = document.getElementById('language');
  const toggleBtn = document.getElementById('toggle-visibility');
  const testBtn = document.getElementById('test-btn');
  const saveBtn = document.getElementById('save-btn');
  const messageEl = document.getElementById('message');

  // Load existing settings
  const { geminiApiKey, summaryLanguage } = await chrome.storage.sync.get(['geminiApiKey', 'summaryLanguage']);
  if (geminiApiKey) {
    apiKeyInput.value = geminiApiKey;
  }
  if (summaryLanguage) {
    languageSelect.value = summaryLanguage;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
  });

  // Test API key
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showMessage('Please enter an API key', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      // Test the API key directly via fetch
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview?key=${apiKey}`);

      if (response.ok) {
        showMessage('API key is valid!', 'success');
      } else {
        showMessage('API key is invalid. Please check and try again.', 'error');
      }
    } catch (error) {
      showMessage('Error testing API key: ' + error.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Key';
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const language = languageSelect.value;

    if (!apiKey) {
      showMessage('Please enter an API key', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey, summaryLanguage: language });
      showMessage('Settings saved successfully!', 'success');
    } catch (error) {
      showMessage('Error saving settings: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 5000);
  }
});
