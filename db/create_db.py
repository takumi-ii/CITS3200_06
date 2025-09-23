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

# UUID helpers + member upsert
def _deterministic_member_uuid(name: str) -> str:
    """
    Produce a stable UUIDv5 for a member name (used for Excel-only rows).
    This allows reproducible FKs until a canonical JSON UUID is known.
    """
    base = f"member:{name.casefold()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, base))

def _ensure_member(
    conn,
    name: str,
    member_uuid: Optional[str],
    email: Optional[str],
    education: Optional[str],
    bio: Optional[str],
    phone: Optional[str],
    photo_url: Optional[str],
    profile_url: Optional[str]
) -> str:
    """
    Ensure an OIMembers row exists for `name`, returning the member UUID.

    - Tries to INSERT with the provided `member_uuid` (or deterministic if none).
    - If IntegrityError (PK or UNIQUE violation), checks existing by name or uuid and UPDATES accordingly.
      - If name exists (possibly with different uuid), updates uuid to canonical and other fields.
      - If uuid exists (with different name), updates name and fields.
    """
    if not member_uuid:
        member_uuid = _deterministic_member_uuid(name)

    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO OIMembers (uuid, name, email, education, bio, phone, photo_url, profile_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (member_uuid, name, email, education, bio, phone, photo_url, profile_url)
        )
        return member_uuid
    except sqlite3.IntegrityError:
        # Check by name
        cur.execute("SELECT uuid FROM OIMembers WHERE name = ?", (name,))
        row = cur.fetchone()
        if row:
            existing_uuid = row[0]
            if existing_uuid != member_uuid:
                # Update PK uuid (cascades to FKs)
                cur.execute("UPDATE OIMembers SET uuid = ? WHERE name = ?", (member_uuid, name))
            # Update fields
            cur.execute(
                """
                UPDATE OIMembers SET
                    email = COALESCE(?, email),
                    education = COALESCE(?, education),
                    bio = COALESCE(?, bio),
                    phone = COALESCE(?, phone),
                    photo_url = COALESCE(?, photo_url),
                    profile_url = COALESCE(?, profile_url)
                WHERE name = ?
                """,
                (email, education, bio, phone, photo_url, name)
            )
            return member_uuid

        # Check by uuid (if name different)
        cur.execute("SELECT name FROM OIMembers WHERE uuid = ?", (member_uuid,))
        row = cur.fetchone()
        if row:
            # Update name and fields
            cur.execute(
                """
                UPDATE OIMembers SET
                    name = ?,
                    email = COALESCE(?, email),
                    education = COALESCE(?, education),
                    bio = COALESCE(?, bio),
                    phone = COALESCE(?, phone),
                    photo_url = COALESCE(?, photo_url),
                    profile_url = COALESCE(?, profile_url)
                WHERE uuid = ?
                """,
                (name, email, education, bio, phone, photo_url, member_uuid, profile_url)
            )
            return member_uuid

        # If neither, re-raise (should not happen)
        raise

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
        # member_uuid = _ensure_member(conn, author_name, author_uuid, None, None)
        member_uuid = _deterministic_member_uuid(author_name)

        publisher = _publisher_from_item(item)
        # Get the portal link to the paper:
        info_obj = item.get("info", {})
        link_to_paper = info_obj.get("portalUrl", None)

        # Get the abstract of the paper:
        abstract_obj = item.get("abstract", {})
        abstract_text_obj = abstract_obj.get("text", [{}])
        abstract = abstract_text_obj[0].get("value", None)

        # Get the number of authors:
        # print(f"\nPaper: {json.dumps(item)}\n")
        num_authors = item.get("totalNumberOfAuthors", 0)

        # Get the number of citations:
        num_citations = item.get("totalScopusCitations", 0)

        # Get the publication year:
        publisher_obj = item.get("publicationStatuses", [{}])
        publication_date_obj = publisher_obj[0].get("publicationDate", {})
        publication_year = publication_date_obj.get("year", 0000)
        try:
            cur.execute(
                """
                INSERT INTO OIResearchOutputs (uuid, publisher_name, name, abstract, num_citations, num_authors, publication_year, link_to_paper)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    publisher_name = COALESCE(excluded.publisher_name, OIResearchOutputs.publisher_name),
                    name = COALESCE(excluded.name, OIResearchOutputs.name),
                    abstract = COALESCE(excluded.abstract, OIResearchOutputs.abstract),
                    num_citations = COALESCE(excluded.num_citations, OIResearchOutputs.num_citations),
                    num_authors = COALESCE(excluded.num_authors, OIResearchOutputs.num_authors),
                    publication_year = COALESCE(excluded.publication_year, OIResearchOutputs.publication_year),
                    link_to_paper = COALESCE(excluded.link_to_paper, OIResearchOutputs.link_to_paper)
                """,
                (ro_uuid , publisher, title, abstract, num_citations, num_authors, publication_year, link_to_paper)
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
        # Now we add any tags (keywords):
        keywordGroups_list = item.get("keywordGroups", [])
        keywordGroups: list[tuple[str, str, str]] = []  # (ro_uuid, type_name, name)
        if keywordGroups_list:
            # Cycle through each keyword group:
            for keywordGroup in keywordGroups_list:
                # Get the logical name (type) for this group:
                type_obj = keywordGroup.get("type", {})
                type_term = type_obj.get("term", {})
                type_texts = type_term.get("text", [])
                type_name = ""
                if type_texts:
                    type_name = _norm(type_texts[0].get("value", ""))
                if not type_name:
                    type_name = keywordGroup.get("logicalName", "Unknown")

                # Get the container objects (list, default to empty):
                containers = keywordGroup.get("keywordContainers", [])

                # Cycle through each container:
                for container in containers:
                    # Check for free keywords (list of dicts, each with a "freeKeywords" list of strings):
                    free_keywords_items = container.get("freeKeywords", [])
                    if free_keywords_items:
                        for fk_item in free_keywords_items:
                            free_keywords = fk_item.get("freeKeywords", [])
                            for free_keyword in free_keywords:
                                kw = _norm(free_keyword)
                                if kw:
                                    keywordGroups.append((ro_uuid, type_name, titlecase_expertise(kw)))
                        continue  # Skip to next container if free keywords were found

                    # Check for structured keywords (direct "structuredKeyword" dict):
                    structured_keyword = container.get("structuredKeyword", {})
                    if structured_keyword:
                        term = structured_keyword.get("term", {})
                        texts = term.get("text", [])
                        for text in texts:
                            value = text.get("value", "")
                            kw = _norm(value)
                            if kw:
                                keywordGroups.append((ro_uuid, type_name, titlecase_expertise(kw)))
        # Now we insert the keywords (if any):
        try:
            for ro_uuid, type_name, name in keywordGroups:
                cur.execute(
                    """INSERT OR IGNORE INTO OIResearchOutputTags (ro_uuid, type_name, name)
                    VALUES (?, ?, ?)""",
                    (ro_uuid, type_name, name)
                )
        except Exception as e:
            print(f"Error inserting keyword tag {ro_uuid}, {type_name}, {name}: {e}")

        # Now we insert the author / collaborator associations (uuid, name, role)
        person_associations_obj = item.get("personAssociations", [{}])
        for person_assoc in person_associations_obj:
            # Get the UUID
            p_uuid = person_assoc.get("person", {}).get("uuid", None)

            # Get the role
            p_role = person_assoc.get("personRole", {}).get("term", {}).get("text", [{}])[0].get("value", None)

            # Only insert if we have both a UUID and a role:
            if not p_uuid or not p_role:
                continue
            
            # Insert the association:
            try:
                cur.execute(
                    """INSERT OR IGNORE INTO OIResearchOutputsCollaborators (ro_uuid, researcher_uuid, role)
                    VALUES (?, ?, ?)""",
                    (ro_uuid,  p_uuid, p_role)
                )
            except Exception as e:
                print(f"Error inserting author association {ro_uuid}, {p_uuid}, {p_role}: {e}")




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

        # 4) Funding Source(s) and Amount(s) (if any):
        try:
            # Get the funding object : list[dict]
            fund_obj = item.get("fundings", [])
            funders: list[tuple] = []
            for funder_item in fund_obj:
                # Get the current funder
                funder_obj = funder_item.get("funder", {})
                name_obj = funder_obj.get("name", {})
                text = name_obj.get("text",{})

                # Get the current funder's name
                if isinstance(text, list):
                    fund_source = text[0].get("value")
                else:
                    fund_source = text.get("value")
                # Get the amount (if any)
                funding_amount = float(fund_obj[0].get("awardedAmount", "0.00"))
                # print(f"Extracted funding source: {fund_obj[0].get('awardedAmount', '0.00')}, amount: {funding_amount}")
                funders.append((fund_source, funding_amount))
            # Get the top funder (if any):
            top_funder = sorted(funders, key=lambda x: x[1], reverse=True)[0] if funders else (None, 0.00)
        except Exception as e:
            print(f"\nError extracting funding source and amount from award: {json.dumps(item)}\nError: {e}\n")
            fund_source = None
            funding_amount = 0.00
            funders = []
            top_funder = (None, 0.00)

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

        # 7) Execute the insert/update for the Award itself
        try:
            cur.execute(
                """
                INSERT INTO OIResearchGrants (uuid, ro_uuid, grant_name, start_date, end_date, total_funding, top_funding_source_name, school)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    grant_name = COALESCE(excluded.grant_name, OIResearchGrants.grant_name),
                    ro_uuid = COALESCE(excluded.ro_uuid, OIResearchGrants.ro_uuid),
                    start_date = COALESCE(excluded.start_date, OIResearchGrants.start_date),
                    end_date = COALESCE(excluded.end_date, OIResearchGrants.end_date),
                    total_funding = COALESCE(excluded.total_funding, OIResearchGrants.total_funding),
                    top_funding_source_name = COALESCE(excluded.top_funding_source_name, OIResearchGrants.top_funding_source_name),
                    school = COALESCE(excluded.school, OIResearchGrants.school)
                """,
                (award_uuid, ro_uuid, title, start_date, end_date, top_funder[1], top_funder[0], school)
            )
            cur.execute("SELECT changes()")
            changes = cur.fetchone()[0] or 0
            if changes > 0:
                updated += 1
        except sqlite3.IntegrityError:
            print("IntegrityError on award insert, attempting update by name")
            skipped += 1
        # 8) Now insert into OIResearchGrantsFundingSources (if we have a funding source):
        if funders:
            for funder in funders:
                try:
                    cur.execute(
                        """INSERT OR IGNORE INTO OIResearchGrantsFundingSources (grant_uuid, funding_source_name, amount)
                           VALUES (?, ?, ?)""",
                        (award_uuid, funder[0], funder[1])
                    )
                except sqlite3.IntegrityError:
                    print(f"IntegrityError on funding source insert for award {award_uuid}, funding source {funder[0]}")
                    continue

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

# Add this function to the script, e.g., after import statements and before _ensure_member
def clean_expertise(raw: str) -> Optional[str]:
    """
    Clean up extracted expertise values by removing HTML, artifacts, and filtering junk.
    Returns None if the cleaned value is invalid (e.g., SDG, URL, too short).
    """
    # Unescape HTML entities
    raw = html.unescape(raw)
    # Remove HTML tags
    raw = re.sub(r'<[^>]*>', '', raw)
    # Normalize: replace multiple spaces with single, strip
    field = re.sub(r'\s+', ' ', raw).strip()
    # Remove leading artifacts like >, <, numbers like 1.
    field = re.sub(r'^[><\s]*', '', field).strip()
    field = re.sub(r'^\d+\.\s*', '', field).strip()
    # Remove trailing artifacts
    field = re.sub(r'[><\s]*$', '', field).strip()
    # Skip if it's a URL, or too short/junk
    upper_field = field.upper()
    if field.lower().startswith(('http', 'www.')) or len(field) < 3 or re.match(r'^[\W\s]*$', field):
        return None
    return field

def fill_db_from_json_persons(db_name='data.db', json_file='db\\OIPersons.json'):
    """
    Load persons and expertise from OIPersons.json into OIMembers and OIExpertise (UUID-based).
    This replaces the Excel ingestion function.
    Upserts members by attempting INSERT first, then UPDATE on failure (e.g., due to unique name or PK uuid).
    Uses canonical UUID from JSON.
    Extracts and inserts expertise from profileInformations (researchinterests) by splitting and title-casing,
    and from keywordGroups (e.g., sustainabledevelopmentgoals) as additional fields, similar to how tags are handled in OIResearchOutputTags.
    """
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(db_name)
    cur = conn.cursor()
    inserted_members = 0
    inserted_expertise = 0

    for person in data:
        # Extract name
        name_dict = person.get('name', {})
        first_name = _norm(name_dict.get('firstName'))
        last_name = _norm(name_dict.get('lastName'))
        name = f"{first_name} {last_name}".strip()
        if not name:
            continue  # Skip if no valid name

        # Canonical UUID
        member_uuid = person.get('uuid')

        # Email: Prefer from primary staffOrganisationAssociation's emails
        email = None
        associations = person.get('staffOrganisationAssociations', [])
        primary_assoc = next((assoc for assoc in associations if assoc.get('isPrimaryAssociation')), None)
        if primary_assoc:
            emails = primary_assoc.get('emails', [])
            if emails:
                email_value = emails[0].get('value', {})
                email = _norm(email_value.get('value') if isinstance(email_value, dict) else email_value)

        # Education: From titles with type /academicdegree
        education = None
        for title in person.get('titles', []):
            title_type_uri = title.get('type', {}).get('uri', '')
            if 'academicdegree' in title_type_uri:
                value_text = title.get('value', {}).get('text', [])
                if value_text:
                    education = _norm(value_text[0].get('value'))
                break

        # Bio: From profileInformations with type /background
        bio = None
        for info in person.get('profileInformations', []):
            info_type_uri = info.get('type', {}).get('uri', '')
            if 'background' in info_type_uri:
                value_text = info.get('value', {}).get('text', [])
                if value_text:
                    bio_raw = value_text[0].get('value', '')
                    bio = re.sub(r"<.*?>", "", html.unescape(_norm(bio_raw)))
                break

        # Phone: From primary association phones
        phone = None
        if primary_assoc:
            phones = primary_assoc.get('phoneNumbers', [])
            if phones:
                phone_value = phones[0].get('value', {})
                phone = _norm(phone_value.get('value') if isinstance(phone_value, dict) else phone_value)

        # Photo URL: From first profilePhotos
        photo_url = None
        photos = person.get('profilePhotos', [])
        if photos:
            photo_url = photos[0].get('url')

        # Profile URL: From first profileLinks
        info_obj = person.get('info', {})
        profile_url = info_obj.get('portalUrl', None)

        # Ensure member (try insert, update on fail)
        ensured_uuid = _ensure_member(conn, name, member_uuid, email, education, bio, phone, photo_url, profile_url)
        inserted_members += 1  # Count as processed

        # Insert expertise from researchinterests (split similar to Excel)
        seen = set()
        for info in person.get('profileInformations', []):
            info_type_uri = info.get('type', {}).get('uri', '')
            if 'researchinterests' in info_type_uri:
                value_text = info.get('value', {}).get('text', [])
                if value_text:
                    interests_raw = value_text[0].get('value', '')
                    # Clean HTML from the whole interests_raw
                    interests_raw = html.unescape(interests_raw)
                    interests_raw = re.sub(r'<[^>]*>', '', interests_raw)
                    # Split the cleaned raw
                    parts = re.split(r"[;,/]|\band\b", _norm(interests_raw), flags=re.I)
                    for p in parts:
                        if cleaned := clean_expertise(p):
                            field = titlecase_expertise(cleaned)
                            key = field.casefold()
                            if key not in seen:
                                seen.add(key)
                                cur.execute(
                                    """INSERT OR IGNORE INTO OIExpertise (researcher_uuid, field)
                                       VALUES (?, ?)""",
                                    (ensured_uuid, field)
                                )
                                if cur.rowcount > 0:
                                    inserted_expertise += 1

        # Insert expertise from keywordGroups (treat as additional fields/tags)
        for kg in person.get('keywordGroups', []):
            for container in kg.get('keywordContainers', []):
                structured_kw = container.get('structuredKeyword', {})
                term = structured_kw.get('term', {})
                term_text = term.get('text', [])
                if term_text:
                    field_raw = term_text[0].get('value', '')
                    if cleaned := clean_expertise(field_raw):
                        field = titlecase_expertise(cleaned)
                        key = field.casefold()
                        if key not in seen:
                            seen.add(key)
                            cur.execute(
                                """INSERT OR IGNORE INTO OIExpertise (researcher_uuid, field)
                                   VALUES (?, ?)""",
                                (ensured_uuid, field)
                            )
                            if cur.rowcount > 0:
                                inserted_expertise += 1

    conn.commit()
    conn.close()
    print(f"[INFO] Members inserted/updated: {inserted_members}")
    print(f"[INFO] Expertise inserted: {inserted_expertise}")
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
    research_outputs_json = 'db\\research_outputs.json'
    awards_json = 'db\\OIAwards.json'
    persons_json = 'db\\OIPersons.json'

    check_and_create_db(db_name=db_name, sql_path=sql_path)
    # fill_db_from_excel_people(db_name=db_name, excel_path=excel_path, sheet_name=sheet_name)
    fill_db_from_json_persons(db_name=db_name, json_file=persons_json)  # Merging OIPersons.json into OIMembers
    fill_db_from_json_research_outputs(db_name=db_name, json_file=research_outputs_json)
    fill_db_from_json_awards(db_name=db_name, json_file=awards_json)

if __name__ == "__main__":
    main()
