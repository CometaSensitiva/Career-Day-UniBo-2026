import { $, clearChildren, createEl } from '../shared/dom.js?v=20260317-23';
import { escapeHtml, getHostFromUrl, getRootHost, linkifyPlainUrls, normalizeHttpUrl, renderMarkdown } from '../shared/sanitize.js?v=20260317-23';
import { companyHasLaurea } from './data.js?v=20260317-23';

const FILTER_SELECT_IDS = ['sectorFilter', 'laureaFilter', 'laureaMatchFilter', 'interestFilter'];
let activeUiSelect = null;
let uiSelectListenersBound = false;

export function populateFilters(state) {
    populateSectorFilter(state);
    populateLaureaFilter(state);
}

export function initializeCustomFilterSelects(state) {
    bindUiSelectDismissal();
    FILTER_SELECT_IDS.forEach((id) => mountCustomNativeSelect(state.dom[id]));
    syncCustomFilterSelects(state);
}

export function syncCustomFilterSelects(state) {
    FILTER_SELECT_IDS.forEach((id) => syncCustomNativeSelect(state.dom[id]));
}

export function renderDatasetLoadError(state, error) {
    if (!state.dom.companyGrid) return;
    state.dom.companyGrid.innerHTML = `<div class="col-span-3 text-center py-16 bg-white rounded-xl border border-red-200"><p class="text-red-600 font-bold text-lg">Errore: impossibile caricare aziende_dettagli.json</p><p class="text-slate-500 mt-2">${escapeHtml(error.message || 'Errore sconosciuto')}</p></div>`;
}

