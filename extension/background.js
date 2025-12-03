// TOS Helper - Background Service Worker
// Handles extension lifecycle, messaging, and API communication

console.log('TOS Helper: Background service worker initialized');

// Backend URL with environment detection
let BACKEND_URL = null;

/**
 * Detect if we're running in a development environment
 * Checks if we can reach localhost backend
 */
async function detectEnvironment() {
    const LOCAL_URL = 'http://localhost:5000';
    const PRODUCTION_URL = 'https://tldr-xv48.onrender.com';

    try {
        // Try to ping local backend health endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

        const response = await fetch(`${LOCAL_URL}/api/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('TOS Helper: Local backend detected, using development mode');
            return LOCAL_URL;
        }
    } catch (error) {
        // Local backend not available, use production
        console.log('TOS Helper: Local backend not available, using production mode');
    }

    console.log('TOS Helper: Using production backend:', PRODUCTION_URL);
    return PRODUCTION_URL;
}

// Initialize backend URL on startup
(async () => {
    BACKEND_URL = await detectEnvironment();
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
 * Checks for exact match and common domain variants (with/without www)
 */
async function getCachedAnalysis(domain) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tosCache'], (result) => {
            const cache = result.tosCache || {};
            
            // Check exact match first
            if (cache[domain]) {
                console.log('TOS Helper: Cache hit for exact domain:', domain);
                // Validate the cached entry has required data
                if (cache[domain].analysis && cache[domain].analysis.overallTrustScore !== undefined) {
                    resolve(cache[domain]);
                } else {
                    console.warn('TOS Helper: Cached entry is invalid/empty, treating as cache miss');
                    resolve(null);
                }
                return;
            }
            
            // Try variants (with/without www)
            const variants = [
                domain.replace('www.', ''),
                'www.' + domain.replace('www.', '')
            ];
            
            for (const variant of variants) {
                if (cache[variant] && cache[variant].analysis && cache[variant].analysis.overallTrustScore !== undefined) {
                    console.log('TOS Helper: Cache hit for variant:', variant, 'of domain:', domain);
                    resolve(cache[variant]);
                    return;
                }
            }
            
            console.log('TOS Helper: Cache miss for domain:', domain);
            resolve(null);
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
 * Ensures complete removal of all data associated with the domain
 */
async function clearCacheForDomain(domain) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tosCache', 'disabledSites', 'lastDetectedTOS'], (result) => {
            const cache = result.tosCache || {};
            const disabledSites = result.disabledSites || [];
            const lastDetected = result.lastDetectedTOS || null;

            console.log('TOS Helper: Clearing all data for domain:', domain);
            console.log('TOS Helper: Before clear - Cache keys:', Object.keys(cache));

            // Remove from cache - check exact match and with/without www
            const domainVariants = [
                domain,
                domain.replace('www.', ''),
                'www.' + domain.replace('www.', '')
            ];

            let removed = false;
            domainVariants.forEach(variant => {
                if (cache[variant]) {
                    delete cache[variant];
                    removed = true;
                    console.log('TOS Helper: Removed cache entry for variant:', variant);
                }
            });

            // Remove from disabled sites list - check all variants
            const updatedDisabledSites = disabledSites.filter(site => {
                const shouldRemove = domainVariants.some(variant => 
                    site === variant || site.includes(domain.replace('www.', ''))
                );
                if (shouldRemove) {
                    console.log('TOS Helper: Removed from disabled sites:', site);
                }
                return !shouldRemove;
            });

            // Clear lastDetectedTOS if it matches this domain
            let clearedLastDetected = false;
            if (lastDetected && lastDetected.url) {
                try {
                    const detectedDomain = new URL(lastDetected.url).hostname;
                    if (domainVariants.some(variant => detectedDomain.includes(variant.replace('www.', '')))) {
                        lastDetected = null;
                        clearedLastDetected = true;
                        console.log('TOS Helper: Cleared lastDetectedTOS for domain');
                    }
                } catch (e) {
                    console.warn('TOS Helper: Error parsing lastDetectedTOS URL:', e);
                }
            }

            // Set the updated storage
            const updates = {
                tosCache: cache,
                disabledSites: updatedDisabledSites
            };
            
            if (clearedLastDetected) {
                updates.lastDetectedTOS = null;
            }

            chrome.storage.local.set(updates, () => {
                console.log('TOS Helper: Cache fully cleared for', domain);
                console.log('TOS Helper: After clear - Cache keys:', Object.keys(cache));
                console.log('TOS Helper: Removed entries:', removed);
                console.log('TOS Helper: Updated disabled sites:', updatedDisabledSites);
                resolve({ 
                    success: true, 
                    cleared: removed,
                    remainingCacheKeys: Object.keys(cache)
                });
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
