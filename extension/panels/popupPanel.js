// TOS Helper - Popup Panel (Injected)
// Handles the extension management UI when the extension icon is clicked

let popupPanel = null;
let currentTabUrl = null;

/**
 * Show the popup panel (injected into page)
 */
window.showPopupPanel = async function () {
    // Hide any existing popup
    hidePopupPanel();

    // Get current page info
    currentTabUrl = window.location.href;
    const hostname = new URL(currentTabUrl).hostname;

    // Create popup panel
    popupPanel = document.createElement('div');
    popupPanel.id = 'tos-helper-popup-panel';
    popupPanel.className = 'tos-helper-popup-panel';
    popupPanel.setAttribute('role', 'dialog');
    popupPanel.setAttribute('aria-labelledby', 'tos-helper-popup-title');
    popupPanel.setAttribute('aria-modal', 'true');

    // Show loading state initially
    popupPanel.innerHTML = `
        <div class="tos-helper-popup-content">
            <div class="tos-helper-popup-header">
                <div class="tos-helper-popup-title" id="tos-helper-popup-title">TOS Helper</div>
                <button class="tos-helper-close-btn" id="tos-helper-popup-close" aria-label="Close popup">✕</button>
            </div>
            <div class="tos-helper-popup-body">
                <div class="tos-helper-popup-url">${hostname}</div>
                <div class="tos-helper-popup-loading">
                    <span class="tos-helper-spinner tos-helper-spinner--small"></span>
                    <span>Checking current page...</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popupPanel);

    // Create focus trap
    const cleanupFocusTrap = window.createFocusTrap ? window.createFocusTrap(popupPanel) : null;
    popupPanel._cleanupFocusTrap = cleanupFocusTrap;

    // Add close button listener
    document.getElementById('tos-helper-popup-close').addEventListener('click', hidePopupPanel);

    // Close on escape key
    popupPanel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hidePopupPanel();
        }
    });

    // Close when clicking outside
    popupPanel.addEventListener('click', (event) => {
        if (event.target === popupPanel) {
            hidePopupPanel();
        }
    });

    console.log('TOS Helper: Popup panel shown');

    // Load popup content
    await loadPopupContent(hostname);
};

/**
 * Hide the popup panel
 */
window.hidePopupPanel = function () {
    if (popupPanel) {
        // Cleanup focus trap
        if (popupPanel._cleanupFocusTrap) {
            popupPanel._cleanupFocusTrap();
        }
        popupPanel.remove();
        popupPanel = null;
        console.log('TOS Helper: Popup panel hidden');
    }
};

/**
 * Load popup content based on current page state
 */
async function loadPopupContent(hostname) {
    try {
        console.log('TOS Helper Popup Panel: Loading content for', hostname);
        // Run TOS detection
        let isTOSPage = false;
        if (window.runTOSDetection) {
            console.log('TOS Helper Popup Panel: Running TOS detection...');
            const detection = window.runTOSDetection();
            isTOSPage = detection.isTOSPage;
            console.log('TOS Helper Popup Panel: Detection result:', { isTOSPage, score: detection.score });
        } else {
            console.warn('TOS Helper Popup Panel: window.runTOSDetection not available');
        }

        // Check cache status
        const cacheResponse = await chrome.runtime.sendMessage({
            type: 'GET_CACHE_STATUS',
            domain: hostname,
            isTOSPage: isTOSPage
        });

        // Render appropriate UI
        renderPopupContent(hostname, cacheResponse, isTOSPage);

    } catch (error) {
        console.error('TOS Helper: Error loading popup content', error);
        showPopupError('Failed to load popup content');
    }
}

/**
 * Render popup content based on cache status
 */
function renderPopupContent(hostname, cacheStatus, isTOSPage) {
    const body = popupPanel.querySelector('.tos-helper-popup-body');

    if (cacheStatus.hasCached) {
        // Has cached analysis
        body.innerHTML = `
            <div class="tos-helper-popup-url" id="popup-current-site">${hostname}</div>
            <div class="tos-helper-alert tos-helper-alert--success" role="status" id="popup-cache-status">
                ✓ TOS analysis cached for this site
            </div>
            <div class="tos-helper-popup-buttons">
                <button class="tos-helper-btn tos-helper-btn--primary" id="popup-view-summary" aria-describedby="popup-cache-status">
                    View Cached Summary
                </button>
                <button class="tos-helper-btn tos-helper-btn--primary" id="popup-reanalyze" aria-describedby="popup-cache-status">
                    Re-analyze TOS
                </button>
                <button class="tos-helper-btn tos-helper-btn--danger" id="popup-clear-cache" aria-describedby="popup-cache-status">
                    Clear Cache for This Site
                </button>
            </div>
            <div class="tos-helper-popup-cache-info">
                <strong>Cached:</strong> ${formatTimestamp(cacheStatus.timestamp)}
            </div>
        `;

        document.getElementById('popup-view-summary').addEventListener('click', handleViewSummary);
        document.getElementById('popup-reanalyze').addEventListener('click', () => handlePopupReanalyze(hostname));
        document.getElementById('popup-clear-cache').addEventListener('click', () => handleClearCache(hostname));

    } else if (isTOSPage) {
        // Is TOS page but no cache
        body.innerHTML = `
            <div class="tos-helper-popup-url" id="popup-current-site">${hostname}</div>
            <div class="tos-helper-alert tos-helper-alert--info" role="status" id="popup-tos-status">
                This page contains a Terms of Service. Would you like to summarize it?
            </div>
            <div class="tos-helper-popup-buttons">
                <button class="tos-helper-btn tos-helper-btn--primary" id="popup-summarize" aria-describedby="popup-tos-status">
                    Summarize TOS
                </button>
            </div>
        `;

        document.getElementById('popup-summarize').addEventListener('click', handlePopupSummarize);

    } else {
        // Not a TOS page
        body.innerHTML = `
            <div class="tos-helper-popup-url" id="popup-current-site">${hostname}</div>
            <div class="tos-helper-alert tos-helper-alert--warning" role="status" id="popup-warning-status">
                This does not appear to be a Terms of Service page.
            </div>
            <div class="tos-helper-popup-buttons">
                <button class="tos-helper-btn tos-helper-btn--secondary" id="popup-generate-anyway" aria-describedby="popup-warning-status">
                    Generate Summary Anyway
                </button>
            </div>
        `;

        document.getElementById('popup-generate-anyway').addEventListener('click', handleGenerateAnyway);
    }
}

/**
 * Handle "View Cached Summary" button
 */
async function handleViewSummary() {
    console.log('Popup Panel: View cached summary');
    hidePopupPanel();

    const hostname = new URL(currentTabUrl).hostname;

    // Get cached data
    const response = await chrome.runtime.sendMessage({
        type: 'CHECK_CACHE',
        domain: hostname
    });

    if (response.success && response.cached) {
        if (window.showCachedSummary) {
            window.showCachedSummary(response.cached);
        }
    }
}

/**
 * Handle "Summarize TOS" button (from popup panel)
 */
function handlePopupSummarize() {
    console.log('Popup Panel: Summarize TOS button clicked');

    // Hide popup panel immediately
    window.hidePopupPanel();
    console.log('Popup Panel: Popup hidden, extracting TOS text...');

    // Extract TOS text and trigger analysis
    if (window.extractTOSText) {
        const tosText = window.extractTOSText();
        window.tosHelperCurrentText = tosText;
        console.log('Popup Panel: TOS text extracted, starting analysis...');
    } else {
        console.error('Popup Panel: extractTOSText not available');
        return;
    }

    // Call the controller's analysis handler
    if (window.handleSummarize) {
        window.handleSummarize();
    } else {
        console.error('Popup Panel: window.handleSummarize not available');
    }
}

/**
 * Handle "Re-analyze TOS" button (from popup panel)
 */
function handlePopupReanalyze(hostname) {
    console.log('Popup Panel: Re-analyze TOS button clicked');

    // Show confirmation
    const body = popupPanel.querySelector('.tos-helper-popup-body');
    body.innerHTML = `
        <div class="tos-helper-popup-url">${hostname}</div>
        <div class="tos-helper-alert tos-helper-alert--warning">
            Are you sure you want to re-generate a TOS summary?
        </div>
        <div class="tos-helper-popup-buttons">
            <button class="tos-helper-btn tos-helper-btn--primary" id="popup-confirm-reanalyze">
                Yes, Re-analyze
            </button>
            <button class="tos-helper-btn tos-helper-btn--secondary" id="popup-cancel-reanalyze">
                Cancel
            </button>
        </div>
    `;

    document.getElementById('popup-confirm-reanalyze').addEventListener('click', () => {
        console.log('Popup Panel: Re-analysis confirmed');

        // Hide popup panel
        window.hidePopupPanel();
        console.log('Popup Panel: Popup hidden, extracting fresh TOS text...');

        // Extract fresh TOS text for re-analysis
        if (window.extractTOSText) {
            const tosText = window.extractTOSText();
            window.tosHelperCurrentText = tosText;
            console.log('Popup Panel: Fresh TOS text extracted, starting re-analysis...');
        } else {
            console.error('Popup Panel: extractTOSText not available');
            return;
        }

        // Call the controller's re-analysis handler
        if (window.handleSummarizeWithCacheClear) {
            window.handleSummarizeWithCacheClear(hostname);
        } else {
            console.error('Popup Panel: window.handleSummarizeWithCacheClear not available');
        }
    });

    document.getElementById('popup-cancel-reanalyze').addEventListener('click', () => {
        // Go back to main view
        loadPopupContent(hostname);
    });
}

/**
 * Handle "Clear Cache for This Site" button
 */
async function handleClearCache(hostname) {
    console.log('Popup Panel: Clear cache for', hostname);

    // Show confirmation
    const body = popupPanel.querySelector('.tos-helper-popup-body');
    body.innerHTML = `
        <div class="tos-helper-popup-url">${hostname}</div>
        <div class="tos-helper-alert tos-helper-alert--warning">
            Are you sure you want to delete the cached TOS summary for this website?
        </div>
        <div class="tos-helper-popup-buttons">
            <button class="tos-helper-btn tos-helper-btn--danger" id="popup-confirm-clear">
                Yes, Clear Cache
            </button>
            <button class="tos-helper-btn tos-helper-btn--secondary" id="popup-cancel-clear">
                No, Keep It
            </button>
        </div>
    `;

    document.getElementById('popup-confirm-clear').addEventListener('click', async () => {
        // Show loading
        body.innerHTML = `
            <div class="tos-helper-popup-url">${hostname}</div>
            <div class="tos-helper-alert tos-helper-alert--info">
                Clearing cache...
            </div>
        `;

        // Clear cache
        const response = await chrome.runtime.sendMessage({
            type: 'CLEAR_CACHE',
            domain: hostname
        });

        if (response.success) {
            // Close any open summary panels
            if (window.hideSummaryPanel) {
                window.hideSummaryPanel();
            }

            // Show success
            body.innerHTML = `
                <div class="tos-helper-popup-url">${hostname}</div>
                <div class="tos-helper-alert tos-helper-alert--success">
                    ✓ Cache cleared successfully
                </div>
            `;

            // Auto-close after 1.5 seconds
            setTimeout(() => {
                hidePopupPanel();
            }, 1500);
        } else {
            showPopupError('Failed to clear cache');
        }
    });

    document.getElementById('popup-cancel-clear').addEventListener('click', () => {
        loadPopupContent(hostname);
    });
}

/**
 * Handle "Generate Summary Anyway" button
 */
function handleGenerateAnyway() {
    console.log('Popup Panel: Generate summary anyway');

    const body = popupPanel.querySelector('.tos-helper-popup-body');
    const hostname = new URL(currentTabUrl).hostname;

    // Show warning confirmation
    body.innerHTML = `
        <div class="tos-helper-popup-url">${hostname}</div>
        <div class="tos-helper-alert tos-helper-alert--warning">
            ⚠ Are you sure you want to generate a summary? This page is not detected as a TOS, and may result in some inaccuracies.
        </div>
        <div class="tos-helper-popup-buttons">
            <button class="tos-helper-btn tos-helper-btn--primary" id="popup-confirm-generate">
                Yes, Generate Summary
            </button>
            <button class="tos-helper-btn tos-helper-btn--secondary" id="popup-cancel-generate">
                Cancel
            </button>
        </div>
    `;

    document.getElementById('popup-confirm-generate').addEventListener('click', () => {
        hidePopupPanel();
        if (window.extractTOSText) {
            const tosText = window.extractTOSText();
            window.tosHelperCurrentText = tosText;
        }
        if (window.handleSummarize) {
            window.handleSummarize();
        }
    });

    document.getElementById('popup-cancel-generate').addEventListener('click', () => {
        loadPopupContent(hostname);
    });
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

/**
 * Show error message
 */
function showPopupError(message) {
    const body = popupPanel.querySelector('.tos-helper-popup-body');
    body.innerHTML = `
        <div class="tos-helper-alert tos-helper-alert--error" role="alert" aria-live="assertive">
            ⚠ ${message}
        </div>
    `;
}
