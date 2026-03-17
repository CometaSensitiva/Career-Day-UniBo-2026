# Aggiornamento Dashboard (Anno per Anno)

Questa guida serve per aggiornare dataset, stand e loghi del Career Day con un comando unico e poi validare il risultato.

## Prerequisiti

Installa dipendenze Python (una volta sola):

```bash
python3 -m pip install requests beautifulsoup4
```

## Comando Unico

Da root progetto:

```bash
python3 tools/update_dashboard.py --year 2026
```

Questo esegue in sequenza:
1. `tools/descr_scraper.py` -> aggiorna `aziende_dettagli.json`
2. `tools/add_stands.py` -> assegna gli stand usando `tools/stand_map_2026.json`
3. `tools/logo_scraper.py` -> aggiorna la cartella `logos/` + `aziende_data.json`

## Test Veloce (consigliato prima del run completo)

```bash
python3 tools/update_dashboard.py --year 2026 --limit 10
```

## Run Completo per un nuovo anno

```bash
python3 tools/update_dashboard.py --year 2027
```

Se l'URL del sito cambia formato, passa direttamente `--url`:

```bash
python3 tools/update_dashboard.py --url "https://eventi.unibo.it/careerday/aziende-partecipanti-2027"
```

## Opzioni utili

- `--skip-stands`: salta assegnazione stand.
- `--skip-logos`: salta scraping loghi.
- `--overwrite-logos`: riscarica anche i loghi già presenti.
- `--dry-run`: stampa i comandi senza eseguirli.
- `--mapping-file path.json`: usa una mappa stand esterna.

Esempio:

```bash
python3 tools/update_dashboard.py --year 2027 --mapping-file stand_map_2027.json
```

## Validazione consigliata

```bash
npm run build:tailwind
python3 tools/validate_dataset.py --input aziende_dettagli.json --logos-dir logos --stand-map tools/stand_map_2026.json
```

Il report stampa:

- aziende senza stand
- stand duplicati
- campi obbligatori mancanti
- URL `http://`
- loghi mancanti

## Checklist prima del commit

1. Apri `aziende_dettagli.json` e controlla che il numero aziende sia plausibile.
2. Cerca campi vuoti critici (`Nome`, `URL_Pagina`, `Settore`, `Sito_Web`).
3. Verifica che gli stand siano valorizzati oppure esplicitamente segnalati come mancanti nel report.
4. Avvia dashboard in locale e controlla 5-10 card a campione.
5. Commit dei file aggiornati (`aziende_dettagli.json`, `logos/`, `tools/stand_map_2026.json`, eventuali report utili).
