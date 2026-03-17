# Architecture Overview

Questo progetto non usa classi applicative in senso OO tradizionale.  
La struttura e principalmente **modulare**: ES modules lato browser, stato centralizzato in uno store runtime e utility condivise.

## Come leggere questo file

Ordine consigliato:

1. attori e infrastruttura
2. mappa moduli frontend
3. contratti runtime
4. flussi applicativi
5. responsabilita file

## Attori e infrastruttura

```mermaid
flowchart LR
    User["Studente / visitatore"] --> Browser["Browser"]
    Browser --> UI["index.html + styles.css"]
    Browser --> Dataset["aziende_dettagli.json"]
    Browser --> LocalStorage["localStorage"]
    Browser --> Firebase["Firebase Auth + Realtime Database"]
    Browser --> Gemini["Gemini API"]

    Repo["GitHub repository"] --> AppFiles["Frontend + docs + rules"]
    Repo --> Tools["tools/*.py"]
    Tools --> Dataset
    Tools --> Logos["logos/"]

    Firebase --> Preferences["users/{uid}/preferences"]
```

## Mappa moduli frontend

```mermaid
flowchart TB
    App[app.js] --> Main[js/dashboard/main.js]

    Main --> Store[js/dashboard/store.js]
    Main --> Data[js/dashboard/data.js]
    Main --> Render[js/dashboard/render.js]
    Main --> Preferences[js/dashboard/preferences.js]
    Main --> AI[js/dashboard/ai.js]
    Main --> Route[js/dashboard/route.js]

    Data --> Contracts[js/shared/contracts.js]
    Store --> Contracts
    Store --> Dom[js/shared/dom.js]

    Render --> Dom
    Render --> Sanitize[js/shared/sanitize.js]
    Render --> Data

    Preferences --> FirebaseShared[js/shared/firebase.js]
    Preferences --> Contracts
    Preferences --> Constants[js/shared/constants.js]

    AI --> Render
    AI --> Dom
    AI --> Constants

    Route --> Dom
    Main --> FirebaseShared
    Main --> Constants
```

## Contratti runtime principali

```mermaid
classDiagram
    class Company {
        +number id
        +string name
        +string stand
        +string standLabel
        +boolean hasConfirmedStand
        +string sector
        +string sito
        +string email
        +object aree
        +string[] areaInserimento
        +string[] modalita
        +string descrizione
        +string logo
        +string urlPagina
        +string careersUrl
        +string linkedinUrl
        +string glassdoorUrl
        +string searchIndex
    }

    class UserPreferences {
        +object interests
        +object visits
        +object applicationOnline
        +number interestsUpdatedAt
        +number visitsUpdatedAt
        +number applicationOnlineUpdatedAt
    }

    class Filters {
        +string search
        +string sector
        +string laurea
        +string laureaMatch
        +string interest
    }

    class UiState {
        +string activeMapFilterStand
        +object[] currentRoute
        +string trackedLoginUid
        +object aiCache
        +object aiPanels
    }

    class AppState {
        +Company[] companies
        +Map companyById
        +Map laureaToAreasMap
        +object currentUser
        +Filters filters
        +UserPreferences preferences
        +UiState ui
        +object dom
    }

    AppState --> Company
    AppState --> Filters
    AppState --> UserPreferences
    AppState --> UiState
```

## Flusso preferenze

```mermaid
sequenceDiagram
    participant User as Utente
    participant UI as Dashboard
    participant LS as localStorage
    participant FB as Firebase RTDB

    User->>UI: clicca Interesse / Priorita / Applica online
    UI->>LS: salva preferenze locali
    UI->>UI: rerender dashboard
    opt utente autenticato
        UI->>FB: update users/{uid}/preferences
        FB-->>UI: conferma o errore
    end
```

## Flusso Info AI

```mermaid
sequenceDiagram
    participant User as Utente
    participant UI as Dashboard
    participant LS as localStorage
    participant Gemini as Gemini API

    User->>UI: clicca Genera / Apri Info AI
    UI->>LS: legge API key e cache AI
    alt risposta in cache
        UI-->>User: mostra risposta salvata
    else nessuna cache
        UI->>Gemini: generateContent + googleSearch
        Gemini-->>UI: testo sintetico
        UI->>LS: salva risposta in cache
        UI-->>User: render nella card
    end
```

## Flusso dati e aggiornamento dataset

```mermaid
flowchart LR
    Source[Sito sorgente Career Day] --> Update[tools/update_dashboard.py]
    Update --> Scrapers[descr_scraper.py + logo_scraper.py]
    Scrapers --> StandMap[tools/stand_map_2026.json]
    StandMap --> AddStands[tools/add_stands.py]
    AddStands --> Dataset[aziende_dettagli.json]
    Dataset --> Validate[tools/validate_dataset.py]
    Validate --> Frontend[index.html + js/dashboard/*]
```

## Responsabilita file principali

| File | Responsabilita |
| --- | --- |
| `app.js` | bootstrap minimo del frontend |
| `index.html` | shell HTML della dashboard |
| `styles.css` | visual design e component styling |
| `js/dashboard/main.js` | orchestrazione eventi, boot, auth state, render cycle |
| `js/dashboard/render.js` | griglia aziende, filtri, mappa statica, dropdown custom |
| `js/dashboard/preferences.js` | preferenze locali + sync Firebase |
| `js/dashboard/ai.js` | cache AI, key management, richiesta Gemini |
| `js/dashboard/route.js` | itinerario, mappa route, export PNG |
| `js/dashboard/data.js` | caricamento e normalizzazione dataset |
| `js/dashboard/store.js` | store applicativo e DOM refs |
| `js/shared/contracts.js` | shape runtime e normalizzazione dati |
| `js/shared/firebase.js` | inizializzazione Firebase condivisa |
| `js/shared/sanitize.js` | sanitizzazione HTML/markdown/link |
| `tools/*.py` | scraping, arricchimento e validazione dataset |

## Note architetturali

- L'app e **frontend-first**: niente backend custom, niente Cloud Functions.
- La persistenza remota e limitata alle preferenze utente.
- L'AI e opzionale e dipende da una chiave locale del browser.
- Il progetto e pensato per essere mantenibile anche senza framework.
