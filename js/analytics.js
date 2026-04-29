function getFirebaseAnalytics() {
    return window.Capacitor?.Plugins?.FirebaseAnalytics ?? null;
}

function logEvent(name, params) {
    const analytics = getFirebaseAnalytics();
    if (!analytics) {
        return;
    }
    analytics.logEvent({ name, params: params ?? {} }).catch(() => {});
}

function analyticsInit() {
    const analytics = getFirebaseAnalytics();
    if (!analytics) {
        return;
    }

    const firstOpenKey = 'analytics:firstOpenSent';
    if (!localStorage.getItem(firstOpenKey)) {
        logEvent('first_open_custom');
        localStorage.setItem(firstOpenKey, '1');
    }

    logEvent('app_open');
}

document.addEventListener('DOMContentLoaded', analyticsInit);

const AppAnalytics = {
    logEvent
};
