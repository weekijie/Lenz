// Manga Lens Background Service Worker
// Handles tab capture and message routing

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Manga Lens BG] Received:', request.action);

    switch (request.action) {
        case 'captureTab':
            captureTabScreenshot(sender.tab?.id)
                .then(imageData => sendResponse({ imageData }))
                .catch(error => sendResponse({ error: error.message }));
            return true; // Keep channel open for async

        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Capture the visible area of the current tab
async function captureTabScreenshot(tabId) {
    try {
        // Get the tab's window ID
        const tab = tabId
            ? await chrome.tabs.get(tabId)
            : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

        if (!tab) {
            throw new Error('No active tab found');
        }

        // Capture visible tab area
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'jpeg',
            quality: 85
        });

        console.log('[Manga Lens BG] Captured tab screenshot');
        return dataUrl;

    } catch (error) {
        console.error('[Manga Lens BG] Capture error:', error);
        throw error;
    }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Manga Lens] Extension installed/updated:', details.reason);

    // Set default settings
    chrome.storage.local.get(['backendUrl'], (result) => {
        if (!result.backendUrl) {
            chrome.storage.local.set({
                backendUrl: '',
                overlayStyle: 'solid',
                autoMode: false
            });
        }
    });
});

// Log when service worker starts
console.log('[Manga Lens] Background service worker started');
