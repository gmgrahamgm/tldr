# TOS Helper (TL;DR)

Chrome extension that automatically detects Terms of Service pages and generates AI-powered summaries with quantifiable trust scores.

## Features

- 🤖 **AI-Powered Analysis** - Uses OpenAI GPT-4o-mini to parse and summarize Terms of Service
- 📊 **Trust Score (0-100)** - Quantifiable rating based on data collection, sharing, user control, and term fairness
- ⚠️ **Risk Highlights** - Plain-language explanations of concerning clauses with real-world examples
- 📋 **Data Sharing Breakdown** - Clear categorization of what data is collected and who receives it
- ♿ **WCAG 2.1 AA Compliant** - Full keyboard navigation, screen reader support, and dark mode
- 🔄 **Smart Caching** - Local storage of analysis results to minimize API calls
- 🌐 **Environment Detection** - Automatically switches between local development and production backend

## Installation

See **[INSTALL.md](INSTALL.md)** for detailed installation instructions.

**Quick Start:**
1. Download `tos-helper-extension.zip` and extract
2. Open `chrome://extensions/` and enable Developer Mode
3. Click "Load unpacked" and select the `extension` folder

## Architecture

### Production Deployment

- **Extension:** Chrome Extension (Manifest V3)
- **Backend:** Flask API with Docker on Render free tier
- **AI Model:** OpenAI GPT-4o-mini
- **Deployment URL:** https://tldr-xv48.onrender.com

### Local Development

**Extension:**
1. Load the unpacked extension from `chrome://extensions/`
2. Extension auto-detects if local backend is running

**Backend Server:**
1. Navigate to the `backend` folder
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and add your `OPENAI_API_KEY`
6. Run the server: `python app.py`

The extension will automatically use `localhost:5000` when available, otherwise falls back to production.

## Deployment Guide

### Production (Render)

The `production` branch is configured for deployment to Render:

1. **Push to GitHub:** Changes to `production` branch auto-deploy
2. **Render Configuration:** `render.yaml` defines Docker-based web service
3. **Environment Variables:** Set in Render Dashboard:
   - `OPENAI_API_KEY` (required)
   - `FLASK_ENV=production`
   - `OPENAI_MODEL=gpt-4o-mini`
4. **Keep-Alive:** Extension pings backend every 10 minutes to prevent spin-down
5. **Cold Start:** First request after 15min idle takes 30-60 seconds

### Docker Deployment

```bash
cd backend
docker build -t tos-helper-api .
docker run -p 10000:10000 -e OPENAI_API_KEY=your_key tos-helper-api
```

## File Structure

```
tldr/
├── extension/
│   ├── manifest.json          # Chrome extension configuration (v1.0.0)
│   ├── background.js          # Service worker with environment detection and keep-alive
│   ├── detector.js            # TOS page detection and entry point for content scripts
│   ├── controller.js          # Analysis workflow orchestrator and state management
│   ├── config.js              # Configuration constants for detection and analysis
│   ├── config.backend.js      # Backend URL configuration with auto-detection
│   ├── accessibility.js       # Focus trap implementation for accessible modals
│   ├── panels/
│   │   ├── promptPanel.js     # Initial TOS detection prompt with action buttons
│   │   ├── loadingPanel.js    # Analysis loading state with cancellation option
│   │   ├── summaryPanel.js    # Analysis results display with collapsible sections
│   │   └── popupPanel.js      # Extension icon popup for cache management and actions
│   └── styles/
│       ├── base.css           # Design tokens, variables, animations, accessibility helpers
│       ├── components.css     # Shared button, badge, alert, card components
│       ├── panels.css         # Panel-specific layouts for all modal dialogs
│       └── popup.css          # Browser action popup styles
├── backend/
│   ├── app.py                 # Flask API server (production CORS, health checks)
│   ├── analyzer.py            # OpenAI integration for TOS analysis generation
│   ├── requirements.txt       # Python dependencies (includes gunicorn)
│   ├── Dockerfile             # Production Docker container configuration
│   ├── .dockerignore          # Docker build exclusions
│   └── .env.example           # Template for environment variables
├── render.yaml                # Render deployment configuration
├── INSTALL.md                 # User installation guide
└── README.md                  # This file
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
