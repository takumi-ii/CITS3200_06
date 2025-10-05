#!/usr/bin/env python3
import argparse
import json
import sqlite3
import sys
from pathlib import Path

def find_exact(cur, name: str):
    cur.execute(
        "SELECT uuid, name FROM OIMembers WHERE LOWER(name) = LOWER(?) LIMIT 2",
        (name.strip().lower(),),
    )
    return cur.fetchall()

def find_fuzzy(cur, name: str):
    cur.execute(
        "SELECT uuid, name FROM OIMembers WHERE LOWER(name) LIKE LOWER(?) ORDER BY name LIMIT 5",
        (f"%{name.strip()}%",),
    )
    return cur.fetchall()

def main():
    ap = argparse.ArgumentParser(description="Map names (JSON array) to UUIDs from OIMembers.")
    ap.add_argument("--db", default="data.db", help="Path to SQLite database (default: data.db)")
    ap.add_argument("--in", dest="input_json", required=True, help="Input JSON: ['Jane Smith','John Doe', ...]")
    ap.add_argument("--out", dest="output_json", default="name_uuid_mapping.json",
                    help="Output JSON file (default: name_uuid_mapping.json)")
    ap.add_argument("--fuzzy", action="store_true",
                    help="If exact match fails, try fuzzy (LIKE %%name%%); only accept if a single match is found.")
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"[ERROR] DB not found: {db_path}", file=sys.stderr); sys.exit(2)

    in_path = Path(args.input_json)
    if not in_path.exists():
        print(f"[ERROR] Input JSON not found: {in_path}", file=sys.stderr); sys.exit(2)

    try:
        names = json.loads(in_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERROR] Bad JSON: {e}", file=sys.stderr); sys.exit(2)

    if not isinstance(names, list) or not all(isinstance(x, str) for x in names):
        print("[ERROR] Input must be a JSON array of strings.", file=sys.stderr); sys.exit(2)

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    mappings = []      # [{ "name": "...", "uuid": "..." }]
    not_found = []     # ["..."]
    ambiguous = {}     # name -> [ {uuid,name}, ... ]

    for name in names:
        nm = name.strip()
        if not nm:
            continue

        rows = find_exact(cur, nm)

        if len(rows) == 1:
            mappings.append({"name": nm, "uuid": rows[0][0]})
            continue
        elif len(rows) > 1:
            ambiguous[nm] = [{"uuid": r[0], "name": r[1]} for r in rows]
            continue

        # No exact match -> optionally try fuzzy
        if args.fuzzy:
            fz = find_fuzzy(cur, nm)
            if len(fz) == 1:
                mappings.append({"name": nm, "uuid": fz[0][0]})
            elif len(fz) > 1:
                ambiguous[nm] = [{"uuid": r[0], "name": r[1]} for r in fz]
            else:
                not_found.append(nm)
        else:
            not_found.append(nm)

    conn.close()

    # Write just the clean mappings (easy to turn into labels JSON)
    Path(args.output_json).write_text(json.dumps(mappings, indent=2, ensure_ascii=False), encoding="utf-8")

    # Console summary to help you fix inputs
    print(f"[OK] Wrote mappings -> {args.output_json}")
    print(f"[SUMMARY] resolved={len(mappings)}  not_found={len(not_found)}  ambiguous={len(ambiguous)}")
    if not_found:
        print("\n[NOT FOUND]")
        for n in not_found:
            print(f"  - {n}")
    if ambiguous:
        print("\n[AMBIGUOUS] (multiple matches; refine the name)")
        for n, cands in ambiguous.items():
            print(f"  - {n}:")
            for c in cands:
                print(f"      {c['uuid']} | {c['name']}")

if __name__ == "__main__":
    main()
