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

    // IMPORTANT: Re-extract TOS text to ensure we have fresh content
    console.log('TOS Helper: Re-scanning page for fresh content');
    if (window.extractTOSText) {
        window.tosHelperCurrentText = window.extractTOSText();
        console.log('TOS Helper: Fresh text extracted', { length: window.tosHelperCurrentText.length });
    }

    // Validate we have content
    if (!window.tosHelperCurrentText || window.tosHelperCurrentText.trim().length < 100) {
        console.error('TOS Helper: Insufficient text content', { length: window.tosHelperCurrentText?.length || 0 });
        if (window.showError) {
            window.showError('Could not extract enough text from this page. Please try again.');
        }
        return;
    }

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

            // Validate response - check if all scores are zero (indicates empty text was sent)
            const overallScore = response.data.overallTrustScore || response.data.overallScore || 0;
            if (overallScore === 0) {
                console.warn('TOS Helper: Received zero score - likely empty text was analyzed');
                console.log('TOS Helper: Using dummy analysis as fallback');

                // Use dummy analysis data as fallback
                const dummyData = {
                    overallTrustScore: 45,
                    overallScore: 45,
                    riskLevel: 'medium',
                    explanation: 'Unable to fully analyze this page. Please try refreshing and analyzing again.',
                    overview: [
                        'Analysis Error: The page content could not be properly extracted.',
                        'This may be due to dynamic content loading or page structure.',
                        'Please refresh the page and try again.'
                    ],
                    risks: [
                        {
                            title: 'Analysis Incomplete',
                            severity: 'medium',
                            description: 'The Terms of Service content could not be fully analyzed.',
                            example: 'Try refreshing the page and running the analysis again.'
                        }
                    ],
                    dataSharing: {
                        collected: ['Unable to determine'],
                        internalUse: ['Unable to determine'],
                        thirdParties: ['Unable to determine']
                    },
                    examples: ['Please refresh the page and try analyzing again.'],
                    scoreBreakdown: {
                        dataCollection: 0,
                        thirdPartySharing: 0,
                        userControl: 0,
                        termFairness: 0
                    }
                };

                // Ensure panel exists before updating
                if (window.tosHelperSummaryPanel && document.body.contains(window.tosHelperSummaryPanel)) {
                    if (window.updateSummaryPanel) {
                        window.updateSummaryPanel(dummyData);
                    }
                } else {
                    console.warn('TOS Helper: Summary panel missing, creating new one');
                    if (window.showSummaryPanel) {
                        window.showSummaryPanel(dummyData);
                    }
                }
                return;
            }

            // Update summary panel with real data
            // Ensure panel exists before updating
            if (window.tosHelperSummaryPanel && document.body.contains(window.tosHelperSummaryPanel)) {
                if (window.updateSummaryPanel) {
                    console.log('TOS Helper: Updating existing panel with real data');
                    window.updateSummaryPanel(response.data);
                }
            } else {
                console.warn('TOS Helper: Summary panel missing, creating new one');
                if (window.showSummaryPanel) {
                    window.showSummaryPanel(response.data);
                }
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

    // IMPORTANT: Re-extract TOS text to ensure we have fresh content
    console.log('TOS Helper: Re-scanning page for fresh content');
    if (window.extractTOSText) {
        window.tosHelperCurrentText = window.extractTOSText();
        console.log('TOS Helper: Fresh text extracted', { length: window.tosHelperCurrentText.length });
    }

    // Validate we have content
    if (!window.tosHelperCurrentText || window.tosHelperCurrentText.trim().length < 100) {
        console.error('TOS Helper: Insufficient text content', { length: window.tosHelperCurrentText?.length || 0 });
        if (window.showError) {
            window.showError('Could not extract enough text from this page. Please try again.');
        }
        return;
    }

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
