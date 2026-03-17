import argparse
import json
import unicodedata
from pathlib import Path


DEFAULT_STAND_MAP_PATH = Path(__file__).with_name("stand_map_2026.json")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Assegna stand alle aziende in aziende_dettagli.json con matching normalizzato."
    )
    parser.add_argument(
        "--input",
        default="aziende_dettagli.json",
        help="File JSON input (default: aziende_dettagli.json)",
    )
    parser.add_argument(
        "--output",
        default="",
        help="File JSON output. Se vuoto, sovrascrive il file input.",
    )
    parser.add_argument(
        "--mapping-file",
        default=str(DEFAULT_STAND_MAP_PATH),
        help=f"File JSON con mappa stand {{nome_azienda: stand}} (default: {DEFAULT_STAND_MAP_PATH.name})",
    )
    parser.add_argument(
        "--report",
        default="",
        help="File JSON opzionale con report unmatched e statistiche.",
    )
    return parser.parse_args()


def normalize_name(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = text.replace("&", " e ")
    return "".join(ch for ch in text if ch.isalnum())


def load_stand_map(mapping_file):
    with open(mapping_file, "r", encoding="utf-8") as handle:
        loaded = json.load(handle)
    if not isinstance(loaded, dict):
        raise ValueError("Il mapping file deve contenere un oggetto JSON {nome: stand}.")
    normalized = {}
    collisions = {}
    for name, stand in loaded.items():
        key = normalize_name(name)
        if not key:
            continue
        if key in normalized and normalized[key]["stand"] != stand:
            collisions.setdefault(key, []).append({"name": name, "stand": stand})
            continue
        normalized[key] = {"name": name, "stand": stand}
    return normalized, collisions


def main():
    args = parse_args()
    output_path = args.output.strip() or args.input
    normalized_map, collisions = load_stand_map(args.mapping_file.strip())

    with open(args.input, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    assigned = 0
    unmatched = []
    matched_by_normalized_name = []
    for company in data:
        company_name = company.get("Nome", "")
        key = normalize_name(company_name)
        match = normalized_map.get(key)
        if match:
            company["Stand"] = match["stand"]
            assigned += 1
            matched_by_normalized_name.append({
                "company_name": company_name,
                "matched_on": match["name"],
                "stand": match["stand"],
            })
        else:
            company["Stand"] = ""
            unmatched.append(company_name)

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=4)

    report = {
        "input": args.input,
        "output": output_path,
        "mapping_file": args.mapping_file,
        "assigned": assigned,
        "total": len(data),
        "unmatched_count": len(unmatched),
        "unmatched": unmatched,
        "collisions": collisions,
        "matched_by_normalized_name": matched_by_normalized_name,
    }

    if args.report.strip():
        with open(args.report.strip(), "w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)

    print(f"Stand assegnati: {assigned}/{len(data)}")
    if unmatched:
        print(f"Senza stand ({len(unmatched)}):")
        for name in unmatched:
            print(f"  - {name}")
    if collisions:
        print(f"Collisioni nel mapping normalizzato: {len(collisions)}")


if __name__ == "__main__":
    main()
