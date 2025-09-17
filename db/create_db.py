"""
OI People + Expertise + Research Outputs loader (UUID-aware)

- Recreates the SQLite DB from a provided SQL file.
- Ingests people from an Excel sheet into OIMembers (upsert by full name),
  assigning a deterministic UUIDv5 if no canonical UUID is known yet.
- Normalizes and inserts expertise into OIExpertise (title-cased phrases),
  keyed by OIMembers.uuid.
- Ingests research_outputs.json into OIResearchOutputs using the output's own
  UUID; associates with the first listed author by that author's canonical
  person UUID from JSON; captures optional publisher_name. If an Excel-created
  member with the same name exists under a synthetic UUID, it is upgraded to
  the canonical JSON UUID (cascades to FKs).
"""

import os
import re
import json
import html
import uuid
import sqlite3
import pandas as pd
from datetime import datetime
from typing import Optional

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

# Helpers
def _norm(val):
    """
    Normalize a value to a single-line, trimmed string. Returns "" for NaN/None.
    """
    if val is None:
        return ""
    if isinstance(val, str):
        return re.sub(r"\s+", " ", val).strip()
    try:
        if pd.isna(val):
            return ""
    except Exception:
        pass
    return re.sub(r"\s+", " ", str(val)).strip()

def _parse_date(val):
    """
    Parse common formats into YYYY-MM-DD (string). None if not parsable.
    """
    if not val or (not isinstance(val, str) and pd.isna(val)):
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

# Expertise title-casing
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
    if any(ch.isdigit() for ch in token) and any(ch.isalpha() for ch in token):
        return True
    return False

def _titlecase_word(token: str, is_boundary: bool) -> str:
    """
    Title-case a single token, respecting connectives and acronyms.
    """
    if not token:
        return token
    if _is_acronym(token):
        return token
    lower = token.lower()
    if not is_boundary and lower in _EXPERTISE_SMALL_WORDS:
        return lower
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
    Title-case an expertise phrase (preserve acronyms, handle hyphens,
    leave connectives lower unless first/last).
    """
    phrase = _norm(phrase)
    if not phrase:
        return phrase
    tokens = phrase.split()
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
    Iterate normalized, title-cased expertise terms from three columns:
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

    seen = set()
    for f in fields:
        key = f.casefold()
        if key not in seen:
            seen.add(key)
            yield f

# UUID helpers + member upsert
def _deterministic_member_uuid(name: str) -> str:
    """
    Produce a stable UUIDv5 for a member name (used for Excel-only rows).
    This allows reproducible FKs until a canonical JSON UUID is known.
    """
    base = f"member:{name.casefold()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, base))

def _ensure_member(conn, name: str, member_uuid: Optional[str], email: Optional[str], bio: Optional[str]) -> str:
    """
    Ensure an OIMembers row exists for `name`, returning the member UUID.

    - If no row exists:
        * Use provided `member_uuid` if given, else create deterministic UUIDv5.
        * Insert (uuid, name, email, bio).
    - If a row exists and `member_uuid` is provided but differs:
        * UPDATE the primary key uuid to the canonical `member_uuid`
          (ON UPDATE CASCADE will update referencing FKs).
    - Update email/bio if provided (non-null).
    """
    cur = conn.cursor()
    cur.execute("SELECT uuid FROM OIMembers WHERE name = ?", (name,))
    row = cur.fetchone()
    if row is None:
        if not member_uuid:
            member_uuid = _deterministic_member_uuid(name)
        cur.execute(
            "INSERT INTO OIMembers (uuid, name, email, bio) VALUES (?, ?, ?, ?)",
            (member_uuid, name, email, bio)
        )
        return member_uuid
    else:
        current_uuid = row[0]
        if member_uuid and member_uuid != current_uuid:
            cur.execute("UPDATE OIMembers SET uuid = ? WHERE name = ?", (member_uuid, name))
        if email or bio:
            cur.execute(
                "UPDATE OIMembers SET email = COALESCE(?, email), bio = COALESCE(?, bio) WHERE name = ?",
                (email if email else None, bio if bio else None, name)
            )
        return member_uuid or current_uuid

# Ingest: People + Expertise from Excel (UUID-based)
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
    Load expertise from Excel into OIExpertise (UUID schema). Members should be handled via JSON files.
    """
    df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]

    missing = [c for c in EXPECTED_COLS if c not in df.columns]
    if missing:
        print(f"[WARN] Missing expected columns: {missing}")

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()
    inserted_expertise = 0

    for _, row in df.iterrows():
        name = _build_name(row)
        if not name:
            continue  # Skip rows without any name information

        # Only insert expertise from the Excel data
        for field in _iter_expertise(row):
            cur.execute(
                """INSERT OR IGNORE INTO OIExpertise (researcher_uuid, field)
                   VALUES (?, ?)""",
                (name, field)
            )
            if cur.rowcount > 0:
                inserted_expertise += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Expertise inserted: {inserted_expertise}")
    return True

