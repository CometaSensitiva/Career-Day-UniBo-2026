import argparse
import json
import sys
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DEFAULT_URL = "https://eventi.unibo.it/careerday/aziende-partecipanti-2026"
DEFAULT_OUTPUT = "aziende_dettagli.json"
DEFAULT_TIMEOUT = 30
DEFAULT_DELAY = 1.0
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
}


def estrai_link_aziende(url_base, timeout):
    print(f"Scansione della pagina principale: {url_base}")
    try:
        response = requests.get(url_base, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
    except Exception as e:
        print(f"Errore caricamento pagina principale: {e}")
        sys.exit(1)

    soup = BeautifulSoup(response.text, 'html.parser')
    links = []
    for a_tag in soup.find_all('a', href=True):
        if '/view/' in a_tag['href']:
            link_completo = urljoin(url_base, a_tag['href'])
            if link_completo not in links:
                links.append(link_completo)
                
    print(f"Trovate {len(links)} aziende da analizzare.")
    return links


def is_footer_garbage(testo):
    """Riconosce contenuti spazzatura del footer/template HTML."""
    garbage_markers = [
        "tal:content=", "tal:condition=", "tal:replace=",  # Template HTML
        "©", "copyright", "alma mater studiorum",          # Copyright
        "piwik", "common code", "end common",              # Commenti HTML
        "privacy", "note legali", "impostazioni cookie",   # Link footer
        "pi: 01131710376", "cf: 80007010376",              # Codici fiscali Unibo
        "via zamboni",                                      # Indirizzo Unibo
    ]
    testo_lower = testo.lower()
    return any(marker in testo_lower for marker in garbage_markers)


def struttura_aree_disciplinari(lista_piatta):
    """
    Trasforma la lista piatta di aree e lauree in un dizionario strutturato.
    Le aree macro (es. "Ingegneria e architettura") diventano chiavi,
    le lauree specifiche ("Laurea in ...") diventano valori sotto la propria area.
    """
    struttura = {}
    area_corrente = None

    for voce in lista_piatta:
        voce_stripped = voce.strip()
        if not voce_stripped:
            continue

        # Una "Laurea in/Laurea Magistrale in" è una sottocategoria
        voce_lower = voce_stripped.lower()
        is_laurea = voce_lower.startswith("laurea ")

        if is_laurea and area_corrente:
            struttura[area_corrente].append(voce_stripped)
        else:
            # È un'area macro (nuova categoria)
            area_corrente = voce_stripped
            if area_corrente not in struttura:
                struttura[area_corrente] = []

    return struttura


def analizza_azienda_macchina_a_stati(url_dettaglio, timeout):
    try:
        response = requests.get(url_dettaglio, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
    except Exception as e:
        print(f"  [!] Errore su {url_dettaglio}: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 1. Trova il nome
    nome_azienda = "Sconosciuta"
    h1_tag = soup.find('h1')
    if h1_tag:
        nome_azienda = h1_tag.get_text(strip=True)
    elif soup.title:
        nome_azienda = soup.title.get_text(strip=True).replace("— Unibo", "").strip()

    print(f"  -> Estrazione in corso: {nome_azienda}")

    # 2. STRATEGIA "STATE MACHINE"
    testi_pagina = []
    
    container = soup.find('main') or soup.find('div', id='content') or soup.body
    
    for element in container.find_all(string=True):
        parent_name = getattr(element.parent, 'name', '')
        if parent_name not in ['script', 'style', 'noscript']:
            testo = str(element).replace('\xa0', ' ').strip()
            if testo:
                testi_pagina.append(testo)

    # 3. Mappatura delle sezioni
    azienda_data = {
        "Nome": nome_azienda,
        "URL_Pagina": url_dettaglio,
        "Sito_Web": [],
        "Email": [],
        "Settore": [],
        "Aree_Disciplinari": [],
        "Area_Inserimento": [],
        "Modalita_Inserimento": [],
        "Perche_lavorare_per_noi": [],
        "Cerca_Ingegneria_Gestionale": None  # null finché non abbiamo dati sufficienti
    }

    mapping_sezioni = {
        "perché lavorare per noi": "Perche_lavorare_per_noi",
        "chi siamo": "Perche_lavorare_per_noi",
        "sito web": "Sito_Web",
        "sito internet": "Sito_Web",
        "email": "Email",
        "e-mail": "Email",
        "settore merceologico": "Settore",
        "aree disciplinari di interesse": "Aree_Disciplinari",
        "area di inserimento": "Area_Inserimento",
        "aree di inserimento": "Area_Inserimento",
        "modalità di inserimento": "Modalita_Inserimento",
        "contratti offerti": "Modalita_Inserimento"
    }

    sezione_corrente = None

    # 4. Scorriamo le stringhe piatte
    for testo in testi_pagina:
        # STOP immediato se incontriamo spazzatura del footer
        if is_footer_garbage(testo):
            sezione_corrente = None
            continue

        testo_lower = testo.lower()
        nuova_sezione = None
        
        if len(testo) < 60:
            for keyword, key in mapping_sezioni.items():
                if testo_lower.startswith(keyword):
                    nuova_sezione = key
                    break
                    
        if nuova_sezione:
            sezione_corrente = nuova_sezione
            continue
            
        if sezione_corrente:
            if not azienda_data[sezione_corrente] or azienda_data[sezione_corrente][-1] != testo:
                azienda_data[sezione_corrente].append(testo)

    # 5. RIFINITURA DATI

    # Sito Web
    azienda_data["Sito_Web"] = azienda_data["Sito_Web"][0] if azienda_data["Sito_Web"] else ""
        
    # Email
    email_pulita = ""
    for riga in azienda_data["Email"]:
        for parola in riga.split():
            if "@" in parola:
                email_pulita = parola.strip()
                break
        if email_pulita: break
    azienda_data["Email"] = email_pulita
    
    # Settore
    azienda_data["Settore"] = azienda_data["Settore"][0] if azienda_data["Settore"] else ""
        
    # Perché lavorare per noi
    azienda_data["Perche_lavorare_per_noi"] = " ".join(azienda_data["Perche_lavorare_per_noi"])
    
    # 6. STRUTTURA AREE DISCIPLINARI (area -> [lauree])
    aree_piatte = azienda_data["Aree_Disciplinari"]
    azienda_data["Aree_Disciplinari"] = struttura_aree_disciplinari(aree_piatte)

    # 7. CHECK INGEGNERIA GESTIONALE (logica a 3 stati)
    aree = azienda_data["Aree_Disciplinari"]  # ora è un dict
    tutte_le_lauree = []
    for lauree_lista in aree.values():
        tutte_le_lauree.extend(lauree_lista)

    if tutte_le_lauree:
        # Ci sono lauree specifiche → possiamo dare un verdetto certo
        testo_lauree = " ".join(tutte_le_lauree).lower()
        azienda_data["Cerca_Ingegneria_Gestionale"] = "gestionale" in testo_lauree
    else:
        # Solo aree macro, nessuna laurea specifica → non determinabile
        nomi_aree = " ".join(aree.keys()).lower() if aree else ""
        if "ingegneria" in nomi_aree:
            # L'area macro c'è ma senza dettaglio sulle lauree
            azienda_data["Cerca_Ingegneria_Gestionale"] = "non_specificato"
        elif aree:
            # Ci sono aree ma nemmeno "Ingegneria" tra queste
            azienda_data["Cerca_Ingegneria_Gestionale"] = False
        else:
            # Nessuna area disciplinare trovata
            azienda_data["Cerca_Ingegneria_Gestionale"] = "dati_mancanti"

    return azienda_data


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scraper dettagli aziende Career Day Unibo."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"URL pagina aziende (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Path file JSON output (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"Timeout richieste HTTP in secondi (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Pausa tra richieste ai dettagli in secondi (default: {DEFAULT_DELAY})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Numero massimo aziende da processare (0 = nessun limite)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    print("=== Avvio Web Scraper Career Day Unibo ===\n")

    link_aziende = estrai_link_aziende(args.url, args.timeout)
    if args.limit > 0:
        link_aziende = link_aziende[: args.limit]
        print(f"Limit attivo: processerò {len(link_aziende)} aziende.")

    dati_raccolti = []

    for i, link in enumerate(link_aziende):
        print(f"[{i+1}/{len(link_aziende)}]", end="")
        dati = analizza_azienda_macchina_a_stati(link, args.timeout)
        if dati:
            dati_raccolti.append(dati)

        if args.delay > 0:
            time.sleep(args.delay)

    print(f"\nSalvataggio di {len(dati_raccolti)} aziende in {args.output}...")
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dati_raccolti, f, indent=4, ensure_ascii=False)

    print("\n=== Scraping Completato con Successo! ===")
    aziende_gestionali = sum(1 for a in dati_raccolti if a["Cerca_Ingegneria_Gestionale"])
    print(f"📊 Su {len(dati_raccolti)} aziende totali, {aziende_gestionali} hanno esplicitato l'interesse per Ingegneria Gestionale!")


if __name__ == "__main__":
    main()
