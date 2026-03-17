import { getFbAuth, getFirebaseInitError, initFirebaseFromRuntimeConfig } from '../shared/firebase.js?v=20260317-23';
import { bindDomReferences, getCompanyById, setCompanyData, state } from './store.js?v=20260317-23';
import { filterCompanies, initializeCustomFilterSelects, populateFilters, renderArchitecturalMap, renderDatasetLoadError, syncCustomFilterSelects } from './render.js?v=20260317-23';
import { buildRouteStops, clearRouteVisuals, drawRoute, exportRouteImage, optimizeRoute, renderItineraryPanel, scrollToStand } from './route.js?v=20260317-23';
import { loadCompanyData } from './data.js?v=20260317-23';
import {
    getApplicationOnlineFlag,
    getCompanyInterest,
    getVisitFlag,
    loadLocalPreferences,
    mergePreferencesFromFirebase,
    resetUserPreferences,
    setApplicationOnlineFlag,
    setCompanyInterest,
    setVisitScore
} from './preferences.js?v=20260317-23';
import {
    clearCompanyExplainCache,
    clearGeminiApiKey,
    closeCompanyExplainPanel,
    closeAiKeyModal,
    generateCompanyExplain,
    hasCompanyExplainCache,
    isCompanyExplainPanelOpen,
    loadAiCache,
    openCompanyExplainPanel,
    openAiKeyModal,
    saveGeminiApiKeyFromModal,
    toggleAiKeyVisibility,
    updateAiKeyControls
} from './ai.js?v=20260317-23';
import { initialsFromUser, safeScrollIntoView } from '../shared/dom.js?v=20260317-23';
import { ONBOARDING_KEY } from '../shared/constants.js?v=20260317-23';

let scheduledFilterRender = 0;

function getPreferenceDeps() {
    return {
        getCompanyInterest: (companyId) => getCompanyInterest(state, companyId),
        getVisitFlag: (companyId) => getVisitFlag(state, companyId),
        getApplicationOnlineFlag: (companyId) => getApplicationOnlineFlag(state, companyId),
        onScrollStand: (stand) => scrollToStand(stand),
        onSetInterest: (companyId, value) => handleCompanyInterestAction(companyId, value),
        onSetVisit: (companyId, value) => handleCompanyVisitAction(companyId, value),
        onToggleOnline: (companyId, enabled) => handleCompanyOnlineAction(companyId, enabled),
        onResetPlanning: (companyId) => handleCompanyPlanningResetAction(companyId),
        onToggleAi: (companyId) => handleCompanyAiAction(companyId),
        onRegenerateAi: (companyId) => handleCompanyAiRegenerateAction(companyId),
        onDeleteAi: (companyId) => handleCompanyAiDeleteAction(companyId)
    };
}

function syncFiltersFromDom() {
    state.filters.search = state.dom.searchInput.value.trim();
    state.filters.sector = state.dom.sectorFilter.value;
    state.filters.laurea = state.dom.laureaFilter.value;
    state.filters.laureaMatch = state.dom.laureaMatchFilter.value;
    state.filters.interest = state.dom.interestFilter.value;
}

function applyFiltersAndRender() {
    syncFiltersFromDom();
    const filtered = filterCompanies(state, getPreferenceDeps());
    syncCustomFilterSelects(state);
    return filtered;
}

function scheduleFilterRender() {
    if (scheduledFilterRender) window.cancelAnimationFrame(scheduledFilterRender);
    scheduledFilterRender = window.requestAnimationFrame(() => {
        scheduledFilterRender = 0;
        applyFiltersAndRender();
    });
}

function preserveViewportAroundCompany(companyId, task) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const anchor = companyId
        ? state.dom.companyGrid?.querySelector(`article[data-company-id="${companyId}"]`)
        : null;
    const anchorTop = anchor?.getBoundingClientRect().top ?? null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && state.dom.companyGrid?.contains(active)) {
        active.blur();
    }

    task();

    window.requestAnimationFrame(() => {
        if (anchorTop !== null) {
            const nextAnchor = state.dom.companyGrid?.querySelector(`article[data-company-id="${companyId}"]`);
            if (nextAnchor) {
                window.scrollBy(0, nextAnchor.getBoundingClientRect().top - anchorTop);
                return;
            }
        }
        window.scrollTo(scrollX, scrollY);
    });
}