export function renderArchitecturalMap(state, handlers) {
    const mapContainer = state.dom.pavilionMapLayout;
    const standBox = (id, extraClass = '') => `<div id="stand-${id}" class="stand-box bg-slate-200 border border-slate-300 text-slate-400 ${extraClass}" data-stand="${id}">${id}</div>`;
    const twoByTwo = (tl, tr, bl, br) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${standBox(tl, 'h-8')}${standBox(tr, 'h-8')}${standBox(bl, 'h-8')}${standBox(br, 'h-8')}</div>`;
    const leftSpan = (left, tr, br) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${standBox(left, 'row-span-2 h-[68px]')}${standBox(tr, 'h-8')}${standBox(br, 'h-8')}</div>`;
    const rightSpan = (tl, bl, right) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${standBox(tl, 'h-8')}${standBox(right, 'row-span-2 h-[68px]')}${standBox(bl, 'h-8')}</div>`;
    const bottomSpan = (left, right) => `<div class="grid grid-cols-2 grid-rows-2 gap-1 w-[70px]">${standBox(left, 'row-span-2 h-[68px]')}${standBox(right, 'row-span-2 h-[68px]')}</div>`;
    const strip = (values) => `<div class="flex flex-col gap-1 w-[33px]">${values.map((value) => value === 'gap' ? '<div class="h-8"></div>' : standBox(value, 'h-8')).join('')}</div>`;
    const spacer = '<div class="h-6"></div>';
    const aisle = (label) => `<div class="w-8 flex flex-col justify-between py-12 text-slate-300 font-bold text-xl items-center select-none"><span>${label}</span><span>${label}</span><span>${label}</span></div>`;
    const row = (stands) => `<div class="flex gap-1">${stands.map((value) => standBox(value, 'h-8 w-8')).join('')}</div>`;

    const topBlocks = `<div class="flex items-start justify-center gap-2 mb-8 mt-4">${strip(['A46', 'A44', 'A42', 'A40', 'A38', 'gap', 'A32', 'A30', 'A28', 'A26', 'A24', 'A22', 'gap', 'A16', 'A14', 'A12', 'A10', 'A8', 'A6'])} ${aisle('A')} <div class="flex flex-col gap-4">${twoByTwo('A37', 'B38', 'A35', 'B36')} ${spacer} ${twoByTwo('A31', 'B32', 'A29', 'B30')} ${spacer} ${twoByTwo('A25', 'B26', 'A23', 'B24')} ${spacer} ${twoByTwo('A19', 'B20', 'A17', 'B18')} ${spacer} ${twoByTwo('A13', 'B14', 'A11', 'B12')} ${spacer} ${twoByTwo('A7', 'B8', 'A5', 'B6')}</div> ${aisle('B')} <div class="flex flex-col gap-4">${twoByTwo('B37', 'C38', 'B35', 'C36')} ${spacer} ${twoByTwo('B31', 'C32', 'B29', 'C30')} ${spacer} ${twoByTwo('B25', 'C26', 'B23', 'C24')} ${spacer} ${rightSpan('B19', 'B17', 'C18-C20')} ${spacer} ${rightSpan('B13', 'B11', 'C12-14')} ${spacer} ${leftSpan('B5-B7', 'C8', 'C6')}</div> ${aisle('C')} <div class="flex flex-col gap-4">${twoByTwo('C39', 'D40', 'C37', 'D38')} <div class="w-[70px] h-[80px] bg-slate-300 border border-slate-400 text-[8px] flex items-center justify-center text-center text-slate-600 font-bold p-1 rounded-sm opacity-60">AREA CONFINDUSTRIA</div> <div class="w-full flex justify-start">${strip(['C27', 'C25', 'C23', 'C21', 'C19', 'C17'])}</div> ${bottomSpan('C11-C13', 'D12-D14')} ${rightSpan('C7', 'C5', 'D6-D8')}</div> ${aisle('D')} <div class="flex flex-col gap-4">${twoByTwo('D39', 'E38', 'D37', 'E36')} <div class="h-[80px] w-[70px] flex items-center justify-center text-slate-400 text-xs font-bold text-center">☕<br>BAR</div> <div class="w-full flex justify-end">${strip(['E28', 'E26', 'E24', 'E22', 'E20', 'E18'])}</div> ${rightSpan('D13', 'D11', 'E12-E14')} ${twoByTwo('D7', 'E10', 'D5', 'E8')}</div> ${aisle('E')} <div class="flex flex-col gap-4">${twoByTwo('E37', 'F38', 'E35', 'F36')} ${spacer} ${twoByTwo('E31', 'F32', 'E29', 'F30')} ${spacer} ${twoByTwo('E25', 'F26', 'E23', 'F24')} ${spacer} ${twoByTwo('E17', 'F20', 'E15', 'F18')} ${spacer} ${leftSpan('E11-E13', 'F14', 'F12')} ${spacer} ${twoByTwo('E9', 'F10', 'E7', 'F8')}</div> ${aisle('F')} <div class="flex flex-col gap-4">${twoByTwo('F37', 'G38', 'F35', 'G36')} ${spacer} ${twoByTwo('F31', 'G32', 'F29', 'G30')} ${spacer} ${twoByTwo('F25', 'G26', 'F23', 'G24')} ${spacer} ${twoByTwo('F19', 'G20', 'F17', 'G18')} ${spacer} ${leftSpan('F11-F13', 'G14', 'G12')} ${spacer} ${twoByTwo('F7', 'G8', 'F5', 'G6')}</div> ${aisle('G')} ${strip(['G45', 'G43', 'G41', 'G39', 'G37', 'G35', 'gap', 'G31', 'G29', 'G27', 'G25', 'G23', 'G21', 'gap', 'G17', 'G15', 'G13', 'G11', 'G9', 'G7', 'G5', 'G3'])}</div>`;
    const bottomRow = `<div class="w-full flex justify-between items-end px-4 gap-6">${row(['A2', 'A1', 'B3', 'B2', 'B1'])}<div class="flex gap-1">${standBox('C1', 'h-8 w-8')}${standBox('C2', 'h-8 w-8')}<div class="h-8 w-16 bg-slate-300 text-slate-500 font-bold text-[8px] flex items-center justify-center">BBS</div></div><div class="flex gap-1">${standBox('E2', 'h-8 w-8')}${standBox('E1', 'h-8 w-16')}</div>${standBox('F3-F4', 'h-8 w-[70px]')}</div>`;
    mapContainer.innerHTML = topBlocks + bottomRow;
    hydrateMapWithData(state, handlers);
    setupMapDrag(state.dom.mapScrollContainer);
}

function getExplainCacheKeyForRender(state, companyId) {
    const userKey = state.currentUser?.uid || 'guest';
    return `${userKey}:${companyId}:${state.filters.laurea || 'all'}`;
}

export function renderGrid(state, deps) {
    const { companyGrid, noResults } = state.dom;
    if (!deps.filteredCompanies.length) {
        clearChildren(companyGrid);
        companyGrid.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    companyGrid.classList.remove('hidden');
    noResults.classList.add('hidden');
    const fragment = document.createDocumentFragment();
    const selectedLaurea = state.filters.laurea;

    deps.filteredCompanies.forEach((company) => {
        const interestFlag = deps.getCompanyInterest(company.id);
        const visitScore = deps.getVisitFlag(company.id);
        const isApplicationOnline = deps.getApplicationOnlineFlag(company.id);

        const indicators = [];
        if (selectedLaurea !== 'all') {
            const laureaStatus = companyHasLaurea(company, selectedLaurea, state.laureaToAreasMap);
            if (laureaStatus === true) indicators.push('<span class="company-card__indicator company-card__indicator--match">Compatibile</span>');
            else if (laureaStatus === false) indicators.push('<span class="company-card__indicator company-card__indicator--negative">Non cercano</span>');
            else if (laureaStatus === 'non_specificato') indicators.push('<span class="company-card__indicator company-card__indicator--unknown">Da verificare</span>');
        }
        if (visitScore > 0) indicators.push(`<span class="company-card__indicator company-card__indicator--priority">Priorità ${'★'.repeat(visitScore)}</span>`);
        if (isApplicationOnline) indicators.push('<span class="company-card__indicator company-card__indicator--info">Applica online</span>');
        if (interestFlag === 'interested') indicators.push('<span class="company-card__indicator company-card__indicator--match">Selezionata</span>');
        else if (interestFlag === 'not_interested') indicators.push('<span class="company-card__indicator company-card__indicator--negative">Esclusa</span>');

        const interestedBtnClass = interestFlag === 'interested'
            ? 'company-card__choice company-card__choice--positive is-active'
            : 'company-card__choice company-card__choice--positive';
        const notInterestedBtnClass = interestFlag === 'not_interested'
            ? 'company-card__choice company-card__choice--negative is-active'
            : 'company-card__choice company-card__choice--negative';
        const onlineToggleBtnClass = isApplicationOnline
            ? 'company-card__tertiary is-active'
            : 'company-card__tertiary';
        const planningDisabled = isApplicationOnline || !company.hasConfirmedStand;
        const priorityHelpText = isApplicationOnline
            ? 'Applica online attivo'
            : company.hasConfirmedStand
                ? '1 bassa · 5 alta'
                : 'Stand in attesa di conferma';
        const priorityOptionsHtml = Array.from({ length: 5 }, (_, index) => {
            const score = index + 1;
            const optionClass = visitScore === score
                ? 'ui-select__option is-selected'
                : 'ui-select__option';
            return `<button type="button" data-action="set-visit" data-company-id="${company.id}" data-value="${score}" class="${optionClass}" ${planningDisabled ? 'disabled' : ''} aria-pressed="${visitScore === score ? 'true' : 'false'}" aria-label="Imposta priorità visita ${score} su 5" title="Priorità ${score} su 5">${getPriorityOptionLabel(score)}</button>`;
        }).join('');
        const priorityTriggerLabel = getPriorityTriggerLabel(visitScore, isApplicationOnline, company.hasConfirmedStand);
        const aiPanelState = state.ui.aiPanels[String(company.id)] || null;
        const currentExplainCacheKey = getExplainCacheKeyForRender(state, company.id);
        const aiCached = aiPanelState?.cacheKey ? state.ui.aiCache[aiPanelState.cacheKey] : state.ui.aiCache[currentExplainCacheKey];
        const hasAiContent = !!aiCached?.text;
        const isAiOpen = !!aiPanelState;
        const isAiLoading = !!aiPanelState?.loading;
        const showAiLaureaHint = selectedLaurea === 'all';
        const aiButtonLabel = isAiLoading && !hasAiContent
            ? 'Generazione AI...'
            : isAiOpen
                ? 'Nascondi Info AI'
                : hasAiContent
                    ? 'Apri Info AI'
                    : 'Genera Info AI';
        const aiButtonClass = hasAiContent
            ? isAiOpen
                ? 'company-card__tertiary company-card__tertiary--accent is-active'
                : 'company-card__tertiary company-card__tertiary--accent'
            : 'company-card__tertiary company-card__tertiary--generate';
        const regenerateButtonLabel = isAiLoading && hasAiContent
            ? 'Rigenerazione...'
            : aiPanelState?.error && !hasAiContent
                ? 'Riprova AI'
                : 'Rigenera AI';
        const showRegenerateButton = hasAiContent || !!aiPanelState?.error;
        const showDeleteAiButton = hasAiContent;
        const siteUrl = normalizeHttpUrl(company.sito);
        const pageUrl = normalizeHttpUrl(company.urlPagina);
        const glassdoorUrl = normalizeHttpUrl(company.glassdoorUrl);
        const linkedInUrl = normalizeHttpUrl(company.linkedinUrl);
        const mailtoHref = company.email ? `mailto:${encodeURIComponent(company.email)}` : '';

        const standBadge = company.hasConfirmedStand
            ? `<button type="button" data-action="scroll-stand" data-stand="${escapeHtml(company.stand)}" class="company-card__stand-badge">${escapeHtml(company.stand)}</button>`
            : '<span class="company-card__stand-badge company-card__stand-badge--pending">Stand da confermare</span>';

        const positionsHtml = company.areaInserimento.length
            ? `<details class="company-card__detail"><summary class="company-card__summary"><span class="company-card__summary-icon">▶</span>Posizioni (${company.areaInserimento.length})</summary><ul class="company-card__positions">${company.areaInserimento.map((role) => `<li>${escapeHtml(role)}</li>`).join('')}</ul></details>`
            : '';
        const modalHtml = company.modalita.length
            ? `<details class="company-card__detail"><summary class="company-card__summary"><span class="company-card__summary-icon">▶</span>Modalità (${company.modalita.length})</summary><div class="company-card__modes">${company.modalita.map((mode) => `<span class="company-card__mode-chip">${escapeHtml(mode)}</span>`).join('')}</div></details>`
            : '';
        const disciplinaryHtml = Object.keys(company.aree).length
            ? `<details class="company-card__detail"><summary class="company-card__summary"><span class="company-card__summary-icon">▶</span>Aree disciplinari (${Object.keys(company.aree).length})</summary><div class="company-card__disciplines">${Object.entries(company.aree).map(([area, lauree]) => `<div class="company-card__discipline-group"><strong>${escapeHtml(area)}</strong>${lauree.length ? `<ul class="company-card__discipline-list">${lauree.map((laurea) => `<li>${escapeHtml(laurea)}</li>`).join('')}</ul>` : '<span class="company-card__discipline-empty">Non specificato</span>'}</div>`).join('')}</div></details>`
            : '';
        const aboutHtml = company.descrizione
            ? `<details class="company-card__detail"><summary class="company-card__summary"><span class="company-card__summary-icon">▶</span>Chi siamo</summary><p class="company-card__about">${escapeHtml(company.descrizione)}</p></details>`
            : '';
        const standNotice = company.hasConfirmedStand
            ? ''
            : '<p class="company-card__notice">Stand non ancora confermato: l’azienda resta filtrabile ma non entra in mappa e itinerario.</p>';
        const metaHtml = indicators.length ? `<div class="company-card__meta">${indicators.join('')}</div>` : '';
        const aiContainerClasses = aiPanelState ? 'space-y-2' : 'hidden space-y-2';
        const aiLoaderClasses = aiPanelState?.loading ? 'explain-loader text-center py-3' : 'explain-loader hidden text-center py-3';
        const aiAreaClasses = aiCached?.text && !aiPanelState?.loading && !aiPanelState?.error
            ? 'explain-area'
            : 'explain-area hidden';
        const aiErrorClasses = aiPanelState?.error ? 'explain-error' : 'explain-error hidden';
        const aiErrorText = aiPanelState?.error ? escapeHtml(aiPanelState.error) : '';
        const aiHintHtml = showAiLaureaHint
            ? '<p class="company-card__ai-hint">Suggerimento: seleziona prima il tuo corso di laurea nei filtri per ottenere risposte AI piu pertinenti.</p>'
            : '';

        const card = createEl('article', { className: 'company-card flex flex-col card-hover' });
        card.dataset.companyId = String(company.id);
        if (company.hasConfirmedStand) {
            card.dataset.stand = company.stand;
            card.addEventListener('mouseenter', () => highlightMapNode(company.stand));
            card.addEventListener('mouseleave', () => unhighlightMapNode(company.stand));
        }
        card.innerHTML = `
            <div class="company-card__header">
                <img src="${escapeHtml(company.logo)}" alt="" loading="lazy" decoding="async" class="company-logo company-card__logo" data-company-name="${escapeHtml(company.name)}">
                <div class="company-card__identity flex-1 min-w-0">
                    <p class="company-card__sector">${escapeHtml(company.sector)}</p>
                    <h4 class="company-card__title">${escapeHtml(company.name)}</h4>
                </div>
                ${standBadge}
            </div>
            ${metaHtml}
            <div class="company-card__research">
                <div class="company-card__stage-header">
                    <span class="company-card__stage-step">1</span>
                    <div class="company-card__stage-copy">
                        <p class="company-card__stage-title">Esplora l’azienda</p>
                        <p class="company-card__stage-description">Apri le fonti principali e usa Info AI per capire velocemente se l’azienda ti interessa.</p>
                    </div>
                </div>
                <div class="company-card__links company-card__links--research">
                    ${siteUrl ? `<a href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener noreferrer" class="company-card__link">Sito</a>` : ''}
                    ${pageUrl ? `<a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer" class="company-card__link" title="Pagina Career Day">Scheda</a>` : ''}
                    ${linkedInUrl ? `<a href="${escapeHtml(linkedInUrl)}" target="_blank" rel="noopener noreferrer" class="company-card__link company-card__link--linkedin">LinkedIn</a>` : ''}
                    ${glassdoorUrl ? `<a href="${escapeHtml(glassdoorUrl)}" target="_blank" rel="noopener noreferrer" class="company-card__link" title="Glassdoor">Glassdoor</a>` : ''}
                    ${mailtoHref ? `<a href="${mailtoHref}" class="company-card__link" title="${escapeHtml(company.email)}">Email</a>` : ''}
                </div>
                ${aiHintHtml}
                <div class="company-card__links company-card__links--ai">
                    <button type="button" data-action="toggle-ai" data-company-id="${company.id}" class="${aiButtonClass}" ${isAiLoading && !hasAiContent ? 'disabled' : ''}>${aiButtonLabel}</button>
                    ${showRegenerateButton ? `<button type="button" data-action="regenerate-ai" data-company-id="${company.id}" class="company-card__tertiary company-card__tertiary--utility" ${isAiLoading ? 'disabled' : ''}>${regenerateButtonLabel}</button>` : ''}
                    ${showDeleteAiButton ? `<button type="button" data-action="delete-ai" data-company-id="${company.id}" class="company-card__tertiary company-card__tertiary--danger">Cancella AI</button>` : ''}
                </div>
            </div>
            <div class="company-card__details company-card__details--research">
                <div id="explain-${company.id}" class="${aiContainerClasses}">
                    <div class="${aiLoaderClasses}"><div class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div><p class="text-[10px] text-slate-400 mt-1">Cerco informazioni online...</p></div>
                    <div class="${aiAreaClasses}"><div class="explain-text bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed"></div></div>
                    <div class="${aiErrorClasses}">${aiErrorText}</div>
                </div>
                ${aboutHtml}
                ${positionsHtml}
                ${modalHtml}
                ${disciplinaryHtml}
            </div>
            <div class="company-card__decision">
                <div class="company-card__stage-header">
                    <span class="company-card__stage-step">2</span>
                    <div class="company-card__stage-copy">
                        <p class="company-card__stage-title">Valuta l’interesse</p>
                        <p class="company-card__stage-description">Dopo averla esplorata, segna se vuoi tenerla in considerazione oppure escluderla.</p>
                    </div>
                </div>
                <div class="company-card__decision-grid">
                    <button type="button" data-action="set-interest" data-company-id="${company.id}" data-value="interested" class="${interestedBtnClass}">Interessato</button>
                    <button type="button" data-action="set-interest" data-company-id="${company.id}" data-value="not_interested" class="${notInterestedBtnClass}">Non interessato</button>
                </div>
                ${interestFlag !== 'unset' ? `<button type="button" data-action="set-interest" data-company-id="${company.id}" data-value="unset" class="company-card__reset">Azzera scelta</button>` : ''}
            </div>
            <div class="company-card__planning">
                <div class="company-card__stage-header">
                    <span class="company-card__stage-step">3</span>
                    <div class="company-card__stage-copy">
                        <p class="company-card__stage-title">Pianifica la visita</p>
                        <p class="company-card__stage-description">Solo se ti interessa davvero, decidi priorità di visita oppure se candidarti solo online.</p>
                    </div>
                </div>
                <div class="company-card__toolbar company-card__toolbar--planning">
                    <div class="company-card__priority-control">
                        <div class="ui-select ui-select--priority ${planningDisabled ? 'is-disabled' : ''}" data-ui-select>
                            <button type="button" data-action="toggle-priority-menu" class="ui-select__trigger company-card__priority-trigger" ${planningDisabled ? 'disabled' : ''} aria-haspopup="listbox" aria-expanded="false">
                                <span class="ui-select__trigger-label">${escapeHtml(priorityTriggerLabel)}</span>
                            </button>
                            <div class="ui-select__menu hidden" role="listbox">
                                ${priorityOptionsHtml}
                            </div>
                        </div>
                        <p class="company-card__priority-help">${priorityHelpText}</p>
                    </div>
                    <button type="button" data-action="toggle-online" data-company-id="${company.id}" data-value="${isApplicationOnline ? 'false' : 'true'}" class="${onlineToggleBtnClass}" aria-pressed="${isApplicationOnline ? 'true' : 'false'}" title="${isApplicationOnline ? 'Disattiva la candidatura solo online' : 'Attiva la candidatura solo online'}">Applica online</button>
                </div>
                ${(visitScore > 0 || isApplicationOnline) ? `<button type="button" data-action="reset-planning" data-company-id="${company.id}" class="company-card__reset">Azzera pianificazione</button>` : ''}
                ${standNotice}
            </div>
        `;

        card.querySelectorAll('.company-logo').forEach((image) => {
            image.addEventListener('error', () => {
                image.style.display = 'none';
            }, { once: true });
        });
        card.querySelectorAll('[data-action="set-interest"]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                deps.onSetInterest(company.id, button.dataset.value);
            });
        });
        const prioritySelect = card.querySelector('.ui-select--priority');
        card.querySelector('[data-action="toggle-priority-menu"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!prioritySelect || prioritySelect.classList.contains('is-disabled')) return;
            toggleUiSelect(prioritySelect);
        });
        card.querySelectorAll('[data-action="set-visit"]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (prioritySelect) closeUiSelect(prioritySelect);
                deps.onSetVisit(company.id, button.dataset.value);
            });
        });
        card.querySelector('[data-action="toggle-online"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onToggleOnline(company.id, event.currentTarget.dataset.value === 'true');
        });
        card.querySelector('[data-action="reset-planning"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onResetPlanning(company.id);
        });
        card.querySelector('[data-action="toggle-ai"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onToggleAi(company.id);
        });
        card.querySelector('[data-action="regenerate-ai"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onRegenerateAi(company.id);
        });
        card.querySelector('[data-action="delete-ai"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onDeleteAi(company.id);
        });
        card.querySelector('[data-action="scroll-stand"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            deps.onScrollStand(event.currentTarget.dataset.stand);
        });
        if (aiPanelState && aiCached?.text && !aiPanelState.loading && !aiPanelState.error) {
            renderExplainContent(card.querySelector(`#explain-${company.id}`), aiCached.text, company);
        }
        fragment.appendChild(card);
    });
    companyGrid.replaceChildren(fragment);
}

