"""
OI People + Expertise + Research Outputs loader

- Recreates the SQLite DB from a provided SQL file.
- Ingests people from an Excel sheet into OIMembers (upsert by full name).
- Normalizes and inserts expertise into OIExpertise, title-casing each term
  (capitalizing every word except common connectives) before de-duplication.
- Ingests research_outputs.json into OIResearchOutputs, associating
  each work with the first listed author.

"""

import os
import re
import json
import html
import sqlite3
import pandas as pd
from datetime import datetime

# DB setup
def check_and_create_db(db_name='data.db', sql_path='create_db.sql'):
    """
    Recreate SQLite DB from a multi-statement SQL script.

    Behavior:
      - Deletes any existing DB at `db_name` to ensure a clean build.
      - Executes the SQL at `sql_path` using executescript (supports multiple statements).
    """
    if os.path.exists(db_name):
        os.remove(db_name)
        print(f"[INFO] Existing database '{db_name}' removed.")

    conn = sqlite3.connect(db_name)
    try:
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        conn.executescript(sql_script)
        print(f"[INFO] Database '{db_name}' created from '{sql_path}'.")
        return True
    finally:
        conn.close()

# ------------------------
# Helpers
# ------------------------
def _norm(val):
    """
    Normalize a cell value:
      - Convert to string, strip leading/trailing whitespace,
      - Collapse internal whitespace.
    """
    if pd.isna(val):
        return ""
    return re.sub(r"\s+", " ", str(val)).strip()

def _parse_date(val):
    """
    Parse a few common date formats into YYYY-MM-DD.
    Returns None on failure (so we don't pollute text fields).
    """
    if not val or pd.isna(val):
        return None
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.date().isoformat()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(str(val), fmt).date().isoformat()
        except ValueError:
            continue
    return None

def _build_name(row):
    """
    Construct a display name: 'Title FirstName Surname' (Title optional).
    """
    title = _norm(row.get("Title"))
    first = _norm(row.get("First Name"))
    last  = _norm(row.get("Surname"))
    parts = [p for p in [title.rstrip(".")] if p] + [first, last]
    name = " ".join([p for p in parts if p]).strip()
    return re.sub(r"\s+", " ", name)

def _choose_email(primary, secondary):
    """
    Prefer primary email; fall back to secondary; None if neither present.
    """
    p = _norm(primary)
    s = _norm(secondary)
    return p or s or None

def _build_bio(row):
    """
    Compose a compact, readable bio string from assorted columns.
    We keep this intentionally lightweight (single line, key facts).
    """
    bits = []
    pos = _norm(row.get("Position"))
    org = _norm(row.get("School/Centre/Organisation"))
    cat = _norm(row.get("Category"))
    profile = _norm(row.get("UWA Profile"))
    oi_student = _norm(row.get("OI Student"))
    oi_adjunct = _norm(row.get("OI Adjunct"))
    relationship = _norm(row.get("Relationship with the Oceans Institute"))
    hdr_type = _norm(row.get("UWA HDR Student Type"))
    affiliations = _norm(row.get("(Non UWA)University/research institution Affiliation"))
    industry = _norm(row.get("Industry affiliate or partner institute/org"))
    geo = _norm(row.get("OI geographical focus for research"))
    priorities = _norm(row.get("Top 3 priorities for OI for next 5 years"))

    if pos or org: bits.append(", ".join([p for p in [pos, org] if p]))
    if cat: bits.append(f"Category: {cat}")
    if oi_student: bits.append(f"OI Student: {oi_student}")
    if oi_adjunct: bits.append(f"OI Adjunct: {oi_adjunct}")
    if relationship: bits.append(f"Relationship with OI: {relationship}")
    if hdr_type: bits.append(f"HDR type: {hdr_type}")
    if affiliations: bits.append(f"Affiliation: {affiliations}")
    if industry: bits.append(f"Industry partner: {industry}")
    if geo: bits.append(f"Geographical focus: {geo}")
    if priorities: bits.append(f"Top priorities: {priorities}")
    if profile: bits.append(f"Profile: {profile}")
    return "; ".join(bits) or None

# --- Title-casing for Expertise ---------------------------------------------

# Common “small words” / connectives to keep lowercase unless they’re the
# first or last token in a phrase or a hyphenated segment.
_EXPERTISE_SMALL_WORDS = {
    "a","an","the","and","or","nor","but","for","so","yet",
    "as","at","by","in","of","on","per","to","via","vs","v",
    "de","la","le","du","da","di","del","von","van","der","den",
    "with","into","onto","over","under","between","among","from",
    "through","toward","towards","without","within","across","against",
    "about","around","after","before","off","up","down","out","into"
}

