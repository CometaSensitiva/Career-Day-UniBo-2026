import { GEMINI_CACHE_STORAGE, GEMINI_KEY_STORAGE } from '../shared/constants.js?v=20260317-15';
import { setText, toggleHidden } from '../shared/dom.js?v=20260317-15';
import { renderExplainContent } from './render.js?v=20260317-15';

function getGeminiStorageKey(currentUser) {
    return currentUser?.uid ? `${GEMINI_KEY_STORAGE}_${currentUser.uid}` : GEMINI_KEY_STORAGE;
}

function getExplainCacheKey(currentUser, companyId, laurea) {
    const userKey = currentUser?.uid || 'guest';
    return `${userKey}:${companyId}:${laurea || 'all'}`;
}

export function getCompanyExplainCacheKey(state, companyId) {
    return getExplainCacheKey(state.currentUser, companyId, state.filters.laurea);
}

export function hasCompanyExplainCache(state, companyId) {
    const cacheKey = getCompanyExplainCacheKey(state, companyId);
    return !!state.ui.aiCache[cacheKey]?.text;
}

export function clearCompanyExplainCache(state, companyId) {
    const currentCacheKey = getCompanyExplainCacheKey(state, companyId);
    const openCacheKey = state.ui.aiPanels[String(companyId)]?.cacheKey || '';
    delete state.ui.aiCache[currentCacheKey];
    if (openCacheKey && openCacheKey !== currentCacheKey) {
        delete state.ui.aiCache[openCacheKey];
    }
    persistAiCache(state.ui.aiCache);
    closeCompanyExplainPanel(state, companyId);
}

function getExplainPanel(companyId) {
    const container = document.getElementById(`explain-${companyId}`);
    return {
        container,
        loader: container?.querySelector('.explain-loader') || null,
        area: container?.querySelector('.explain-area') || null,
        errorEl: container?.querySelector('.explain-error') || null
    };
}

function getAiPanelState(state, companyId) {
    return state.ui.aiPanels[String(companyId)] || null;
}

function setAiPanelState(state, companyId, nextState) {
    if (!nextState) {
        delete state.ui.aiPanels[String(companyId)];
        return;
    }
    state.ui.aiPanels[String(companyId)] = nextState;
}

