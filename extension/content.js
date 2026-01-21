// Manga Lens Content Script
// Handles page interaction, canvas capture, and overlay rendering

(function () {
    'use strict';

    // State
    let mangaContext = null;
    let translationOverlays = [];
    let autoMode = false;
    let isTranslating = false;

    // Initialize when DOM is ready
    initialize();

    function initialize() {
        console.log('[Manga Lens] Content script loaded');

        // Extract manga context from the page
        extractMangaContext();

        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener(handleMessage);

        // Watch for page changes (new manga page loaded)
        observePageChanges();
    }

    // Extract manga metadata from Comic Walker page
    function extractMangaContext() {
        try {
            // Try to get manga title from page
            const titleEl = document.querySelector('h1, [class*="title"], [class*="Title"]');
            const descEl = document.querySelector('[class*="description"], [class*="Description"], [class*="synopsis"]');

            // Get tags/genres if available
            const tagEls = document.querySelectorAll('[class*="tag"], [class*="Tag"], [class*="genre"]');
            const tags = Array.from(tagEls).map(el => el.textContent.trim()).filter(t => t.length < 30);

            // Extract from URL pattern
            const urlMatch = window.location.href.match(/detail\/([^\/]+)/);
            const mangaId = urlMatch ? urlMatch[1] : null;

            mangaContext = {
                title: titleEl?.textContent?.trim() || document.title.split('|')[0].trim(),
                synopsis: descEl?.textContent?.trim() || '',
                tags: tags.slice(0, 5),
                mangaId: mangaId,
                url: window.location.href
            };

            console.log('[Manga Lens] Extracted context:', mangaContext);
        } catch (e) {
            console.error('[Manga Lens] Failed to extract context:', e);
            mangaContext = { title: document.title, tags: [], synopsis: '' };
        }
    }

    // Handle messages from popup/background
    function handleMessage(request, sender, sendResponse) {
        console.log('[Manga Lens] Received message:', request.action);

        switch (request.action) {
            case 'getMangaContext':
                sendResponse({ context: mangaContext });
                break;

            case 'translatePage':
                translatePage(request.settings)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Keep channel open for async response

            case 'setAutoMode':
                autoMode = request.enabled;
                console.log('[Manga Lens] Auto mode:', autoMode);
                sendResponse({ success: true });
                break;

            case 'clearOverlays':
                clearOverlays();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    // Main translation function
    async function translatePage(settings) {
        if (isTranslating) {
            return { success: false, error: 'Translation in progress' };
        }

        isTranslating = true;
        clearOverlays();

        try {
            // Step 1: Capture the manga canvas/image
            const captureResult = await capturePageImage();
            if (!captureResult || !captureResult.imageData) {
                throw new Error('Failed to capture page image');
            }

            console.log('[Manga Lens] Capture method:', captureResult.type);

            // Step 2: Send to backend for translation
            // Strip trailing slash from backend URL to avoid double slashes
            const baseUrl = settings.backendUrl.replace(/\/+$/, '');
            const response = await fetch(`${baseUrl}/api/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: captureResult.imageData,
                    context: mangaContext
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API error: ${error}`);
            }

            const result = await response.json();
            console.log('[Manga Lens] Translation result:', result);

            // Step 3: Render overlays
            if (result.bubbles && result.bubbles.length > 0) {
                renderOverlays(result.bubbles, settings.overlayStyle, captureResult);
                return { success: true, bubbleCount: result.bubbles.length };
            } else {
                return { success: true, bubbleCount: 0 };
            }

        } catch (error) {
            console.error('[Manga Lens] Translation error:', error);
            throw error;
        } finally {
            isTranslating = false;
        }
    }

    // Helper to check visibility (both CSS and Viewport Intersection)
    function isVisible(el) {
        if (!el) return false;

        // 1. Check CSS visibility
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        // 2. Check Viewport Intersection
        const rect = el.getBoundingClientRect();
        const viewHeight = (window.innerHeight || document.documentElement.clientHeight);
        const viewWidth = (window.innerWidth || document.documentElement.clientWidth);

        // Check if any part of the element is in the viewport
        const inViewport = (
            rect.top < viewHeight &&
            rect.bottom > 0 &&
            rect.left < viewWidth &&
            rect.right > 0
        );

        return inViewport;
    }

    // Find the largest canvas on the page (manga image)
    function findTargetCanvas() {
        const canvases = document.querySelectorAll('canvas');
        let targetCanvas = null;
        let maxArea = 0;
        let largeVisibleCanvases = 0;

        console.log(`[Manga Lens] Found ${canvases.length} canvases`);

        canvases.forEach((canvas, index) => {
            const area = canvas.width * canvas.height;
            const visible = isVisible(canvas);

            console.log(`[Manga Lens] Canvas ${index}: ${canvas.width}x${canvas.height} (Area: ${area}, Visible: ${visible})`);

            // Ignore small canvases (likely UI or icons)
            if (area > 10000 && visible) {
                largeVisibleCanvases++;
                if (area > maxArea) {
                    maxArea = area;
                    targetCanvas = canvas;
                }
            }
        });

        if (largeVisibleCanvases > 1) {
            console.log('[Manga Lens] Multiple large visible canvases detected (Double page spread?). Favoring full tab capture.');
            return null; // Force null to trigger tab capture
        }

        if (targetCanvas) {
            console.log(`[Manga Lens] Selected canvas: ${targetCanvas.width}x${targetCanvas.height}`);
        } else {
            console.warn('[Manga Lens] No suitable target canvas found');
        }

        return targetCanvas;
    }

    // Capture the manga page image
    async function capturePageImage() {
        const targetCanvas = findTargetCanvas();

        if (targetCanvas) {
            try {
                // Try to get canvas data directly
                const dataUrl = targetCanvas.toDataURL('image/jpeg', 0.85);
                return {
                    imageData: dataUrl,
                    type: 'canvas',
                    element: targetCanvas
                };
            } catch (e) {
                // Canvas might be tainted by cross-origin images
                console.warn('[Manga Lens] Canvas tainted, falling back to tab capture');
            }
        }

        // Fallback: Request tab capture from background script
        return new Promise((resolve, reject) => {
            // Capture viewport state/metrics at the moment of capture
            const meta = {
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                vw: window.innerWidth,
                vh: window.innerHeight
            };

            chrome.runtime.sendMessage({ action: 'captureTab' }, response => {
                if (response?.imageData) {
                    resolve({
                        imageData: response.imageData,
                        type: 'tab',
                        meta: meta
                    });
                } else {
                    reject(new Error('Tab capture failed'));
                }
            });
        });
    }

    // Render translation overlays
    function renderOverlays(bubbles, style = 'solid', captureResult = { type: 'canvas' }) {
        let container;

        if (captureResult.type === 'tab') {
            // usage: absolute positioning on body based on captured scroll pos
            container = document.body;
        } else {
            // usage: relative positioning on canvas parent
            container = captureResult.element ? captureResult.element.parentElement : findMangaContainer();
            if (container) {
                const computedStyle = window.getComputedStyle(container);
                if (computedStyle.position === 'static') {
                    container.style.position = 'relative';
                }
            }
        }

        if (!container) {
            console.error('[Manga Lens] Could not find container for overlays');
            return;
        }

        const containerRect = container.getBoundingClientRect();

        bubbles.forEach((bubble, index) => {
            const overlay = createOverlay(bubble, container, style, index, captureResult);
            container.appendChild(overlay);
            translationOverlays.push(overlay);
        });

        console.log('[Manga Lens] Rendered', bubbles.length, 'overlays');
    }

    // Find the manga content container
    function findMangaContainer() {
        const targetCanvas = findTargetCanvas();
        if (targetCanvas) {
            return targetCanvas.parentElement;
        }

        // Fallback to common container selectors
        const selectors = [
            '[class*="viewer"]',
            '[class*="reader"]',
            '[class*="manga"]',
            'main',
            '#root'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) return el;
        }

        return document.body;
    }

    // Create a single overlay element
    function createOverlay(bubble, container, style, index, captureResult) {
        const overlay = document.createElement('div');
        overlay.className = `manga-lens-overlay manga-lens-${style}`;
        overlay.dataset.index = index;

        const [x, y, width, height] = bubble.bbox;

        if (captureResult && captureResult.type === 'tab') {
            // Calculate absolute position based on viewport capture
            const { scrollX, scrollY, vw, vh } = captureResult.meta;

            // x, y, width, height are percentages of the viewport (at capture time)
            const leftPx = scrollX + (x / 100 * vw);
            const topPx = scrollY + (y / 100 * vh);
            const widthPx = (width / 100 * vw);
            const heightPx = (height / 100 * vh);

            overlay.style.position = 'absolute';
            overlay.style.left = `${leftPx}px`;
            overlay.style.top = `${topPx}px`;
            overlay.style.width = `${widthPx}px`;
            overlay.style.minHeight = `${heightPx}px`;
        } else {
            // Relative to container (original logic)
            overlay.style.left = `${x}%`;
            overlay.style.top = `${y}%`;
            overlay.style.width = `${width}%`;
            overlay.style.minHeight = `${height}%`;
        }

        // Add emotion class
        if (bubble.emotion) {
            overlay.classList.add(`manga-lens-emotion-${bubble.emotion}`);
        }

        // Create text content
        const textEl = document.createElement('div');
        textEl.className = 'manga-lens-text';
        textEl.textContent = bubble.english;
        overlay.appendChild(textEl);

        // Add cultural note button if available
        if (bubble.culturalNote) {
            const noteBtn = document.createElement('button');
            noteBtn.className = 'manga-lens-note-btn';
            noteBtn.textContent = '?';
            noteBtn.title = 'Cultural Note';
            noteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCulturalNote(bubble.culturalNote, e.target);
            });
            overlay.appendChild(noteBtn);
        }

        // Add speaker label if available
        if (bubble.speaker && bubble.speaker !== 'unknown') {
            const speakerEl = document.createElement('div');
            speakerEl.className = 'manga-lens-speaker';
            speakerEl.textContent = bubble.speaker;
            overlay.insertBefore(speakerEl, textEl);
        }

        return overlay;
    }



    // Show cultural note popup
    function showCulturalNote(note, anchor) {
        // Remove any existing note popups
        document.querySelectorAll('.manga-lens-note-popup').forEach(el => el.remove());

        const popup = document.createElement('div');
        popup.className = 'manga-lens-note-popup';
        popup.innerHTML = `
      <div class="manga-lens-note-header">📚 Cultural Note</div>
      <div class="manga-lens-note-content">${note}</div>
    `;

        // Position near the button
        const rect = anchor.getBoundingClientRect();
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 5}px`;

        document.body.appendChild(popup);

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 100);
    }

    // Clear all overlays
    function clearOverlays() {
        translationOverlays.forEach(overlay => overlay.remove());
        translationOverlays = [];
        document.querySelectorAll('.manga-lens-note-popup').forEach(el => el.remove());
    }

    // Watch for page navigation (chapter changes only)
    // NOTE: Auto-translate on page turn is disabled for now.
    // Users should click "Translate" button manually per page.
    function observePageChanges() {
        console.log('[Manga Lens] Starting page observation (URL changes only)...');

        // URL Observer (for chapter changes)
        let lastUrl = window.location.href;
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('[Manga Lens] URL changed, context reset');
                clearOverlays();
                extractMangaContext();
            }
        });
        urlObserver.observe(document.body, { childList: true, subtree: true });
    }

})();
