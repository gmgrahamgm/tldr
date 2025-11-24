// TOS Helper - Backend Configuration with Environment Detection
// Automatically switches between local development and production Render backend

/**
 * Detect if we're running in a development environment
 * Checks if we can reach localhost backend
 */
async function detectEnvironment() {
    const LOCAL_URL = 'http://localhost:5000';
    const PRODUCTION_URL = 'https://tos-helper-api.onrender.com';

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

/**
 * Get the backend URL (cached after first detection)
 * This is called by background.js on initialization
 */
let cachedBackendUrl = null;

async function getBackendUrl() {
    if (!cachedBackendUrl) {
        cachedBackendUrl = await detectEnvironment();
    }
    return cachedBackendUrl;
}

/**
 * Force re-detection of environment (useful for testing)
 */
function resetBackendUrl() {
    cachedBackendUrl = null;
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getBackendUrl, resetBackendUrl };
}
