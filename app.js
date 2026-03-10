const GEMINI_KEY_STORAGE = 'careerday_gemini_key';
const INTEREST_STORAGE_KEY = 'careerday_interest_flags_v1';
const VISIT_STORAGE_KEY = 'careerday_visit_flags_v1';
const ONBOARDING_KEY = 'careerday_onboarding_dismissed';

let companiesData = [];
let activeMapFilterStand = null;
let interestFlags = {};
let visitFlags = {};
let currentUser = null;
let aggregateData = {};
let currentRoute = [];

function getFbAuth() {
    return window.fbAuth || null;
}

function getFbDb() {
    return window.fbDb || null;
}

function getGeminiStorageKey() {
    if (currentUser && currentUser.uid) return `${GEMINI_KEY_STORAGE}_${currentUser.uid}`;
    return GEMINI_KEY_STORAGE;
}

function loadGeminiKey() {
    try { return localStorage.getItem(getGeminiStorageKey()) || ''; } catch { return ''; }
}

function saveGeminiKey(key) {
    if (!currentUser) return;
    const value = (key || '').trim();
    const storageKey = getGeminiStorageKey();
    try {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
    } catch {}
}

function updateAiKeyControls() {
    const setBtn = document.getElementById('set-ai-key-btn');
    const clearBtn = document.getElementById('clear-ai-key-btn');
    const helpLink = document.getElementById('ai-key-help-link');
    const modalClearBtn = document.getElementById('ai-key-modal-clear-btn');
    if (!setBtn || !clearBtn || !helpLink) return;
    if (!currentUser) {
        setBtn.classList.add('hidden');
        clearBtn.classList.add('hidden');
        helpLink.classList.add('hidden');
        if (modalClearBtn) modalClearBtn.classList.add('hidden');
        return;
    }
    setBtn.classList.remove('hidden');
    helpLink.classList.remove('hidden');
    const hasKey = !!loadGeminiKey().trim();
    setBtn.textContent = hasKey ? '🔑 API AI ✓' : '🔑 API AI';
    clearBtn.classList.toggle('hidden', !hasKey);
    if (modalClearBtn) modalClearBtn.classList.toggle('hidden', !hasKey);
}

function setAiKeyModalFeedback(message, isError = false) {
    const feedback = document.getElementById('ai-key-modal-feedback');
    if (!feedback) return;
    const msg = (message || '').trim();
    feedback.textContent = msg;
    feedback.classList.remove('text-emerald-600', 'text-rose-600');
    if (!msg) {
        feedback.classList.add('hidden');
        return;
    }
    feedback.classList.remove('hidden');
    feedback.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');
}

function openAiKeyModal() {
    if (!currentUser) {
        alert('Accedi con Google prima di configurare la tua API key AI.');
        return;
    }
    const modal = document.getElementById('ai-key-modal');
    const input = document.getElementById('ai-key-input');
    if (!modal || !input) return;
    updateAiKeyControls();
    input.value = loadGeminiKey();
    const visBtn = document.getElementById('ai-key-visibility-btn');
    if (visBtn) visBtn.textContent = 'Mostra';
    input.type = 'password';
    setAiKeyModalFeedback('');
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => input.focus(), 0);
}

function closeAiKeyModal() {
    const modal = document.getElementById('ai-key-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function handleAiKeyModalBackdrop(event) {
    if (event.target && event.target.id === 'ai-key-modal') {
        closeAiKeyModal();
    }
}

function toggleAiKeyVisibility() {
    const input = document.getElementById('ai-key-input');
    const btn = document.getElementById('ai-key-visibility-btn');
    if (!input || !btn) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Nascondi';
    } else {
        input.type = 'password';
        btn.textContent = 'Mostra';
    }
}

function saveGeminiApiKeyFromModal() {
    if (!currentUser) return;
    const input = document.getElementById('ai-key-input');
    if (!input) return;
    const trimmed = input.value.trim();
    if (!trimmed) {
        setAiKeyModalFeedback('Inserisci una API key valida.', true);
        return;
    }
    saveGeminiKey(trimmed);
    updateAiKeyControls();
    setAiKeyModalFeedback('API key salvata su questo browser.');
    setTimeout(() => closeAiKeyModal(), 450);
}

function setGeminiApiKeyPrompt() {
    openAiKeyModal();
}

function clearGeminiApiKey() {
    if (!currentUser) return;
    saveGeminiKey('');
    updateAiKeyControls();
    const input = document.getElementById('ai-key-input');
    if (input) input.value = '';
    setAiKeyModalFeedback('API key rimossa da questo browser.');
}

function getGeminiKey() {
    if (!currentUser) return '';
    return loadGeminiKey().trim();
}

async function loginWithGoogle() {
    const auth = getFbAuth();
    if (!auth) {
        alert('Login non configurato. Verifica firebase-public-config.js.');
        return;
    }
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        onUserLogin(result.user);
    } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
            console.error('Login error:', err);
        }
    }
}

function onUserLogin(user) {
    currentUser = user;
    document.getElementById('login-btn').classList.add('hidden');
    const userInfo = document.getElementById('user-info');
    userInfo.classList.remove('hidden');
    userInfo.classList.add('flex');
    const avatar = document.getElementById('user-avatar');
    const fallback = document.getElementById('user-avatar-fallback');
    if (user.photoURL) {
        avatar.src = user.photoURL;
        avatar.style.display = '';
        fallback.style.display = 'none';
    } else {
        avatar.style.display = 'none';
        fallback.style.display = 'flex';
        const initials = (user.displayName || user.email || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        fallback.textContent = initials;
    }
    document.getElementById('user-name').textContent = user.displayName || user.email;
    updateAiKeyControls();
    syncLocalToFirebase();
    loadFromFirebase();
    listenToAggregates();
}

function logoutUser() {
    const auth = getFbAuth();
    if (auth) auth.signOut();
    currentUser = null;
    document.getElementById('login-btn').classList.remove('hidden');
    const userInfo = document.getElementById('user-info');
    userInfo.classList.add('hidden');
    userInfo.classList.remove('flex');
    updateAiKeyControls();
    aggregateData = {};
    filterData();
}

function syncLocalToFirebase() {
    const db = getFbDb();
    if (!currentUser || !db) return;
    const uid = currentUser.uid;
    const userData = {
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        lastLogin: Date.now()
    };
    if (Object.keys(interestFlags).length > 0) userData.interests = interestFlags;
    if (Object.keys(visitFlags).length > 0) userData.visits = visitFlags;
    db.ref('users/' + uid).update(userData);
}

async function loadFromFirebase() {
    const db = getFbDb();
    if (!currentUser || !db) return;
    try {
        const snap = await db.ref('users/' + currentUser.uid).once('value');
        const data = snap.val();
        if (!data) return;
        if (data.interests) {
            Object.assign(interestFlags, data.interests);
            saveInterestFlags();
        }
        if (data.visits) {
            Object.assign(visitFlags, data.visits);
            saveVisitFlags();
        }
        filterData();
    } catch {}
}

function syncInterestToFirebase(companyId, status) {
    const db = getFbDb();
    if (!currentUser || !db) return;
    if (status === 'unset') {
        db.ref('users/' + currentUser.uid + '/interests/' + companyId).remove();
    } else {
        db.ref('users/' + currentUser.uid + '/interests/' + companyId).set(status);
    }
    updateAggregate(companyId);
}

function syncVisitToFirebase(companyId, score) {
    const db = getFbDb();
    if (!currentUser || !db) return;
    if (score <= 0) {
        db.ref('users/' + currentUser.uid + '/visits/' + companyId).remove();
    } else {
        db.ref('users/' + currentUser.uid + '/visits/' + companyId).set(score);
    }
}

async function updateAggregate(companyId) {
    const db = getFbDb();
    if (!db) return;
    try {
        const snap = await db.ref('users').once('value');
        const users = snap.val() || {};
        let count = 0;
        for (const uid in users) {
            if (users[uid].interests && users[uid].interests[companyId] === 'interested') count++;
        }
        db.ref('aggregates/interests/' + companyId).set(count);
    } catch {}
}

function listenToAggregates() {
    const db = getFbDb();
    if (!db) return;
    db.ref('aggregates/interests').on('value', snap => {
        aggregateData = snap.val() || {};
        filterData();
    });
}

function getInterestedCount(companyId) {
    return aggregateData[companyId] || 0;
}

function cleanCompanyName(name) {
    return name.replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?c\.?\s*|soc\.?\s*coop\.?\s*(agricola)?|s\.?c\.?p\.?a\.?|spa|srl)\b\.?/gi, '').replace(/[.]+$/, '').trim().replace(/\s{2,}/g, ' ');
}
function loadInterestFlags() {
    try { const raw = localStorage.getItem(INTEREST_STORAGE_KEY); interestFlags = raw ? JSON.parse(raw) : {}; } catch { interestFlags = {}; }
}
function saveInterestFlags() {
    try { localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(interestFlags)); } catch {}
}
function getCompanyInterest(companyId) {
    return interestFlags[companyId] || 'unset';
}
function setCompanyInterest(companyId, status) {
    if (status === 'unset') delete interestFlags[companyId];
    else interestFlags[companyId] = status;
    saveInterestFlags();
    syncInterestToFirebase(companyId, status);
    filterData();
}

