// Lenz Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const translateBtn = document.getElementById('translateBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const contextCard = document.getElementById('contextCard');
  const mangaTitle = document.getElementById('mangaTitle');
  const mangaTags = document.getElementById('mangaTags');
  const autoMode = document.getElementById('autoMode');
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
  if (settings.autoMode) autoMode.checked = settings.autoMode;
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
    if (!settings.backendUrl && !backendUrl.value) {
      setStatus('error', 'Please set backend URL in settings');
      return;
    }

    const modeLabel = qualityMode.checked ? 'Quality Mode' : 'Fast Mode';
    setStatus('loading', `Capturing page (${modeLabel})...`);
    translateBtn.disabled = true;
    translateBtn.classList.add('loading');

    try {
      // Send translate message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'translatePage',
        settings: {
          backendUrl: backendUrl.value || settings.backendUrl,
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

  // Save settings
  saveSettings.addEventListener('click', async () => {
    await chrome.storage.local.set({
      backendUrl: backendUrl.value,
      overlayStyle: overlayStyle.value,
      autoMode: autoMode.checked,
      qualityMode: qualityMode.checked
    });
    
    // Flash button to confirm
    saveSettings.textContent = 'Saved!';
    setTimeout(() => {
      saveSettings.textContent = 'Save Settings';
    }, 1500);
  });

  // Auto mode toggle
  autoMode.addEventListener('change', async () => {
    await chrome.storage.local.set({ autoMode: autoMode.checked });
    
    // Notify content script
    chrome.tabs.sendMessage(tab.id, { 
      action: 'setAutoMode', 
      enabled: autoMode.checked 
    });
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