function syncExplainPanelDom(state, company, fallbackText = '') {
    const { container, loader, area, errorEl } = getExplainPanel(company.id);
    if (!container || !loader || !area || !errorEl) return;
    const panelState = getAiPanelState(state, company.id);
    if (!panelState) {
        container.classList.add('hidden');
        loader.classList.add('hidden');
        area.classList.add('hidden');
        errorEl.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    if (panelState.loading) {
        loader.classList.remove('hidden');
        area.classList.add('hidden');
        errorEl.classList.add('hidden');
        return;
    }

    loader.classList.add('hidden');
    if (panelState.error) {
        area.classList.add('hidden');
        errorEl.textContent = panelState.error;
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    const text = fallbackText || state.ui.aiCache[panelState.cacheKey]?.text || '';
    if (!text) {
        area.classList.add('hidden');
        return;
    }
    renderExplainContent(container, text, company);
}

export function openCompanyExplainPanel(state, companyId, cacheKey = '') {
    const companyKey = String(companyId);
    const current = state.ui.aiPanels[companyKey] || {};
    state.ui.aiPanels[companyKey] = {
        cacheKey: cacheKey || current.cacheKey || '',
        loading: false,
        error: ''
    };
}

export function closeCompanyExplainPanel(state, companyId) {
    delete state.ui.aiPanels[String(companyId)];
}

export function isCompanyExplainPanelOpen(state, companyId) {
    return !!state.ui.aiPanels[String(companyId)];
}

export function loadAiCache(state) {
    try {
        state.ui.aiCache = JSON.parse(localStorage.getItem(GEMINI_CACHE_STORAGE) || '{}');
    } catch (error) {
        console.error('Errore lettura cache AI locale:', error);
        state.ui.aiCache = {};
    }
}

export function updateAiKeyControls(state) {
    const hasUser = !!state.currentUser;
    toggleHidden(state.dom.setAiKeyBtn, !hasUser);
    toggleHidden(state.dom.aiKeyHelpLink, !hasUser);
    const keyPresent = hasUser && !!loadGeminiKey(state.currentUser).trim();
    toggleHidden(state.dom.clearAiKeyBtn, !keyPresent);
    toggleHidden(state.dom.aiKeyModalClearBtn, !keyPresent);
    if (state.dom.setAiKeyBtn && hasUser) {
        state.dom.setAiKeyBtn.textContent = keyPresent ? 'API AI configurata' : 'API AI';
    }
}

export function openAiKeyModal(state) {
    if (!state.currentUser) {
        alert('Accedi con Google prima di configurare la tua API key AI.');
        return;
    }
    state.dom.aiKeyInput.value = loadGeminiKey(state.currentUser);
    state.dom.aiKeyInput.type = 'password';
    state.dom.aiKeyVisibilityBtn.textContent = 'Mostra';
    setAiKeyModalFeedback(state, '');
    state.dom.aiKeyModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    window.setTimeout(() => state.dom.aiKeyInput.focus(), 0);
}

export function closeAiKeyModal(state) {
    state.dom.aiKeyModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

export function toggleAiKeyVisibility(state) {
    const input = state.dom.aiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
    state.dom.aiKeyVisibilityBtn.textContent = input.type === 'password' ? 'Mostra' : 'Nascondi';
}

export function saveGeminiApiKeyFromModal(state) {
    const trimmed = state.dom.aiKeyInput.value.trim();
    if (!trimmed) {
        setAiKeyModalFeedback(state, 'Inserisci una API key valida.', true);
        return;
    }

    try {
        localStorage.setItem(getGeminiStorageKey(state.currentUser), trimmed);
    } catch (error) {
        console.error('Errore salvataggio API key locale:', error);
        setAiKeyModalFeedback(state, 'Impossibile salvare la key su questo browser.', true);
        return;
    }
    updateAiKeyControls(state);
    setAiKeyModalFeedback(state, 'API key salvata su questo browser.');
    window.setTimeout(() => closeAiKeyModal(state), 450);
}

export function clearGeminiApiKey(state) {
    try {
        localStorage.removeItem(getGeminiStorageKey(state.currentUser));
    } catch (error) {
        console.error('Errore rimozione API key locale:', error);
    }
    state.dom.aiKeyInput.value = '';
    updateAiKeyControls(state);
    setAiKeyModalFeedback(state, 'API key rimossa da questo browser.');
}

export async function generateCompanyExplain({ state, company, forceRefresh = false }) {
    const selectedLaurea = state.filters.laurea;
    const cacheKey = getExplainCacheKey(state.currentUser, company.id, selectedLaurea);
    setAiPanelState(state, company.id, { cacheKey, loading: false, error: '' });
    syncExplainPanelDom(state, company);

    if (!state.currentUser) {
        setAiPanelState(state, company.id, {
            cacheKey,
            loading: false,
            error: 'Per usare Info AI devi prima fare accesso con Google e inserire la tua API key.'
        });
        syncExplainPanelDom(state, company);
        return;
    }

    const apiKey = loadGeminiKey(state.currentUser);
    if (!apiKey) {
        setAiPanelState(state, company.id, {
            cacheKey,
            loading: false,
            error: 'API key mancante. Clicca "API AI" in alto a destra.'
        });
        syncExplainPanelDom(state, company);
        return;
    }

    const cached = state.ui.aiCache[cacheKey];
    if (forceRefresh && cached?.text) {
        delete state.ui.aiCache[cacheKey];
        persistAiCache(state.ui.aiCache);
    }

    if (cached?.text && !forceRefresh) {
        setAiPanelState(state, company.id, { cacheKey, loading: false, error: '' });
        syncExplainPanelDom(state, company, cached.text);
        return;
    }

    setAiPanelState(state, company.id, { cacheKey, loading: true, error: '' });
    syncExplainPanelDom(state, company);

    const laureaLabel = selectedLaurea !== 'all' ? selectedLaurea : 'Ingegneria Gestionale';
    const profileCtx = selectedLaurea !== 'all'
        ? `L'utente studia "${selectedLaurea}".`
        : "L'utente ha un profilo di ingegneria gestionale.";
    const linksCtx = [company.sito, company.urlPagina].filter(Boolean).length
        ? `\nLink ufficiali verificati dal dataset:\n- ${[company.sito, company.urlPagina].filter(Boolean).join('\n- ')}`
        : '';
    const fallback = company.careersUrl || company.sito || company.urlPagina || 'non disponibile';

    try {
        const text = await fetchExplain({
            apiKey,
            prompt: `Cerca informazioni su "${company.name}" e spiegami in modo semplice e diretto:
- Cosa fa questa azienda
- In che settore opera
- Quanto è grande
- Dove ha sede e dove opera
- Cosa potresti fare tu con la tua laurea in "${laureaLabel}"
- Ho trovato posizioni aperte adesso?

${profileCtx}${linksCtx}
Link utile fallback per cercare offerte reali: ${fallback}

Regole:
- Usa preferibilmente fonti ufficiali aziendali.
- NON inventare URL.
- Se non trovi nulla, scrivi: "Posizioni aperte: Non trovate con fonte verificabile".
- Chiudi sempre con: "Cerca qui: ${fallback}".

Rispondi in italiano, chiaro, con sezioni e senza buzzwords.`
        });

        state.ui.aiCache[cacheKey] = { text, ts: Date.now() };
        persistAiCache(state.ui.aiCache);
        if (getAiPanelState(state, company.id)?.cacheKey === cacheKey) {
            setAiPanelState(state, company.id, { cacheKey, loading: false, error: '' });
            syncExplainPanelDom(state, company, text);
        }
    } catch (error) {
        console.error('Errore richiesta AI:', error);
        if (getAiPanelState(state, company.id)?.cacheKey === cacheKey) {
            setAiPanelState(state, company.id, {
                cacheKey,
                loading: false,
                error: error.name === 'AbortError' ? 'Timeout.' : (error.message || 'Errore AI')
            });
            syncExplainPanelDom(state, company);
        }
    } finally {
        if (getAiPanelState(state, company.id)?.cacheKey === cacheKey && getAiPanelState(state, company.id)?.loading) {
            setAiPanelState(state, company.id, { cacheKey, loading: false, error: '' });
            syncExplainPanelDom(state, company);
        }
    }
}

function loadGeminiKey(currentUser) {
    try {
        return localStorage.getItem(getGeminiStorageKey(currentUser)) || '';
    } catch (error) {
        console.error('Errore lettura API key locale:', error);
        return '';
    }
}

function persistAiCache(cache) {
    try {
        localStorage.setItem(GEMINI_CACHE_STORAGE, JSON.stringify(cache));
    } catch (error) {
        console.error('Errore scrittura cache AI locale:', error);
    }
}

function setAiKeyModalFeedback(state, message, isError = false) {
    setText(state.dom.aiKeyModalFeedback, message);
    state.dom.aiKeyModalFeedback.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    if (!message) {
        state.dom.aiKeyModalFeedback.classList.add('hidden');
        return;
    }
    state.dom.aiKeyModalFeedback.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');
}

async function fetchExplain({ apiKey, prompt, attempt = 0 }) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.9,
                    maxOutputTokens: 1200
                }
            })
        });

        if (!response.ok) {
            if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
                await sleep(600 * (2 ** attempt));
                return fetchExplain({ apiKey, prompt, attempt: attempt + 1 });
            }
            const errorPayload = await safeJson(response);
            const apiMessage = errorPayload?.error?.message || errorPayload?.error || `Errore API: ${response.status}`;
            throw new Error(response.status === 429 ? 'Quota esaurita o troppe richieste. Riprova tra poco.' : apiMessage);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts
            ?.map((part) => typeof part?.text === 'string' ? part.text : '')
            .filter(Boolean)
            .join('\n')
            .trim();
        if (!text) throw new Error('Risposta vuota dal modello.');
        return text;
    } finally {
        window.clearTimeout(timeout);
    }
}

function safeJson(response) {
    return response.json().catch(() => null);
}

function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
