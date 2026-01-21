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

    // Show loading indicator
    function showLoading() {
        hideLoading(); // Remove any existing
        const loader = document.createElement('div');
        loader.className = 'manga-lens-loading';
        loader.id = 'manga-lens-loader';
        loader.innerHTML = '<div class="manga-lens-loading-spinner"></div><span>Translating...</span>';
        document.body.appendChild(loader);
    }

    function hideLoading() {
        document.getElementById('manga-lens-loader')?.remove();
    }

    // Show error toast notification
    function showErrorToast(type, title, message, autoClose = true) {
        // Remove any existing toast
        document.querySelector('.manga-lens-error-toast')?.remove();
        
        const toast = document.createElement('div');
        toast.className = `manga-lens-error-toast ${type}`;
        
        const icon = type === 'warning' ? '&#9888;' : '&#10060;';
        
        toast.innerHTML = `
            <button class="manga-lens-error-close">&times;</button>
            <div class="manga-lens-error-header">
                <span class="manga-lens-error-icon">${icon}</span>
                <span class="manga-lens-error-title">${title}</span>
            </div>
            <div class="manga-lens-error-message">${message}</div>
        `;
        
        document.body.appendChild(toast);
        
        // Close button handler
        toast.querySelector('.manga-lens-error-close').addEventListener('click', () => {
            toast.remove();
        });
        
        // Auto-close after 8 seconds
        if (autoClose) {
            setTimeout(() => {
                toast.remove();
            }, 8000);
        }
    }

    // Handle API errors with visual feedback
    function handleApiError(statusCode, errorData) {
        const code = errorData?.code || '';
        const message = errorData?.message || errorData?.error || 'An error occurred';
        
        if (statusCode === 429 || code === 'RATE_LIMIT') {
            showErrorToast(
                'warning',
                'Rate Limit Exceeded',
                `${message}<br><br><strong>Tip:</strong> Wait about a minute before trying again.`
            );
        } else if (statusCode === 503 || code === 'SERVICE_UNAVAILABLE') {
            showErrorToast(
                'warning',
                'Service Temporarily Unavailable',
                `${message}<br><br><strong>Tip:</strong> The API is experiencing high load. Try again in a few seconds.`
            );
        } else if (statusCode === 404 || code === 'NOT_FOUND') {
            showErrorToast(
                'error',
                'Service Not Found',
                message
            );
        } else {
            showErrorToast(
                'error',
                'Translation Failed',
                message
            );
        }
    }

    // Main translation function - with streaming support
    async function translatePage(settings, retryCount = 0) {
        if (isTranslating) {
            return { success: false, error: 'Translation in progress' };
        }

        isTranslating = true;
        clearOverlays();
        showLoading();

        try {
            // Step 1: Capture the manga canvas/image
            const captureResult = await capturePageImage();
            if (!captureResult || !captureResult.imageData) {
                throw new Error('Failed to capture page image');
            }

            console.log('[Manga Lens] Capture method:', captureResult.type);

            // Step 2: Send to backend for translation (try streaming first)
            const baseUrl = settings.backendUrl.replace(/\/+$/, '');
            
            // Try streaming endpoint first for progressive rendering
            try {
                const result = await translateWithStreaming(baseUrl, captureResult, settings);
                return result;
            } catch (streamError) {
                console.log('[Manga Lens] Streaming failed, falling back to regular endpoint:', streamError.message);
                // Fall back to regular endpoint
                return await translateWithRegularEndpoint(baseUrl, captureResult, settings, retryCount);
            }

        } catch (error) {
            console.error('[Manga Lens] Translation error:', error);
            throw error;
        } finally {
            isTranslating = false;
            hideLoading();
        }
    }

    // Streaming translation - bubbles appear progressively
    async function translateWithStreaming(baseUrl, captureResult, settings) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

            fetch(`${baseUrl}/api/translate-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: captureResult.imageData,
                    context: mangaContext
                }),
                signal: controller.signal
            }).then(async response => {
                if (!response.ok) {
                    clearTimeout(timeoutId);
                    // Parse error response and handle it
                    const errorData = await response.json().catch(() => ({}));
                    handleApiError(response.status, errorData);
                    reject(new Error(`Stream API error: ${response.status}`));
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let bubbleCount = 0;

                // Get container for rendering
                let container;
                if (captureResult.type === 'tab') {
                    container = document.body;
                } else {
                    container = captureResult.element ? captureResult.element.parentElement : findMangaContainer();
                    if (container) {
                        const computedStyle = window.getComputedStyle(container);
                        if (computedStyle.position === 'static') {
                            container.style.position = 'relative';
                        }
                    }
                }

                function processStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            clearTimeout(timeoutId);
                            console.log('[Manga Lens] Stream complete:', bubbleCount, 'bubbles');
                            resolve({ success: true, bubbleCount });
                            return;
                        }

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    if (data.type === 'bubble') {
                                        // Render bubble immediately
                                        const overlay = createOverlay(
                                            data.bubble, 
                                            container, 
                                            settings.overlayStyle, 
                                            bubbleCount, 
                                            captureResult
                                        );
                                        container.appendChild(overlay);
                                        translationOverlays.push(overlay);
                                        bubbleCount++;
                                        console.log(`[Manga Lens] Rendered bubble ${bubbleCount}`);
                                    } else if (data.type === 'done') {
                                        clearTimeout(timeoutId);
                                        resolve({ success: true, bubbleCount: data.count });
                                        return;
                                    } else if (data.type === 'error') {
                                        clearTimeout(timeoutId);
                                        handleApiError(null, data);
                                        reject(new Error(data.message));
                                        return;
                                    }
                                } catch (e) {
                                    console.warn('[Manga Lens] Failed to parse SSE:', line);
                                }
                            }
                        }

                        processStream();
                    }).catch(err => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });
                }

                processStream();
            }).catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }

    // Regular (non-streaming) translation
    async function translateWithRegularEndpoint(baseUrl, captureResult, settings, retryCount) {
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
            const errorData = await response.json().catch(() => ({}));

            // Auto-retry on 503 (overloaded) errors
            if (response.status === 503 && retryCount < 2) {
                console.log(`[Manga Lens] Model overloaded, retrying in 5s... (attempt ${retryCount + 1})`);
                hideLoading();
                isTranslating = false;
                await new Promise(r => setTimeout(r, 5000));
                return translatePage(settings, retryCount + 1);
            }

            // Show error toast for all other errors
            handleApiError(response.status, errorData);
            throw new Error(`API error: ${response.status}`);
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

    // Resize image for faster API processing
    function resizeImageForAPI(dataUrl, maxWidth = 800) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Only resize if larger than maxWidth
                if (img.width <= maxWidth) {
                    resolve(dataUrl);
                    return;
                }

                const canvas = document.createElement('canvas');
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * ratio;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const resized = canvas.toDataURL('image/jpeg', 0.6);
                console.log(`[Manga Lens] Resized image: ${img.width}x${img.height} → ${canvas.width}x${canvas.height}`);
                resolve(resized);
            };
            img.src = dataUrl;
        });
    }

    // Capture the manga page image
    async function capturePageImage() {
        const targetCanvas = findTargetCanvas();

        if (targetCanvas) {
            try {
                // Try to get canvas data directly
                const dataUrl = targetCanvas.toDataURL('image/jpeg', 0.85);
                const resized = await resizeImageForAPI(dataUrl);
                return {
                    imageData: resized,
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

            chrome.runtime.sendMessage({ action: 'captureTab' }, async (response) => {
                if (response?.imageData) {
                    // Resize tab capture for faster processing
                    const resized = await resizeImageForAPI(response.imageData);
                    resolve({
                        imageData: resized,
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

        // Batch all DOM insertions using DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        const newOverlays = [];

        bubbles.forEach((bubble, index) => {
            const overlay = createOverlay(bubble, container, style, index, captureResult);
            fragment.appendChild(overlay);  // Appends to in-memory fragment (no reflow)
            newOverlays.push(overlay);
        });

        // Single DOM write triggers one reflow, scheduled at optimal render time
        requestAnimationFrame(() => {
            container.appendChild(fragment);
            translationOverlays.push(...newOverlays);
            console.log('[Manga Lens] Rendered', bubbles.length, 'overlays');
        });
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

        // Create header (safe DOM construction)
        const header = document.createElement('div');
        header.className = 'manga-lens-note-header';
        header.textContent = '📚 Cultural Note';

        // Create content (safe - uses textContent to prevent XSS)
        const content = document.createElement('div');
        content.className = 'manga-lens-note-content';
        content.textContent = note;

        popup.appendChild(header);
        popup.appendChild(content);

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
