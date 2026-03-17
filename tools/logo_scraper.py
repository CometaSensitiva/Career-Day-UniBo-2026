import argparse
import json
import os
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DEFAULT_URL = "https://eventi.unibo.it/careerday/aziende-partecipanti-2026"
DEFAULT_LOGOS_DIR = "logos"
DEFAULT_OUTPUT_JSON = "aziende_data.json"
DEFAULT_TIMEOUT = 30
DEFAULT_DELAY = 0.2
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
}

def pulisci_nome_file(nome):
    """Rende il nome dell'azienda un nome di file valido per Windows/Mac"""
    caratteri_non_validi = '<>:"/\\|?* '
    for char in caratteri_non_validi:
        nome = nome.replace(char, '_')
    return nome.lower()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scraper loghi aziende Career Day Unibo."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"URL pagina aziende (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--logos-dir",
        default=DEFAULT_LOGOS_DIR,
        help=f"Cartella output loghi (default: {DEFAULT_LOGOS_DIR})",
    )
    parser.add_argument(
        "--output-json",
        default=DEFAULT_OUTPUT_JSON,
        help=f"File output JSON metadati loghi (default: {DEFAULT_OUTPUT_JSON})",
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
        help=f"Pausa tra download loghi in secondi (default: {DEFAULT_DELAY})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Numero massimo aziende da processare (0 = nessun limite)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Sovrascrive i loghi già presenti. Default: salta i file esistenti.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if not os.path.exists(args.logos_dir):
        os.makedirs(args.logos_dir)

    print("Inizio connessione a Unibo...")
    try:
        response = requests.get(args.url, headers=HEADERS, timeout=args.timeout)
        response.raise_for_status()  # Verifica che la pagina sia caricata correttamente
    except Exception as e:
        print(f"Errore nella connessione: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Questo selettore potrebbe variare a seconda della struttura HTML esatta del sito Unibo.
    # Di solito, le griglie di loghi sono contenute in elementi <a> con dentro un <img>.
    # Adattiamo la ricerca per trovare tutti i blocchi che rappresentano un'azienda.
    
    aziende_estratte = []
    
    # Cerchiamo tutti i tag <a> che portano a /view/ (il dettaglio dell'azienda)
    link_aziende = soup.find_all('a', href=lambda href: href and '/view/' in href)
    if args.limit > 0:
        link_aziende = link_aziende[: args.limit]

    print(f"Trovate potenziali {len(link_aziende)} aziende. Inizio scraping loghi...")

    for link in link_aziende:
        href_dettaglio = urljoin(args.url, link['href'])
        
        # Cerchiamo l'immagine dentro il link
        img_tag = link.find('img')
        
        # Cerchiamo il nome dell'azienda (potrebbe essere nell'attributo alt dell'img o in un tag span/h3 adiacente)
        nome_azienda = ""
        url_logo = ""
        
        if img_tag:
            url_logo = urljoin(args.url, img_tag.get('src', ''))
            nome_azienda = img_tag.get('alt', '').strip()
        
        # Se non c'è il nome nell'alt, proviamo a prendere il testo dentro il link
        if not nome_azienda:
            testo_link = link.get_text(strip=True)
            if testo_link:
                nome_azienda = testo_link
            else:
                # Usa l'id dall'url (es: 504292) come fallback se non trova il nome
                nome_azienda = href_dettaglio.split('/')[-1]

        if not url_logo:
            continue

        nome_file = pulisci_nome_file(nome_azienda) + ".png" # Forziamo png come estensione generica
        percorso_file = os.path.join(args.logos_dir, nome_file)

        if os.path.exists(percorso_file) and not args.overwrite:
            aziende_estratte.append({
                "nome": nome_azienda,
                "url_dettaglio": href_dettaglio,
                "percorso_logo_locale": percorso_file,
                "url_logo_originale": url_logo
            })
            continue
        
        # Scarica l'immagine
        try:
            img_data = requests.get(url_logo, headers=HEADERS, timeout=args.timeout).content
            with open(percorso_file, 'wb') as handler:
                handler.write(img_data)
            print(f"✅ Scaricato: {nome_azienda}")
        except Exception as e:
            print(f"❌ Errore scaricamento logo {nome_azienda}: {e}")
            continue

        aziende_estratte.append({
            "nome": nome_azienda,
            "url_dettaglio": href_dettaglio,
            "percorso_logo_locale": percorso_file,
            "url_logo_originale": url_logo
        })

        if args.delay > 0:
            time.sleep(args.delay)

    # Salva il risultato in un file JSON
    with open(args.output_json, 'w', encoding='utf-8') as f:
        json.dump(aziende_estratte, f, ensure_ascii=False, indent=4)

    print(
        f"\nFinito! Ho gestito {len(aziende_estratte)} loghi nella cartella "
        f"'{args.logos_dir}' e salvato i dati in '{args.output_json}'."
    )

if __name__ == "__main__":
    main()
