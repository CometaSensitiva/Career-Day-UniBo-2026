import {
    APPLICATION_ONLINE_STORAGE_KEY,
    INTEREST_STORAGE_KEY,
    PREFERENCES_META_STORAGE_KEY,
    VISIT_STORAGE_KEY
} from '../shared/constants.js?v=20260317-15';
import { getFbDb } from '../shared/firebase.js?v=20260317-15';
import { normalizePreferences } from '../shared/contracts.js?v=20260317-15';

const SECTION_KEYS = ['interests', 'visits', 'applicationOnline'];

export function loadLocalPreferences(state) {
    const local = normalizePreferences({
        interests: readJson(INTEREST_STORAGE_KEY),
        visits: readJson(VISIT_STORAGE_KEY),
        applicationOnline: readJson(APPLICATION_ONLINE_STORAGE_KEY),
        ...readJson(PREFERENCES_META_STORAGE_KEY)
    });
    state.preferences = local;
}

export function saveLocalPreferences(state) {
    try {
        localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(state.preferences.interests));
        localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(state.preferences.visits));
        localStorage.setItem(APPLICATION_ONLINE_STORAGE_KEY, JSON.stringify(state.preferences.applicationOnline));
        localStorage.setItem(PREFERENCES_META_STORAGE_KEY, JSON.stringify({
            interestsUpdatedAt: state.preferences.interestsUpdatedAt,
            visitsUpdatedAt: state.preferences.visitsUpdatedAt,
            applicationOnlineUpdatedAt: state.preferences.applicationOnlineUpdatedAt
        }));
    } catch (error) {
        console.error('Errore salvataggio preferenze locali:', error);
    }
}

export function getCompanyInterest(state, companyId) {
    return state.preferences.interests[String(companyId)] || 'unset';
}

export function getVisitFlag(state, companyId) {
    return state.preferences.visits[String(companyId)] || 0;
}

export function getApplicationOnlineFlag(state, companyId) {
    return !!state.preferences.applicationOnline[String(companyId)];
}

export function setCompanyInterest(state, companyId, status) {
    const key = String(companyId);
    if (status === 'unset') delete state.preferences.interests[key];
    else state.preferences.interests[key] = status;
    state.preferences.interestsUpdatedAt = Date.now();
    saveLocalPreferences(state);
    syncSectionToFirebase(state, 'interests');
}

export function setVisitScore(state, companyId, score) {
    const numericScore = Math.max(0, Math.min(5, Number(score) || 0));
    const key = String(companyId);
    if (numericScore > 0) state.preferences.visits[key] = numericScore;
    else delete state.preferences.visits[key];
    state.preferences.visitsUpdatedAt = Date.now();
    saveLocalPreferences(state);
    syncSectionToFirebase(state, 'visits');
}

export function setApplicationOnlineFlag(state, companyId, enabled) {
    const key = String(companyId);
    if (enabled) state.preferences.applicationOnline[key] = true;
    else delete state.preferences.applicationOnline[key];
    state.preferences.applicationOnlineUpdatedAt = Date.now();
    saveLocalPreferences(state);
    syncSectionToFirebase(state, 'applicationOnline');
}

export async function mergePreferencesFromFirebase(state) {
    const db = getFbDb();
    if (!db || !state.currentUser) return;

    try {
        const snap = await db.ref(`users/${state.currentUser.uid}/preferences`).once('value');
        const remote = normalizePreferences(snap.val() || {});
        const local = normalizePreferences(state.preferences);
        const merged = normalizePreferences();
        let shouldPushMerged = false;

        SECTION_KEYS.forEach((section) => {
            const timestampKey = `${section}UpdatedAt`;
            if (remote[timestampKey] > local[timestampKey]) {
                merged[section] = remote[section];
                merged[timestampKey] = remote[timestampKey];
            } else {
                merged[section] = local[section];
                merged[timestampKey] = local[timestampKey];
                if (local[timestampKey] > remote[timestampKey]) shouldPushMerged = true;
            }
        });

        state.preferences = merged;
        saveLocalPreferences(state);

        if (shouldPushMerged) {
            await db.ref(`users/${state.currentUser.uid}/preferences`).update(merged);
        }
    } catch (error) {
        console.error('Errore merge preferenze da Firebase:', error);
        throw error;
    }
}

export async function resetUserPreferences(state) {
    state.preferences = normalizePreferences();
    saveLocalPreferences(state);
    const db = getFbDb();
    if (!db || !state.currentUser) return;
    try {
        await db.ref(`users/${state.currentUser.uid}/preferences`).remove();
    } catch (error) {
        console.error('Errore reset preferenze Firebase:', error);
        throw error;
    }
}

function syncSectionToFirebase(state, section) {
    const db = getFbDb();
    if (!db || !state.currentUser) return;
    const timestampKey = `${section}UpdatedAt`;
    db.ref(`users/${state.currentUser.uid}/preferences`).update({
            [section]: state.preferences[section],
            [timestampKey]: state.preferences[timestampKey]
        }).catch((error) => {
        console.error(`Errore sincronizzazione sezione ${section} su Firebase:`, error);
    });
}

function readJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (error) {
        console.error(`Errore lettura JSON locale (${key}):`, error);
        return {};
    }
}