# Ingest: Research outputs JSON (UUID-based)
def _first_author_name_uuid(item):
    """
    Return (author_full_name, author_person_uuid) for the first 'Author' role.
    Fallback: first personAssociation with a person object.
    """
    for assoc in item.get("personAssociations") or []:
        role = assoc.get("personRole") or {}
        term = role.get("term") or {}
        texts = term.get("text") or []
        role_vals = [t.get("value") for t in texts if isinstance(t, dict)]
        is_author = any((v or "").lower() == "author" for v in role_vals)

        person = assoc.get("person") or {}
        puuid = person.get("uuid")
        n = person.get("name") or {}
        name_texts = n.get("text") or []
        fullname = None
        for t in name_texts:
            if isinstance(t, dict) and t.get("value"):
                fullname = t["value"]
                break

        if is_author and puuid and fullname:
            return fullname, puuid

    # Fallback
    for assoc in item.get("personAssociations") or []:
        person = assoc.get("person") or {}
        puuid  = person.get("uuid")
        n = person.get("name") or {}
        name_texts = n.get("text") or []
        fullname = None
        for t in name_texts:
            if isinstance(t, dict) and t.get("value"):
                fullname = t["value"]
                break
        if puuid and fullname:
            return fullname, puuid

    return None, None

def _title_from_item(item):
    """
    Extract a plain-text title from an item (strip simple HTML markup).
    """
    t = (item.get("title") or {}).get("value") or ""
    return re.sub(r"<.*?>", "", html.unescape(t)).strip()

def _publisher_from_item(item):
    """
    Extract a clean publisher/venue string from PURE JSON, e.g.:
      item['publisher']['name']['text'][0]['value'] -> 'Cambridge University Press'
    """
    pub = item.get("publisher")
    if not pub:
        return None
    if isinstance(pub, str):
        s = _norm(html.unescape(pub))
        return s or None
    if isinstance(pub, dict):
        name = pub.get("name")
        if isinstance(name, str):
            s = _norm(html.unescape(name))
            return s or None
        if isinstance(name, dict):
            text = name.get("text")
            if isinstance(text, list):
                for entry in text:
                    if isinstance(entry, dict):
                        val = entry.get("value")
                        if val:
                            s = _norm(html.unescape(str(val)))
                            if s:
                                return s
        for key in ("value", "title"):
            v = pub.get(key)
            if isinstance(v, str):
                s = _norm(html.unescape(v))
                if s:
                    return s
    return None

def filter_by_organization(item, org_uuid='b3a31a78-ac4b-46f0-91e0-89423a64aea6'):
    """
    Checks if the item is associated with the given organization UUID, either in its managingOrganisationalUnit
    or in any of its organisationalUnits.
    
    Args:
    item (dict): The research output item to check.
    org_uuid (str): The UUID of the organization to check against.
    
    Returns:
    bool: True if the item is associated with the organization, False otherwise.
    """
    # Check the 'organisationalUnits' field for the given UUID
    orgs = item.get('organisationalUnits', [])
    
    # Check if the organisation UUID exists in the organisationalUnits
    for org in orgs:
        if org.get('uuid') == org_uuid:
            return True

    # If we don't find it, check 'managingOrganisationalUnit'
    managing_org = item.get('managingOrganisationalUnit', {})
    if managing_org.get('uuid') == org_uuid:
        return True

    return False

