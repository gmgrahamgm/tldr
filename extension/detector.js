// TOS Helper - Content Script (Main Entry Point)
// Runs on all web pages to detect TOS and trigger UI

console.log('TOS Helper: Content script loaded on', window.location.href);

(function () {
    'use strict';

    // Store last extracted TOS text for popup-triggered analysis
    let lastExtractedTOSText = null;

    // Store detection result for popup queries
    let lastDetectionResult = null;

    /**
     * Check if current URL is blocked
     */
    function isBlockedURL() {
        const urlLower = window.location.href.toLowerCase();

        for (const pattern of BLOCKED_URL_PATTERNS) {
            if (urlLower.includes(pattern)) {
                console.log(`TOS Helper: URL blocked by pattern: "${pattern}"`);
                return true;
            }
        }

        return false;
    }

    /**
     * Detect if the current page is likely a TOS page
     * Returns detection score and signals
     */
    function detectTOS() {
        // First check if URL is blocked
        if (isBlockedURL()) {
            return { score: 0, signals: { url: false, heading: false, legalLanguage: 0 }, blocked: true };
        }

        let score = 0;
        const signals = {
            url: false,
            heading: false,
            legalLanguage: 0
        };

        // Check URL
        const urlLower = window.location.href.toLowerCase();
        const urlPath = window.location.pathname.toLowerCase();

        for (const pattern of URL_PATTERNS) {
            if (urlPath.includes(pattern)) {
                signals.url = pattern;
                score += 1;
                console.log(`TOS Helper: URL match: "${pattern}"`);
                break;
            }
        }

        // Check headings (h1-h6)
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const heading of headings) {
            const headingText = heading.textContent.toLowerCase().trim();
            for (const pattern of HEADING_PATTERNS) {
                if (headingText.includes(pattern)) {
                    signals.heading = headingText;
                    score += 2; // Headings are strong signals
                    console.log(`TOS Helper: Heading match: "${headingText.substring(0, 50)}..."`);
                    break;
                }
            }
            if (signals.heading) break;
        }

        // Check for legal language in page text
        const bodyText = document.body.textContent.toLowerCase();
        let legalPhraseCount = 0;

        for (const phrase of LEGAL_PHRASES) {
            if (bodyText.includes(phrase)) {
                legalPhraseCount++;
            }
        }

        signals.legalLanguage = legalPhraseCount;
        console.log(`TOS Helper: Legal phrases found: ${legalPhraseCount}`);

        // Add to score based on legal phrase density
        if (legalPhraseCount >= 5) {
            score += 2;
        } else if (legalPhraseCount >= 3) {
            score += 1;
        }

        return { score, signals };
    }

    /**
     * Extract TOS text from the page
     * Returns cleaned text limited to MAX_TEXT_LENGTH
     */
    function extractTOSText() {
        // Try to find main content containers
        const selectors = [
            'main',
            'article',
            '[role="main"]',
            '.terms-content',
            '.legal-content',
            '.tos-content',
            '#terms',
            '#tos',
            '#content',
            '.content'
        ];

        let contentElement = null;

        // Try each selector
        for (const selector of selectors) {
            contentElement = document.querySelector(selector);
            if (contentElement) {
                break;
            }
        }

        // Fallback to body if no specific container found
        if (!contentElement) {
            contentElement = document.body;
        }

        // Clone the element to manipulate without affecting the page
        const clone = contentElement.cloneNode(true);

        // Remove elements we don't want
        const elementsToRemove = [
            'nav',
            'header',
            'footer',
            'aside',
            'script',
            'style',
            'noscript',
            '[role="navigation"]',
            '[role="banner"]',
            '[role="contentinfo"]',
            '.navigation',
            '.nav',
            '.header',
            '.footer',
            '.sidebar',
            '.cookie-banner',
            '.ad',
            '.advertisement'
        ];

        elementsToRemove.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Extract text content
        let text = clone.textContent || '';

        // Clean up the text
        text = text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        // Limit length
        if (text.length > CONFIG.MAX_TEXT_LENGTH) {
            text = text.substring(0, CONFIG.MAX_TEXT_LENGTH);
            console.log(`TOS Helper: Text truncated to ${CONFIG.MAX_TEXT_LENGTH} characters`);
        }

        return text;
    }

    /**
     * Main initialization
     */
    function init() {
        console.log('TOS Helper: Analyzing page...');

        // Run detection
        const detection = detectTOS();

        // Store detection result for popup queries
        lastDetectionResult = detection;

        // Check if blocked
        if (detection.blocked) {
            console.log('TOS Helper: URL is blocked, skipping detection');
            return;
        }

        console.log(`TOS Helper: Score=${detection.score}/${CONFIG.DETECTION_THRESHOLD} | URL:${!!detection.signals.url} Heading:${!!detection.signals.heading} Legal:${detection.signals.legalLanguage}`);

        // If TOS detected, check cache and user preferences before showing prompt
        if (detection.score >= CONFIG.DETECTION_THRESHOLD) {
            console.log('TOS Helper: ✓ TOS page detected!');

            const tosText = extractTOSText();
            lastExtractedTOSText = tosText; // Store for later use

            console.log('TOS Helper: Text extraction complete', {
                textLength: tosText.length,
                preview: tosText.substring(0, 200) + '...'
            });

            const hostname = new URL(window.location.href).hostname;

            // Check if site is disabled
            chrome.storage.local.get(['disabledSites'], (result) => {
                const disabledSites = result.disabledSites || [];

                if (disabledSites.includes(hostname)) {
                    console.log(`TOS Helper: Extension disabled for ${hostname}, skipping prompt`);
                    return;
                }

                // Check if we have cached analysis for this domain
                chrome.runtime.sendMessage(
                    { type: 'CHECK_CACHE', domain: hostname },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('TOS Helper: Error checking cache', chrome.runtime.lastError);
                            // If cache check fails, show prompt as fallback
                            if (window.showPromptPanel) {
                                window.showPromptPanel(tosText);
                            }
                            return;
                        }

                        if (response && response.hasCached) {
                            console.log('TOS Helper: Cached analysis found, skipping prompt panel');
                            // Don't show prompt - user can access via extension icon
                            return;
                        }

                        // No cache found, show prompt panel
                        if (window.showPromptPanel) {
                            window.showPromptPanel(tosText);
                        }
                    }
                );
            });

            // Send detection result to background script
            chrome.runtime.sendMessage({
                type: 'TOS_DETECTED',
                data: {
                    url: window.location.href,
                    title: document.title,
                    detection: detection,
                    textLength: tosText.length,
                    text: tosText
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('TOS Helper: Error sending to background', chrome.runtime.lastError);
                } else {
                    console.log('TOS Helper: Background acknowledged detection', response);
                }
            });
        } else {
            console.log('TOS Helper: Not a TOS page (score too low)');
        }
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('TOS Helper: Message received in content script', message.type);

        if (message.type === 'CHECK_TOS_DETECTED') {
            // Respond with whether TOS was detected on this page (from last detection)
            const isTOSPage = lastDetectionResult && !lastDetectionResult.blocked &&
                lastDetectionResult.score >= CONFIG.DETECTION_THRESHOLD;
            console.log('TOS Helper: Responding to detection check', { isTOSPage, score: lastDetectionResult?.score });
            sendResponse({ isTOSPage });
            return true;

        } else if (message.type === 'RUN_TOS_DETECTION') {
            // Run full TOS detection check and respond
            console.log('TOS Helper: Running full TOS detection check');
            const detection = detectTOS();
            const isTOSPage = !detection.blocked && detection.score >= CONFIG.DETECTION_THRESHOLD;
            console.log('TOS Helper: Full detection complete', { isTOSPage, score: detection.score });
            sendResponse({ isTOSPage, score: detection.score });
            return true;

        } else if (message.type === 'SHOW_CACHED_SUMMARY') {
            // Display cached summary from popup request
            const domain = message.domain;
            chrome.runtime.sendMessage(
                { type: 'CHECK_CACHE', domain: domain },
                (response) => {
                    if (response && response.cached) {
                        console.log('TOS Helper: Displaying cached summary');
                        // Pass the full cached object (includes timestamp and analysis)
                        if (window.showCachedSummary) {
                            window.showCachedSummary(response.cached);
                        }
                        sendResponse({ success: true });
                    } else {
                        console.log('TOS Helper: No cached data found');
                        sendResponse({ success: false, error: 'No cached data' });
                    }
                }
            );
            return true; // Async response

        } else if (message.type === 'TRIGGER_SUMMARY') {
            // Trigger summary analysis from popup
            console.log('TOS Helper: Summary triggered from popup');

            // Extract or use cached text
            const tosText = lastExtractedTOSText || extractTOSText();
            window.tosHelperCurrentText = tosText;
            lastExtractedTOSText = tosText;

            if (window.handleSummarize) {
                window.handleSummarize();
            }
            sendResponse({ success: true });
            return true;

        } else if (message.type === 'FORCE_REANALYZE') {
            // Force re-analysis (cache will be cleared after successful analysis)
            console.log('TOS Helper: Force re-analysis from popup');
            const domain = message.domain;

            // Extract fresh text and trigger analysis
            const tosText = extractTOSText();
            window.tosHelperCurrentText = tosText;
            lastExtractedTOSText = tosText;

            // Use the re-analyze handler that clears cache on success
            if (window.handleSummarizeWithCacheClear) {
                window.handleSummarizeWithCacheClear(domain);
            }
            sendResponse({ success: true });
            return true;

        } else if (message.type === 'CLOSE_PANELS') {
            // Close any open panels (summary or prompt)
            console.log('TOS Helper: Closing panels from popup request');
            if (window.hideSummaryPanel) {
                window.hideSummaryPanel();
            }
            if (window.hidePromptPanel) {
                window.hidePromptPanel();
            }
            sendResponse({ success: true });
            return true;
        }
    });

    // Expose detection function for popup panel
    window.runTOSDetection = function () {
        const detection = detectTOS();
        const isTOSPage = !detection.blocked && detection.score >= CONFIG.DETECTION_THRESHOLD;
        console.log('TOS Helper: Manual detection check requested', { isTOSPage, score: detection.score });
        return { isTOSPage, score: detection.score, detection };
    };

    // Expose extraction function for popup panel
    window.extractTOSText = function () {
        const tosText = extractTOSText();
        lastExtractedTOSText = tosText;
        console.log('TOS Helper: TOS text extracted manually', { length: tosText.length });
        return tosText;
    };

    // Run detection when DOM is ready
    // Use a small delay to ensure page content is fully rendered
    function initWithDelay() {
        // Wait for DOM to be interactive and give dynamic content time to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(init, 500); // 500ms delay after DOM ready
            });
        } else {
            // If already loaded, wait a bit for dynamic content
            setTimeout(init, 500);
        }
    }

    initWithDelay();

})();
