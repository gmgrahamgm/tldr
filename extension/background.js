// TOS Helper - Background Service Worker
// Handles extension lifecycle, messaging, and API communication

console.log('TOS Helper: Background service worker initialized');

// Backend URL with environment detection
let BACKEND_URL = null;

// Initialize backend URL on startup
(async () => {
    BACKEND_URL = await getBackendUrl();
    console.log('TOS Helper: Backend URL configured:', BACKEND_URL);

    // Start keep-alive ping for production backend
    if (BACKEND_URL.includes('onrender.com')) {
        startKeepAlivePing();
    }
})();

// Track cancelled request IDs to prevent caching
const cancelledRequests = new Set();

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    console.log('TOS Helper: Extension icon clicked', { tabId: tab.id, url: tab.url });

    try {
        // Inject the popup panel into the current tab
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                if (window.showPopupPanel) {
                    window.showPopupPanel();
                }
            }
        });

        console.log('TOS Helper: Popup panel injected into tab', tab.id);
    } catch (error) {
        console.error('TOS Helper: Failed to inject popup panel', error);
    }
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('TOS Helper: Extension installed/updated', details.reason);

    if (details.reason === 'install') {
        console.log('TOS Helper: First time installation - setting up defaults');
        // Initialize default settings
        chrome.storage.local.set({
            enabled: true,
            disabledSites: [],
            tosCache: {} // Cache structure: { [domain]: { timestamp, url, analysis } }
        });
    }
});

/**
 * Get cached analysis for a domain
 */
async function getCachedAnalysis(domain) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tosCache'], (result) => {
            const cache = result.tosCache || {};
            resolve(cache[domain] || null);
        });
    });
}

/**
 * Save analysis to cache
 */
async function saveCachedAnalysis(domain, url, analysis) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tosCache'], (result) => {
            const cache = result.tosCache || {};
            cache[domain] = {
                timestamp: new Date().toISOString(),
                url: url,
                analysis: analysis
            };
            chrome.storage.local.set({ tosCache: cache }, () => {
                console.log('TOS Helper: Analysis cached for', domain);
                resolve();
            });
        });
    });
}

/**
 * Clear cache for specific domain and remove from disabled sites
 */
async function clearCacheForDomain(domain) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tosCache', 'disabledSites'], (result) => {
            const cache = result.tosCache || {};
            const disabledSites = result.disabledSites || [];

            // Remove from cache
            delete cache[domain];

            // Remove from disabled sites list
            const updatedDisabledSites = disabledSites.filter(site => site !== domain);

            chrome.storage.local.set({
                tosCache: cache,
                disabledSites: updatedDisabledSites
            }, () => {
                console.log('TOS Helper: Cache cleared for', domain);
                if (disabledSites.includes(domain)) {
                    console.log('TOS Helper: Removed', domain, 'from disabled sites list');
                }
                resolve({ success: true });
            });
        });
    });
}

/**
 * Call backend API to analyze TOS
 */