def _is_acronym(token: str) -> bool:
    """
    Treat all-caps alphabetic tokens (>=2 chars) and alnum mixtures like 'H2O'
    as acronyms/initialisms; keep as-is.
    """
    if not token:
        return False
    if token.isupper() and token.isalpha() and len(token) >= 2:
        return True
    # Mixed alnum (e.g., H2O, CO2) – keep original casing
    if any(ch.isdigit() for ch in token) and any(ch.isalpha() for ch in token):
        return True
    return False

def _titlecase_word(token: str, is_boundary: bool) -> str:
    """
    Title-case a single token, respecting connectives and acronyms.
    `is_boundary` is True if token is first or last in the phrase or hyphenated
    segment, so we always capitalize in that case.
    """
    if not token:
        return token
    if _is_acronym(token):
        return token  # keep acronyms as provided
    lower = token.lower()
    if not is_boundary and lower in _EXPERTISE_SMALL_WORDS:
        return lower
    # Regular word: capitalize first letter, keep the rest lower (basic Title Case)
    return lower[:1].upper() + lower[1:]

def _titlecase_hyphenated(token: str, is_first: bool, is_last: bool) -> str:
    """
    Title-case hyphenated words segment-by-segment.
    Boundary segments (start/end) are capitalized even if connective.
    """
    parts = token.split("-")
    out = []
    for i, seg in enumerate(parts):
        boundary = (i == 0 and is_first) or (i == len(parts) - 1 and is_last)
        out.append(_titlecase_word(seg, is_boundary=boundary or i == 0 or i == len(parts)-1))
    return "-".join(out)

def titlecase_expertise(phrase: str) -> str:
    """
    Title-case an expertise phrase:
      - Capitalize every significant word.
      - Keep common connectives lowercase unless at the beginning or end.
      - Preserve acronyms (e.g., UWA, CSIRO, AI) and alnum like CO2, H2O.
      - Handle hyphenated tokens (e.g., state-of-the-art -> State-of-the-Art).
    """
    phrase = _norm(phrase)
    if not phrase:
        return phrase

    tokens = phrase.split()
    if not tokens:
        return phrase

    out = []
    for idx, tok in enumerate(tokens):
        is_first = (idx == 0)
        is_last  = (idx == len(tokens) - 1)

        if "-" in tok and len(tok) > 1:
            out.append(_titlecase_hyphenated(tok, is_first, is_last))
        else:
            out.append(_titlecase_word(tok, is_boundary=is_first or is_last))
    return " ".join(out)

def _iter_expertise(row):
    """
    Iterate normalized, title-cased expertise terms from the three columns:
      - Splits on commas, semicolons, slashes, and the word 'and' (case-insensitive).
      - Applies titlecase_expertise *before* case-insensitive de-duplication.
    """
    fields = []
    for col in ["New Expertise", "New Expertise2", "New Expertise3"]:
        raw = _norm(row.get(col))
        if not raw:
            continue
        parts = re.split(r"[;,/]|(?i)\band\b", raw)
        for p in parts:
            v = _norm(p)
            if v:
                fields.append(titlecase_expertise(v))

    # De-dup preserving order (case-insensitive equality)
    seen = set()
    for f in fields:
        key = f.casefold()
        if key not in seen:
            seen.add(key)
            yield f

# Ingest: People + Expertise from Excel
EXPECTED_COLS = [
    "Academic Staff", "Title", "First Name", "Surname", "Gender",
    "Email Address", "Seconday email", "Category", "School/Centre/Organisation",
    "Position", "UWA Oceans Institute - the UWA Profiles and Research Repository",
    "OI Student", "OI Adjunct", "Tagged UWA Repository", "UWA Profile",
    "Adjunct Commencement Date", "Adjunct Renewal Date", "Expiry Date", "Notes",
    "New Expertise", "New Expertise2", "New Expertise3",
    "Relationship with the Oceans Institute", "UWA HDR Student Type",
    "UWA Staff Member area of business", "UWA Academic Staff Member Business Unit",
    "(Non UWA)University/research institution Affiliation",
    "Industry affiliate or partner institute/org",
    "Formed collaborations or partnerships through OI",
    "Details of collaborations or partnerships",
    "OI geographical focus for research",
    "Top 3 priorities for OI for next 5 years",
]