function loadVisitFlags() {
    try { const r = localStorage.getItem(VISIT_STORAGE_KEY); visitFlags = r ? JSON.parse(r) : {}; } catch { visitFlags = {}; }
}
function saveVisitFlags() {
    try { localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visitFlags)); } catch {}
}
function getVisitFlag(companyId) {
    return visitFlags[companyId] || 0;
}
function setVisitScore(companyId, score) {
    score = parseInt(score);
    if (score > 0) visitFlags[companyId] = score;
    else delete visitFlags[companyId];
    saveVisitFlags();
    syncVisitToFirebase(companyId, score);
    filterData();
}

async function generateCompanyExplain(companyId) {
    if (!currentUser) {
        const container = document.getElementById('explain-' + companyId);
        const errorEl = container.querySelector('.explain-error');
        container.classList.remove('hidden');
        errorEl.textContent = 'Per usare Info AI devi prima fare accesso con Google e inserire la tua API key.';
        errorEl.classList.remove('hidden');
        return;
    }
    const apiKey = getGeminiKey();
    const container = document.getElementById('explain-' + companyId);
    const loader = container.querySelector('.explain-loader');
    const area = container.querySelector('.explain-area');
    const errorEl = container.querySelector('.explain-error');
    if (!apiKey) {
        errorEl.textContent = 'API key mancante. Clicca "🔑 API AI" o "Ottieni key gratis" in alto a destra.';
        errorEl.classList.remove('hidden');
        return;
    }
    const company = companiesData.find(c => c.id === companyId);
    if (!company) return;
    container.classList.remove('hidden');
    loader.classList.remove('hidden');
    area.classList.add('hidden');
    errorEl.classList.add('hidden');
    const selectedLaurea = document.getElementById('laureaFilter').value;
    const laureaLabel = selectedLaurea !== 'all' ? selectedLaurea : 'Ingegneria Gestionale';
    const profileCtx = selectedLaurea !== 'all'
        ? `L'utente studia "${selectedLaurea}".`
        : "L'utente ha un profilo di ingegneria gestionale.";
    const laureaStatusForAi = selectedLaurea !== 'all' ? companyHasLaurea(company, selectedLaurea) : null;
    const laureaMismatchCtx = (selectedLaurea !== 'all' && laureaStatusForAi === false)
        ? `\nContesto aggiuntivo: dal dataset Career Day risulta "✗ Non cercano" per la laurea "${selectedLaurea}". Dillo chiaramente nella sezione sui ruoli: compatibilita' bassa, senza forzare suggerimenti poco credibili.`
        : '';
    const officialLinks = [company.sito, company.urlPagina].filter(Boolean);
    const linksCtx = officialLinks.length > 0 ? `\nLink ufficiali verificati dal dataset:\n- ${officialLinks.join('\n- ')}` : '';
    const careersFallback = company.careersUrl || company.sito || company.urlPagina || '';
    const prompt = `Cerca informazioni su "${company.name}" e spiegami in modo semplice e diretto:\n- Cosa fa questa azienda (in 2-3 frasi comprensibili a chiunque)\n- In che settore opera\n- Quanto è grande (dipendenti, fatturato se trovi)\n- Dove ha sede e dove opera\n- Cosa potresti fare tu con la tua laurea in "${laureaLabel}"? (ruoli consigliati e perche')\n- Ho trovato posizioni aperte adesso (stage/internship/tirocinio/junior)?\n\n${profileCtx}${laureaMismatchCtx}${linksCtx}\nLink utile fallback per cercare offerte reali: ${careersFallback || 'non disponibile'}\n\nRegole importanti:\n- Usa preferibilmente fonti ufficiali aziendali.\n- Se nel contesto e' presente "✗ Non cercano", esplicita che il match con la laurea selezionata e' debole.\n- NON inventare URL.\n- Se trovi posizioni plausibili ma non hai link diretto certo, elenca max 5 ruoli in formato: "Titolo | Sede | Stato: da verificare".\n- Se hai link diretto verificabile, usa formato: "Titolo | Sede | Link: URL".\n- Se non trovi nulla, scrivi: "Posizioni aperte: Non trovate con fonte verificabile".\n- In ogni caso, chiudi la sezione con: "Cerca qui: ${careersFallback || 'non disponibile'}".\n\nRispondi in italiano, tono informale e chiaro. Niente buzzwords.`;
    try {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const extractText = (data) => {
            const parts = data?.candidates?.[0]?.content?.parts;
            if (!Array.isArray(parts)) return '';
            return parts
                .map(p => (typeof p?.text === 'string' ? p.text : ''))
                .filter(Boolean)
                .join('\n')
                .trim();
        };

        const isLikelyTruncated = (text, finishReason) => {
            const t = (text || '').trim();
            if (!t) return true;
            const fr = (finishReason || '').toUpperCase();
            if (fr === 'MAX_TOKENS' || fr === 'LENGTH') return true;
            if (t.length < 260) return true;
            return !/[.!?…)"'\]]$/.test(t);
        };

        const fetchExplain = async (promptText, attempt = 0) => {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 30000);
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        tools: [{ googleSearch: {} }],
                        generationConfig: {
                            temperature: 0.2,
                            topP: 0.9,
                            maxOutputTokens: 1200
                        }
                    })
                });
                if (!res.ok) {
                    const s = res.status;
                    if ([429, 500, 502, 503, 504].includes(s) && attempt < 2) {
                        const waitMs = 600 * (2 ** attempt) + Math.floor(Math.random() * 250);
                        await sleep(waitMs);
                        return fetchExplain(promptText, attempt + 1);
                    }
                    let msg = '';
                    try {
                        const errData = await res.json();
                        if (typeof errData?.error === 'string') msg = errData.error;
                        if (!msg && typeof errData?.error?.message === 'string') msg = errData.error.message;
                    } catch {}
                    if (s === 401 || s === 403) throw new Error('Autorizzazione AI fallita.');
                    if (s === 429) throw new Error('Quota esaurita o troppe richieste. Riprova tra poco.');
                    if (s === 503) throw new Error('Servizio AI temporaneamente non disponibile (503). Riprova tra qualche secondo.');
                    if (s >= 500) throw new Error('Servizio AI temporaneamente non disponibile. Riprova.');
                    if (msg) throw new Error(msg);
                    throw new Error(`Errore API: ${s}`);
                }
                const data = await res.json();
                const text = extractText(data);
                if (!text) throw new Error('Risposta vuota dal modello.');
                const finishReason = data?.candidates?.[0]?.finishReason || '';
                return { text, finishReason };
            } finally {
                clearTimeout(tid);
            }
        };

        let { text, finishReason } = await fetchExplain(prompt);
        if (text.length < 320) {
            const retryPrompt = `${prompt}\n\nIMPORTANTE: risposta troppo corta. Fornisci una risposta completa con sezioni distinte, dati concreti (se disponibili), e almeno 8-10 frasi.`;
            try {
                const retryRes = await fetchExplain(retryPrompt);
                if (retryRes.text.length > text.length) {
                    text = retryRes.text;
                    finishReason = retryRes.finishReason;
                }
            } catch (retryErr) {
                console.warn('Retry Gemini non riuscito, uso la prima risposta:', retryErr.message);
            }
        }

        if (isLikelyTruncated(text, finishReason)) {
            const continuationPrompt = `La risposta precedente si e' interrotta. Continua dal punto in cui eri arrivato, senza ripetere l'introduzione.\n\nRisposta gia' data:\n"""${text.slice(-1400)}"""`;
            try {
                const contRes = await fetchExplain(continuationPrompt);
                if (contRes.text) {
                    text = `${text.replace(/\s+$/,'')}\n\n${contRes.text.trim()}`;
                    finishReason = contRes.finishReason;
                }
            } catch (contErr) {
                console.warn('Continuazione Gemini non riuscita:', contErr.message);
            }
        }

        if (isLikelyTruncated(text, finishReason)) {
            text = `${text}\n\n_Note: risposta AI probabilmente troncata. Clicca di nuovo "Info AI" per rigenerarla._`;
        }

        const explainTextEl = area.querySelector('.explain-text');
        explainTextEl.innerHTML = renderMarkdown(text);
        enhanceExplainOutput(explainTextEl, company);
        area.classList.remove('hidden');
    } catch (err) {
        errorEl.textContent = err.name === 'AbortError' ? 'Timeout.' : err.message;
        errorEl.classList.remove('hidden');
    } finally { loader.classList.add('hidden'); }
}

