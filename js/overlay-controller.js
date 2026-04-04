(() => {
    const overlayRegistry = new Map();
    let activeOverlayId = null;
    let lockedScrollY = 0;

    const toArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        return [value];
    };

    const resolveElements = (value) => {
        return toArray(value)
            .map((item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    return document.querySelector(item);
                }
                return item;
            })
            .filter(Boolean);
    };

    const consumeEvent = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
    };

    const readOpenState = (entry) => {
        if (!entry?.overlayEl) {
            return false;
        }
        return entry.overlayEl.classList.contains('active');
    };

    const applyBodyScrollLock = () => {
        const body = document.body;
        if (!body || body.dataset.overlayScrollLock === 'true') {
            return;
        }

        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        body.dataset.overlayScrollLock = 'true';
        body.style.position = 'fixed';
        body.style.top = `-${lockedScrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
    };

    const releaseBodyScrollLock = () => {
        const body = document.body;
        if (!body || body.dataset.overlayScrollLock !== 'true') {
            return;
        }

        const restoreY = Math.abs(Number.parseInt(body.style.top || `${-lockedScrollY}`, 10)) || lockedScrollY || 0;
        body.dataset.overlayScrollLock = 'false';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        window.scrollTo(0, restoreY);
        lockedScrollY = 0;
    };

    const syncActiveOverlayId = () => {
        if (activeOverlayId) {
            const currentEntry = overlayRegistry.get(activeOverlayId);
            if (!currentEntry || !readOpenState(currentEntry)) {
                activeOverlayId = null;
            }
        }

        if (!activeOverlayId) {
            const openEntry = Array.from(overlayRegistry.values()).find((entry) => readOpenState(entry));
            activeOverlayId = openEntry?.id || null;
        }

        document.body.classList.toggle('has-managed-overlay', Boolean(activeOverlayId));

        if (activeOverlayId) {
            applyBodyScrollLock();
        } else {
            releaseBodyScrollLock();
        }
    };

    const requestOpen = (id, payload = {}) => {
        const entry = overlayRegistry.get(id);
        if (!entry) {
            return false;
        }

        if (activeOverlayId && activeOverlayId !== id) {
            requestClose(activeOverlayId, { reason: 'switch', sourceOverlayId: id });
        }

        const result = typeof entry.onOpen === 'function'
            ? entry.onOpen(payload)
            : entry.overlayEl?.classList.add('active');

        if (result === false) {
            syncActiveOverlayId();
            return false;
        }

        syncActiveOverlayId();
        return readOpenState(entry);
    };

    const requestClose = (id, payload = {}) => {
        const entry = overlayRegistry.get(id);
        if (!entry) {
            return false;
        }

        const result = typeof entry.onClose === 'function'
            ? entry.onClose(payload)
            : entry.overlayEl?.classList.remove('active');

        if (result === false) {
            syncActiveOverlayId();
            return false;
        }

        syncActiveOverlayId();
        return !readOpenState(entry);
    };

    const registerOverlay = ({
        id,
        overlay,
        openButtons,
        closeButtons,
        onOpen,
        onClose,
        onEscape,
        closeOnBackdrop = true,
        closeOnEscape = true
    }) => {
        if (!id) {
            throw new Error('Overlay id is required');
        }

        const overlayEl = resolveElements(overlay)[0] || null;
        const entry = {
            id,
            overlayEl,
            onOpen,
            onClose,
            onEscape,
            closeOnEscape: closeOnEscape !== false
        };

        overlayRegistry.set(id, entry);

        const openEls = resolveElements(openButtons);
        const closeEls = resolveElements(closeButtons);

        openEls.forEach((element) => {
            element.addEventListener('click', (event) => {
                consumeEvent(event);
                requestOpen(id, { event, reason: 'trigger' });
            });
        });

        closeEls.forEach((element) => {
            element.addEventListener('click', (event) => {
                consumeEvent(event);
                requestClose(id, { event, reason: 'dismiss' });
            });
        });

        if (overlayEl && closeOnBackdrop) {
            overlayEl.addEventListener('click', (event) => {
                if (event.target !== overlayEl) {
                    return;
                }

                consumeEvent(event);
                requestClose(id, { event, reason: 'backdrop' });
            });
        }

        syncActiveOverlayId();

        return {
            open: (payload) => requestOpen(id, payload),
            close: (payload) => requestClose(id, payload),
            isOpen: () => readOpenState(entry)
        };
    };

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !activeOverlayId) {
            return;
        }

        const entry = overlayRegistry.get(activeOverlayId);
        if (!entry || entry.closeOnEscape === false) {
            return;
        }

        if (typeof entry.onEscape === 'function') {
            const handled = entry.onEscape({ event, close: () => requestClose(activeOverlayId, { event, reason: 'escape' }) });
            if (handled === false) {
                return;
            }
        }

        consumeEvent(event);
        requestClose(activeOverlayId, { event, reason: 'escape' });
    });

    window.AppShellOverlays = {
        registerOverlay,
        open: requestOpen,
        close: requestClose,
        isOpen: (id) => {
            const entry = overlayRegistry.get(id);
            return readOpenState(entry);
        },
        getActiveOverlayId: () => activeOverlayId
    };
})();
