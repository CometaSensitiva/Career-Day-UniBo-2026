# Career Day UniBo 2026 - Dashboard Interattiva

Dashboard web per orientarsi tra le aziende del Career Day UniBo: filtri, mappa stand, preferenze personali, itinerario e supporto AI.

## Funzionalita principali

- Ricerca e filtri per settore, laurea e match.
- Mappa stand interattiva con itinerario e gestione aziende senza stand confermato.
- Preferenze utente sincronizzate su Firebase solo nel nodo personale.
- Export aziende selezionate.
- Overview AI per azienda con API key Gemini salvata solo nel browser utente.

## Architettura attuale

- `index.html` carica il dashboard tramite ES modules.
- `app.js` e un bootstrap minimo.
- `js/dashboard/`: store, data loading, rendering, preferenze, AI, itinerario.
- `js/shared/`: contratti runtime, Firebase e utility DOM/sanitizzazione.
- `database.rules.json`: regole Realtime Database versionate nel repo.
- `tools/stand_map_2026.json`: mappa stand separata e riusabile.
- `tools/validate_dataset.py`: validator dataset/loghi/stand.

## Avvio locale

```bash
npm install
npm run build:tailwind
python3 -m http.server 8000
```

Apri:

- `http://127.0.0.1:8000/index.html`

## Check locali

```bash
npm run build:tailwind
npm run check:js
npm run check:py
npm run validate:data
```

## Sicurezza

- La Gemini key non e nel repository e non viene scritta su Firebase.
- Il client non legge piu dati globali di altri utenti.

## Note operative

- Il conteggio aggregato pubblico degli interessi e stato rimosso dal dashboard studente per evitare accessi cross-user non difendibili senza backend.
- Le aziende senza stand restano visibili nelle card, ma non entrano in mappa e itinerario finche il dato non viene confermato.