export function updateDashboardCounts(state, filteredCompanies, deps) {
    state.dom.totalCompaniesCount.textContent = filteredCompanies.length;
    if (state.filters.laurea !== 'all') {
        const shortName = state.filters.laurea.replace(/^Laurea (Magistrale (a Ciclo Unico )?in |in )/i, '');
        state.dom.totalLaureaCount.textContent = filteredCompanies.filter((company) => companyHasLaurea(company, state.filters.laurea, state.laureaToAreasMap) === true).length;
        state.dom.totalLaureaLabel.textContent = shortName.length > 20 ? `${shortName.slice(0, 18)}…` : shortName;
    } else {
        state.dom.totalLaureaCount.textContent = state.companies.length;
        state.dom.totalLaureaLabel.textContent = 'Aziende';
    }
    state.dom.totalRolesCount.textContent = filteredCompanies.reduce((acc, company) => acc + company.areaInserimento.length, 0);
    state.dom.totalVisitCount.textContent = state.companies.filter((company) => deps.getVisitFlag(company.id) > 0).length;
}

export function filterCompanies(state, deps) {
    const filtered = state.companies.filter((company) => {
        const matchSearch = company.searchIndex.includes(state.filters.search.toLowerCase());
        const matchSector = state.filters.sector === 'all' || company.sector === state.filters.sector;
        let matchLaurea = true;
        if (state.filters.laurea !== 'all' && state.filters.laureaMatch !== 'all') {
            const status = companyHasLaurea(company, state.filters.laurea, state.laureaToAreasMap);
            if (state.filters.laureaMatch === 'true') matchLaurea = status === true;
            else if (state.filters.laureaMatch === 'false') matchLaurea = status === false;
            else if (state.filters.laureaMatch === 'non_specificato') matchLaurea = status === 'non_specificato';
        }

        const interestFlag = deps.getCompanyInterest(company.id);
        let matchInterest = true;
        if (state.filters.interest === 'hide_not_interested') matchInterest = interestFlag !== 'not_interested';
        else if (state.filters.interest === 'interested_only') matchInterest = interestFlag === 'interested';
        else if (state.filters.interest === 'not_interested_only') matchInterest = interestFlag === 'not_interested';
        else if (state.filters.interest === 'visit_only') matchInterest = deps.getVisitFlag(company.id) > 0;

        return matchSearch && matchSector && matchLaurea && matchInterest;
    });

    state.dom.laureaSubFilter.classList.toggle('hidden', state.filters.laurea === 'all');
    renderGrid(state, { ...deps, filteredCompanies: filtered });
    updateDashboardCounts(state, filtered, deps);
    updateLaureaMapAccent(state, filtered);
    updateInterestMapAccent(state, filtered, deps);
    highlightExactStandMatch(state, filtered);
    return filtered;
}