def fill_db_from_json_research_outputs(db_name='data.db', json_file='db\\research_outputs.json'):
    """
    Insert/Upsert research outputs (UUID-based) but only those associated with a specific organization.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()

    inserted = 0
    updated  = 0
    skipped  = 0

    for item in data:
        # Only process if the item is associated with the desired organization
        if not filter_by_organization(item, 'b3a31a78-ac4b-46f0-91e0-89423a64aea6'):
            skipped += 1
            continue
        
        ro_uuid = item.get("uuid")
        title = _title_from_item(item)
        if not ro_uuid or not title:
            skipped += 1
            continue

        author_name, author_uuid = _first_author_name_uuid(item)
        if not author_name:
            author_name = "Unknown"
        
        # Ensure the member exists; this will also "upgrade" the uuid for
        # name-matched Excel members to the canonical author_uuid (cascade-safe).
        member_uuid = _ensure_member(conn, author_name, author_uuid, None, None)

        publisher = _publisher_from_item(item)

        try:
            cur.execute(
                """
                INSERT INTO OIResearchOutputs (uuid, researcher_uuid, publisher_name, name)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    publisher_name = COALESCE(excluded.publisher_name, OIResearchOutputs.publisher_name),
                    researcher_uuid = COALESCE(excluded.researcher_uuid, OIResearchOutputs.researcher_uuid),
                    name = COALESCE(excluded.name, OIResearchOutputs.name)
                """,
                (ro_uuid, member_uuid, publisher, title)
            )
            cur.execute("SELECT changes()")
            changes = cur.fetchone()[0] or 0
            if changes > 0:
                updated += 1
        except sqlite3.IntegrityError:
            cur.execute(
                """
                UPDATE OIResearchOutputs
                   SET uuid = ?,
                       researcher_uuid = COALESCE(?, researcher_uuid),
                       publisher_name = COALESCE(?, publisher_name)
                 WHERE name = ?
                """,
                (ro_uuid, member_uuid, publisher, title)
            )
            cur.execute("SELECT changes()")
            if (cur.fetchone()[0] or 0) > 0:
                updated += 1
            else:
                skipped += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Research outputs -> inserted/updated: {inserted + updated}, skipped: {skipped}")
    return True

def fill_db_from_json_awards(db_name='data.db', json_file='db\\OIAwards.json'):
    """
    Insert/Upsert awards but only those associated with a specific organization.
    
    Checks both 'managingOrganisationalUnit' and 'organisationalUnits' for the desired organization UUID.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()

    inserted = 0
    updated  = 0
    skipped  = 0

    def filter_by_organization(item, org_uuid='b3a31a78-ac4b-46f0-91e0-89423a64aea6'):
        """
        Checks if the item is associated with the given organization UUID in either the 
        'managingOrganisationalUnit' or 'organisationalUnits' fields.
        """
        # Check 'managingOrganisationalUnit' for the organization UUID
        managing_org = item.get('managingOrganisationalUnit', {})
        if managing_org.get('uuid') == org_uuid:
            return True
        
        # Check 'organisationalUnits' for the organization UUID
        orgs = item.get('organisationalUnits', [])
        return any(org.get('uuid') == org_uuid for org in orgs)

    for item in data:
        # Only process if the item is associated with the desired organization
        if not filter_by_organization(item, 'b3a31a78-ac4b-46f0-91e0-89423a64aea6'):
            print("Skipping award not associated with target organization")
            skipped += 1
            continue
        # 1) Get the UUID of the grant:
        award_uuid = item.get("uuid")

        # 2) Get the title of the grant:
        try:
            title_obj = item.get("title", {})
            text = title_obj.get("text",{})
            if isinstance(text, list):
                title = text[0].get("value")
            else:
                title = text.get("value")
        except Exception:
            print(f"Error extracting title from award: {item}")
            title = None
        if not award_uuid or not title:
            print("Skipping award with missing uuid or title")
            skipped += 1
            continue

        # 3) Get the school/centre/organisation (if any):
        try:
            managing_org = item.get("managingOrganisationalUnit", {})
            title_obj = managing_org.get("name", {})
            text = title_obj.get("text",{})
            if isinstance(text, list):
                school = text[0].get("value")
            else:
                school = text.get("value")
        except Exception:
            print(f"Error extracting school/managing org from award: {item}")
            school = None

        
        if not school:
            print("Skipping award with missing school/managing org")
            skipped += 1
            continue

        # 4) Funding Source and Amount
        try:
            fund_obj = item.get("fundings", {})
            funder_obj = fund_obj.get("funder", {})
            name_obj = funder_obj.get("name", {})
            text = name_obj.get("text",{})
            # Get the source name
            if isinstance(text, list):
                fund_source = text[0].get("value")
            else:
                fund_source = text.get("value")
            # Get the amount (if any)
            funding_amount = float(fund_obj.get("awardedAmount", "0.00"))
        except Exception:
            print(f"Error extracting funding source and amount from award: {item}")
            fund_source = None
            funding_amount = 0.00

        # 5) Get start and end dates (if any):
        try:
            date_obj = item.get("actualPeriod", {})
            start_date = _parse_iso_date(date_obj.get("startDate"))
            end_date = _parse_iso_date(date_obj.get("endDate"))
        except Exception:
            print(f"Error extracting funding source and amount from award: {item}")
            start_date = None
            end_date = None

        # 6) Get the associated research output uuid
        try:
            ro_obj = item.get("relatedProject", {})
            ro_uuid = ro_obj.get("uuid")
        except Exception:
            print(f"Error extracting funding source and amount from award: {item}")
            ro_uuid = None


        try:
            cur.execute(
                """
                INSERT INTO OIResearchGrants (uuid, ro_uuid, grant_name, start_date, end_date, funding, funding_source_name, school)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    grant_name = COALESCE(excluded.grant_name, OIResearchGrants.grant_name),
                    ro_uuid = COALESCE(excluded.ro_uuid, OIResearchGrants.ro_uuid),
                    start_date = COALESCE(excluded.start_date, OIResearchGrants.start_date),
                    end_date = COALESCE(excluded.end_date, OIResearchGrants.end_date),
                    funding = COALESCE(excluded.funding, OIResearchGrants.funding),
                    funding_source_name = COALESCE(excluded.funding_source_name, OIResearchGrants.funding_source_name),
                    school = COALESCE(excluded.school, OIResearchGrants.school)
                """,
                (award_uuid, ro_uuid, title, start_date, end_date, funding_amount, fund_source, school)
            )
            cur.execute("SELECT changes()")
            changes = cur.fetchone()[0] or 0
            if changes > 0:
                updated += 1
        except sqlite3.IntegrityError:
            print("IntegrityError on award insert, attempting update by name")
            skipped += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Awards -> inserted/updated: {inserted + updated}, skipped: {skipped}")
    return True

