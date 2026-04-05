(() => {
    if (window.__nativeBackHandlerRegistered) {
        return;
    }
    window.__nativeBackHandlerRegistered = true;

    const isOverlayActive = (selector) => {
        const element = document.querySelector(selector);
        return Boolean(element && !element.hidden && element.classList.contains('active'));
    };

    const collapseExpandedStatsIfNeeded = () => {
        const panel = document.getElementById('insights-panel');
        if (!panel || panel.classList.contains('is-collapsed')) {
            return false;
        }

        if (typeof window.setPeriodStatsCollapsed === 'function') {
            window.setPeriodStatsCollapsed(true);
            return true;
        }

        panel.classList.add('is-collapsed');
        return true;
    };

    const handleBackNavigation = () => {
        if (window.isProfileColorPaletteOpen?.()) {
            window.closeProfileColorPalette?.();
            return true;
        }

        if (window.isProfileEditOverlayOpen?.()) {
            window.closeProfileEditOverlay?.();
            return true;
        }

        if (window.isDayModalOpen?.()) {
            window.closeDayModal?.();
            return true;
        }

        if (isOverlayActive('#app-update-banner')) {
            window.AppUpdate?.hideBanner?.();
            return true;
        }

        const activeOverlayId = window.AppShellOverlays?.getActiveOverlayId?.();
        if (activeOverlayId) {
            const closed = window.AppShellOverlays.close(activeOverlayId, { reason: 'system-back' });
            return closed !== false;
        }

        if (collapseExpandedStatsIfNeeded()) {
            return true;
        }

        return false;
    };

    const registerNativeBackHandler = () => {
        const appPlugin = window.Capacitor?.Plugins?.App;
        const isAndroid = window.Capacitor?.getPlatform?.() === 'android';

        if (!isAndroid || !appPlugin?.addListener) {
            return;
        }

        appPlugin.addListener('backButton', ({ canGoBack }) => {
            if (handleBackNavigation()) {
                return;
            }

            if (canGoBack && window.history.length > 1) {
                window.history.back();
                return;
            }

            if (typeof appPlugin.minimizeApp === 'function') {
                appPlugin.minimizeApp();
                return;
            }

            if (typeof appPlugin.exitApp === 'function') {
                appPlugin.exitApp();
            }
        });
    };

    registerNativeBackHandler();

    window.__appBackNavigation = {
        handleBackNavigation
    };
})();
