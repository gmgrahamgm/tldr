// TOS Helper - Prompt Panel
// Handles the initial TOS detection prompt

let promptPanel = null;

/**
 * Show the initial prompt panel
 */
window.showPromptPanel = function (tosText) {
    // Store TOS text in window for cross-file access
    window.tosHelperCurrentText = tosText;

    // Check if already shown
    if (promptPanel) return;

    // Create prompt panel
    promptPanel = document.createElement('div');
    promptPanel.id = 'tos-helper-prompt';
    promptPanel.className = 'tos-helper-panel';
    promptPanel.setAttribute('role', 'dialog');
    promptPanel.setAttribute('aria-labelledby', 'tos-helper-prompt-title');

    promptPanel.innerHTML = `
        <div class=\"tos-helper-prompt-content\">
            <h2 id=\"tos-helper-prompt-title\" class=\"tos-helper-prompt-title\">
                Terms of Service Detected
            </h2>
            <p class=\"tos-helper-prompt-text\">
                This looks like a Terms of Service page. Would you like a quick summary?
            </p>
            <div class="tos-helper-prompt-buttons">
                <button id="tos-helper-summarize-btn" class="tos-helper-btn tos-helper-btn--primary" aria-describedby="tos-helper-prompt-text">
                    Summarize TOS
                </button>
                <button id="tos-helper-dismiss-btn" class="tos-helper-btn tos-helper-btn--secondary">
                    Not Now
                </button>
                <button id="tos-helper-never-btn" class="tos-helper-btn tos-helper-btn--link" title="Never show for this site">
                    Never for this site
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(promptPanel);

    // Add event listeners - delegate to modal controller
    document.getElementById('tos-helper-summarize-btn').addEventListener('click', () => {
        if (window.handleSummarize) {
            window.handleSummarize();
        }
    });
    document.getElementById('tos-helper-dismiss-btn').addEventListener('click', hidePromptPanel);
    document.getElementById('tos-helper-never-btn').addEventListener('click', handleNeverForSite);

    // Keyboard handling
    promptPanel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hidePromptPanel();
        }
    });

    // Focus on panel
    setTimeout(() => {
        document.getElementById('tos-helper-summarize-btn').focus();
    }, 100);

    console.log('TOS Helper: Prompt panel shown');
};

/**
 * Hide the prompt panel
 */
window.hidePromptPanel = function () {
    if (promptPanel) {
        promptPanel.remove();
        promptPanel = null;
        console.log('TOS Helper: Prompt panel hidden');
    }
};

/**
 * Handle \"Never for this site\" button click
 */
function handleNeverForSite() {
    const hostname = new URL(window.location.href).hostname;

    console.log(`TOS Helper: User disabled extension for ${hostname}`);

    // Get current disabled sites
    chrome.storage.local.get(['disabledSites'], (result) => {
        const disabledSites = result.disabledSites || [];

        // Add current site if not already disabled
        if (!disabledSites.includes(hostname)) {
            disabledSites.push(hostname);

            // Save to storage
            chrome.storage.local.set({ disabledSites }, () => {
                console.log(`TOS Helper: Saved disabled sites:`, disabledSites);

                // Show confirmation
                if (promptPanel) {
                    const content = promptPanel.querySelector('.tos-helper-prompt-content');
                    content.innerHTML = `
                        <div class="tos-helper-alert tos-helper-alert--success" role="status" aria-live="polite">
                            <p>
                                ✓ Extension disabled for ${hostname}
                            </p>
                            <p class="tos-helper-alert__details">
                                You can still perform analysis using the extension menu.
                            </p>
                        </div>
                    `;

                    // Auto-hide after 2 seconds
                    setTimeout(hidePromptPanel, 2000);
                }
            });
        }
    });
}