# DB setup
def check_and_create_db(db_name='data.db', sql_path='create_db.sql'):
    """
    Recreate the SQLite DB from a provided SQL file.

    - Deletes any existing DB at `db_name` to ensure a clean build.
    - Executes the SQL at `sql_path` using `executescript` (supports multiple SQL statements).
    
    Args:
    db_name (str): The name of the SQLite database to create.
    sql_path (str): The path to the SQL file used to create the schema.
    
    Returns:
    bool: True if the DB creation was successful, otherwise False.
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

# Helpers to process and clean data
def _norm(val):
    """
    Normalize a value to a single-line, trimmed string. Returns an empty string for NaN/None.
    
    Args:
    val (str or None): The value to normalize.
    
    Returns:
    str: The cleaned string or an empty string.
    """
    if val is None:
        return ""
    if isinstance(val, str):
        return re.sub(r"\s+", " ", val).strip()
    try:
        if pd.isna(val):
            return ""
    except Exception:
        pass
    return re.sub(r"\s+", " ", str(val)).strip()
from datetime import datetime

def _parse_iso_date(val):
    """
    Parse the ISO 8601 date-time format with timezone ('2013-01-01T12:00:00.000+0800') 
    into 'YYYY-MM-DD' format. Returns None if not parsable.
    
    Args:
    val (str): The date-time value in ISO 8601 format to parse.
    
    Returns:
    str or None: The formatted date string (YYYY-MM-DD) or None.
    """
    if not val or not isinstance(val, str):
        return None

    # Try parsing the ISO 8601 format and extract only the date part
    try:
        # Remove the timezone part and parse the date-time string
        parsed_datetime = datetime.fromisoformat(val.split('+')[0])  # Ignore the timezone
        return parsed_datetime.date().isoformat()
    except ValueError:
        return None
    
def _parse_date(val):
    """
    Parse common date formats into 'YYYY-MM-DD' format. Returns None if not parsable.
    
    Args:
    val (str or datetime): The date value to parse.
    
    Returns:
    str or None: The formatted date string or None.
    """
    if not val or (not isinstance(val, str) and pd.isna(val)):
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
    Construct a display name from the Excel data: 'Title FirstName Surname' (Title is optional).
    
    Args:
    row (pd.Series): A row from the Excel sheet containing name components.
    
    Returns:
    str: The full name as 'Title FirstName Surname'.
    """
    title = _norm(row.get("Title"))
    first = _norm(row.get("First Name"))
    last  = _norm(row.get("Surname"))
    parts = [p for p in [title.rstrip(".")] if p] + [first, last]
    name = " ".join([p for p in parts if p]).strip()
    return re.sub(r"\s+", " ", name)

