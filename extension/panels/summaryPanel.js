// TOS Helper - Summary Panel
// Handles the full TOS analysis summary display

/**
 * Get the summary panel reference
 */
function getSummaryPanel() {
    return window.tosHelperSummaryPanel;
}

/**
 * Set the summary panel reference
 */
function setSummaryPanel(panel) {
    window.tosHelperSummaryPanel = panel;
}

/**
 * Show the summary panel with analysis data (updates loading panel if it exists)
 */
window.showSummaryPanel = function (data) {
    // If loading panel is shown, update it with actual content
    const summaryPanel = getSummaryPanel();
    if (summaryPanel) {
        updateSummaryPanel(data);
        return;
    }

    // Otherwise create new panel (shouldn't normally happen)
    const newPanel = document.createElement('div');
    newPanel.id = 'tos-helper-summary';
    newPanel.className = 'tos-helper-overlay';
    newPanel.setAttribute('role', 'dialog');
    newPanel.setAttribute('aria-labelledby', 'tos-helper-summary-title');
    newPanel.setAttribute('aria-modal', 'true');

    const siteName = new URL(window.location.href).hostname;

    newPanel.innerHTML = `
        <div class="tos-helper-summary-content">
            <div class="tos-helper-summary-header">
                <h1 id="tos-helper-summary-title">TOS Summary for ${siteName}</h1>
                <button id="tos-helper-close-btn" class="tos-helper-close-btn" aria-label="Close summary">
                    ✕
                </button>
            </div>

            <div class="tos-helper-score-section">
                <div class="tos-helper-score-display">
                    <span class="tos-helper-score-number" aria-label="Trust score">${data.overallScore || 0}</span>
                    <span class="tos-helper-score-max">/100</span>
                </div>
                <div class="tos-helper-score-label ${data.riskLevel || 'medium'}-risk">
                    <strong>${(data.riskLevel || 'Loading').toUpperCase()} RISK</strong>
                </div>
            </div>

            <section class="tos-helper-section" id="tos-overview-section">
                <h2 class="tos-helper-section-title">
                    <button class="tos-helper-section-toggle" aria-expanded="true" aria-controls="tos-overview-content">
                        <span class="tos-helper-toggle-icon">▼</span>
                        Overview
                    </button>
                </h2>
                <div class="tos-helper-section-content" id="tos-overview-content">
                    <ul class="tos-helper-bullet-list">
                        ${(data.overview || ['Analyzing terms of service...']).map(item =>
        `<li>${item}</li>`
    ).join('')}
                    </ul>
                </div>
            </section>

            <section class="tos-helper-section" id="tos-risks-section">
                <h2 class="tos-helper-section-title">
                    <button class="tos-helper-section-toggle" aria-expanded="true" aria-controls="tos-risks-content">
                        <span class="tos-helper-toggle-icon">▼</span>
                        Key Risks
                    </button>
                </h2>
                <div class="tos-helper-section-content" id="tos-risks-content">
                    <div class="tos-helper-risks-list">
                        ${(data.risks || [{ title: 'Loading...', severity: 'medium', description: 'Analyzing...', example: '' }]).map(risk => `
                            <div class="tos-helper-risk-item">
                                <div class="tos-helper-risk-header">
                                    <span class="tos-helper-risk-severity ${risk.severity}-severity" aria-label="${risk.severity} severity">
                                        ${risk.severity === 'high' ? '⚠' : risk.severity === 'medium' ? '⚡' : 'ℹ'}
                                        <span class="tos-helper-severity-text">${risk.severity.toUpperCase()}</span>
                                    </span>
                                    <h3 class="tos-helper-risk-title">${risk.title}</h3>
                                </div>
                                <p class="tos-helper-risk-description">${risk.description}</p>
                                ${risk.example ? `<p class="tos-helper-risk-example"><em>Example: ${risk.example}</em></p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section class="tos-helper-section">
                <h2 class="tos-helper-section-title">
                    <button class="tos-helper-section-toggle" aria-expanded="false">
                        <span class="tos-helper-toggle-icon">▶</span>
                        Data & Sharing
                    </button>
                </h2>
                <div class="tos-helper-section-content" hidden>
                    ${data.dataSharing ? `
                        <dl class="tos-helper-data-list">
                            <dt>Data Collected:</dt>
                            <dd>${(data.dataSharing.collected || []).join(', ') || 'Loading...'}</dd>
                            
                            <dt>Internal Use:</dt>
                            <dd>${(data.dataSharing.internalUse || []).join(', ') || 'Loading...'}</dd>
                            
                            <dt>Third Parties:</dt>
                            <dd>${(data.dataSharing.thirdParties || []).join(', ') || 'Loading...'}</dd>
                            
                            <dt>User Controls:</dt>
                            <dd>${data.dataSharing.userControls || 'Loading...'}</dd>
                        </dl>
                    ` : '<p>Analyzing data practices...</p>'}
                </div>
            </section>

            <section class="tos-helper-section">
                <h2 class="tos-helper-section-title">
                    <button class="tos-helper-section-toggle" aria-expanded="false">
                        <span class="tos-helper-toggle-icon">▶</span>
                        Real-World Examples
                    </button>
                </h2>
                <div class="tos-helper-section-content" hidden>
                    <ul class="tos-helper-examples-list">
                        ${(data.examples || ['Loading examples...']).map(example =>
        `<li>${example}</li>`
    ).join('')}
                    </ul>
                </div>
            </section>
        </div>
    `;

    document.body.appendChild(newPanel);
    setSummaryPanel(newPanel);

    // Add event listeners
    document.getElementById('tos-helper-close-btn').addEventListener('click', hideSummaryPanel);

    // Section toggles
    newPanel.querySelectorAll('.tos-helper-section-toggle').forEach(toggle => {
        toggle.addEventListener('click', handleSectionToggle);
    });

    // Keyboard handling
    newPanel.addEventListener('keydown', handleSummaryKeydown);

    // Create focus trap
    const cleanupFocusTrap = window.createFocusTrap ? window.createFocusTrap(newPanel) : null;
    newPanel._cleanupFocusTrap = cleanupFocusTrap;

    console.log('TOS Helper: Summary panel shown');
};

/**
 * Hide the summary panel
 */
window.hideSummaryPanel = function () {
    const summaryPanel = getSummaryPanel();
    if (summaryPanel) {
        // Cleanup focus trap
        if (summaryPanel._cleanupFocusTrap) {
            summaryPanel._cleanupFocusTrap();
        }
        summaryPanel.remove();
        setSummaryPanel(null);
        console.log('TOS Helper: Summary panel hidden');
    }
};

/**
 * Update summary panel with analysis results
 */
window.updateSummaryPanel = function (data, fromCache = false, cacheTimestamp = null) {
    const summaryPanel = getSummaryPanel();
    if (!summaryPanel) return;

    const siteName = new URL(window.location.href).hostname;

    // Format cache timestamp if provided
    let cacheTimeText = '';
    if (fromCache && cacheTimestamp) {
        const cacheDate = new Date(cacheTimestamp);
        const now = new Date();
        const diffMs = now - cacheDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            cacheTimeText = 'just now';
        } else if (diffMins < 60) {
            cacheTimeText = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            cacheTimeText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            cacheTimeText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            cacheTimeText = `on ${cacheDate.toLocaleDateString()}`;
        }
    }

    // Update the entire content
    const content = getSummaryPanel().querySelector('.tos-helper-summary-content');
    content.innerHTML = `
        <div class="tos-helper-summary-header">
            <h1 id="tos-helper-summary-title">TOS Summary for ${siteName}</h1>
            <button id="tos-helper-close-btn" class="tos-helper-close-btn" aria-label="Close summary">
                ✕
            </button>
        </div>
        ${fromCache ? `
            <div class="tos-helper-cache-banner">
                <span class="tos-helper-cache-text">Showing cached analysis${cacheTimeText ? ` from ${cacheTimeText}` : ''}</span>
            </div>
        ` : ''}

        <div class="tos-helper-score-section">
            <div class="tos-helper-score-display">
                <span class="tos-helper-score-number" aria-label="Trust score">${data.overallScore}</span>
                <span class="tos-helper-score-max">/100</span>
            </div>
            <div class="tos-helper-score-label ${data.riskLevel}-risk">
                <strong>${data.riskLevel.toUpperCase()} RISK</strong>
            </div>
            ${data.scoreBreakdown ? `
                <div class="tos-helper-score-breakdown">
                    <h3 class="tos-helper-score-breakdown__title">Score Breakdown</h3>
                    <div class="tos-helper-breakdown-grid">
                        <div class="tos-helper-breakdown-item">
                            <div class="tos-helper-breakdown-label">Data Collection</div>
                            <div class="tos-helper-breakdown-bar">
                                <div class="tos-helper-breakdown-fill" style="width: ${data.scoreBreakdown.dataCollection}%"></div>
                            </div>
                            <div class="tos-helper-breakdown-value">${data.scoreBreakdown.dataCollection}/100</div>
                        </div>
                        <div class="tos-helper-breakdown-item">
                            <div class="tos-helper-breakdown-label">Third-Party Sharing</div>
                            <div class="tos-helper-breakdown-bar">
                                <div class="tos-helper-breakdown-fill" style="width: ${data.scoreBreakdown.thirdPartySharing}%"></div>
                            </div>
                            <div class="tos-helper-breakdown-value">${data.scoreBreakdown.thirdPartySharing}/100</div>
                        </div>
                        <div class="tos-helper-breakdown-item">
                            <div class="tos-helper-breakdown-label">User Control</div>
                            <div class="tos-helper-breakdown-bar">
                                <div class="tos-helper-breakdown-fill" style="width: ${data.scoreBreakdown.userControl}%"></div>
                            </div>
                            <div class="tos-helper-breakdown-value">${data.scoreBreakdown.userControl}/100</div>
                        </div>
                        <div class="tos-helper-breakdown-item">
                            <div class="tos-helper-breakdown-label">Term Fairness</div>
                            <div class="tos-helper-breakdown-bar">
                                <div class="tos-helper-breakdown-fill" style="width: ${data.scoreBreakdown.termFairness}%"></div>
                            </div>
                            <div class="tos-helper-breakdown-value">${data.scoreBreakdown.termFairness}/100</div>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>

        <section class="tos-helper-section">
            <h2 class="tos-helper-section-title">
                <button class="tos-helper-section-toggle" aria-expanded="true">
                    <span class="tos-helper-toggle-icon">▼</span>
                    Overview
                </button>
            </h2>
            <div class="tos-helper-section-content">
                <ul class="tos-helper-bullet-list">
                    ${data.overview.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </section>

        <section class="tos-helper-section">
            <h2 class="tos-helper-section-title">
                <button class="tos-helper-section-toggle" aria-expanded="true">
                    <span class="tos-helper-toggle-icon">▼</span>
                    Key Risks
                </button>
            </h2>
            <div class="tos-helper-section-content">
                <div class="tos-helper-risks-list">
                    ${data.risks.map(risk => `
                        <div class="tos-helper-risk-item">
                            <div class="tos-helper-risk-header">
                                <span class="tos-helper-risk-severity ${risk.severity}-severity" aria-label="${risk.severity} severity">
                                    ${risk.severity === 'high' ? '⚠' : risk.severity === 'medium' ? '⚡' : 'ℹ'}
                                    <span class="tos-helper-severity-text">${risk.severity.toUpperCase()}</span>
                                </span>
                                <h3 class="tos-helper-risk-title">${risk.title}</h3>
                            </div>
                            <p class="tos-helper-risk-description">${risk.description}</p>
                            ${risk.example ? `<p class="tos-helper-risk-example"><em>Example: ${risk.example}</em></p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <section class="tos-helper-section">
            <h2 class="tos-helper-section-title">
                <button class="tos-helper-section-toggle" aria-expanded="false">
                    <span class="tos-helper-toggle-icon">▶</span>
                    Data & Sharing
                </button>
            </h2>
            <div class="tos-helper-section-content" hidden>
                <div class="tos-helper-data-sharing-container">
                    ${data.dataSharing.collected && data.dataSharing.collected.length > 0 ? `
                        <div class="tos-helper-data-category">
                            <div class="tos-helper-data-category-header">
                                <h3 class="tos-helper-data-category-title">Data Collected</h3>
                            </div>
                            <div class="tos-helper-data-tags">
                                ${data.dataSharing.collected.map(item => `<span class="tos-helper-data-tag">${item}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${data.dataSharing.internalUse && data.dataSharing.internalUse.length > 0 ? `
                        <div class="tos-helper-data-category">
                            <div class="tos-helper-data-category-header">
                                <h3 class="tos-helper-data-category-title">Internal Use</h3>
                            </div>
                            <div class="tos-helper-data-tags">
                                ${data.dataSharing.internalUse.map(item => `<span class="tos-helper-data-tag">${item}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${data.dataSharing.thirdPartiesDetailed && data.dataSharing.thirdPartiesDetailed.length > 0 ? `
                        <div class="tos-helper-data-category tos-helper-data-category-full">
                            <div class="tos-helper-data-category-header">
                                <h3 class="tos-helper-data-category-title">Third-Party Sharing</h3>
                            </div>
                            <div class="tos-helper-third-party-grid">
                                ${data.dataSharing.thirdPartiesDetailed.map(tp => `
                                    <div class="tos-helper-third-party-card">
                                        <div class="tos-helper-third-party-category">${tp.category || 'Unknown'}</div>
                                        <div class="tos-helper-third-party-details">${tp.details || 'No details provided'}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="tos-helper-data-policies">
                        ${data.dataSharing.retention && data.dataSharing.retention !== 'Not mentioned' ? `
                            <div class="tos-helper-data-policy-item">
                                <div class="tos-helper-policy-content">
                                    <strong>Data Retention:</strong>
                                    <span>${data.dataSharing.retention}</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${data.dataSharing.userControls && data.dataSharing.userControls !== 'Not mentioned' ? `
                            <div class="tos-helper-data-policy-item">
                                <div class="tos-helper-policy-content">
                                    <strong>User Controls:</strong>
                                    <span>${data.dataSharing.userControls}</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </section>

        <section class="tos-helper-section">
            <h2 class="tos-helper-section-title">
                <button class="tos-helper-section-toggle" aria-expanded="false">
                    <span class="tos-helper-toggle-icon">▶</span>
                    Real-World Examples
                </button>
            </h2>
            <div class="tos-helper-section-content" hidden>
                <div class="tos-helper-examples-container">
                    ${data.examples.map((example, index) => `
                        <div class="tos-helper-example-card">
                            <div class="tos-helper-example-title">Example ${index + 1}</div>
                            <div class="tos-helper-example-text">${example}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>
    `;

    // Re-attach event listeners
    content.querySelector('#tos-helper-close-btn').addEventListener('click', hideSummaryPanel);
    content.querySelectorAll('.tos-helper-section-toggle').forEach(toggle => {
        toggle.addEventListener('click', handleSectionToggle);
    });

    console.log('TOS Helper: Modal updated with analysis results', { fromCache });
};

/**
 * Show cached summary (called from popup or cache check)
 */
window.showCachedSummary = function (cachedData) {
    console.log('TOS Helper: Displaying cached summary');

    // Close any existing panels
    if (window.hidePromptPanel) {
        window.hidePromptPanel();
    }
    hideSummaryPanel();

    // Extract analysis and timestamp from cached data
    const analysis = cachedData.analysis || cachedData; // Support both formats
    const timestamp = cachedData.timestamp;

    // Create summary panel
    showSummaryPanel(analysis);

    // Update with cached flag and timestamp
    window.updateSummaryPanel(analysis, true, timestamp);
};



/**
 * Show error in summary panel
 */
window.showError = function (errorMessage) {
    const summaryPanel = getSummaryPanel();
    if (!summaryPanel) return;

    const content = summaryPanel.querySelector('.tos-helper-summary-content');
    const siteName = new URL(window.location.href).hostname;

    content.innerHTML = `
        <div class="tos-helper-summary-header">
            <h1 id="tos-helper-summary-title">Error Analyzing TOS</h1>
            <button id="tos-helper-close-btn" class="tos-helper-close-btn" aria-label="Close summary">
                ✕
            </button>
        </div>
        <div class="tos-helper-error-container">
            <p class="tos-helper-error-icon">⚠ Analysis Failed</p>
            <p class="tos-helper-error-message">${errorMessage}</p>
        </div>
    `;

    content.querySelector('#tos-helper-close-btn').addEventListener('click', window.hideSummaryPanel);
};

/**
 * Handle section toggle
 */
function handleSectionToggle(event) {
    const button = event.currentTarget;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const content = button.closest('.tos-helper-section').querySelector('.tos-helper-section-content');
    const icon = button.querySelector('.tos-helper-toggle-icon');

    button.setAttribute('aria-expanded', !isExpanded);
    content.hidden = isExpanded;
    icon.textContent = isExpanded ? '▶' : '▼';
}

/**
 * Handle keyboard events in summary panel
 */
function handleSummaryKeydown(event) {
    if (event.key === 'Escape') {
        hideSummaryPanel();
    }
}