async function loginWithGoogle() {
    const auth = getFbAuth();
    if (!auth) {
        alert('Login non configurato. Verifica firebase-public-config.js.');
        return;
    }
    try {
        const provider = new window.firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (error) {
        if (error?.code !== 'auth/popup-closed-by-user') {
            console.error('Errore login Google:', error);
            alert(`Errore login: ${error.message || 'sconosciuto'}`);
        }
    }
}

async function logoutUser() {
    const auth = getFbAuth();
    if (!auth) return;
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Impossibile eseguire il logout in questo momento.');
    }
}

async function handleAuthStateChanged(user) {
    state.currentUser = user || null;
    if (!state.currentUser) {
        state.ui.trackedLoginUid = null;
        state.dom.loginBtn.classList.remove('hidden');
        state.dom.userInfo.classList.add('hidden');
        state.dom.userInfo.classList.remove('flex');
        updateAiKeyControls(state);
        applyFiltersAndRender();
        return;
    }

    state.dom.loginBtn.classList.add('hidden');
    state.dom.userInfo.classList.remove('hidden');
    state.dom.userInfo.classList.add('flex');
    state.dom.userName.textContent = state.currentUser.displayName || state.currentUser.email || state.currentUser.uid;
    state.dom.userAvatar.alt = '';
    if (state.currentUser.photoURL) {
        state.dom.userAvatar.src = state.currentUser.photoURL;
        state.dom.userAvatar.style.display = '';
        state.dom.userAvatarFallback.style.display = 'none';
        state.dom.userAvatar.onerror = () => {
            state.dom.userAvatar.style.display = 'none';
            state.dom.userAvatarFallback.style.display = 'flex';
            state.dom.userAvatarFallback.textContent = initialsFromUser(state.currentUser);
        };
    } else {
        state.dom.userAvatar.removeAttribute('src');
        state.dom.userAvatar.style.display = 'none';
        state.dom.userAvatarFallback.style.display = 'flex';
        state.dom.userAvatarFallback.textContent = initialsFromUser(state.currentUser);
    }

    updateAiKeyControls(state);
    if (state.ui.trackedLoginUid !== state.currentUser.uid) {
        state.ui.trackedLoginUid = state.currentUser.uid;
    }

    try {
        await mergePreferencesFromFirebase(state);
    } catch {
        alert('Non sono riuscito a sincronizzare le preferenze da Firebase. Continuo con i dati locali.');
    }

    applyFiltersAndRender();
}

