import { COMPANY_REQUIRED_FIELDS } from './constants.js?v=20260317-23';

/**
 * @typedef {Object} Company
 * @property {number} id
 * @property {string} name
 * @property {string} stand
 * @property {string} sector
 * @property {string} sito
 * @property {string} email
 * @property {Record<string, string[]>} aree
 * @property {string[]} areaInserimento
 * @property {string[]} modalita
 * @property {string} descrizione
 * @property {string} logo
 * @property {string} urlPagina
 * @property {string} careersUrl
 * @property {string} linkedinUrl
 * @property {string} glassdoorUrl
 * @property {string} searchIndex
 * @property {string} standLabel
 * @property {boolean} hasConfirmedStand
 */

/**
 * @typedef {Object} UserPreferences
 * @property {Record<string, string>} interests
 * @property {Record<string, number>} visits
 * @property {Record<string, boolean>} applicationOnline
 * @property {number} interestsUpdatedAt
 * @property {number} visitsUpdatedAt
 * @property {number} applicationOnlineUpdatedAt
 */

export function normalizeStandMapKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

export function cleanCompanyName(name) {
    return String(name || '')
        .replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?c\.?\s*|soc\.?\s*coop\.?\s*(agricola)?|s\.?c\.?p\.?a\.?|spa|srl)\b\.?/gi, '')
        .replace(/[.]+$/, '')
        .trim()
        .replace(/\s{2,}/g, ' ');
}

export function getLogoPath(name) {
    const badChars = '<>:"/\\|?* ';
    let clean = String(name || '');
    for (const char of badChars) clean = clean.split(char).join('_');
    return `logos/logo_${clean.toLowerCase()}.png`;
}

export function buildSearchIndex(company) {
    return [
        company.name,
        company.stand,
        company.standLabel,
        company.sector,
        company.areaInserimento.join(' '),
        Object.keys(company.aree || {}).join(' '),
        Object.values(company.aree || {}).flat().join(' ')
    ].join(' ').toLowerCase();
}

export function normalizeCompanyRecord(raw, index) {
    COMPANY_REQUIRED_FIELDS.forEach((field) => {
        if (!(field in raw)) {
            throw new Error(`Campo mancante nel dataset: ${field} (azienda #${index + 1})`);
        }
    });

    const company = {
        id: index + 1,
        name: String(raw.Nome || '').trim(),
        stand: String(raw.Stand || '').trim(),
        sector: String(raw.Settore || 'Non specificato').trim(),
        sito: String(raw.Sito_Web || '').trim(),
        email: String(raw.Email || '').trim(),
        aree: normalizeAree(raw.Aree_Disciplinari),
        areaInserimento: normalizeStringArray(raw.Area_Inserimento),
        modalita: normalizeStringArray(raw.Modalita_Inserimento),
        descrizione: String(raw.Perche_lavorare_per_noi || '').trim(),
        logo: getLogoPath(raw.Nome),
        urlPagina: String(raw.URL_Pagina || '').trim(),
        careersUrl: `https://www.google.com/search?q=${encodeURIComponent(`${raw.Nome || ''} lavora con noi`)}`,
        linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(raw.Nome || '')}`,
        glassdoorUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:glassdoor.it "${cleanCompanyName(raw.Nome || '')}" recensioni`)}`,
        hasConfirmedStand: !!String(raw.Stand || '').trim(),
        standLabel: String(raw.Stand || '').trim() || 'Stand da confermare'
    };

    company.searchIndex = buildSearchIndex(company);
    return company;
}

export function normalizePreferences(input = {}) {
    return {
        interests: normalizeStringMap(input.interests),
        visits: normalizeNumberMap(input.visits),
        applicationOnline: normalizeBooleanMap(input.applicationOnline),
        interestsUpdatedAt: normalizeTimestamp(input.interestsUpdatedAt),
        visitsUpdatedAt: normalizeTimestamp(input.visitsUpdatedAt),
        applicationOnlineUpdatedAt: normalizeTimestamp(input.applicationOnlineUpdatedAt)
    };
}

function normalizeAree(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [String(key || '').trim(), normalizeStringArray(value)])
    );
}

function normalizeStringArray(input) {
    return Array.isArray(input)
        ? input.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
}

function normalizeStringMap(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
        Object.entries(input)
            .filter(([, value]) => value === 'interested' || value === 'not_interested')
            .map(([key, value]) => [String(key), value])
    );
}

function normalizeNumberMap(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
        Object.entries(input)
            .map(([key, value]) => [String(key), Math.max(0, Math.min(5, Number(value) || 0))])
            .filter(([, value]) => value > 0)
    );
}

function normalizeBooleanMap(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
        Object.entries(input)
            .filter(([, value]) => !!value)
            .map(([key]) => [String(key), true])
    );
}

function normalizeTimestamp(value) {
    const numeric = Number(value) || 0;
    return numeric > 0 ? numeric : 0;
}