def fill_db_from_excel_people(
    db_name='data.db',
    excel_path='db\\OI_members_data.xlsx',
    sheet_name='DATA- OI Member Listing-sample'
):
    """
    Load people + expertise from Excel into OIMembers and OIExpertise.

    - Upserts OIMembers on (unique) full name.
    - Builds a compact bio string from relevant fields.
    - Normalizes and title-cases expertise phrases before dedup + insert.
    """
    df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)
    # Normalize column names (trim + collapse whitespace)
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]

    missing = [c for c in EXPECTED_COLS if c not in df.columns]
    if missing:
        print(f"[WARN] Missing expected columns: {missing}")

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()
    inserted_members = 0
    inserted_expertise = 0

    for _, row in df.iterrows():
        name = _build_name(row)
        if not name:
            continue  # Skip rows without any name information

        email = _choose_email(row.get("Email Address"), row.get("Seconday email"))
        bio = _build_bio(row)

        # Optionally append the three date fields to the bio.
        dates = []
        acd = _parse_date(row.get("Adjunct Commencement Date"))
        ard = _parse_date(row.get("Adjunct Renewal Date"))
        exp = _parse_date(row.get("Expiry Date"))
        if acd: dates.append(f"Adjunct start: {acd}")
        if ard: dates.append(f"Adjunct renewal: {ard}")
        if exp: dates.append(f"Expiry: {exp}")
        if dates:
            bio = (bio + ("; " if bio else "")) + " | ".join(dates)

        # Upsert member
        cur.execute(
            """
            INSERT INTO OIMembers (name, email, bio)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                email = COALESCE(excluded.email, OIMembers.email),
                bio   = COALESCE(excluded.bio,   OIMembers.bio)
            """,
            (name, email, bio)
        )
        if cur.rowcount > 0:
            inserted_members += 1

        # Expertise (already title-cased + deduped in iterator)
        for field in _iter_expertise(row):
            cur.execute(
                """INSERT OR IGNORE INTO OIExpertise (researcher_name, field)
                   VALUES (?, ?)""",
                (name, field)
            )
            if cur.rowcount > 0:
                inserted_expertise += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Members upserted: {inserted_members}")
    print(f"[INFO] Expertise inserted: {inserted_expertise}")
    return True

# Ingest: Research outputs JSON
def _first_author_name(item):
    """
    Return the first listed person's full name (First Last) if available.
    This keeps our FK to OIMembers consistent even when authorship is shared.
    """
    people = item.get("personAssociations") or []
    for p in people:
        n = p.get("name") or {}
        first = _norm(n.get("firstName"))
        last  = _norm(n.get("lastName"))
        full = " ".join([first, last]).strip()
        if full:
            return full
    return None

def _title_from_item(item):
    """
    Extract a plain-text title from an item (strip simple HTML markup).
    """
    t = (item.get("title") or {}).get("value") or ""
    return re.sub(r"<.*?>", "", html.unescape(t)).strip()

def fill_db_from_json_research_outputs(db_name='data.db', json_file='db\\research_outputs.json'):
    """
    Insert research outputs:
      - Uses first listed author as the owner (schema uses researcher's name).
      - Creates a stub OIMember if the author doesn't exist yet.
      - Skips duplicates based on unique constraints.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()
    inserted = 0
    skipped = 0

    for item in data:
        title = _title_from_item(item)
        if not title:
            continue
        author = _first_author_name(item) or "Unknown"

        # Ensure the author exists in OIMembers for FK consistency (name is FK target)
        cur.execute(
            """INSERT INTO OIMembers (name) VALUES (?)
               ON CONFLICT(name) DO NOTHING""",
            (author,)
        )

        try:
            cur.execute(
                """INSERT OR IGNORE INTO OIResearchOutputs (researcher_name, name)
                   VALUES (?, ?)""",
                (author, title)
            )
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except sqlite3.IntegrityError:
            skipped += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Research outputs inserted: {inserted}; skipped (duplicates/conflicts): {skipped}")
    return True

# Main
def main():
    """
    Orchestrate the full pipeline:
      1) Rebuild DB from SQL.
      2) Load people + title-cased expertise from Excel.
      3) Load research outputs from JSON.
    """
    db_name  = 'db\\data.db'
    sql_path = 'db\\create_db.sql'
    excel_path = 'db\\OI_members_data.xlsx'
    sheet_name = 'DATA- OI Member Listing-sample'
    json_file = 'db\\research_outputs.json'

    check_and_create_db(db_name=db_name, sql_path=sql_path)
    fill_db_from_excel_people(db_name=db_name, excel_path=excel_path, sheet_name=sheet_name)
    fill_db_from_json_research_outputs(db_name=db_name, json_file=json_file)

if __name__ == "__main__":
    main()
