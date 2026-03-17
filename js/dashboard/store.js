import { normalizePreferences } from '../shared/contracts.js?v=20260317-23';
import { $, setText } from '../shared/dom.js?v=20260317-23';

export const state = {
    companies: [],
    companyById: new Map(),
    laureaToAreasMap: new Map(),
    currentUser: null,
    filters: {
        search: '',
        sector: 'all',
        laurea: 'all',
        laureaMatch: 'all',
        interest: 'all'
    },
    preferences: normalizePreferences(),
    ui: {
        activeMapFilterStand: null,
        currentRoute: [],
        trackedLoginUid: null,
        aiCache: {},
        aiPanels: {}
    },
    dom: {}
};

export function bindDomReferences() {
    state.dom = {
        headerCount: $('header-count'),
        loginBtn: $('login-btn'),
        userInfo: $('user-info'),
        userAvatar: $('user-avatar'),
        userAvatarFallback: $('user-avatar-fallback'),
        userName: $('user-name'),
        setAiKeyBtn: $('set-ai-key-btn'),
        aiKeyHelpLink: $('ai-key-help-link'),
        clearAiKeyBtn: $('clear-ai-key-btn'),
        aiKeyModal: $('ai-key-modal'),
        aiKeyInput: $('ai-key-input'),
        aiKeyModalFeedback: $('ai-key-modal-feedback'),
        aiKeyModalClearBtn: $('ai-key-modal-clear-btn'),
        aiKeyVisibilityBtn: $('ai-key-visibility-btn'),
        onboardingBanner: $('onboarding-banner'),
        companyGrid: $('company-grid'),
        noResults: $('no-results'),
        searchInput: $('searchInput'),
        sectorFilter: $('sectorFilter'),
        laureaFilter: $('laureaFilter'),
        laureaMatchFilter: $('laureaMatchFilter'),
        laureaSubFilter: $('laureaSubFilter'),
        interestFilter: $('interestFilter'),
        totalCompaniesCount: $('total-companies-count'),
        totalLaureaCount: $('total-laurea-count'),
        totalLaureaLabel: $('total-laurea-label'),
        totalRolesCount: $('total-roles-count'),
        totalVisitCount: $('total-visit-count'),
        resetFiltersBtn: $('reset-filters'),
        resetMapBtn: $('reset-map-btn'),
        resetPreferencesBtn: $('reset-preferences-btn'),
        exportInterestedBtn: $('export-interested-btn'),
        routeMode: $('route-mode'),
        clearRouteBtn: $('clear-route-btn'),
        exportRouteBtn: $('export-route-btn'),
        mapScrollContainer: $('map-scroll-container'),
        pavilionMapLayout: $('pavilion-map-layout'),
        itineraryPanel: $('itinerary-panel'),
        itineraryList: $('itinerary-list')
    };
}

export function setCompanyData(companies, laureaToAreasMap) {
    state.companies = companies;
    state.companyById = new Map(companies.map((company) => [company.id, company]));
    state.laureaToAreasMap = laureaToAreasMap;
    setText(state.dom.headerCount, `${companies.length} aziende`);
}

export function getCompanyById(companyId) {
    return state.companyById.get(Number(companyId)) || null;
}