function attachGlobalListeners() {
    state.dom.loginBtn.addEventListener('click', loginWithGoogle);
    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
    state.dom.setAiKeyBtn?.addEventListener('click', () => openAiKeyModal(state));
    state.dom.clearAiKeyBtn?.addEventListener('click', () => clearGeminiApiKey(state));
    state.dom.aiKeyModalClearBtn?.addEventListener('click', () => clearGeminiApiKey(state));
    state.dom.aiKeyVisibilityBtn?.addEventListener('click', () => toggleAiKeyVisibility(state));
    document.getElementById('ai-key-save-btn')?.addEventListener('click', () => saveGeminiApiKeyFromModal(state));
    document.getElementById('ai-key-cancel-btn')?.addEventListener('click', () => closeAiKeyModal(state));
    document.getElementById('ai-key-close-btn')?.addEventListener('click', () => closeAiKeyModal(state));
    state.dom.aiKeyModal?.addEventListener('click', (event) => {
        if (event.target === state.dom.aiKeyModal) closeAiKeyModal(state);
    });

    state.dom.searchInput.addEventListener('input', (event) => {
        state.ui.activeMapFilterStand = null;
        state.dom.resetMapBtn.classList.add('hidden');
        document.querySelectorAll('.stand-box').forEach((node) => node.classList.remove('active-filter'));
        scheduleFilterRender();
    });

    state.dom.sectorFilter.addEventListener('change', (event) => {
        scheduleFilterRender();
    });
    state.dom.laureaFilter.addEventListener('change', (event) => {
        scheduleFilterRender();
    });
    state.dom.laureaMatchFilter.addEventListener('change', (event) => {
        scheduleFilterRender();
    });
    state.dom.interestFilter.addEventListener('change', (event) => {
        scheduleFilterRender();
    });
    state.dom.resetFiltersBtn.addEventListener('click', resetAllFilters);
    state.dom.resetMapBtn.addEventListener('click', resetAllFilters);
    state.dom.resetPreferencesBtn.addEventListener('click', handleResetPreferences);
    state.dom.exportInterestedBtn.addEventListener('click', exportInterestedCompanies);

    document.getElementById('generate-itinerary-btn')?.addEventListener('click', generateItinerary);
    state.dom.clearRouteBtn.addEventListener('click', clearRoute);
    state.dom.exportRouteBtn.addEventListener('click', handleExportRoute);
    state.dom.routeMode.addEventListener('change', () => {
        if (state.ui.currentRoute.length > 0) generateItinerary();
    });

    state.dom.itineraryList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action="scroll-stand"]');
        if (!button) return;
        scrollToStand(button.dataset.stand);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !state.dom.aiKeyModal.classList.contains('hidden')) {
            closeAiKeyModal(state);
        }
    });
    document.getElementById('dismiss-onboarding-btn')?.addEventListener('click', dismissOnboarding);
}

function handleMapStandClick(standCode, nodeElement) {
    document.querySelectorAll('.stand-box').forEach((node) => node.classList.remove('active-filter'));
    if (state.ui.activeMapFilterStand === standCode) {
        state.ui.activeMapFilterStand = null;
        state.dom.searchInput.value = '';
        state.dom.resetMapBtn.classList.add('hidden');
    } else {
        state.ui.activeMapFilterStand = standCode;
        nodeElement.classList.add('active-filter');
        state.dom.searchInput.value = standCode;
        state.dom.resetMapBtn.classList.remove('hidden');
        safeScrollIntoView(state.dom.companyGrid, { behavior: 'smooth', block: 'start' });
    }
    applyFiltersAndRender();
}

function handleCompanyInterestAction(companyId, value) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        setCompanyInterest(state, companyId, value);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
            regenerateRouteIfNeeded();
        });
    } catch (error) {
        console.error('Errore aggiornamento interesse:', error);
        alert(error.message || 'Errore aggiornamento preferenze.');
    }
}

function handleCompanyVisitAction(companyId, value) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        setVisitScore(state, companyId, value);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
            regenerateRouteIfNeeded();
        });
    } catch (error) {
        console.error('Errore aggiornamento priorita visita:', error);
        alert('Impossibile aggiornare la priorità in questo momento.');
    }
}

function handleCompanyOnlineAction(companyId, enabled) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        setApplicationOnlineFlag(state, companyId, enabled);
        if (enabled && getVisitFlag(state, companyId) > 0) {
            setVisitScore(state, companyId, 0);
        }
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
            regenerateRouteIfNeeded();
        });
    } catch (error) {
        console.error('Errore aggiornamento modalita candidatura:', error);
        alert(error.message || 'Errore aggiornamento preferenze.');
    }
}

function handleCompanyPlanningResetAction(companyId) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        setVisitScore(state, companyId, 0);
        setApplicationOnlineFlag(state, companyId, false);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
            regenerateRouteIfNeeded();
        });
    } catch (error) {
        console.error('Errore reset pianificazione:', error);
        alert(error.message || 'Errore reset pianificazione.');
    }
}

async function handleCompanyAiAction(companyId) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        const hasCachedExplain = hasCompanyExplainCache(state, companyId);
        if (isCompanyExplainPanelOpen(state, companyId)) {
            closeCompanyExplainPanel(state, companyId);
            preserveViewportAroundCompany(companyId, () => {
                applyFiltersAndRender();
            });
            return;
        }
        openCompanyExplainPanel(state, companyId);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
        });
        if (!hasCachedExplain) {
            await generateCompanyExplain({ state, company });
        }
    } catch (error) {
        console.error('Errore info AI:', error);
        alert(error.message || 'Errore generazione info AI.');
    }
}

