// TOS Helper - Accessibility Utilities
// Focus trapping and keyboard navigation helpers

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container) {
    const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Create a focus trap for modal dialogs
 * Returns cleanup function
 */
window.createFocusTrap = function (container) {
    let lastFocusedElement = document.activeElement;

    // Get focusable elements
    const getFocusables = () => getFocusableElements(container);

    // Handle tab key navigation
    const handleKeyDown = (event) => {
        if (event.key !== 'Tab') return;

        const focusables = getFocusables();
        if (focusables.length === 0) return;

        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];

        // Shift + Tab (backwards)
        if (event.shiftKey) {
            if (document.activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable.focus();
            }
        }
        // Tab (forwards)
        else {
            if (document.activeElement === lastFocusable) {
                event.preventDefault();
                firstFocusable.focus();
            }
        }
    };

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Focus first element
    const focusables = getFocusables();
    if (focusables.length > 0) {
        // Focus close button if available, otherwise first focusable
        const closeButton = container.querySelector('[aria-label*="Close"], .tos-helper-close-btn');
        const elementToFocus = closeButton || focusables[0];

        setTimeout(() => {
            elementToFocus.focus();
        }, 100);
    }

    // Return cleanup function
    return () => {
        container.removeEventListener('keydown', handleKeyDown);

        // Restore focus to previous element
        if (lastFocusedElement && lastFocusedElement.focus) {
            setTimeout(() => {
                lastFocusedElement.focus();
            }, 100);
        }
    };
};

/**
 * Announce message to screen readers
 */
window.announceToScreenReader = function (message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority); // 'polite' or 'assertive'
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'tos-helper-sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        announcement.remove();
    }, 1000);
};

/**
 * Skip link helper for long content
 */
window.addSkipLinks = function (container, sections) {
    const skipNav = document.createElement('nav');
    skipNav.className = 'tos-helper-skip-links';
    skipNav.setAttribute('aria-label', 'Skip to section');

    const skipList = document.createElement('ul');

    sections.forEach(section => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${section.id}`;
        link.textContent = `Skip to ${section.label}`;
        link.className = 'tos-helper-skip-link';

        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(section.id);
            if (target) {
                target.setAttribute('tabindex', '-1');
                target.focus();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        li.appendChild(link);
        skipList.appendChild(li);
    });

    skipNav.appendChild(skipList);
    container.insertBefore(skipNav, container.firstChild);
};