function renderMarkdown(md) {
    const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const sanitizeHttpUrl = (s) => {
        if (!s) return '';
        try {
            const u = new URL(String(s).replace(/&amp;/g, '&'));
            if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
            return '';
        } catch {
            return '';
        }
    };
    let html = esc(md);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-100 border border-slate-300 rounded p-2 my-2 overflow-x-auto text-[11px]"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 px-1 rounded text-[11px]">$1</code>');
    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
        const safeUrl = sanitizeHttpUrl(url);
        if (!safeUrl) return label;
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-700 underline decoration-indigo-300 hover:decoration-indigo-600 break-all">${label}</a>`;
    });
    html = html.replace(/^### (.+)$/gm, '<h4 class="font-bold text-slate-800 mt-3 mb-1">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="font-bold text-slate-900 text-sm mt-3 mb-1">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="font-bold text-slate-900 text-base mt-3 mb-1">$1</h2>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<![*])\*([^*]+?)\*(?![*])/g, '<em>$1</em>');
    html = html.replace(/^---$/gm, '<hr class="my-2 border-slate-300">');
    html = html.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, content) => {
        const level = Math.floor(indent.length / 2);
        return `<li class="ml-${level ? level * 4 : 4} list-disc">${content}</li>`;
    });
    html = html.replace(/^(\s*)\d+\. (.+)$/gm, (_, indent, content) => {
        const level = Math.floor(indent.length / 2);
        return `<li class="ml-${level ? level * 4 : 4} list-decimal">${content}</li>`;
    });
    html = html.replace(/((?:<li class="ml-\d+ list-disc">.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>');
    html = html.replace(/((?:<li class="ml-\d+ list-decimal">.*<\/li>\n?)+)/g, '<ol class="my-1">$1</ol>');
    html = html.replace(/\n{2,}/g, '</p><p class="my-1.5">');
    html = html.replace(/(?<!<\/(?:h[234]|li|ul|ol|pre|hr|p)>)\n(?!<)/g, '<br>');
    html = '<p class="my-1.5">' + html + '</p>';
    html = html.replace(/<p class="my-1.5">\s*<\/p>/g, '');
    return html;
}

function linkifyPlainUrls(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
            const tag = node.parentElement.tagName;
            if (tag === 'A' || tag === 'CODE' || tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const urlRx = /https?:\/\/[^\s<>()"]+/g;
    for (const node of nodes) {
        const text = node.nodeValue || '';
        if (!urlRx.test(text)) continue;
        urlRx.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let match;
        while ((match = urlRx.exec(text)) !== null) {
            const rawUrl = match[0];
            let url = rawUrl;
            while (/[),.;!?]$/.test(url)) {
                url = url.slice(0, -1);
            }
            const idx = match.index;
            if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = url;
            a.className = 'text-indigo-700 underline decoration-indigo-300 hover:decoration-indigo-600 break-all';
            frag.appendChild(a);
            const trailing = rawUrl.slice(url.length);
            if (trailing) frag.appendChild(document.createTextNode(trailing));
            lastIdx = idx + rawUrl.length;
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        node.parentNode.replaceChild(frag, node);
    }
}

function getHostFromUrl(s) {
    try { return new URL(s).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function normalizeHttpUrl(s) {
    try {
        const u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return u.href;
    } catch {
        return '';
    }
}

function getRootHost(host) {
    const parts = (host || '').split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    return parts.slice(-2).join('.');
}

function annotateExplainLinks(root, company) {
    if (!root || !company) return;
    const trustedHosts = new Set();
    [company.sito, company.urlPagina].filter(Boolean).forEach((url) => {
        const h = getHostFromUrl(url);
        if (!h) return;
        trustedHosts.add(h);
        trustedHosts.add(getRootHost(h));
    });
    trustedHosts.add('linkedin.com');

    const knownJobHosts = [
        'workdayjobs.com', 'myworkdayjobs.com', 'smartrecruiters.com',
        'greenhouse.io', 'lever.co', 'jobvite.com', 'icims.com',
        'successfactors.com', 'taleo.net', 'join.com', 'indeed.com'
    ];

    const isTrusted = (host) => {
        if (!host) return false;
        const rootHost = getRootHost(host);
        if (trustedHosts.has(host) || trustedHosts.has(rootHost)) return true;
        return knownJobHosts.some((h) => host === h || host.endsWith(`.${h}`));
    };

    root.querySelectorAll('a[href]').forEach((a) => {
        const host = getHostFromUrl(a.href);
        if (!isTrusted(host)) {
            a.classList.add('text-amber-700', 'decoration-amber-500');
            a.title = 'Link AI non verificato automaticamente';
        }
    });
}

function appendCareersFallbackPanel(root, company) {
    if (!root || !company) return;
    if (root.querySelector('.ai-careers-fallback')) return;
    const txt = (root.textContent || '').toLowerCase();
    const needsFallback = txt.includes('posizioni aperte') ||
        txt.includes('stato: da verificare') ||
        txt.includes('non verificabili in tempo reale') ||
        txt.includes('non trovate con fonte verificabile') ||
        txt.includes('link: non verificabile');
    if (!needsFallback) return;

    const links = [];
    const careersSearchUrl = normalizeHttpUrl(company.careersUrl || '');
    const siteUrl = normalizeHttpUrl(company.sito || '');
    const linkedinUrl = normalizeHttpUrl(company.linkedinUrl || '');
    if (careersSearchUrl) links.push({ label: 'Cerca offerte (lavora con noi)', url: careersSearchUrl });
    if (siteUrl) links.push({ label: 'Apri sito aziendale', url: siteUrl });
    if (linkedinUrl) links.push({ label: 'Apri pagina LinkedIn', url: linkedinUrl });
    if (!links.length) return;

    const box = document.createElement('div');
    box.className = 'ai-careers-fallback mt-3 p-2.5 rounded-lg border border-indigo-200 bg-indigo-50';

    const title = document.createElement('p');
    title.className = 'text-[11px] font-semibold text-indigo-800 mb-2';
    title.textContent = 'Link utili verificati per continuare la ricerca';
    box.appendChild(title);

    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-1.5';
    links.forEach((l) => {
        const a = document.createElement('a');
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-100 transition-colors';
        a.textContent = l.label;
        row.appendChild(a);
    });
    box.appendChild(row);
    root.appendChild(box);
}

function enhanceExplainOutput(root, company) {
    if (!root) return;
    linkifyPlainUrls(root);
    annotateExplainLinks(root, company);
    appendCareersFallbackPanel(root, company);

    root.querySelectorAll('h2,h3,h4,p,li').forEach(el => {
        const txt = (el.textContent || '').trim();
        if (!txt) return;
        if (/^posizioni aperte/i.test(txt)) {
            el.classList.add('text-emerald-700', 'font-semibold');
        }
        if (/non trovate con fonte verificabile/i.test(txt)) {
            el.classList.add('bg-amber-50', 'border', 'border-amber-200', 'rounded', 'px-2', 'py-1', 'text-amber-700');
        }
    });
}

function getLogoPath(nome) {
    const badChars = '<>:"/\\|?* ';
    let clean = nome;
    for (const c of badChars) { clean = clean.split(c).join('_'); }
    return 'logos/logo_' + clean.toLowerCase() + '.png';
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

async function loadData() {
    try {
        const candidateUrls = [];
        const seen = new Set();
        const addUrl = (url) => {
            if (!url || seen.has(url)) return;
            seen.add(url);
            candidateUrls.push(url);
        };

        addUrl('aziende_dettagli.json');
        addUrl('./aziende_dettagli.json');
        addUrl(new URL('aziende_dettagli.json', window.location.href).toString());
        if (!window.location.pathname.endsWith('/')) {
            addUrl(new URL('aziende_dettagli.json', window.location.href + '/').toString());
        }
        const appScript = document.querySelector('script[src$="app.js"]');
        if (appScript && appScript.src) {
            addUrl(new URL('aziende_dettagli.json', appScript.src).toString());
        }

        let jsonData = null;
        let lastError = null;
        for (const url of candidateUrls) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                if (!Array.isArray(payload)) throw new Error('Payload non valido');
                jsonData = payload;
                break;
            } catch (err) {
                lastError = `${url} -> ${err.message}`;
                console.warn('Tentativo caricamento fallito:', lastError);
            }
        }
        if (!jsonData) throw new Error(lastError || 'Nessun URL valido per il dataset');

        companiesData = jsonData.map((a, i) => {
            const cleanName = cleanCompanyName(a.Nome);
            const obj = {
                id: i + 1,
                name: a.Nome,
                stand: a.Stand || '',
                sector: a.Settore || 'Non specificato',
                sito: a.Sito_Web || '',
                email: a.Email || '',
                aree: a.Aree_Disciplinari || {},
                areaInserimento: a.Area_Inserimento || [],
                modalita: a.Modalita_Inserimento || [],
                descrizione: a.Perche_lavorare_per_noi || '',
                cercaGestionale: a.Cerca_Ingegneria_Gestionale,
                logo: getLogoPath(a.Nome),
                urlPagina: a.URL_Pagina || '',
                careersUrl: `https://www.google.com/search?q=${encodeURIComponent(a.Nome + ' lavora con noi')}`,
                linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(a.Nome)}`,
                glassdoorUrl: `https://www.google.com/search?q=${encodeURIComponent('site:glassdoor.it "' + cleanName + '" recensioni')}`
            };
            return obj;
        });
    } catch (err) {
        console.error('Errore caricamento aziende_dettagli.json:', err);
        document.getElementById('company-grid').innerHTML = '<div class="col-span-3 text-center py-16 bg-white rounded-xl border border-red-200"><p class="text-red-600 font-bold text-lg">Errore: impossibile caricare aziende_dettagli.json</p><p class="text-slate-500 mt-2">Ricarica la pagina con Ctrl/Cmd+Shift+R. Se persiste, verifica che il file sia pubblicato nella root del sito.</p></div>';
    }
}

function renderArchitecturalMap() {
    const mapContainer = document.getElementById('pavilion-map-layout');
    const sb = (id, exClass='') => `<div id="stand-${id}" class="stand-box bg-slate-200 border border-slate-300 text-slate-400 ${exClass}" data-stand="${id}">${id}</div>`;
    const t2x2 = (tl,tr,bl,br) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${sb(tl,'h-8')}${sb(tr,'h-8')}${sb(bl,'h-8')}${sb(br,'h-8')}</div>`;
    const tLSpan = (l,tr,br) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${sb(l,'row-span-2 h-[68px]')}${sb(tr,'h-8')}${sb(br,'h-8')}</div>`;
    const tRSpan = (tl,bl,r) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${sb(tl,'h-8')}${sb(r,'row-span-2 h-[68px]')}${sb(bl,'h-8')}</div>`;
    const tBSpan = (l,r) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${sb(l,'row-span-2 h-[68px]')}${sb(r,'row-span-2 h-[68px]')}</div>`;
    const vStrip = (arr) => `<div class="flex flex-col gap-1 w-[33px]">${arr.map(s => s==='gap' ? '<div class="h-8"></div>' : sb(s,'h-8')).join('')}</div>`;
    const spc = `<div class="h-6"></div>`;

    const colAStrip = vStrip(['A46','A44','A42','A40','A38','gap','A32','A30','A28','A26','A24','A22','gap','A16','A14','A12','A10','A8','A6']);
    const colAB = `<div class="flex flex-col gap-4">${t2x2('A37','B38','A35','B36')} ${spc} ${t2x2('A31','B32','A29','B30')} ${spc} ${t2x2('A25','B26','A23','B24')} ${spc} ${t2x2('A19','B20','A17','B18')} ${spc} ${t2x2('A13','B14','A11','B12')} ${spc} ${t2x2('A7','B8','A5','B6')}</div>`;
    const colBC = `<div class="flex flex-col gap-4">${t2x2('B37','C38','B35','C36')} ${spc} ${t2x2('B31','C32','B29','C30')} ${spc} ${t2x2('B25','C26','B23','C24')} ${spc} ${tRSpan('B19','B17','C18-C20')} ${spc} ${tRSpan('B13','B11','C12-14')} ${spc} ${tLSpan('B5-B7','C8','C6')}</div>`;
    const colCD = `<div class="flex flex-col gap-4">${t2x2('C39','D40','C37','D38')} <div class="w-[70px] h-[80px] bg-slate-300 border border-slate-400 text-[8px] flex items-center justify-center text-center text-slate-600 font-bold p-1 rounded-sm opacity-60">AREA CONFINDUSTRIA</div> <div class="w-full flex justify-start">${vStrip(['C27','C25','C23','C21','C19','C17'])}</div> ${tBSpan('C11-C13','D12-D14')} ${tRSpan('C7','C5','D6-D8')}</div>`;
    const colDE = `<div class="flex flex-col gap-4">${t2x2('D39','E38','D37','E36')} <div class="h-[80px] w-[70px] flex items-center justify-center text-slate-400 text-xs font-bold text-center">☕<br>BAR</div> <div class="w-full flex justify-end">${vStrip(['E28','E26','E24','E22','E20','E18'])}</div> ${tRSpan('D13','D11','E12-E14')} ${t2x2('D7','E10','D5','E8')}</div>`;
    const colEF = `<div class="flex flex-col gap-4">${t2x2('E37','F38','E35','F36')} ${spc} ${t2x2('E31','F32','E29','F30')} ${spc} ${t2x2('E25','F26','E23','F24')} ${spc} ${t2x2('E17','F20','E15','F18')} ${spc} ${tLSpan('E11-E13','F14','F12')} ${spc} ${t2x2('E9','F10','E7','F8')}</div>`;
    const colFG = `<div class="flex flex-col gap-4">${t2x2('F37','G38','F35','G36')} ${spc} ${t2x2('F31','G32','F29','G30')} ${spc} ${t2x2('F25','G26','F23','G24')} ${spc} ${t2x2('F19','G20','F17','G18')} ${spc} ${tLSpan('F11-F13','G14','G12')} ${spc} ${t2x2('F7','G8','F5','G6')}</div>`;
    const colGStrip = vStrip(['G45','G43','G41','G39','G37','G35','gap','G31','G29','G27','G25','G23','G21','gap','G17','G15','G13','G11','G9','G7','G5','G3']);
    const aisle = (l) => `<div class="w-8 flex flex-col justify-between py-12 text-slate-300 font-bold text-xl items-center select-none"><span>${l}</span><span>${l}</span><span>${l}</span></div>`;

    const topBlocks = `<div class="flex items-start justify-center gap-2 mb-8 mt-4">${colAStrip} ${aisle('A')} ${colAB} ${aisle('B')} ${colBC} ${aisle('C')} ${colCD} ${aisle('D')} ${colDE} ${aisle('E')} ${colEF} ${aisle('F')} ${colFG} ${aisle('G')} ${colGStrip}</div>`;
    const bRow = (stands) => `<div class="flex gap-1">${stands.map(s => sb(s,'h-8 w-8')).join('')}</div>`;
    const bRowBlock = `<div class="w-full flex justify-between items-end px-4 gap-6">${bRow(['A2','A1','B3','B2','B1'])}<div class="flex gap-1">${sb('C1','h-8 w-8')}${sb('C2','h-8 w-8')}<div class="h-8 w-16 bg-slate-300 text-slate-500 font-bold text-[8px] flex items-center justify-center">BBS</div></div><div class="flex gap-1">${sb('E2','h-8 w-8')}${sb('E1','h-8 w-16')}</div>${sb('F3-F4','h-8 w-[70px]')}</div>`;

    mapContainer.innerHTML = topBlocks + bRowBlock;
    hydrateMapWithData();
    setupMapDrag();
}

function hydrateMapWithData() {
    companiesData.forEach(company => {
        if (!company.stand) return;
        const node = document.getElementById(`stand-${company.stand}`);
        if (node) {
            node.classList.remove('bg-slate-200', 'text-slate-400');
            node.classList.add('occupied');
            const selectedLaurea = document.getElementById('laureaFilter').value;
            const laureaStatus = selectedLaurea !== 'all' ? companyHasLaurea(company, selectedLaurea) : null;
            const gestIcon = laureaStatus === true ? '✅' : laureaStatus === 'non_specificato' ? '⚠️' : laureaStatus === false ? '❌' : '';
            const tooltip = document.createElement('div');
            tooltip.className = 'map-tooltip';
            const laureaShort = selectedLaurea !== 'all' ? selectedLaurea.replace(/^Laurea (Magistrale (a Ciclo Unico )?in |in )/i, '') : '';
            tooltip.innerHTML = `<div class="flex items-start gap-2.5 mb-2"><img src="${company.logo}" alt="" class="w-14 h-14 object-contain rounded-md bg-white p-1 border border-slate-600 shadow-sm flex-shrink-0" onerror="this.style.display='none'"><div class="min-w-0"><strong class="text-indigo-300 text-sm block leading-tight break-words">${company.name}</strong><span class="block opacity-90 text-xs break-words">${company.sector}</span></div></div>${gestIcon ? `<span class="block text-xs">${gestIcon} ${laureaShort}</span>` : ''}<span class="block mt-1 pt-1 border-t border-slate-700 opacity-70 italic">Clicca per isolare</span>`;
            node.appendChild(tooltip);
            node.addEventListener('mouseenter', () => positionTooltip(node, tooltip));
            node.addEventListener('click', (e) => { e.stopPropagation(); handleMapClick(company.stand, node); });
        }
    });
}

function handleMapClick(standCode, nodeElement) {
    document.querySelectorAll('.stand-box').forEach(n => n.classList.remove('active-filter'));
    if (activeMapFilterStand === standCode) {
        activeMapFilterStand = null;
        document.getElementById('searchInput').value = '';
        document.getElementById('reset-map-btn').classList.add('hidden');
    } else {
        activeMapFilterStand = standCode;
        nodeElement.classList.add('active-filter');
        document.getElementById('searchInput').value = standCode;
        document.getElementById('reset-map-btn').classList.remove('hidden');
        document.getElementById('company-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    filterData();
}

function highlightMapNode(stand) {
    if (!stand) return;
    const node = document.getElementById(`stand-${stand}`);
    if (node && !node.classList.contains('active-filter')) node.classList.add('highlighted');
}
function unhighlightMapNode(stand) {
    if (!stand) return;
    const node = document.getElementById(`stand-${stand}`);
    if (node) node.classList.remove('highlighted');
}

function setupMapDrag() {
    const slider = document.getElementById('map-scroll-container');
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 2; });
}

function updateLaureaMapAccent(filteredData, selectedLaurea, laureaMatchFilter) {
    const nodes = document.querySelectorAll('.stand-box.occupied');
    nodes.forEach(n => n.classList.remove('gestionale-accent-true', 'gestionale-accent-unspecified', 'gestionale-accent-false', 'muted-by-gestionale'));
    if (selectedLaurea === 'all' || laureaMatchFilter === 'all') return;
    const accentMap = { true: 'gestionale-accent-true', non_specificato: 'gestionale-accent-unspecified', false: 'gestionale-accent-false' };
    const targetStatus = laureaMatchFilter === 'true' ? true : laureaMatchFilter === 'non_specificato' ? 'non_specificato' : false;
    const accentClass = accentMap[laureaMatchFilter];
    const standsWithMatch = new Set(
        filteredData.filter(c => c.stand && companyHasLaurea(c, selectedLaurea) === targetStatus).map(c => c.stand)
    );
    nodes.forEach(node => {
        const standCode = node.dataset.stand;
        if (standsWithMatch.has(standCode)) node.classList.add(accentClass);
        else node.classList.add('muted-by-gestionale');
    });
}

function updateInterestMapAccent(filteredData, interestFilter) {
    const accentClasses = ['interest-accent-interested', 'interest-accent-not-interested', 'interest-accent-visit', 'muted-by-interest'];
    const nodes = document.querySelectorAll('.stand-box.occupied');
    nodes.forEach(n => n.classList.remove(...accentClasses));
    if (interestFilter === 'all' || interestFilter === 'hide_not_interested') return;
    const filteredStands = new Set(filteredData.filter(c => c.stand).map(c => c.stand));
    let accentClass;
    if (interestFilter === 'interested_only') accentClass = 'interest-accent-interested';
    else if (interestFilter === 'not_interested_only') accentClass = 'interest-accent-not-interested';
    else if (interestFilter === 'visit_only') accentClass = 'interest-accent-visit';
    else return;
    nodes.forEach(node => {
        const standCode = node.dataset.stand;
        if (filteredStands.has(standCode)) node.classList.add(accentClass);
        else node.classList.add('muted-by-interest');
    });
}

function positionTooltip(node, tooltip) {
    const scrollArea = document.getElementById('map-scroll-container');
    if (!scrollArea || !node || !tooltip) return;
    tooltip.style.setProperty('--tooltip-offset-x', '0px');
    tooltip.classList.remove('map-tooltip--top');
    const padding = 8;
    const scrollRect = scrollArea.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const naturalLeft = nodeRect.left + (nodeRect.width / 2) - (tooltipRect.width / 2);
    const minLeft = scrollRect.left + padding;
    const maxLeft = scrollRect.right - tooltipRect.width - padding;
    const clampedLeft = Math.max(minLeft, Math.min(naturalLeft, maxLeft));
    tooltip.style.setProperty('--tooltip-offset-x', `${clampedLeft - naturalLeft}px`);
    const belowTop = nodeRect.bottom + 8;
    const overflowBottom = belowTop + tooltipRect.height > (scrollRect.bottom - padding);
    if (overflowBottom) {
        const aboveTop = nodeRect.top - tooltipRect.height - 8;
        if (aboveTop >= scrollRect.top + padding) {
            tooltip.classList.add('map-tooltip--top');
        }
    }
}

function companyHasLaurea(company, laureaName) {
    if (!laureaName || laureaName === 'all') return null;
    const areeEntries = Object.values(company.aree || {});
    if (areeEntries.length === 0) return 'non_specificato';
    for (const lauree of areeEntries) {
        if (lauree.some(l => l.toLowerCase() === laureaName.toLowerCase())) return true;
    }
    return false;
}

function renderGrid(data) {
    const grid = document.getElementById('company-grid');
    const noResults = document.getElementById('no-results');
    grid.innerHTML = '';
    if (data.length === 0) { grid.classList.add('hidden'); noResults.classList.remove('hidden'); return; }
    grid.classList.remove('hidden'); noResults.classList.add('hidden');

    const selectedLaurea = document.getElementById('laureaFilter').value;
    const shortLaurea = selectedLaurea !== 'all' ? selectedLaurea.replace(/^Laurea (Magistrale (a Ciclo Unico )?in |in )/i, '') : '';

    data.forEach(company => {
        const interestFlag = getCompanyInterest(company.id);
        const isVisit = getVisitFlag(company.id);

        // --- Status indicators (clean inline text, no big badges) ---
        const indicators = [];
        if (selectedLaurea !== 'all') {
            const laureaStatus = companyHasLaurea(company, selectedLaurea);
            if (laureaStatus === true) indicators.push(`<span class="text-emerald-600 font-medium">✓ ${escapeHtml(shortLaurea)}</span>`);
            else if (laureaStatus === false) indicators.push('<span class="text-red-500">✗ Non cercano</span>');
            else if (laureaStatus === 'non_specificato') indicators.push('<span class="text-amber-500">? N.S.</span>');
        }
        if (isVisit) indicators.push(`<span class="text-amber-500">${'★'.repeat(isVisit)}${'☆'.repeat(5-isVisit)}</span>`);
        const aggCount = currentUser ? getInterestedCount(company.id) : 0;
        if (aggCount > 0) indicators.push(`<span class="text-indigo-500">👥 ${aggCount}</span>`);
        if (interestFlag === 'interested') indicators.push('<span class="text-emerald-600">⭐</span>');
        else if (interestFlag === 'not_interested') indicators.push('<span class="text-slate-400">🚫</span>');
        const indicatorsHtml = indicators.join('<span class="text-slate-300 mx-1">·</span>');

        // --- Action button styles ---
        const interestedBtnClass = interestFlag === 'interested'
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700';
        const notInterestedBtnClass = interestFlag === 'not_interested'
            ? 'bg-rose-600 text-white border-rose-700'
            : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400 hover:text-rose-700';
        const visitBtnClass = isVisit ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400';

        // --- Stand badge ---
        const standHtml = company.stand
            ? `<span onclick="const el=document.getElementById('stand-${company.stand}');if(el){el.scrollIntoView({behavior:'smooth',inline:'center'});highlightMapNode('${company.stand}');setTimeout(()=>unhighlightMapNode('${company.stand}'),2000)}" class="text-xs font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex-shrink-0">${company.stand}</span>`
            : '';

        // --- Expandable details ---
        const posHtml = company.areaInserimento.length > 0
            ? company.areaInserimento.map(role =>
                `<li class="py-1.5 px-2 bg-slate-50 rounded border border-slate-100 text-sm text-slate-700"><span class="text-indigo-400 mr-1">▸</span>${escapeHtml(role)}</li>`).join('')
            : '<li class="text-sm text-slate-400 italic px-2">Non specificato</li>';

        const modalHtml = company.modalita.length > 0
            ? company.modalita.map(m => `<span class="inline-block bg-violet-50 text-violet-700 text-[10px] font-medium px-2 py-0.5 rounded mr-1 mb-1 border border-violet-100">${escapeHtml(m)}</span>`).join('')
            : '';

        const areeEntries = Object.entries(company.aree);
        let areeHtml = '';
        if (areeEntries.length > 0) {
            areeHtml = areeEntries.map(([area, lauree]) => {
                const hasGest = lauree.some(l => l.toLowerCase().includes('gestionale'));
                const laureList = lauree.length > 0
                    ? '<ul class="ml-3 mt-0.5 space-y-0">' + lauree.map(l => {
                        const isGest = l.toLowerCase().includes('gestionale');
                        return `<li class="text-[11px] ${isGest ? 'text-emerald-700 font-semibold' : 'text-slate-500'}">• ${escapeHtml(l)}</li>`;
                    }).join('') + '</ul>'
                    : '';
                return `<div class="mb-1.5"><span class="text-xs font-medium ${hasGest ? 'text-emerald-700' : 'text-slate-700'}">${escapeHtml(area)}</span>${laureList}</div>`;
            }).join('');
        }

        // --- Build card ---
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col card-hover';
        if (company.stand) {
            card.addEventListener('mouseenter', () => highlightMapNode(company.stand));
            card.addEventListener('mouseleave', () => unhighlightMapNode(company.stand));
        }

        card.innerHTML = `
            <div class="p-4 flex items-start gap-3">
                <img src="${company.logo}" alt="" class="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-white p-0.5 flex-shrink-0" onerror="this.style.display='none'">
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-semibold text-slate-800 leading-tight">${escapeHtml(company.name)}</h4>
                    <p class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(company.sector)}</p>
                </div>
                ${standHtml}
            </div>
            <div class="px-4 pb-3 flex flex-wrap items-center text-[11px] text-slate-400 leading-relaxed">${indicatorsHtml}</div>
            <div class="border-t border-slate-100 p-4 space-y-2.5">
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="setCompanyInterest(${company.id}, 'interested')" class="text-xs font-medium border rounded-lg px-3 py-2 transition-colors ${interestedBtnClass}">⭐ Interessato</button>
                    <button onclick="setCompanyInterest(${company.id}, 'not_interested')" class="text-xs font-medium border rounded-lg px-3 py-2 transition-colors ${notInterestedBtnClass}">Non interessato</button>
                </div>
                <div class="flex items-center gap-2">
                    <select onchange="setVisitScore(${company.id}, this.value)" class="text-[11px] font-medium border rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${visitBtnClass}">
                        <option value="0" ${!isVisit ? 'selected' : ''}>Presentarsi?</option>
                        <option value="1" ${isVisit===1 ? 'selected' : ''}>★☆☆☆☆</option>
                        <option value="2" ${isVisit===2 ? 'selected' : ''}>★★☆☆☆</option>
                        <option value="3" ${isVisit===3 ? 'selected' : ''}>★★★☆☆</option>
                        <option value="4" ${isVisit===4 ? 'selected' : ''}>★★★★☆</option>
                        <option value="5" ${isVisit===5 ? 'selected' : ''}>★★★★★</option>
                    </select>
                    ${interestFlag !== 'unset' ? `<button onclick="setCompanyInterest(${company.id}, 'unset')" class="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">↺ Reset</button>` : ''}
                    <button onclick="generateCompanyExplain(${company.id})" class="text-[11px] font-medium border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1.5 transition-colors ml-auto">✨ Info AI</button>
                </div>
            </div>
            <div class="px-4 pb-3 space-y-1.5 text-sm">
                ${company.areaInserimento.length > 0 ? `<details class="group"><summary class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 flex items-center gap-1"><span class="group-open:rotate-90 transition-transform text-[10px]">▶</span> Posizioni (${company.areaInserimento.length})</summary><ul class="mt-2 space-y-1">${posHtml}</ul></details>` : ''}
                ${modalHtml ? `<details class="group"><summary class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 flex items-center gap-1"><span class="group-open:rotate-90 transition-transform text-[10px]">▶</span> Modalità (${company.modalita.length})</summary><div class="mt-2">${modalHtml}</div></details>` : ''}
                ${areeHtml ? `<details class="group"><summary class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 flex items-center gap-1"><span class="group-open:rotate-90 transition-transform text-[10px]">▶</span> Aree Disciplinari (${areeEntries.length})</summary><div class="mt-2 pl-2 border-l-2 border-slate-100">${areeHtml}</div></details>` : ''}
                ${company.descrizione ? `<details class="group"><summary class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 flex items-center gap-1"><span class="group-open:rotate-90 transition-transform text-[10px]">▶</span> Chi siamo</summary><p class="mt-2 text-xs text-slate-600 leading-relaxed">${escapeHtml(company.descrizione)}</p></details>` : ''}
                <div id="explain-${company.id}" class="hidden space-y-2">
                    <div class="explain-loader hidden text-center py-3"><div class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div><p class="text-[10px] text-slate-400 mt-1">Cerco info online...</p></div>
                    <div class="explain-area hidden"><div class="explain-text bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto"></div></div>
                    <div class="explain-error hidden bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-lg p-2"></div>
                </div>
            </div>
            <div class="mt-auto border-t border-slate-100 px-4 py-2.5 flex items-center gap-1.5">
                ${company.sito ? `<a href="${escapeHtml(company.sito)}" target="_blank" rel="noopener" class="flex-1 text-center bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 py-1.5 rounded-md text-[11px] font-medium transition-colors">Sito</a>` : ''}
                ${company.email ? `<a href="mailto:${escapeHtml(company.email)}" class="bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 py-1.5 px-2.5 rounded-md text-[11px] transition-colors" title="${escapeHtml(company.email)}">✉</a>` : ''}
                ${company.urlPagina ? `<a href="${escapeHtml(company.urlPagina)}" target="_blank" rel="noopener" class="bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 py-1.5 px-2.5 rounded-md text-[11px] transition-colors" title="Pagina Career Day">📄</a>` : ''}
                <a href="${company.glassdoorUrl}" target="_blank" rel="noopener" class="bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 py-1.5 px-2.5 rounded-md text-[11px] transition-colors" title="Glassdoor">⭐</a>
                <a href="${company.linkedinUrl}" target="_blank" rel="noopener" class="bg-[#0a66c2] hover:bg-[#004182] text-white py-1.5 px-2.5 rounded-md text-[11px] font-bold transition-colors">in</a>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterData() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const sector = document.getElementById('sectorFilter').value;
    const selectedLaurea = document.getElementById('laureaFilter').value;
    const laureaMatchFilter = document.getElementById('laureaMatchFilter').value;
    const interestFilter = document.getElementById('interestFilter').value;

    document.getElementById('laureaSubFilter').classList.toggle('hidden', selectedLaurea === 'all');

    const filtered = companiesData.filter(c => {
        const searchText = `${c.name} ${c.stand} ${c.areaInserimento.join(' ')} ${c.sector} ${Object.keys(c.aree).join(' ')}`.toLowerCase();
        const matchSearch = searchText.includes(term);
        const matchSector = sector === 'all' || c.sector === sector;
        let matchLaurea = true;
        if (selectedLaurea !== 'all' && laureaMatchFilter !== 'all') {
            const status = companyHasLaurea(c, selectedLaurea);
            if (laureaMatchFilter === 'true') matchLaurea = status === true;
            else if (laureaMatchFilter === 'false') matchLaurea = status === false;
            else if (laureaMatchFilter === 'non_specificato') matchLaurea = status === 'non_specificato';
        }
        const interestFlag = getCompanyInterest(c.id);
        let matchInterest = true;
        if (interestFilter === 'hide_not_interested') matchInterest = interestFlag !== 'not_interested';
        else if (interestFilter === 'interested_only') matchInterest = interestFlag === 'interested';
        else if (interestFilter === 'not_interested_only') matchInterest = interestFlag === 'not_interested';
        else if (interestFilter === 'visit_only') matchInterest = getVisitFlag(c.id) > 0;
        return matchSearch && matchSector && matchLaurea && matchInterest;
    });

    renderGrid(filtered);
    updateLaureaMapAccent(filtered, selectedLaurea, laureaMatchFilter);
    updateInterestMapAccent(filtered, interestFilter);

    document.getElementById('total-companies-count').textContent = filtered.length;
    if (selectedLaurea !== 'all') {
        const shortName = selectedLaurea.replace(/^Laurea (Magistrale (a Ciclo Unico )?in |in )/i, '');
        document.getElementById('total-laurea-count').textContent = filtered.filter(c => companyHasLaurea(c, selectedLaurea) === true).length;
        document.getElementById('total-laurea-label').textContent = shortName.length > 20 ? shortName.substring(0, 18) + '…' : shortName;
    } else {
        document.getElementById('total-laurea-count').textContent = companiesData.length;
        document.getElementById('total-laurea-label').textContent = 'Aziende';
    }
    document.getElementById('total-roles-count').textContent = filtered.reduce((a, c) => a + c.areaInserimento.length, 0);
    document.getElementById('total-visit-count').textContent = companiesData.filter(c => getVisitFlag(c.id) > 0).length;

    if (!activeMapFilterStand && term.length > 1) {
        document.querySelectorAll('.stand-box').forEach(n => n.classList.remove('active-filter'));
        const exact = filtered.find(c => c.stand.toLowerCase() === term);
        if (exact) document.getElementById(`stand-${exact.stand}`)?.classList.add('active-filter');
    }
}

function resetAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sectorFilter').value = 'all';
    document.getElementById('laureaFilter').value = 'all';
    document.getElementById('laureaMatchFilter').value = 'all';
    document.getElementById('laureaSubFilter').classList.add('hidden');
    document.getElementById('interestFilter').value = 'hide_not_interested';
    activeMapFilterStand = null;
    document.querySelectorAll('.stand-box').forEach(n => n.classList.remove('active-filter'));
    document.getElementById('reset-map-btn').classList.add('hidden');
    filterData();
}

function populateSectorFilter() {
    const select = document.getElementById('sectorFilter');
    const sectors = [...new Set(companiesData.map(c => c.sector).filter(Boolean))].sort();
    sectors.forEach(s => select.appendChild(new Option(s, s)));
}

function populateLaureaFilter() {
    const select = document.getElementById('laureaFilter');
    const lauree = new Set();
    companiesData.forEach(c => {
        Object.values(c.aree || {}).forEach(arr => arr.forEach(l => lauree.add(l)));
    });
    const sorted = [...lauree].sort((a, b) => a.localeCompare(b, 'it'));
    sorted.forEach(l => {
        const short = l.replace(/^Laurea (Magistrale (a Ciclo Unico )?in |in )/i, '');
        const opt = new Option(l, l);
        opt.textContent = '🎓 ' + short;
        select.appendChild(opt);
    });
    const gestionale = sorted.find(l => l.toLowerCase().includes('ingegneria gestionale') && l.toLowerCase().includes('magistrale'));
    if (gestionale) select.value = gestionale;
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => { activeMapFilterStand = null; document.getElementById('reset-map-btn').classList.add('hidden'); document.querySelectorAll('.stand-box').forEach(n => n.classList.remove('active-filter')); filterData(); });
    document.getElementById('sectorFilter').addEventListener('change', filterData);
    document.getElementById('laureaFilter').addEventListener('change', filterData);
    document.getElementById('laureaMatchFilter').addEventListener('change', filterData);
    document.getElementById('interestFilter').addEventListener('change', filterData);
    document.getElementById('reset-filters').addEventListener('click', resetAllFilters);
    document.getElementById('reset-map-btn').addEventListener('click', resetAllFilters);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('ai-key-modal');
            if (modal && !modal.classList.contains('hidden')) closeAiKeyModal();
        }
    });
}

function exportInterestedCompanies() {
    const interested = companiesData.filter(c => {
        const flag = getCompanyInterest(c.id);
        const visit = getVisitFlag(c.id);
        return flag === 'interested' || visit > 0;
    });
    if (interested.length === 0) {
        alert('Nessuna azienda segnata come interessata o con voto "Presentarsi".');
        return;
    }
    const sep = '\t';
    const header = ['Nome', 'Settore', 'Stand', 'Interesse', 'Presentarsi', 'Sito Web', 'Email', 'Pagina Career Day', 'LinkedIn', 'Posizioni'].join(sep);
    const rows = interested.map(c => {
        const flag = getCompanyInterest(c.id);
        const visit = getVisitFlag(c.id);
        return [
            c.name,
            c.sector,
            c.stand || '',
            flag === 'interested' ? 'Sì' : '',
            visit > 0 ? '★'.repeat(visit) : '',
            c.sito || '',
            c.email || '',
            c.urlPagina || '',
            `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`,
            c.areaInserimento.join(' | ')
        ].join(sep);
    });
    const tsv = [header, ...rows].join('\n');

    // Copy to clipboard
    navigator.clipboard.writeText(tsv).then(() => {
        const btn = document.getElementById('export-interested-btn');
        if (btn) { const orig = btn.innerHTML; btn.innerHTML = '✓ Copiato!'; setTimeout(() => btn.innerHTML = orig, 2000); }
    }).catch(() => {
        // Fallback: download as CSV
        const csvHeader = ['Nome', 'Settore', 'Stand', 'Interesse', 'Presentarsi', 'Sito Web', 'Email', 'Pagina Career Day', 'LinkedIn', 'Posizioni'].join(',');
        const csvRows = interested.map(c => {
            const flag = getCompanyInterest(c.id);
            const visit = getVisitFlag(c.id);
            const csvEsc = (v) => `"${(v||'').replace(/"/g,'""')}"`;
            return [
                csvEsc(c.name), csvEsc(c.sector), csvEsc(c.stand),
                csvEsc(flag === 'interested' ? 'Sì' : ''),
                csvEsc(visit > 0 ? visit.toString() : ''),
                csvEsc(c.sito), csvEsc(c.email), csvEsc(c.urlPagina),
                csvEsc(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`),
                csvEsc(c.areaInserimento.join(' | '))
            ].join(',');
        });
        const blob = new Blob(['\uFEFF' + csvHeader + '\n' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.download = 'aziende-interessate-career-day.csv';
        link.href = URL.createObjectURL(blob);
        link.click();
    });
}

function dismissOnboarding() {
    const banner = document.getElementById('onboarding-banner');
    if (banner) banner.style.display = 'none';
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
}

function getStandPosition(standId) {
    const node = document.getElementById(`stand-${standId}`);
    if (!node) return null;
    const mapLayout = document.getElementById('pavilion-map-layout');
    const mapRect = mapLayout.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return {
        x: nodeRect.left - mapRect.left + nodeRect.width / 2,
        y: nodeRect.top - mapRect.top + nodeRect.height / 2
    };
}

function distanceBetween(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function buildRouteStops() {
    const stops = [];
    companiesData.forEach(c => {
        if (!c.stand) return;
        const visitScore = getVisitFlag(c.id);
        const interest = getCompanyInterest(c.id);
        if (visitScore > 0 || interest === 'interested') {
            const pos = getStandPosition(c.stand);
            if (pos) {
                stops.push({
                    companyId: c.id,
                    name: c.name,
                    stand: c.stand,
                    visitScore: visitScore || 0,
                    interested: interest === 'interested',
                    priority: visitScore > 0 ? visitScore : (interest === 'interested' ? 0.5 : 0),
                    x: pos.x,
                    y: pos.y
                });
            }
        }
    });
    return stops;
}

function nearestNeighborOrder(group, startPos) {
    if (group.length === 0) return [];
    const ordered = [];
    const remaining = [...group];
    let current = startPos;
    while (remaining.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = distanceBetween(current, remaining[i]);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        ordered.push(remaining[bestIdx]);
        current = remaining[bestIdx];
        remaining.splice(bestIdx, 1);
    }
    return ordered;
}

function optimizeRoute(stops, mode) {
    if (stops.length <= 2) return stops;
    const mapLayout = document.getElementById('pavilion-map-layout');
    const mapRect = mapLayout.getBoundingClientRect();
    const entrance = { x: mapRect.width / 2, y: mapRect.height };

    if (mode === 'smooth') {
        let route = nearestNeighborOrder(stops, entrance);
        route = twoOptImprove(route);
        return route;
    }

    const visitStops = stops.filter(s => s.visitScore > 0).sort((a, b) => b.visitScore - a.visitScore);
    const interestOnly = stops.filter(s => s.visitScore === 0);
    const scoreGroups = {};
    visitStops.forEach(s => {
        (scoreGroups[s.visitScore] = scoreGroups[s.visitScore] || []).push(s);
    });
    const sortedScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);

    let orderedVisits = [];
    let lastPos = entrance;
    for (const score of sortedScores) {
        let group = nearestNeighborOrder(scoreGroups[score], lastPos);
        group = twoOptImprove(group);
        orderedVisits = orderedVisits.concat(group);
        if (group.length > 0) lastPos = group[group.length - 1];
    }

    let orderedInterests = nearestNeighborOrder(interestOnly, lastPos);
    orderedInterests = twoOptImprove(orderedInterests);
    return [...orderedVisits, ...orderedInterests];
}

function twoOptImprove(route) {
    if (route.length < 4) return route;
    let improved = true;
    let best = [...route];
    while (improved) {
        improved = false;
        for (let i = 0; i < best.length - 2; i++) {
            for (let j = i + 2; j < best.length; j++) {
                const a = i === 0 ? { x: best[0].x, y: best[0].y + 200 } : best[i - 1];
                const b = best[i], c = best[j];
                const d = j + 1 < best.length ? best[j + 1] : { x: best[best.length - 1].x, y: best[best.length - 1].y + 200 };
                const currentDist = distanceBetween(a, b) + distanceBetween(c, d);
                const newDist = distanceBetween(a, c) + distanceBetween(b, d);
                if (newDist < currentDist - 1) {
                    const reversed = best.slice(i, j + 1).reverse();
                    best = [...best.slice(0, i), ...reversed, ...best.slice(j + 1)];
                    improved = true;
                }
            }
        }
    }
    return best;
}

function drawRoute(route) {
    clearRouteVisuals();
    if (route.length < 1) return;

    const mapLayout = document.getElementById('pavilion-map-layout');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('route-svg');
    svg.setAttribute('width', mapLayout.scrollWidth);
    svg.setAttribute('height', mapLayout.scrollHeight);
    svg.id = 'route-overlay';

    const entrance = { x: mapLayout.scrollWidth / 2, y: mapLayout.scrollHeight - 20 };
    const points = [entrance, ...route.map(s => ({ x: s.x, y: s.y })), entrance];

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.classList.add('route-line');
    svg.appendChild(path);

    path.style.strokeDasharray = '8 4';
    path.style.animation = 'none';

    route.forEach((stop, i) => {
        const priorityClass = stop.visitScore >= 4 ? 'priority-high' : stop.visitScore >= 2 ? 'priority-medium' : '';
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', stop.x);
        circle.setAttribute('cy', stop.y);
        circle.setAttribute('r', 12);
        circle.classList.add('route-marker-bg');
        if (priorityClass) circle.classList.add(priorityClass);
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', stop.x);
        text.setAttribute('y', stop.y);
        text.classList.add('route-marker');
        text.textContent = i + 1;
        svg.appendChild(text);

        const standNode = document.getElementById(`stand-${stop.stand}`);
        if (standNode) standNode.classList.add('on-route');
    });

    const eSvgG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const eCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    eCircle.setAttribute('cx', entrance.x); eCircle.setAttribute('cy', entrance.y);
    eCircle.setAttribute('r', 10);
    eCircle.setAttribute('fill', '#0f172a'); eCircle.setAttribute('stroke', 'white'); eCircle.setAttribute('stroke-width', '2');
    eSvgG.appendChild(eCircle);
    const eText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    eText.setAttribute('x', entrance.x); eText.setAttribute('y', entrance.y);
    eText.setAttribute('font-size', '8'); eText.setAttribute('fill', 'white');
    eText.setAttribute('text-anchor', 'middle'); eText.setAttribute('dominant-baseline', 'central');
    eText.setAttribute('font-weight', '700');
    eText.textContent = '🚪';
    eSvgG.appendChild(eText);
    svg.appendChild(eSvgG);

    mapLayout.style.position = 'relative';
    mapLayout.appendChild(svg);
}

function renderItineraryPanel(route) {
    const panel = document.getElementById('itinerary-panel');
    const list = document.getElementById('itinerary-list');
    if (route.length === 0) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');

    const groups = [];
    let currentGroup = null;
    route.forEach((stop, i) => {
        const label = stop.visitScore >= 4 ? 'Priorità alta' : stop.visitScore >= 2 ? 'Priorità media' : stop.visitScore === 1 ? 'Priorità bassa' : 'Interessato';
        if (!currentGroup || currentGroup.label !== label) {
            currentGroup = { label, stops: [] };
            groups.push(currentGroup);
        }
        currentGroup.stops.push({ ...stop, index: i });
    });

    const groupColors = {
        'Priorità alta':   { badge: 'bg-red-500',   bg: 'bg-red-50',   text: 'text-red-700' },
        'Priorità media':  { badge: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
        'Priorità bassa':  { badge: 'bg-sky-500',   bg: 'bg-sky-50',   text: 'text-sky-700' },
        'Interessato':     { badge: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' }
    };

    list.innerHTML = groups.map(group => {
        const c = groupColors[group.label] || groupColors['Interessato'];
        const stopsHtml = group.stops.map(stop => {
            const stars = stop.visitScore > 0 ? `${'★'.repeat(stop.visitScore)}${'☆'.repeat(5-stop.visitScore)}` : '⭐';
            return `<li class="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:${c.bg} transition-colors cursor-pointer group" onclick="scrollToStand('${stop.stand}')">
                <span class="${c.badge} text-white text-[10px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">${stop.index + 1}</span>
                <div class="flex-1 min-w-0">
                    <span class="text-xs font-bold text-slate-800 block truncate">${escapeHtml(stop.name)}</span>
                    <span class="text-[10px] text-slate-400">Stand ${stop.stand}</span>
                </div>
                <span class="text-[11px] text-slate-400 tracking-wide">${stars}</span>
                <span class="text-slate-300 group-hover:text-indigo-500 transition-colors text-xs">›</span>
            </li>`;
        }).join('');
        return `<div class="mb-2">
            <div class="flex items-center gap-2 px-3 py-1.5"><span class="w-2 h-2 rounded-full ${c.badge}"></span><span class="text-[10px] font-bold ${c.text} uppercase tracking-wider">${group.label}</span><span class="flex-1 h-px bg-slate-100"></span><span class="text-[10px] text-slate-400">${group.stops.length} stand</span></div>
            <ul class="space-y-0.5">${stopsHtml}</ul>
        </div>`;
    }).join('');
}

function scrollToStand(standId) {
    const node = document.getElementById(`stand-${standId}`);
    if (node) {
        node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
        highlightMapNode(standId);
        setTimeout(() => unhighlightMapNode(standId), 2000);
    }
}

function generateItinerary() {
    const stops = buildRouteStops();
    if (stops.length === 0) {
        alert('Nessuna azienda selezionata!\nSegna almeno un\'azienda come "Interessato" o con un voto "Presentarsi".');
        return;
    }
    const mode = document.getElementById('route-mode').value;
    const route = optimizeRoute(stops, mode);
    currentRoute = route;
    drawRoute(route);
    renderItineraryPanel(route);
    document.getElementById('clear-route-btn').classList.remove('hidden');
    document.getElementById('export-route-btn').classList.remove('hidden');
    document.getElementById('map-scroll-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearRouteVisuals() {
    const existing = document.getElementById('route-overlay');
    if (existing) existing.remove();
    document.querySelectorAll('.stand-box.on-route').forEach(n => n.classList.remove('on-route'));
}

function clearRoute() {
    clearRouteVisuals();
    currentRoute = [];
    document.getElementById('itinerary-panel').classList.add('hidden');
    document.getElementById('clear-route-btn').classList.add('hidden');
    document.getElementById('export-route-btn').classList.add('hidden');
}

async function exportRouteImage() {
    if (currentRoute.length === 0) return;
    const btn = document.getElementById('export-route-btn');
    btn.textContent = '⏳ Generazione...';
    btn.disabled = true;
    try {
        const mapSection = document.getElementById('map-scroll-container');
        const mapLayout = document.getElementById('pavilion-map-layout');
        const fullW = mapLayout.scrollWidth;
        const fullH = mapLayout.scrollHeight;

        const origOverflow = mapSection.style.overflow;
        const origWidth = mapSection.style.width;
        const origMinWidth = mapSection.style.minWidth;
        mapSection.style.overflow = 'visible';
        mapSection.style.width = fullW + 'px';
        mapSection.style.minWidth = fullW + 'px';

        const canvas = await html2canvas(mapSection, {
            backgroundColor: '#f1f5f9',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            width: fullW,
            height: fullH + 60,
            windowWidth: fullW + 100,
            scrollX: 0, scrollY: 0, x: 0, y: 0
        });

        mapSection.style.overflow = origOverflow;
        mapSection.style.width = origWidth;
        mapSection.style.minWidth = origMinWidth;

        const pad = 40;
        const rowH = 44;
        const headerH = 70;
        const listHeight = headerH + currentRoute.length * rowH + pad;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = canvas.width + pad * 2;
        finalCanvas.height = canvas.height + listHeight + pad * 2;
        const ctx = finalCanvas.getContext('2d');

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(pad, pad, canvas.width, canvas.height);
        ctx.restore();
        ctx.drawImage(canvas, pad, pad);

        const listY = pad + canvas.height + pad;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pad, listY, canvas.width, listHeight - pad);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, listY, canvas.width, listHeight - pad);

        ctx.fillStyle = '#4f46e5';
        ctx.font = 'bold 28px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('Itinerario Career Day Unibo 2026', pad + 24, listY + 40);

        currentRoute.forEach((stop, i) => {
            const y = listY + headerH + i * rowH;
            if (i % 2 === 0) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(pad + 1, y, canvas.width - 2, rowH);
            }
            const badgeColor = stop.visitScore >= 4 ? '#dc2626' : stop.visitScore >= 2 ? '#f59e0b' : '#4f46e5';
            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.arc(pad + 40, y + rowH / 2, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}`, pad + 40, y + rowH / 2 + 5);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 18px system-ui';
            ctx.fillText(stop.name, pad + 68, y + rowH / 2 + 1);

            const nameWidth = ctx.measureText(stop.name).width;
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px system-ui';
            ctx.fillText(`Stand ${stop.stand}`, pad + 76 + nameWidth, y + rowH / 2 + 1);

            const stars = stop.visitScore > 0 ? '\u2605'.repeat(stop.visitScore) + '\u2606'.repeat(5 - stop.visitScore) : '\u2b50';
            ctx.fillStyle = '#64748b';
            ctx.font = '16px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(stars, pad + canvas.width - 24, y + rowH / 2 + 1);
            ctx.textAlign = 'left';
        });

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Career Day Unibo 2026 \u2022 Padiglione 33', finalCanvas.width / 2, finalCanvas.height - 12);

        const link = document.createElement('a');
        link.download = 'itinerario-career-day-2026.png';
        link.href = finalCanvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Export error:', err);
        alert('Errore durante l\'esportazione. Riprova.');
    } finally {
        btn.innerHTML = '📥 Esporta PNG';
        btn.disabled = false;
    }
}

async function initApp() {
    await loadData();
    if (companiesData.length === 0) return;
    updateAiKeyControls();
    loadInterestFlags();
    loadVisitFlags();

    const auth = getFbAuth();
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) onUserLogin(user);
        });
    } else {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.classList.add('opacity-50', 'cursor-not-allowed');
            loginBtn.title = 'Configura Firebase in firebase-public-config.js per abilitare il login';
        }
    }

    // Onboarding
    if (localStorage.getItem(ONBOARDING_KEY)) {
        const banner = document.getElementById('onboarding-banner');
        if (banner) banner.style.display = 'none';
    }

    document.getElementById('header-count').textContent = companiesData.length + ' aziende';
    renderArchitecturalMap();
    populateSectorFilter();
    populateLaureaFilter();
    filterData();
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', initApp);