async function handleCompanyAiRegenerateAction(companyId) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        openCompanyExplainPanel(state, companyId);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
        });
        await generateCompanyExplain({ state, company, forceRefresh: true });
    } catch (error) {
        console.error('Errore rigenerazione info AI:', error);
        alert(error.message || 'Errore rigenerazione info AI.');
    }
}

function handleCompanyAiDeleteAction(companyId) {
    const company = getCompanyById(companyId);
    if (!company) return;
    try {
        clearCompanyExplainCache(state, companyId);
        preserveViewportAroundCompany(companyId, () => {
            applyFiltersAndRender();
        });
    } catch (error) {
        console.error('Errore cancellazione info AI:', error);
        alert(error.message || 'Errore cancellazione info AI.');
    }
}

function resetAllFilters() {
    state.ui.activeMapFilterStand = null;
    state.dom.searchInput.value = '';
    state.dom.sectorFilter.value = 'all';
    state.dom.laureaFilter.value = 'all';
    state.dom.laureaMatchFilter.value = 'all';
    state.dom.interestFilter.value = 'all';
    state.dom.laureaSubFilter.classList.add('hidden');
    state.dom.resetMapBtn.classList.add('hidden');
    document.querySelectorAll('.stand-box').forEach((node) => node.classList.remove('active-filter'));
    applyFiltersAndRender();
}

async function handleResetPreferences() {
    const confirmed = window.confirm('Vuoi ripristinare tutte le preferenze (interessi, punteggi visite e flag solo online)?');
    if (!confirmed) return;
    try {
        await resetUserPreferences(state);
        clearRoute();
        applyFiltersAndRender();
    } catch {
        alert('Impossibile ripristinare le preferenze in questo momento.');
    }
}

function generateItinerary() {
    const stops = buildRouteStops({
        state,
        getVisitFlag: (companyId) => getVisitFlag(state, companyId),
        getCompanyInterest: (companyId) => getCompanyInterest(state, companyId),
        getApplicationOnlineFlag: (companyId) => getApplicationOnlineFlag(state, companyId)
    });
    if (!stops.length) {
        alert('Nessuna azienda selezionata!\nSegna almeno un\'azienda come "Interessato" o con una priorità visita.');
        return;
    }

    const route = optimizeRoute(stops, state.dom.routeMode.value, state.dom.pavilionMapLayout);
    state.ui.currentRoute = route;
    drawRoute(route, state);
    renderItineraryPanel(route, state);
    safeScrollIntoView(state.dom.mapScrollContainer, { behavior: 'smooth', block: 'start' });
}

function clearRoute() {
    clearRouteVisuals(state);
    state.ui.currentRoute = [];
}

function regenerateRouteIfNeeded() {
    if (!state.ui.currentRoute.length) return;
    const stops = buildRouteStops({
        state,
        getVisitFlag: (companyId) => getVisitFlag(state, companyId),
        getCompanyInterest: (companyId) => getCompanyInterest(state, companyId),
        getApplicationOnlineFlag: (companyId) => getApplicationOnlineFlag(state, companyId)
    });
    if (!stops.length) {
        clearRoute();
        return;
    }
    const route = optimizeRoute(stops, state.dom.routeMode.value, state.dom.pavilionMapLayout);
    state.ui.currentRoute = route;
    drawRoute(route, state);
    renderItineraryPanel(route, state);
}

async function handleExportRoute() {
    try {
        await exportRouteImage(state);
    } catch (error) {
        console.error('Errore export itinerario:', error);
        alert(`Errore durante l'esportazione: ${error.message || 'sconosciuto'}`);
    }
}

