// TOS Helper - Configuration and Constants

const CONFIG = {
    DETECTION_THRESHOLD: 2, // Minimum score to trigger TOS detection
    MAX_TEXT_LENGTH: 50000, // Limit text sent to backend
    ANALYSIS_TIMEOUT: 60000, // Analysis timeout in milliseconds (1 minute)
};

// Blocked URLs - domains/patterns where extension should never activate
const BLOCKED_URL_PATTERNS = [
    'google.com/search',
    'bing.com/search',
    'duckduckgo.com',
    'yahoo.com/search',
    'reddit.com/r/',
    'twitter.com/search',
    'x.com/search',
    'youtube.com/watch',
    'youtube.com/results',
    'facebook.com/search',
    'amazon.com/s/',
    'ebay.com/sch/',
    'wikipedia.org/wiki/',
    'github.com/search',
    'stackoverflow.com/search',
    'localhost',
    '127.0.0.1'
];

// URL-based detection patterns
const URL_PATTERNS = [
    'terms',
    'tos',
    'eula',
    'legal',
    'conditions',
    'user-agreement',
    'terms-of-service',
    'terms-of-use',
    'privacy',
    'policy',
    'guidelines'
];

// Heading text patterns (case-insensitive)
const HEADING_PATTERNS = [
    'terms of service',
    'terms and conditions',
    'terms of use',
    'user agreement',
    'end user license agreement',
    'eula',
    'terms & conditions',
    'service agreement',
    'acceptable use policy',
    'community guidelines'
];

// Legal language patterns (case-insensitive)
const LEGAL_PHRASES = [
    'by using this service you agree',
    'by accessing this service',
    'limitation of liability',
    'governing law',
    'indemnify',
    'arbitration',
    'dispute resolution',
    'warranties and disclaimers',
    'intellectual property',
    'prohibited uses',
    'termination of service',
    'acceptance of terms',
    'appeals'
];
