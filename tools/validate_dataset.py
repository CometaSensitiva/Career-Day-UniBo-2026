#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path


REQUIRED_FIELDS = [
    "Nome",
    "URL_Pagina",
    "Sito_Web",
    "Settore",
    "Aree_Disciplinari",
    "Area_Inserimento",
    "Modalita_Inserimento",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Valida il dataset aziende e produce un report machine-readable."
    )
    parser.add_argument("--input", default="aziende_dettagli.json", help="Path dataset input.")
    parser.add_argument("--logos-dir", default="logos", help="Cartella loghi.")
    parser.add_argument("--stand-map", default="", help="Mappa stand JSON opzionale per coverage.")
    parser.add_argument("--report", default="", help="File report JSON opzionale.")
    return parser.parse_args()


def normalized_logo_path(logos_dir, company_name):
    bad_chars = '<>:"/\\|?* '
    clean = company_name
    for char in bad_chars:
        clean = clean.replace(char, "_")
    return Path(logos_dir) / f"logo_{clean.lower()}.png"


def main():
    args = parse_args()
    dataset = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if not isinstance(dataset, list):
        raise SystemExit("Il dataset deve essere una lista JSON.")

    missing_fields = []
    stand_to_names = {}
    missing_stands = []
    http_sites = []
    missing_logos = []
    missing_emails = []
    invalid_shapes = []

    for index, company in enumerate(dataset, start=1):
        for field in REQUIRED_FIELDS:
            if field not in company:
                missing_fields.append({"index": index, "name": company.get("Nome", ""), "field": field})
        if company.get("Sito_Web", "").startswith("http://"):
            http_sites.append(company.get("Nome", ""))
        if not company.get("Email"):
            missing_emails.append(company.get("Nome", ""))
        stand = str(company.get("Stand", "")).strip()
        if stand:
            stand_to_names.setdefault(stand, []).append(company.get("Nome", ""))
        else:
            missing_stands.append(company.get("Nome", ""))
        if not isinstance(company.get("Aree_Disciplinari", {}), dict) or not isinstance(company.get("Area_Inserimento", []), list) or not isinstance(company.get("Modalita_Inserimento", []), list):
            invalid_shapes.append(company.get("Nome", ""))
        if not normalized_logo_path(args.logos_dir, company.get("Nome", "")).exists():
            missing_logos.append(company.get("Nome", ""))

    duplicate_stands = {stand: names for stand, names in stand_to_names.items() if len(names) > 1}
    stand_map_count = 0
    if args.stand_map:
        stand_map_data = json.loads(Path(args.stand_map).read_text(encoding="utf-8"))
        if isinstance(stand_map_data, dict):
            stand_map_count = len(stand_map_data)

    report = {
        "total_companies": len(dataset),
        "required_fields_missing": missing_fields,
        "missing_stands": missing_stands,
        "duplicate_stands": duplicate_stands,
        "http_sites": http_sites,
        "missing_logos": missing_logos,
        "missing_emails": missing_emails,
        "invalid_shapes": invalid_shapes,
        "stand_map_entries": stand_map_count,
    }

    if args.report:
        Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))

    has_blockers = bool(missing_fields or duplicate_stands or invalid_shapes)
    if has_blockers:
        sys.exit(1)


if __name__ == "__main__":
    main()