function exportInterestedCompanies() {
    const interested = state.companies.filter((company) => {
        const interestFlag = getCompanyInterest(state, company.id);
        const visitScore = getVisitFlag(state, company.id);
        return interestFlag === 'interested' || visitScore > 0;
    });
    if (!interested.length) {
        alert('Nessuna azienda segnata come interessata o con priorità visita.');
        return;
    }

    const separator = '\t';
    const header = ['Nome', 'Settore', 'Stand', 'Interesse', 'Presentarsi', 'Sito Web', 'Email', 'Pagina Career Day', 'LinkedIn', 'Posizioni'].join(separator);
    const rows = interested.map((company) => {
        const interestFlag = getCompanyInterest(state, company.id);
        const visitScore = getVisitFlag(state, company.id);
        return [
            company.name,
            company.sector,
            company.standLabel,
            interestFlag === 'interested' ? 'Sì' : '',
            visitScore > 0 ? '★'.repeat(visitScore) : '',
            company.sito || '',
            company.email || '',
            company.urlPagina || '',
            company.linkedinUrl,
            company.areaInserimento.join(' | ')
        ].join(separator);
    });

    const tsv = [header, ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
        const original = state.dom.exportInterestedBtn.innerHTML;
        state.dom.exportInterestedBtn.innerHTML = '✓ Copiato!';
        window.setTimeout(() => {
            state.dom.exportInterestedBtn.innerHTML = original;
        }, 2000);
    }).catch((error) => {
        console.error('Errore clipboard, fallback CSV:', error);
        const escapeCsv = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
        const csvHeader = ['Nome', 'Settore', 'Stand', 'Interesse', 'Presentarsi', 'Sito Web', 'Email', 'Pagina Career Day', 'LinkedIn', 'Posizioni'].join(',');
        const csvRows = interested.map((company) => {
            const interestFlag = getCompanyInterest(state, company.id);
            const visitScore = getVisitFlag(state, company.id);
            return [
                escapeCsv(company.name),
                escapeCsv(company.sector),
                escapeCsv(company.standLabel),
                escapeCsv(interestFlag === 'interested' ? 'Sì' : ''),
                escapeCsv(visitScore > 0 ? String(visitScore) : ''),
                escapeCsv(company.sito),
                escapeCsv(company.email),
                escapeCsv(company.urlPagina),
                escapeCsv(company.linkedinUrl),
                escapeCsv(company.areaInserimento.join(' | '))
            ].join(',');
        });
        const blob = new Blob([`\uFEFF${csvHeader}\n${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.download = 'aziende-interessate-career-day.csv';
        link.href = URL.createObjectURL(blob);
        link.click();
    });
}

function dismissOnboarding() {
    state.dom.onboardingBanner.style.display = 'none';
    try {
        localStorage.setItem(ONBOARDING_KEY, '1');
    } catch (error) {
        console.error('Errore salvataggio onboarding:', error);
    }
}

function setupOnboarding() {
    try {
        if (localStorage.getItem(ONBOARDING_KEY)) {
            state.dom.onboardingBanner.style.display = 'none';
        }
    } catch (error) {
        console.error('Errore lettura onboarding:', error);
    }
}

async function initAuth() {
    const auth = getFbAuth();
    if (!auth) {
        state.dom.loginBtn.classList.add('opacity-50', 'cursor-not-allowed');
        state.dom.loginBtn.title = getFirebaseInitError()?.message || 'Firebase non disponibile';
        return;
    }
    auth.onAuthStateChanged((user) => {
        handleAuthStateChanged(user).catch((error) => {
            console.error('Errore update stato auth:', error);
            alert('Errore durante la sincronizzazione dell\'account.');
        });
    });
}

export async function initDashboard() {
    initFirebaseFromRuntimeConfig();
    bindDomReferences();
    loadLocalPreferences(state);
    loadAiCache(state);
    updateAiKeyControls(state);
    setupOnboarding();

    try {
        const { companies, laureaToAreasMap } = await loadCompanyData();
        setCompanyData(companies, laureaToAreasMap);
    } catch (error) {
        console.error('Errore caricamento dataset:', error);
        renderDatasetLoadError(state, error);
        return;
    }

    populateFilters(state);
    initializeCustomFilterSelects(state);
    renderArchitecturalMap(state, { onMapStandClick: handleMapStandClick });
    attachGlobalListeners();
    applyFiltersAndRender();
    await initAuth();
}
