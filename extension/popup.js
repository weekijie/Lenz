// Lenz Popup Script

// Default hosted backend (free tier limits apply)
const DEFAULT_BACKEND_URL = 'https://lenz-iota.vercel.app';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const translateBtn = document.getElementById('translateBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const contextCard = document.getElementById('contextCard');
  const mangaTitle = document.getElementById('mangaTitle');
  const mangaTags = document.getElementById('mangaTags');
  const qualityMode = document.getElementById('qualityMode');
  const modeHint = document.getElementById('modeHint');
  const backendUrl = document.getElementById('backendUrl');
  const overlayStyle = document.getElementById('overlayStyle');
  const saveSettings = document.getElementById('saveSettings');

  // Load saved settings
  const settings = await chrome.storage.local.get([
    'backendUrl',
    'overlayStyle',
    'autoMode',
    'qualityMode'
  ]);

  if (settings.backendUrl) backendUrl.value = settings.backendUrl;
  if (settings.overlayStyle) overlayStyle.value = settings.overlayStyle;
  if (settings.qualityMode) {
    qualityMode.checked = settings.qualityMode;
    updateModeHint(true);
  }

  // Quality mode toggle
  qualityMode.addEventListener('change', async () => {
    await chrome.storage.local.set({ qualityMode: qualityMode.checked });
    updateModeHint(qualityMode.checked);
  });

  function updateModeHint(isQuality) {
    if (isQuality) {
      modeHint.textContent = 'Quality (~15-30s)';
      modeHint.classList.add('quality');
    } else {
      modeHint.textContent = 'Fast (~5s)';
      modeHint.classList.remove('quality');
    }
  }

  // Check if we're on a manga page and get context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab.url?.includes('comic-walker.com')) {
    // Get manga context from content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMangaContext' });
      if (response?.context) {
        showMangaContext(response.context);
      }
    } catch (e) {
      console.log('Content script not ready or no context available');
    }

    setStatus('ready', 'Ready to translate');
  } else {
    setStatus('error', 'Please open a manga on Comic Walker');
    translateBtn.disabled = true;
  }

  // Translate button click
  translateBtn.addEventListener('click', async () => {
    // Use custom URL if set, otherwise use default hosted backend
    const activeBackendUrl = backendUrl.value || settings.backendUrl || DEFAULT_BACKEND_URL;

    const modeLabel = qualityMode.checked ? 'Quality Mode' : 'Fast Mode';
    setStatus('loading', `Capturing page (${modeLabel})...`);
    translateBtn.disabled = true;
    translateBtn.classList.add('loading');

    try {
      // Send translate message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'translatePage',
        settings: {
          backendUrl: activeBackendUrl,
          overlayStyle: overlayStyle.value || settings.overlayStyle || 'solid',
          qualityMode: qualityMode.checked
        }
      });

      if (response?.success) {
        setStatus('ready', `Translated ${response.bubbleCount} bubbles`);
      } else {
        setStatus('error', response?.error || 'Translation failed');
      }
    } catch (error) {
      setStatus('error', 'Failed to communicate with page');
      console.error(error);
    } finally {
      translateBtn.disabled = false;
      translateBtn.classList.remove('loading');
    }
  });

  // Clear button click
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', async () => {
    try {
      setStatus('loading', 'Clearing overlays...');

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'clearOverlays'
      });

      setStatus('ready', 'Overlays cleared');

      // Flash button feedback
      const originalText = clearBtn.innerHTML;
      clearBtn.innerHTML = '<span class="btn-icon">✓</span><span class="btn-text">Cleared!</span>';
      setTimeout(() => {
        clearBtn.innerHTML = originalText;
      }, 1500);

    } catch (error) {
      console.error('Failed to clear overlays', error);
      setStatus('error', 'Failed to clear overlays');
    }
  });

  // Save settings
  saveSettings.addEventListener('click', async () => {
    await chrome.storage.local.set({
      backendUrl: backendUrl.value,
      overlayStyle: overlayStyle.value,
      qualityMode: qualityMode.checked
    });

    // Flash button to confirm
    saveSettings.textContent = 'Saved!';
    setTimeout(() => {
      saveSettings.textContent = 'Save Settings';
    }, 1500);
  });



  // Helper functions
  function setStatus(type, message) {
    statusIndicator.className = 'status-indicator';
    if (type === 'loading') statusIndicator.classList.add('loading');
    if (type === 'error') statusIndicator.classList.add('error');
    statusText.textContent = message;
  }

  function showMangaContext(context) {
    contextCard.classList.remove('hidden');
    mangaTitle.textContent = context.title || 'Unknown Manga';

    mangaTags.innerHTML = '';
    (context.tags || []).slice(0, 4).forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'context-tag';
      tagEl.textContent = tag;
      mangaTags.appendChild(tagEl);
    });
  }
});