def _choose_email(primary, secondary):
    """
    Prefer primary email; fall back to secondary; return None if neither exists.
    
    Args:
    primary (str or None): The primary email address.
    secondary (str or None): The secondary email address.
    
    Returns:
    str or None: The preferred email address or None.
    """
    p = _norm(primary)
    s = _norm(secondary)
    return p or s or None

def _build_bio(row):
    """
    Compose a compact, readable bio string from the Excel data fields.
    
    Args:
    row (pd.Series): A row from the Excel sheet containing bio-relevant fields.
    
    Returns:
    str: A compact bio string containing relevant information from the Excel sheet.
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

# UUID helpers + member upsert
def _deterministic_member_uuid(name: str) -> str:
    """
    Generate a stable UUIDv5 for a given member name, ensuring reproducibility for matching Excel rows.
    
    Args:
    name (str): The full name of the member.
    
    Returns:
    str: The deterministic UUIDv5 based on the member name.
    """
    base = f"member:{name.casefold()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, base))

def _ensure_member(conn, name: str, member_uuid: Optional[str], email: Optional[str], bio: Optional[str]) -> str:
    """
    Ensure an OIMembers row exists for the given name, returning the member UUID.
    
    If no row exists:
        - Uses `member_uuid` if provided, or creates a deterministic UUIDv5.
        - Inserts (uuid, name, email, bio).
    
    If a row exists and `member_uuid` differs:
        - Updates the primary key to the canonical `member_uuid` (cascade-safe).
    
    Args:
    conn (sqlite3.Connection): The database connection.
    name (str): The full name of the member.
    member_uuid (str or None): The canonical member UUID (if available).
    email (str or None): The email address.
    bio (str or None): The bio string.
    
    Returns:
    str: The UUID for the member.
    """
    cur = conn.cursor()
    cur.execute("SELECT uuid FROM OIMembers WHERE name = ?", (name,))
    row = cur.fetchone()
    if row is None:
        if not member_uuid:
            member_uuid = _deterministic_member_uuid(name)
        cur.execute(
            "INSERT INTO OIMembers (uuid, name, email, bio) VALUES (?, ?, ?, ?)",
            (member_uuid, name, email, bio)
        )
        return member_uuid
    else:
        current_uuid = row[0]
        if member_uuid and member_uuid != current_uuid:
            cur.execute("UPDATE OIMembers SET uuid = ? WHERE name = ?", (member_uuid, name))
        if email or bio:
            cur.execute(
                "UPDATE OIMembers SET email = COALESCE(?, email), bio = COALESCE(?, bio) WHERE name = ?",
                (email if email else None, bio if bio else None, name)
            )
        return member_uuid or current_uuid

# Ingest expertise from Excel (UUID-based)
def fill_db_from_excel_people(
    db_name='data.db',
    excel_path='db\\OI_members_data.xlsx',
    sheet_name='DATA- OI Member Listing-sample'
):
    """
    Load expertise from Excel into OIExpertise, and upsert OIMembers using full names.
    Merges people from both Excel and OIPersons.json files when names match.
    
    Args:
    db_name (str): The name of the SQLite database.
    excel_path (str): The path to the Excel file.
    sheet_name (str): The sheet name in the Excel file.
    
    Returns:
    bool: True if successful, False otherwise.
    """
    df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]

    missing = [c for c in EXPECTED_COLS if c not in df.columns]
    if missing:
        print(f"[WARN] Missing expected columns: {missing}")

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()
    inserted_expertise = 0

    for _, row in df.iterrows():
        name = _build_name(row)
        if not name:
            continue  # Skip rows without any name information

        email = _choose_email(row.get("Email Address"), row.get("Seconday email"))
        bio = _build_bio(row)

        # Ensure member (deterministic uuid if new)
        member_uuid = _ensure_member(conn, name, None, email, bio)

        # Count a new insert roughly by checking if any expertise will insert new rows.
        for field in _iter_expertise(row):
            cur.execute(
                """INSERT OR IGNORE INTO OIExpertise (researcher_uuid, field)
                   VALUES (?, ?)""",
                (member_uuid, field)
            )
            if cur.rowcount > 0:
                inserted_expertise += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Expertise inserted: {inserted_expertise}")
    return True

# Ingest: People + Expertise from OIPersons.json (UUID-based)
def fill_db_from_json_persons(db_name='data.db', json_file='db\\OIPersons.json'):
    """
    Ingest OIPersons.json into OIMembers, ensuring data is inserted without any filtering.
    
    Args:
    db_name (str): The name of the SQLite database.
    json_file (str): The path to the OIPersons.json file.
    
    Returns:
    bool: True if successful, False otherwise.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()

    inserted_members = 0

    for person in data:
        name = person.get("name", {}).get("value")
        if not name:
            continue  # Skip if no name exists (this should not happen if OIPersons.json is well-formed)

        uuid = person.get("uuid")
        email = _norm(person.get("email"))
        bio = _norm(person.get("bio"))

        # Ensure member (deterministic uuid if new)
        member_uuid = _ensure_member(conn, name, uuid, email, bio)

        inserted_members += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Members inserted: {inserted_members}")
    return True

# Main pipeline orchestrator
def main():
    """
    Orchestrates the full pipeline:
    1) Rebuild the DB from SQL.
    2) Load expertise from Excel into OIExpertise.
    3) Merge people from OIPersons.json into OIMembers.
    4) Process research outputs and awards filtered by organization UUID.
    """
    db_name  = 'data.db'
    sql_path = 'db\\create_db.sql'
    excel_path = 'db\\OI_members_data.xlsx'
    sheet_name = 'DATA- OI Member Listing-sample'
    research_outputs_json = 'db\\research_outputs.json'
    awards_json = 'db\\OIAwards.json'
    persons_json = 'db\\OIPersons.json'

    check_and_create_db(db_name=db_name, sql_path=sql_path)
    fill_db_from_excel_people(db_name=db_name, excel_path=excel_path, sheet_name=sheet_name)
    fill_db_from_json_persons(db_name=db_name, json_file=persons_json)  # Merging OIPersons.json into OIMembers
    fill_db_from_json_research_outputs(db_name=db_name, json_file=research_outputs_json)
    fill_db_from_json_awards(db_name=db_name, json_file=awards_json)

if __name__ == "__main__":
    main()
