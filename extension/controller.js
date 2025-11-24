// TOS Helper - Modal Controller
// Coordinates analysis workflow and delegates to panel files

// Store timeout ID for cancellation (exposed to window for loading panel cancel)
window.tosHelperAnalysisTimeoutId = null;

// Store cancellation flag to prevent caching if analysis is cancelled
window.tosHelperAnalysisCancelled = false;

// Store current request ID to track which request was cancelled
window.tosHelperCurrentRequestId = null;

/**
 * Handle summarize button click
 */
window.handleSummarize = function () {
    console.log('TOS Helper: User requested summary');

    // Reset cancellation flag and generate unique request ID
    window.tosHelperAnalysisCancelled = false;
    const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    window.tosHelperCurrentRequestId = requestId;

    // Show loading panel
    if (window.showLoadingPanel) {
        window.showLoadingPanel();
    }

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.error('TOS Helper: Extension context invalidated');
        if (window.showError) {
            window.showError('Extension was reloaded. Please refresh the page.');
        }
        return;
    }

    // Set timeout for analysis
    window.tosHelperAnalysisTimeoutId = setTimeout(() => {
        console.error('TOS Helper: Analysis timeout');
        if (window.showError) {
            window.showError('Analysis timed out. Please try again.');
        }
        window.tosHelperAnalysisTimeoutId = null;
    }, CONFIG.ANALYSIS_TIMEOUT);

    // Send to background worker for backend analysis
    try {
        chrome.runtime.sendMessage({
            type: 'ANALYZE_TOS',
            requestId: requestId,
            data: {
                text: window.tosHelperCurrentText,
                url: window.location.href
            }
        }, (response) => {
            // Clear timeout on response
            if (window.tosHelperAnalysisTimeoutId) {
                clearTimeout(window.tosHelperAnalysisTimeoutId);
                window.tosHelperAnalysisTimeoutId = null;
            }

            // Check if analysis was cancelled - discard response if so
            if (window.tosHelperAnalysisCancelled) {
                console.log('TOS Helper: Analysis was cancelled, discarding response');
                return;
            }

            if (chrome.runtime.lastError) {
                console.error('TOS Helper: Error communicating with background', chrome.runtime.lastError);
                if (window.showError) {
                    window.showError('Failed to connect to analysis service');
                }
                return;
            }

            if (!response.success) {
                console.error('TOS Helper: Backend error', response.error);
                if (window.showError) {
                    window.showError(response.error || 'Analysis failed');
                }
                return;
            }

            console.log('TOS Helper: Analysis complete, updating UI');

            // Update summary panel with real data
            if (window.updateSummaryPanel) {
                window.updateSummaryPanel(response.data);
            }
        });
    } catch (error) {
        // Clear timeout on error
        if (window.tosHelperAnalysisTimeoutId) {
            clearTimeout(window.tosHelperAnalysisTimeoutId);
            window.tosHelperAnalysisTimeoutId = null;
        }
        console.error('TOS Helper: Exception during analysis request', error);
        if (window.showError) {
            window.showError('Extension was reloaded. Please refresh the page.');
        }
    }
};

/**
 * Handle summarize with cache clearing on success (for re-analyze)
 */
window.handleSummarizeWithCacheClear = function (domain) {
    console.log('TOS Helper: Re-analyzing with cache clear on success');

    // Reset cancellation flag and generate unique request ID
    window.tosHelperAnalysisCancelled = false;
    const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    window.tosHelperCurrentRequestId = requestId;

    // Show loading panel
    if (window.showLoadingPanel) {
        window.showLoadingPanel();
    }

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.error('TOS Helper: Extension context invalidated');
        if (window.showError) {
            window.showError('Extension was reloaded. Please refresh the page.');
        }
        return;
    }

    // Validate TOS text exists
    if (!window.tosHelperCurrentText || window.tosHelperCurrentText.length === 0) {
        console.error('TOS Helper: No TOS text available for re-analysis');
        if (window.showError) {
            window.showError('No TOS text found. Please refresh the page.');
        }
        return;
    }

    // Set timeout for analysis
    window.tosHelperAnalysisTimeoutId = setTimeout(() => {
        console.error('TOS Helper: Analysis timeout');
        if (window.showError) {
            window.showError('Analysis timed out. Please try again.');
        }
        window.tosHelperAnalysisTimeoutId = null;
    }, CONFIG.ANALYSIS_TIMEOUT);

    // Send to background worker for backend analysis
    try {
        chrome.runtime.sendMessage({
            type: 'ANALYZE_TOS',
            requestId: requestId,
            data: {
                text: window.tosHelperCurrentText,
                url: window.location.href
            }
        }, (response) => {
            // Clear timeout on response
            if (window.tosHelperAnalysisTimeoutId) {
                clearTimeout(window.tosHelperAnalysisTimeoutId);
                window.tosHelperAnalysisTimeoutId = null;
            }

            // Check if analysis was cancelled - discard response if so
            if (window.tosHelperAnalysisCancelled) {
                console.log('TOS Helper: Re-analysis was cancelled, discarding response');
                return;
            }

            if (chrome.runtime.lastError) {
                console.error('TOS Helper: Error communicating with background', chrome.runtime.lastError);
                if (window.showError) {
                    window.showError('Failed to connect to analysis service');
                }
                return;
            }

            if (!response.success) {
                console.error('TOS Helper: Backend error', response.error);
                if (window.showError) {
                    window.showError(response.error || 'Analysis failed');
                }
                return;
            }

            console.log('TOS Helper: Re-analysis complete, updating UI with new data');

            // Note: Background script already cached the new analysis
            // Update summary panel with new data (not from old cache)
            if (window.updateSummaryPanel) {
                window.updateSummaryPanel(response.data, false);
            }
        });
    } catch (error) {
        // Clear timeout on error
        if (window.tosHelperAnalysisTimeoutId) {
            clearTimeout(window.tosHelperAnalysisTimeoutId);
            window.tosHelperAnalysisTimeoutId = null;
        }
        console.error('TOS Helper: Exception during re-analysis request', error);
        if (window.showError) {
            window.showError('Extension was reloaded. Please refresh the page.');
        }
    }
};
