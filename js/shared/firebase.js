let firebaseInitState = {
    attempted: false,
    auth: null,
    db: null,
    error: null
};

function hasValidConfig(cfg) {
    return !!(cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim());
}

export function initFirebaseFromRuntimeConfig() {
    if (firebaseInitState.attempted) return firebaseInitState;
    firebaseInitState.attempted = true;

    const cfg = window.__FIREBASE_PUBLIC_CONFIG__;
    if (!hasValidConfig(cfg)) {
        firebaseInitState.error = new Error('Firebase non configurato. Controlla firebase-public-config.js.');
        console.warn(firebaseInitState.error.message);
        return firebaseInitState;
    }

    if (!window.firebase) {
        firebaseInitState.error = new Error('Firebase SDK non disponibile.');
        console.error(firebaseInitState.error.message);
        return firebaseInitState;
    }

    try {
        const app = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(cfg);
        firebaseInitState.auth = app.auth();
        firebaseInitState.db = app.database();
    } catch (error) {
        firebaseInitState.error = error;
        console.error('Errore inizializzazione Firebase:', error);
    }

    return firebaseInitState;
}

export function getFbAuth() {
    return initFirebaseFromRuntimeConfig().auth;
}

export function getFbDb() {
    return initFirebaseFromRuntimeConfig().db;
}

export function getFirebaseInitError() {
    return initFirebaseFromRuntimeConfig().error;
}

export function isFirebaseReady() {
    const state = initFirebaseFromRuntimeConfig();
    return !!(state.auth && state.db);
}
