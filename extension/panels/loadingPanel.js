// TOS Helper - Loading Panel
// Handles the analysis loading state

/**
 * Show the loading panel
 */
window.showLoadingPanel = function () {
    // Hide prompt first
    if (window.hidePromptPanel) {
        window.hidePromptPanel();
    }

    // Check if already shown
    if (window.tosHelperSummaryPanel) return;

    // Create overlay
    const summaryPanel = document.createElement('div');
    summaryPanel.id = 'tos-helper-summary';
    summaryPanel.className = 'tos-helper-overlay';
    summaryPanel.setAttribute('role', 'dialog');
    summaryPanel.setAttribute('aria-labelledby', 'tos-helper-loading-title');
    summaryPanel.setAttribute('aria-modal', 'true');
    summaryPanel.setAttribute('aria-live', 'polite');

    summaryPanel.innerHTML = `
        <div class=\"tos-helper-summary-content\">
            <div class=\"tos-helper-summary-header\">
                <h1 id=\"tos-helper-loading-title\" class=\"tos-helper-loading-title\">Analyzing Terms of Service</h1>
                <button id=\"tos-helper-loading-close-btn\" class=\"tos-helper-close-btn\" aria-label=\"Cancel analysis\">
                    ✕
                </button>
            </div>
            <div class=\"tos-helper-loading-container\">
                <div class=\"tos-helper-spinner\" aria-hidden=\"true\"></div>
                <p class=\"tos-helper-loading-text\">Please wait while we review the terms...</p>
            </div>
        </div>
    `;

    document.body.appendChild(summaryPanel);

    // Store in window for cross-file access
    window.tosHelperSummaryPanel = summaryPanel;

    // Create focus trap
    const cleanupFocusTrap = window.createFocusTrap ? window.createFocusTrap(summaryPanel) : null;
    summaryPanel._cleanupFocusTrap = cleanupFocusTrap;

    // Add close button listener
    const closeBtn = document.getElementById('tos-helper-loading-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', handleLoadingClose);
    }

    console.log('TOS Helper: Loading panel shown');
};

/**
 * Handle close button click during loading
 */
function handleLoadingClose() {
    const confirmed = confirm('Exiting will cancel TOS analysis. Are you sure you want to continue?');

    if (confirmed) {
        console.log('TOS Helper: User cancelled analysis');

        // Set cancellation flag to prevent caching the response
        window.tosHelperAnalysisCancelled = true;

        // Notify background script to mark this request as cancelled
        if (window.tosHelperCurrentRequestId) {
            chrome.runtime.sendMessage({
                type: 'CANCEL_ANALYSIS',
                requestId: window.tosHelperCurrentRequestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to notify cancellation:', chrome.runtime.lastError);
                } else {
                    console.log('TOS Helper: Cancellation registered with background');
                }
            });
        }

        // Clear any pending timeout
        if (window.tosHelperAnalysisTimeoutId) {
            clearTimeout(window.tosHelperAnalysisTimeoutId);
            window.tosHelperAnalysisTimeoutId = null;
        }

        // Hide the loading panel
        if (window.tosHelperSummaryPanel) {
            // Cleanup focus trap
            if (window.tosHelperSummaryPanel._cleanupFocusTrap) {
                window.tosHelperSummaryPanel._cleanupFocusTrap();
            }
            window.tosHelperSummaryPanel.remove();
            window.tosHelperSummaryPanel = null;
        }
    }
}