export function highlightMapNode(stand) {
    $(`stand-${stand}`)?.classList.add('highlighted');
}

export function unhighlightMapNode(stand) {
    $(`stand-${stand}`)?.classList.remove('highlighted');
}

export function annotateExplainOutput(root, company) {
    linkifyPlainUrls(root);
    const trustedHosts = new Set();
    [company.sito, company.urlPagina].filter(Boolean).forEach((url) => {
        const host = getHostFromUrl(url);
        if (!host) return;
        trustedHosts.add(host);
        trustedHosts.add(getRootHost(host));
    });
    trustedHosts.add('linkedin.com');

    const knownJobHosts = [
        'workdayjobs.com',
        'myworkdayjobs.com',
        'smartrecruiters.com',
        'greenhouse.io',
        'lever.co',
        'jobvite.com',
        'icims.com',
        'successfactors.com',
        'taleo.net',
        'join.com',
        'indeed.com'
    ];

    root.querySelectorAll('a[href]').forEach((link) => {
        const host = getHostFromUrl(link.href);
        const rootHost = getRootHost(host);
        const trusted = trustedHosts.has(host) || trustedHosts.has(rootHost) || knownJobHosts.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`));
        if (!trusted) {
            link.classList.add('text-amber-700');
            link.title = 'Link AI non verificato automaticamente';
        }
    });

    const needsFallback = /posizioni aperte|stato: da verificare|non trovate con fonte verificabile|cerca qui/i.test(root.textContent || '');
    if (!needsFallback) return;
    const links = [];
    const careersUrl = normalizeHttpUrl(company.careersUrl || '');
    const siteUrl = normalizeHttpUrl(company.sito || '');
    const linkedInUrl = normalizeHttpUrl(company.linkedinUrl || '');
    if (careersUrl) links.push({ label: 'Cerca offerte', url: careersUrl });
    if (siteUrl) links.push({ label: 'Apri sito aziendale', url: siteUrl });
    if (linkedInUrl) links.push({ label: 'Apri LinkedIn', url: linkedInUrl });
    if (!links.length) return;

    const box = createEl('div', { className: 'ai-careers-fallback' });
    box.appendChild(createEl('p', { className: 'ai-careers-fallback__title', text: 'Link utili verificati per continuare la ricerca' }));
    const row = createEl('div', { className: 'ai-careers-fallback__actions' });
    links.forEach((item) => {
        row.appendChild(createEl('a', {
            className: 'ai-careers-fallback__link',
            text: item.label,
            attrs: { href: item.url, target: '_blank', rel: 'noopener noreferrer' }
        }));
    });
    box.appendChild(row);
    root.appendChild(box);
}

export function renderExplainContent(container, markdownText, company) {
    const explainArea = container.querySelector('.explain-area');
    const explainText = container.querySelector('.explain-text');
    if (!explainArea || !explainText) return;
    explainText.innerHTML = renderMarkdown(markdownText);
    annotateExplainOutput(explainText, company);
    explainArea.classList.remove('hidden');
}

function populateSectorFilter(state) {
    const sectors = [...new Set(state.companies.map((company) => company.sector).filter(Boolean))].sort();
    sectors.forEach((sector) => state.dom.sectorFilter.appendChild(new Option(sector, sector)));
}

function populateLaureaFilter(state) {
    const lauree = new Set();
    state.companies.forEach((company) => {
        Object.values(company.aree || {}).forEach((list) => list.forEach((laurea) => lauree.add(laurea)));
    });
    [...lauree].sort((a, b) => a.localeCompare(b, 'it')).forEach((laurea) => {
        const option = new Option(laurea, laurea);
        if (/^Laurea Magistrale/i.test(laurea)) {
            option.textContent = `[LM] ${laurea.replace(/^Laurea Magistrale (a Ciclo Unico )?in\s*/i, '')}`;
        } else if (/^Laurea in\s+/i.test(laurea)) {
            option.textContent = `[L] ${laurea.replace(/^Laurea in\s+/i, '')}`;
        } else {
            option.textContent = laurea;
        }
        state.dom.laureaFilter.appendChild(option);
    });
}

function getPriorityTriggerLabel(visitScore, isApplicationOnline, hasConfirmedStand) {
    if (isApplicationOnline) return 'Applica online';
    if (!hasConfirmedStand) return 'Stand atteso';
    if (visitScore > 0) return `Priorità ${visitScore}/5`;
    return 'Priorità visita';
}

function getPriorityOptionLabel(score) {
    return `Priorità ${score} · ${'★'.repeat(score)}${'☆'.repeat(5 - score)}`;
}

function mountCustomNativeSelect(select) {
    if (!select || select.dataset.customSelectReady === 'true') return;
    bindUiSelectDismissal();
    select.dataset.customSelectReady = 'true';
    select.classList.add('ui-select__native');

    const wrapper = createEl('div', {
        className: 'ui-select ui-select--filter',
        attrs: {
            'data-ui-select': '',
            'data-select-id': select.id
        }
    });
    const trigger = createEl('button', {
        className: 'ui-select__trigger',
        attrs: {
            type: 'button',
            'aria-haspopup': 'listbox',
            'aria-expanded': 'false'
        }
    });
    trigger.appendChild(createEl('span', { className: 'ui-select__trigger-label' }));
    const menu = createEl('div', {
        className: 'ui-select__menu hidden',
        attrs: { role: 'listbox' }
    });
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    select.insertAdjacentElement('afterend', wrapper);

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (wrapper.classList.contains('is-disabled')) return;
        toggleUiSelect(wrapper);
    });
}

function syncCustomNativeSelect(select) {
    if (!select) return;
    const wrapper = select.parentElement?.querySelector(`.ui-select--filter[data-select-id="${select.id}"]`);
    if (!wrapper) return;

    const trigger = wrapper.querySelector('.ui-select__trigger');
    const label = wrapper.querySelector('.ui-select__trigger-label');
    const menu = wrapper.querySelector('.ui-select__menu');
    if (!trigger || !label || !menu) return;

    wrapper.classList.toggle('is-disabled', select.disabled);
    trigger.disabled = select.disabled;
    label.textContent = select.options[select.selectedIndex]?.textContent?.trim() || '';

    clearChildren(menu);
    Array.from(select.options).forEach((option) => {
        const optionButton = createEl('button', {
            className: option.selected ? 'ui-select__option is-selected' : 'ui-select__option',
            text: option.textContent?.trim() || '',
            attrs: {
                type: 'button',
                role: 'option',
                'aria-selected': option.selected ? 'true' : 'false'
            }
        });
        optionButton.disabled = select.disabled || option.disabled;
        optionButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeUiSelect(wrapper);
            if (select.value !== option.value) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            syncCustomNativeSelect(select);
        });
        menu.appendChild(optionButton);
    });
}

function bindUiSelectDismissal() {
    if (uiSelectListenersBound) return;
    uiSelectListenersBound = true;

    document.addEventListener('click', (event) => {
        const owner = event.target.closest('[data-ui-select]');
        if (owner) return;
        if (activeUiSelect) closeUiSelect(activeUiSelect);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && activeUiSelect) {
            closeUiSelect(activeUiSelect);
        }
    });

    window.addEventListener('resize', () => {
        if (activeUiSelect) closeUiSelect(activeUiSelect);
    });
}

function toggleUiSelect(wrapper) {
    if (!wrapper) return;
    if (activeUiSelect === wrapper) {
        closeUiSelect(wrapper);
        return;
    }
    if (activeUiSelect && activeUiSelect !== wrapper) {
        closeUiSelect(activeUiSelect);
    }
    openUiSelect(wrapper);
}

function openUiSelect(wrapper) {
    const trigger = wrapper.querySelector('.ui-select__trigger');
    const menu = wrapper.querySelector('.ui-select__menu');
    if (!trigger || !menu) return;
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.classList.remove('hidden');
    positionUiSelectMenu(wrapper);
    activeUiSelect = wrapper;
}

function closeUiSelect(wrapper) {
    const trigger = wrapper?.querySelector('.ui-select__trigger');
    const menu = wrapper?.querySelector('.ui-select__menu');
    if (!trigger || !menu) return;
    wrapper.classList.remove('is-open', 'ui-select--open-up', 'ui-select--open-down');
    trigger.setAttribute('aria-expanded', 'false');
    menu.style.maxHeight = '';
    menu.classList.add('hidden');
    if (activeUiSelect === wrapper) activeUiSelect = null;
}

function positionUiSelectMenu(wrapper) {
    const trigger = wrapper.querySelector('.ui-select__trigger');
    const menu = wrapper.querySelector('.ui-select__menu');
    if (!trigger || !menu) return;

    wrapper.classList.remove('ui-select--open-up', 'ui-select--open-down');
    menu.style.maxHeight = '';

    const viewportPadding = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const availableAbove = Math.max(0, triggerRect.top - viewportPadding);
    const availableBelow = Math.max(0, window.innerHeight - triggerRect.bottom - viewportPadding);
    const desiredHeight = Math.min(menu.scrollHeight || 0, 320);
    const minimumComfortSpace = Math.min(desiredHeight || 220, 220);
    const openUp = availableBelow < minimumComfortSpace && availableAbove > availableBelow;
    const chosenSpace = openUp ? availableAbove : availableBelow;

    wrapper.classList.add(openUp ? 'ui-select--open-up' : 'ui-select--open-down');
    menu.style.maxHeight = `${Math.max(96, Math.min(chosenSpace, 320))}px`;
}

function hydrateMapWithData(state, handlers) {
    state.companies.forEach((company) => {
        if (!company.hasConfirmedStand) return;
        const node = $(`stand-${company.stand}`);
        if (!node) return;
        node.classList.remove('bg-slate-200', 'text-slate-400');
        node.classList.add('occupied');
        const tooltip = createMapTooltip();
        node.appendChild(tooltip);
        node.addEventListener('mouseenter', () => {
            updateTooltipContent(tooltip, company, state);
            positionTooltip(node, tooltip);
        });
        node.addEventListener('click', (event) => {
            event.stopPropagation();
            handlers.onMapStandClick(company.stand, node);
        });
    });
}

function setupMapDrag(container) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    container.addEventListener('mousedown', (event) => {
        isDown = true;
        startX = event.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    ['mouseleave', 'mouseup'].forEach((eventName) => {
        container.addEventListener(eventName, () => {
            isDown = false;
        });
    });
    container.addEventListener('mousemove', (event) => {
        if (!isDown) return;
        event.preventDefault();
        container.scrollLeft = scrollLeft - ((event.pageX - container.offsetLeft - startX) * 2);
    });
}

function createMapTooltip() {
    return createEl('div', { className: 'map-tooltip' });
}

function updateTooltipContent(tooltip, company, state) {
    clearChildren(tooltip);
    const header = createEl('div', { className: 'flex items-start gap-2.5 mb-2' });
    const logo = createEl('img', {
        className: 'w-14 h-14 object-contain rounded-md bg-white p-1 border border-slate-600 shadow-sm flex-shrink-0',
        attrs: { src: company.logo, alt: '' }
    });
    logo.addEventListener('error', () => {
        logo.style.display = 'none';
    }, { once: true });
    const details = createEl('div', { className: 'min-w-0' });
    details.appendChild(createEl('strong', { className: 'text-indigo-300 text-sm block leading-tight break-words', text: company.name }));
    details.appendChild(createEl('span', { className: 'block opacity-90 text-xs break-words', text: company.sector }));
    header.appendChild(logo);
    header.appendChild(details);
    tooltip.appendChild(header);

    if (state.filters.laurea !== 'all') {
        const status = companyHasLaurea(company, state.filters.laurea, state.laureaToAreasMap);
            const statusLabel = status === true
                ? 'Profilo compatibile'
                : status === 'non_specificato'
                    ? 'Compatibilità da verificare'
                    : status === false
                        ? 'Profilo non cercato'
                        : '';
            if (statusLabel) {
                tooltip.appendChild(createEl('span', { className: 'block text-xs', text: statusLabel }));
            }
        }

    tooltip.appendChild(createEl('span', { className: 'block mt-1 pt-1 border-t border-slate-700 opacity-70 italic', text: 'Clicca per isolare' }));
}

function positionTooltip(node, tooltip) {
    const scrollArea = $('map-scroll-container');
    if (!scrollArea) return;
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
    if (belowTop + tooltipRect.height > (scrollRect.bottom - padding)) {
        const aboveTop = nodeRect.top - tooltipRect.height - 8;
        if (aboveTop >= scrollRect.top + padding) {
            tooltip.classList.add('map-tooltip--top');
        }
    }
}

function updateLaureaMapAccent(state, filteredCompanies) {
    const nodes = document.querySelectorAll('.stand-box.occupied');
    nodes.forEach((node) => node.classList.remove('gestionale-accent-true', 'gestionale-accent-unspecified', 'gestionale-accent-false', 'muted-by-gestionale'));
    if (state.filters.laurea === 'all' || state.filters.laureaMatch === 'all') return;
    const targetStatus = state.filters.laureaMatch === 'true' ? true : state.filters.laureaMatch === 'non_specificato' ? 'non_specificato' : false;
    const accentMap = {
        true: 'gestionale-accent-true',
        false: 'gestionale-accent-false',
        non_specificato: 'gestionale-accent-unspecified'
    };
    const standsWithMatch = new Set(filteredCompanies
        .filter((company) => company.hasConfirmedStand && companyHasLaurea(company, state.filters.laurea, state.laureaToAreasMap) === targetStatus)
        .map((company) => company.stand));
    nodes.forEach((node) => {
        if (standsWithMatch.has(node.dataset.stand)) node.classList.add(accentMap[state.filters.laureaMatch]);
        else node.classList.add('muted-by-gestionale');
    });
}

function updateInterestMapAccent(state, filteredCompanies, deps) {
    const accentClasses = ['interest-accent-interested', 'interest-accent-not-interested', 'interest-accent-visit', 'muted-by-interest'];
    const nodes = document.querySelectorAll('.stand-box.occupied');
    nodes.forEach((node) => node.classList.remove(...accentClasses));
    if (state.filters.interest === 'all' || state.filters.interest === 'hide_not_interested') return;

    const matchingStands = new Set(filteredCompanies.filter((company) => company.hasConfirmedStand).map((company) => company.stand));
    const accentClass = state.filters.interest === 'interested_only'
        ? 'interest-accent-interested'
        : state.filters.interest === 'not_interested_only'
            ? 'interest-accent-not-interested'
            : 'interest-accent-visit';
    nodes.forEach((node) => {
        if (matchingStands.has(node.dataset.stand)) node.classList.add(accentClass);
        else node.classList.add('muted-by-interest');
    });
}

function highlightExactStandMatch(state, filteredCompanies) {
    if (state.ui.activeMapFilterStand || state.filters.search.trim().length <= 1) return;
    document.querySelectorAll('.stand-box').forEach((node) => node.classList.remove('active-filter'));
    const exact = filteredCompanies.find((company) => company.hasConfirmedStand && company.stand.toLowerCase() === state.filters.search.toLowerCase());
    if (exact) {
        $(`stand-${exact.stand}`)?.classList.add('active-filter');
    }
}
