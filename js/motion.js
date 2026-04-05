(() => {
    const rootEl = document.documentElement;
    const durationVars = Object.freeze({
        revealHide: '--motion-reveal-hide-duration',
        overlayHide: '--motion-overlay-hide-duration',
        tiltReset: '--motion-tilt-reset-duration',
        visualSwitchGuard: '--motion-visual-switch-guard-duration',
        holdProgress: '--motion-duration-progress'
    });

    const parseCssTimeToMs = (value, fallbackMs = 0) => {
        if (typeof value !== 'string') {
            return fallbackMs;
        }

        const trimmed = value.trim();
        if (!trimmed || trimmed === 'none') {
            return 0;
        }

        if (trimmed.endsWith('ms')) {
            const numericValue = Number.parseFloat(trimmed);
            return Number.isFinite(numericValue) ? numericValue : fallbackMs;
        }

        if (trimmed.endsWith('s')) {
            const numericValue = Number.parseFloat(trimmed);
            return Number.isFinite(numericValue) ? Math.round(numericValue * 1000) : fallbackMs;
        }

        const numericValue = Number.parseFloat(trimmed);
        return Number.isFinite(numericValue) ? numericValue : fallbackMs;
    };

    const readCssTimeVar = (customPropertyName, fallbackMs = 0) => {
        if (!rootEl) {
            return fallbackMs;
        }

        const value = getComputedStyle(rootEl).getPropertyValue(customPropertyName);
        return parseCssTimeToMs(value, fallbackMs);
    };

    const getDurationMs = (key, fallbackMs = 0) => {
        const customPropertyName = durationVars[key] || key;
        return readCssTimeVar(customPropertyName, fallbackMs);
    };

    window.AppMotion = Object.freeze({
        getDurationMs,
        parseCssTimeToMs,
        vars: durationVars
    });
})();