async function analyzeTOS(tosText, url) {
    console.log(`TOS Helper: Sending ${tosText.length} chars to backend...`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: tosText,
                url: url
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const analysis = await response.json();
        console.log('TOS Helper: Analysis received', {
            overallScore: analysis.overallScore,
            riskLevel: analysis.riskLevel
        });

        return {
            success: true,
            data: analysis
        };

    } catch (error) {
        console.error('TOS Helper: Backend error', error);
        return {
            success: false,
            error: error.message || 'Failed to connect to backend'
        };
    }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('TOS Helper: Message received from content script', {
        type: message.type,
        tabId: sender.tab?.id,
        url: sender.tab?.url
    });

    if (message.type === 'PAGE_LOADED') {
        // Acknowledge page load
        sendResponse({
            success: true,
            message: 'Background service worker received page load notification'
        });

    } else if (message.type === 'TOS_DETECTED') {
        // Handle TOS detection
        console.log('TOS Helper: TOS page detected!', {
            url: message.data.url,
            title: message.data.title,
            detectionScore: message.data.detection.score,
            signals: message.data.detection.signals,
            textLength: message.data.textLength
        });

        // Store the detected TOS data for later use
        chrome.storage.local.set({
            lastDetectedTOS: {
                url: message.data.url,
                title: message.data.title,
                detection: message.data.detection,
                timestamp: new Date().toISOString()
            }
        });

        sendResponse({
            success: true,
            message: 'TOS detection acknowledged'
        });

    } else if (message.type === 'ANALYZE_TOS') {
        // Handle TOS analysis request
        const requestId = message.requestId;
        console.log('TOS Helper: Analysis requested', { requestId });

        // Call backend (async)
        analyzeTOS(message.data.text, message.data.url)
            .then(async result => {
                // Check if this request was cancelled while we were waiting
                if (cancelledRequests.has(requestId)) {
                    console.log('TOS Helper: Request was cancelled, not caching', { requestId });
                    cancelledRequests.delete(requestId); // Clean up
                    sendResponse({
                        success: false,
                        error: 'Analysis was cancelled by user'
                    });
                    return;
                }

                if (result.success) {
                    // Save to cache only if not cancelled
                    const url = new URL(message.data.url);
                    const domain = url.hostname;
                    await saveCachedAnalysis(domain, message.data.url, result.data);
                    console.log('TOS Helper: Analysis cached', { requestId, domain });
                }
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        // Return true to indicate async response
        return true;

    } else if (message.type === 'CANCEL_ANALYSIS') {
        // Handle cancellation request
        const requestId = message.requestId;
        console.log('TOS Helper: Analysis cancellation requested', { requestId });
        if (requestId) {
            cancelledRequests.add(requestId);
        }
        sendResponse({ success: true });
        return true;

    } else if (message.type === 'CHECK_CACHE') {
        // Check if domain has cached analysis
        console.log('TOS Helper: Cache check requested for', message.domain);

        getCachedAnalysis(message.domain)
            .then(cached => {
                sendResponse({
                    success: true,
                    cached: cached,
                    hasCached: !!cached
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        return true;

    } else if (message.type === 'GET_CACHE_STATUS') {
        // Get cache status for popup
        console.log('TOS Helper: Cache status requested for', message.domain);

        getCachedAnalysis(message.domain)
            .then(cached => {
                sendResponse({
                    hasCached: !!cached,
                    timestamp: cached?.timestamp,
                    isTOSPage: message.isTOSPage || false
                });
            })
            .catch(error => {
                sendResponse({
                    hasCached: false,
                    isTOSPage: false
                });
            });

        return true;

    } else if (message.type === 'CLEAR_CACHE') {
        // Clear cache for specific domain
        console.log('TOS Helper: Clear cache requested for', message.domain);

        clearCacheForDomain(message.domain)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        return true;
    }

    // Return true to indicate async response
    return true;
});

/**
 * Keep-alive ping mechanism to prevent Render free tier from spinning down
 * Pings every 10 minutes while extension is active
 */
let keepAliveInterval = null;

function startKeepAlivePing() {
    // Clear any existing interval
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }

    console.log('TOS Helper: Starting keep-alive pings for production backend');

    // Ping immediately
    pingBackendHealth();

    // Then ping every 10 minutes (600000ms)
    keepAliveInterval = setInterval(() => {
        pingBackendHealth();
    }, 600000);
}

function stopKeepAlivePing() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('TOS Helper: Keep-alive pings stopped');
    }
}

async function pingBackendHealth() {
    if (!BACKEND_URL) return;

    try {
        const response = await fetch(`${BACKEND_URL}/api/health`, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.json();
            console.log('TOS Helper: Keep-alive ping successful', {
                status: data.status,
                model: data.model,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.warn('TOS Helper: Keep-alive ping failed', error.message);
    }
}

console.log('TOS Helper: Background service worker ready');
