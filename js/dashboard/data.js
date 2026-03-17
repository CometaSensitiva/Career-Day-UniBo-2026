import { normalizeCompanyRecord } from '../shared/contracts.js?v=20260317-23';

export async function loadCompanyData() {
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
        addUrl(new URL('aziende_dettagli.json', `${window.location.href}/`).toString());
    }

    let payload = null;
    let lastError = null;
    for (const url of candidateUrls) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            if (!Array.isArray(json)) throw new Error('Payload non valido');
            payload = json;
            break;
        } catch (error) {
            lastError = `${url} -> ${error.message}`;
            console.warn('Tentativo caricamento dataset fallito:', lastError);
        }
    }

    if (!payload) {
        throw new Error(lastError || 'Impossibile caricare aziende_dettagli.json');
    }

    const companies = payload.map((raw, index) => normalizeCompanyRecord(raw, index));
    const laureaToAreasMap = buildLaureaToAreasMap(companies);
    return { companies, laureaToAreasMap };
}

export function companyHasLaurea(company, laureaName, laureaToAreasMap) {
    if (!laureaName || laureaName === 'all') return null;
    const target = String(laureaName).trim().toLowerCase();
    const areeEntries = Object.entries(company.aree || {});
    if (areeEntries.length === 0) return 'non_specificato';

    for (const [, lauree] of areeEntries) {
        if (lauree.some((laurea) => String(laurea).trim().toLowerCase() === target)) {
            return true;
        }
    }

    const macroAreas = laureaToAreasMap.get(target) ? [...laureaToAreasMap.get(target)] : [];
    if (macroAreas.length > 0) {
        let foundRelevantArea = false;
        let foundRelevantAreaWithoutSpecifiche = false;

        macroAreas.forEach((areaName) => {
            if (!Object.prototype.hasOwnProperty.call(company.aree, areaName)) return;
            foundRelevantArea = true;
            const lauree = Array.isArray(company.aree[areaName]) ? company.aree[areaName] : [];
            if (lauree.length === 0) foundRelevantAreaWithoutSpecifiche = true;
        });

        if (foundRelevantAreaWithoutSpecifiche) return 'non_specificato';
        if (foundRelevantArea) return false;
    }

    return false;
}

function buildLaureaToAreasMap(companies) {
    const map = new Map();
    companies.forEach((company) => {
        Object.entries(company.aree || {}).forEach(([areaName, lauree]) => {
            lauree.forEach((laurea) => {
                const key = String(laurea || '').trim().toLowerCase();
                if (!key) return;
                if (!map.has(key)) map.set(key, new Set());
                map.get(key).add(areaName);
            });
        });
    });
    return map;
}
