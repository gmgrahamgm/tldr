# TL;DR

Chrome extension that detects Terms of Service pages and generates AI-powered summaries with trust scores.

## Setup

### Extension
1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` folder

### Backend Server
1. Navigate to the `backend` folder
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Create `.env` file with your `OPENAI_API_KEY`
6. Run the server: `python app.py`

## File Structure

```
tldr/
├── extension/
│   ├── manifest.json          # Chrome extension configuration and permissions
│   ├── background.js          # Service worker for extension lifecycle and API communication
│   ├── detector.js            # TOS page detection and entry point for content scripts
│   ├── controller.js          # Analysis workflow orchestrator and state management
│   ├── config.js              # Configuration constants for detection and analysis
│   ├── accessibility.js       # Focus trap implementation for accessible modals
│   ├── styles.css             # Global styling for extension UI components
│   ├── popup.html             # Legacy browser action popup (now unused)
│   ├── popup.js               # Legacy popup script (now unused)
│   ├── panels/
│   │   ├── promptPanel.js     # Initial TOS detection prompt with action buttons
│   │   ├── loadingPanel.js    # Analysis loading state with cancellation option
│   │   ├── summaryPanel.js    # Analysis results display with collapsible sections
│   │   └── popupPanel.js      # Extension icon popup for cache management and actions
│   └── styles/
│       ├── base.css           # Design tokens, variables, animations, accessibility helpers
│       ├── components.css     # Shared button, badge, alert, card components
│       ├── panels.css         # Panel-specific layouts for all modal dialogs
│       └── popup.css          # Legacy popup styles (maintained for compatibility)
└── backend/
    ├── app.py                 # Flask API server with TOS analysis endpoint
    ├── analyzer.py            # OpenAI integration for TOS analysis generation
    ├── requirements.txt       # Python dependencies for Flask and OpenAI
    ├── .env.example           # Template for environment variables
    └── dummy_analysis.json    # Mock response for testing without API calls
```

## Accessibility

The extension implements WCAG 2.1 Level AA compliance with the following features:

- **Focus Management**: All modal dialogs (prompt, loading, summary, popup) implement focus trapping that cycles keyboard navigation within the active panel and returns focus to the trigger element on close.
- **ARIA Attributes**: Comprehensive semantic markup including `role="dialog"`, `aria-modal="true"`, `aria-live` regions for status updates, `aria-controls` for expandable sections, and `aria-labelledby`/`aria-describedby` for screen reader context.
- **Keyboard Navigation**: Full keyboard support with Tab/Shift+Tab cycling, Escape key to close modals, Enter/Space for button activation, and proper focus indicators on all interactive elements.
- **Color Contrast**: All text combinations meet WCAG AA minimum contrast ratio of 4.5:1, with most exceeding 7:1 (AAA level) in both light and dark modes.
- **Reduced Motion**: Users with `prefers-reduced-motion: reduce` system preference have all animations and transitions disabled for a static experience.
- **Dark Mode**: Automatic theme switching based on `prefers-color-scheme` system preference with 30+ adjusted color tokens for optimal readability.
- **High Contrast Mode**: Enhanced border widths, outline visibility, and visual separators for users with `prefers-contrast: high` preference.
- **Screen Reader Support**: Status changes and dynamic content updates are announced via `aria-live` regions, and all interactive elements have descriptive labels.
