#!/usr/bin/env python3
"""
Orchestratore aggiornamento dashboard Career Day.

Esegue in sequenza:
1) descr_scraper.py (dettagli aziende -> aziende_dettagli.json)
2) add_stands.py (assegna stand)
3) logo_scraper.py (scarica/aggiorna loghi)
"""

import argparse
import subprocess
import sys
from pathlib import Path

DEFAULT_YEAR = 2026
DEFAULT_URL_TEMPLATE = "https://eventi.unibo.it/careerday/aziende-partecipanti-{year}"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Aggiorna dataset e loghi dashboard Career Day con un comando."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=DEFAULT_YEAR,
        help=f"Anno Career Day usato per costruire l'URL se --url non è passato (default: {DEFAULT_YEAR})",
    )
    parser.add_argument(
        "--url",
        default="",
        help="URL esplicito pagina aziende (override su --year).",
    )
    parser.add_argument(
        "--data-file",
        default="aziende_dettagli.json",
        help="File dataset output/input (default: aziende_dettagli.json).",
    )
    parser.add_argument(
        "--logos-dir",
        default="logos",
        help="Cartella loghi (default: logos).",
    )
    parser.add_argument(
        "--logos-report",
        default="aziende_data.json",
        help="File JSON di report loghi (default: aziende_data.json).",
    )
    parser.add_argument(
        "--mapping-file",
        default=str((Path(__file__).resolve().parent / "stand_map_2026.json")),
        help="File JSON con mappa stand {nome: stand}. Default: tools/stand_map_2026.json",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Timeout HTTP in secondi per gli scraper (default: 30).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay tra richieste dettaglio aziende (default: 1.0).",
    )
    parser.add_argument(
        "--logo-delay",
        type=float,
        default=0.2,
        help="Delay tra download loghi (default: 0.2).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max aziende da processare per test veloce (0 = nessun limite).",
    )
    parser.add_argument(
        "--skip-stands",
        action="store_true",
        help="Salta step assegnazione stand.",
    )
    parser.add_argument(
        "--skip-logos",
        action="store_true",
        help="Salta step scraping loghi.",
    )
    parser.add_argument(
        "--overwrite-logos",
        action="store_true",
        help="Sovrascrive i loghi già scaricati.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra i comandi senza eseguirli.",
    )
    parser.add_argument(
        "--skip-validate",
        action="store_true",
        help="Salta la validazione finale dataset/loghi/stand.",
    )
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="Interprete Python da usare (default: python corrente).",
    )
    return parser.parse_args()


def run_step(name, cmd, cwd, dry_run):
    pretty = " ".join(cmd)
    print(f"\n== {name} ==")
    print(pretty)
    if dry_run:
        return
    subprocess.run(cmd, cwd=cwd, check=True)


def build_url(args):
    if args.url.strip():
        return args.url.strip()
    return DEFAULT_URL_TEMPLATE.format(year=args.year)


def main():
    args = parse_args()
    tools_dir = Path(__file__).resolve().parent
    repo_root = tools_dir.parent

    details_script = tools_dir / "descr_scraper.py"
    stands_script = tools_dir / "add_stands.py"
    logos_script = tools_dir / "logo_scraper.py"
    validate_script = tools_dir / "validate_dataset.py"

    for script in (details_script, stands_script, logos_script, validate_script):
        if not script.exists():
            raise FileNotFoundError(f"Script non trovato: {script}")

    target_url = build_url(args)
    print("Pipeline aggiornamento dashboard Career Day")
    print(f"Repo root: {repo_root}")
    print(f"URL target: {target_url}")

    details_cmd = [
        args.python,
        str(details_script),
        "--url",
        target_url,
        "--output",
        args.data_file,
        "--timeout",
        str(args.timeout),
        "--delay",
        str(args.delay),
    ]
    if args.limit > 0:
        details_cmd.extend(["--limit", str(args.limit)])
    run_step("Scraping dettagli aziende", details_cmd, repo_root, args.dry_run)

    if not args.skip_stands:
        stands_cmd = [
            args.python,
            str(stands_script),
            "--input",
            args.data_file,
        ]
        if args.mapping_file.strip():
            stands_cmd.extend(["--mapping-file", args.mapping_file.strip()])
        run_step("Assegnazione stand", stands_cmd, repo_root, args.dry_run)
    else:
        print("\n== Assegnazione stand ==\nStep saltato (--skip-stands).")

    if not args.skip_logos:
        logos_cmd = [
            args.python,
            str(logos_script),
            "--url",
            target_url,
            "--logos-dir",
            args.logos_dir,
            "--output-json",
            args.logos_report,
            "--timeout",
            str(args.timeout),
            "--delay",
            str(args.logo_delay),
        ]
        if args.limit > 0:
            logos_cmd.extend(["--limit", str(args.limit)])
        if args.overwrite_logos:
            logos_cmd.append("--overwrite")
        run_step("Scraping loghi", logos_cmd, repo_root, args.dry_run)
    else:
        print("\n== Scraping loghi ==\nStep saltato (--skip-logos).")

    if not args.skip_validate:
        validate_cmd = [
            args.python,
            str(validate_script),
            "--input",
            args.data_file,
            "--logos-dir",
            args.logos_dir,
        ]
        if args.mapping_file.strip():
            validate_cmd.extend(["--stand-map", args.mapping_file.strip()])
        run_step("Validazione dataset", validate_cmd, repo_root, args.dry_run)
    else:
        print("\n== Validazione dataset ==\nStep saltato (--skip-validate).")

    print("\nPipeline completata.")
    print(f"- Dataset: {args.data_file}")
    print(f"- Loghi: {args.logos_dir}")
    print(f"- Report loghi: {args.logos_report}")


if __name__ == "__main__":
    main()
