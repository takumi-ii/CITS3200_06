# Simple Flask server to serve a Vite/React build from ./build on localhost.

from __future__ import annotations
import os
from pathlib import Path
from flask import Flask, send_from_directory, Response, request, jsonify
import sqlite3
import requests
from urllib.parse import urlencode

try:
    # Optional: load environment variables from .env if present
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# -------------------- DB helpers --------------------
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.environ.get("DB_PATH", str((BASE_DIR / "data.db").resolve()))

def get_db():
    """Open a connection with Row access by column name."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
    

def recent_outputs_for(researcher_uuid: str, limit: int = 2):
    """Return the N most recent outputs (fallback ordering by rowid)."""
    with get_db() as conn:
        cur = conn.execute(
            """
            SELECT
              name AS title,
              NULL AS year,                 -- <- replace if you add a year column
              publisher_name AS journal
            FROM OIResearchOutputs
            WHERE researcher_uuid = ?
            ORDER BY rowid DESC
            LIMIT ?
            """,
            (researcher_uuid, limit),
        )
        return [dict(r) for r in cur.fetchall()]
# ---------------------------------------------------

def _to_int_or_none(v):
    try:
        if v is None or v == "":
            return None
        return int(v)
    except Exception:
        return None

def _pub_tile(title: str, journal: str | None = None, year: int | None = None):
    # Frontend expects ResearcherTilePub: { title, year:number, journal? }
    # We don’t have a year column in OIResearchOutputs; default to None (UI tolerates)
    return {
        "title": title or "Untitled",
        "journal": journal or "",
        "year": year if isinstance(year, int) else None,
    }

# --- helpers: table/column detection + safe getters -------------------------
def _table_cols(conn, table: str) -> set[str]:
    try:
        cur = conn.execute(f"PRAGMA table_info({table})")
        return {r["name"] for r in cur.fetchall()}
    except sqlite3.Error:
        return set()

def _get_one(conn, sql: str, params: tuple = ()):
    try:
        cur = conn.execute(sql, params)
        return cur.fetchone()
    except sqlite3.Error:
        return None

def _get_all(conn, sql: str, params: tuple = ()):
    try:
        cur = conn.execute(sql, params)
        return cur.fetchall()
    except sqlite3.Error:
        return []

def _first_nonempty(row: dict, *candidates: str, default: str | None = ""):
    for c in candidates:
        if c in row and row[c]:
            return row[c]
    return default

def _norm_url(v: str | None) -> str | None:
    return (v or "").strip() or None

def query(sql: str, params=()):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        cur = con.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()

BASE_DIR = Path(__file__).resolve().parent
BUILD_DIR = (BASE_DIR / "build").resolve()   # change to "dist" if you keep Vite default

app = Flask(__name__)

if not BUILD_DIR.exists():
    print(f"[WARN] Build directory not found: {BUILD_DIR}. Run your frontend build first.")

@app.after_request
def _no_cache_for_html(resp: Response):
    # Keep SPA shell fresh; let static assets use default caching.
    if resp.mimetype == "text/html":
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp

@app.route("/healthz")
def healthz():
    return {"status": "ok"}


# -------------------- API routes --------------------
@app.route("/api/oimembers")
def get_oimembers():
    """
    Get members from the OIMembers table with optional filters and expertise tags.
    Query params:
      - q: text to match against member name, bio, education
      - tags: comma-separated list of expertise fields (match any)
    """
    q = (request.args.get("q") or "").strip().lower()
    tag_param = (request.args.get("tags") or "").strip()
    requested_tags = [t.strip().lower() for t in tag_param.split(",") if t.strip()]

    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    # Pull members with their expertise aggregated
    cursor.execute(
        """
        SELECT m.uuid, m.name, m.email, m.education, m.bio, m.phone,
               GROUP_CONCAT(e.field, '\u001F') as expertise_concat
        FROM OIMembers m
        LEFT JOIN OIExpertise e ON e.researcher_uuid = m.uuid
        GROUP BY m.uuid, m.name, m.email, m.education, m.bio, m.phone
        """
    )
    rows = cursor.fetchall()
    conn.close()

    members = []
    for row in rows:
        uuid, name, email, education, bio, phone, expertise_concat = row
        expertise = (expertise_concat or "").split("\u001F") if expertise_concat else []
        expertise_lower = [e.lower() for e in expertise]

        # Text filter
        if q:
            joined = " ".join([
                str(name or ""), str(education or ""), str(bio or "")
            ] + expertise_lower).lower()
            if q not in joined:
                continue

        # Tags filter (match any of requested tags)
        if requested_tags:
            if not any(t in expertise_lower for t in requested_tags):
                continue

        members.append({
            "uuid": uuid,
            "name": name,
            "email": email,
            "education": education,
            "bio": bio,
            "phone": phone,
            "expertise": expertise,
        })

    return {"members": members}

@app.route("/api/oiexpertise")
def get_oiexpertise():
    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM OIExpertise")
    rows = cursor.fetchall()
    conn.close()
    expertise = [
        {
            "id": row[0],
            "researcher_uuid": row[1],
            "field": row[2]
        }
        for row in rows
    ]
    return {"expertise": expertise}

@app.route("/api/oiresearchoutputs")
def get_oiresearchoutputs():
    """
    Get research outputs. Optional filters:
      - q: text to match against output name/publisher
      - researcher_uuid: limit to a specific researcher
    The response includes any associated grants for each output.
    """
    q = (request.args.get("q") or "").strip().lower()
    researcher_uuid_filter = (request.args.get("researcher_uuid") or "").strip()

    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()

    cursor.execute(
        "SELECT uuid, researcher_uuid, publisher_name, name FROM OIResearchOutputs"
    )
    outputs = cursor.fetchall()

    # Build grants map keyed by ro_name
    cursor.execute(
        """
        SELECT ro_name, grant_name, start_date, end_date, funding, institute, school
        FROM OIResearchGrants
        """
    )
    grant_rows = cursor.fetchall()
    conn.close()

    grants_by_output = {}
    for ro_name, grant_name, start_date, end_date, funding, institute, school in grant_rows:
        grants_by_output.setdefault(ro_name, []).append({
            "grant_name": grant_name,
            "start_date": start_date,
            "end_date": end_date,
            "funding": funding,
            "institute": institute,
            "school": school,
        })

    research_outputs = []
    for uuid, researcher_uuid, publisher_name, name in outputs:
        if researcher_uuid_filter and researcher_uuid != researcher_uuid_filter:
            continue
        if q:
            joined = f"{publisher_name or ''} {name or ''}".lower()
            if q not in joined:
                continue
        research_outputs.append({
            "uuid": uuid,
            "researcher_uuid": researcher_uuid,
            "publisher_name": publisher_name,
            "name": name,
            "grants": grants_by_output.get(name, []),
        })

    return {"research_outputs": research_outputs}

@app.route("/api/_debug_db")
def _debug_db():
    try:
        with get_db() as conn:
            db_file = conn.execute("PRAGMA database_list").fetchone()["file"]
            # table list
            tables = [r["name"] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).fetchall()]
            counts = {}
            for t in ["OIMembers", "OIMembersMetaInfo", "OIExpertise",
                      "OIResearchOutputs", "OIResearchOutputsCollaborators",
                      "OIResearchOutputsToGrants"]:
                try:
                    counts[t] = conn.execute(f"SELECT COUNT(*) AS c FROM {t}").fetchone()["c"]
                except sqlite3.Error:
                    counts[t] = "missing"
            # sample row
            sample = None
            if "OIMembers" in tables:
                sample = conn.execute(
                    "SELECT uuid, name, position, first_title FROM OIMembers LIMIT 1"
                ).fetchone()
                sample = dict(sample) if sample else None
            return jsonify({
                "db_path": db_file,
                "tables": tables,
                "counts": counts,
                "sample_member": sample
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/researchers")
def api_researchers():
    """
    Returns UWA researchers only (excludes external collaborators) in the mock-aligned shape, with:
      - title <- OIMembers.first_title
      - role  <- OIMembers.position
      - counts from OIMembersMetaInfo (num_research_outputs, num_grants, num_collaborations)
      - recentPublications via OIResearchOutputsCollaborators -> OIResearchOutputs
      - grantIds via OIResearchOutputsCollaborators -> OIResearchOutputsToGrants
      - collaboratorIds as co-authors on shared outputs
      - awardIds empty (no awards table in schema)
    
    Note: External collaborators (position='External Collaborator') are filtered out to improve 
    performance and show only UWA staff. External collaborators with real names are still 
    available via the /api/researchers/{id}/collaborators endpoint.
    """
    TEST_RESEARCHER = {
        "id": "test-researcher-1",
        "name": "Test Researcher",
        "title": "Researcher",
        "role": "Researcher",
        "department": "",
        "email": "test@example.org",
        "phone": None,
        "photoUrl": None,
        "profileUrl": None,
        "expertise": ["Test Expertise"],
        "publicationsCount": 0,
        "grantsCount": 0,
        "collaboratorsCount": 0,
        "bio": "",
        "recentPublications": [_pub_tile("Test Publication", "", None)],
        "grantIds": [],
        "collaboratorIds": [],
        "awardIds": [],
    }

    base_sql = """
      WITH exp AS (
        SELECT researcher_uuid, GROUP_CONCAT(field, '||') AS expertise_concat
        FROM OIExpertise
        GROUP BY researcher_uuid
      )
      SELECT
        m.uuid                     AS id,
        m.name                     AS name,
        m.bio                      AS bio,
        m.email                    AS email,
        m.phone                    AS phone,
        m.position                 AS position,
        m.first_title              AS first_title,
        m.main_research_area       AS main_research_area,
        m.photo_url                AS photo_url,
        m.profile_url              AS profile_url,
        COALESCE(meta.num_research_outputs, 0) AS publicationsCount,
        COALESCE(meta.num_grants, 0)           AS grantsCount,
        COALESCE(meta.num_collaborations, 0)   AS collaboratorsCount,
        e.expertise_concat         AS expertise_concat
      FROM OIMembers m
      LEFT JOIN OIMembersMetaInfo meta ON meta.researcher_uuid = m.uuid
      LEFT JOIN exp e                   ON e.researcher_uuid    = m.uuid
      WHERE m.position != 'External Collaborator' OR m.position IS NULL
      ORDER BY m.name
    """

    try:
        with get_db() as conn:
            rows = conn.execute(base_sql).fetchall()
            if not rows:
                return {"researchers": [TEST_RESEARCHER]}

            # --- precompute collaboratorIds and grantIds per researcher ---

            # collaboratorIds: other authors on the same outputs
            collab_sql = """
              SELECT c1.researcher_uuid AS me, c2.researcher_uuid AS other
              FROM OIResearchOutputsCollaborators c1
              JOIN OIResearchOutputsCollaborators c2
                ON c1.ro_uuid = c2.ro_uuid
              WHERE c1.researcher_uuid != c2.researcher_uuid
            """
            collab_map: dict[str, set[str]] = {}
            for r in conn.execute(collab_sql):
                collab_map.setdefault(r["me"], set()).add(r["other"])

            # grantIds: outputs for the researcher -> grants linked to those outputs
            grants_sql = """
              SELECT DISTINCT c.researcher_uuid AS rid, g.grant_uuid AS gid
              FROM OIResearchOutputsCollaborators c
              JOIN OIResearchOutputsToGrants g ON g.ro_uuid = c.ro_uuid
            """
            grants_map: dict[str, list[str]] = {}
            for r in conn.execute(grants_sql):
                rid, gid = r["rid"], r["gid"]
                grants_map.setdefault(rid, []).append(gid)

            # recent publications (2): join through collaborators table
            recent_sql = """
              SELECT ro.name AS title,
                     ro.journal_name AS journal,
                     ro.publication_year AS year
              FROM OIResearchOutputs ro
              JOIN OIResearchOutputsCollaborators c
                ON c.ro_uuid = ro.uuid
              WHERE c.researcher_uuid = ?
              ORDER BY ro.publication_year DESC NULLS LAST, ro.rowid DESC
              LIMIT 2
            """

            data = []
            for r in rows:
                rid = r["id"]
                expertise = (r["expertise_concat"] or "")
                expertise = expertise.split("||") if expertise else []

                # Build recent pubs
                recents_rows = conn.execute(recent_sql, (rid,)).fetchall()
                recent_pubs = [_pub_tile(rr["title"], rr["journal"], rr["year"]) for rr in recents_rows]

                # Relationships
                collaborator_ids = sorted(list(collab_map.get(rid, set())))
                # de-dupe while preserving order for grants
                grant_ids = list(dict.fromkeys(grants_map.get(rid, [])))

                data.append({
                    "id": rid,
                    "name": r["name"],
                    "title": r["first_title"] or "",           # <- from first_title
                    "role": r["position"] or "",               # <- from position
                    "department": r["main_research_area"] or "",
                    "email": r["email"] or None,
                    "phone": r["phone"] or None,
                    "photoUrl": (r["photo_url"] or None),
                    "profileUrl": (r["profile_url"] or None),

                    "expertise": expertise,

                    # counts come straight from OIMembersMetaInfo
                    "publicationsCount": int(r["publicationsCount"] or 0),
                    "grantsCount": int(r["grantsCount"] or 0),
                    "collaboratorsCount": int(r["collaboratorsCount"] or 0),

                    "bio": r["bio"] or "",
                    "recentPublications": recent_pubs or [_pub_tile("Untitled", "", None)],

                    "grantIds": grant_ids,
                    "collaboratorIds": collaborator_ids,
                    "awardIds": [],   # no awards table in schema
                })

            return {"researchers": data}
    except sqlite3.Error as err:
        app.logger.warning(f"/api/researchers DB error: {err}")
        return {"researchers": [TEST_RESEARCHER]}

@app.route("/api/researchOutcomes")
def api_research_outcomes():
    TEST_OUTCOME = {
        "id": "test-output-1",
        "title": "Test Publication",
        "type": "Research Output",
        "authors": ["Test Researcher"],
        "journal": "Test Journal",
        "year": 2024,
        "citations": 0,
        "abstract": "",
        "keywords": [],
        "grantFunding": "",
    }

    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row

            # 1) Base outputs
            outs = conn.execute("""
                SELECT
                  ro.uuid            AS id,
                  ro.name            AS title,
                  ro.journal_name    AS journal,
                  ro.publication_year AS year,
                  COALESCE(ro.num_citations, 0) AS citations,
                  COALESCE(ro.abstract, '')     AS abstract
                FROM OIResearchOutputs ro
                ORDER BY (ro.publication_year IS NULL), ro.publication_year DESC, ro.rowid DESC
            """).fetchall()
            if not outs:
                return {"outcomes": [TEST_OUTCOME]}

            # Collect all ids once
            ro_ids = [r["id"] for r in outs]
            if not ro_ids:
                return {"outcomes": [TEST_OUTCOME]}

            # 2) Authors per output (many-to-many via collaborators)
            #    OIResearchOutputsCollaborators(ro_uuid, researcher_uuid) -> OIMembers(uuid -> name)
            q_marks = ",".join(["?"] * len(ro_ids))

            authors_map: dict[str, list[str]] = {}
            rows = conn.execute(f"""
                SELECT c.ro_uuid AS rid, m.name AS author_name
                FROM OIResearchOutputsCollaborators c
                JOIN OIMembers m ON m.uuid = c.researcher_uuid
                WHERE c.ro_uuid IN ({q_marks})
                ORDER BY m.name COLLATE NOCASE
            """, ro_ids).fetchall()
            for r in rows:
                if r["author_name"]:
                    authors_map.setdefault(r["rid"], []).append(r["author_name"])

            # 3) Keywords per output
            kw_map: dict[str, list[str]] = {}
            rows = conn.execute(f"""
                SELECT t.ro_uuid AS rid, t.name AS kw
                FROM OIResearchOutputTags t
                WHERE t.ro_uuid IN ({q_marks})
                ORDER BY t.name COLLATE NOCASE
            """, ro_ids).fetchall()
            for r in rows:
                if r["kw"]:
                    kw_map.setdefault(r["rid"], []).append(r["kw"])

            # 4) Funding (via outputs→grants, prefer detailed funding source names)
            fund_map: dict[str, set[str]] = {}
            # First, detailed sources
            rows = conn.execute(f"""
                SELECT rg.ro_uuid AS rid, fs.funding_source_name AS src
                FROM OIResearchOutputsToGrants rg
                JOIN OIResearchGrantsFundingSources fs ON fs.grant_uuid = rg.grant_uuid
                WHERE rg.ro_uuid IN ({q_marks})
            """, ro_ids).fetchall()
            for r in rows:
                if r["src"]:
                    fund_map.setdefault(r["rid"], set()).add(r["src"])

            # Fallback to top_funding_source_name if no detailed source captured
            rows = conn.execute(f"""
                SELECT rg.ro_uuid AS rid, g.top_funding_source_name AS src
                FROM OIResearchOutputsToGrants rg
                JOIN OIResearchGrants g ON g.uuid = rg.grant_uuid
                WHERE rg.ro_uuid IN ({q_marks})
            """, ro_ids).fetchall()
            for r in rows:
                if r["src"]:
                    fund_map.setdefault(r["rid"], set()).add(r["src"])

            # 5) Build outcomes list
            outcomes = []
            for ro in outs:
                rid = ro["id"]
                outcomes.append({
                    "id": rid,
                    "title": ro["title"] or "Untitled",
                    "type": "Research Output",
                    "authors": authors_map.get(rid, []),
                    "journal": ro["journal"] or "",
                    "year": ro["year"],
                    "citations": int(ro["citations"] or 0),
                    "abstract": ro["abstract"] or "",
                    "keywords": kw_map.get(rid, []),
                    "grantFunding": ", ".join(sorted(fund_map.get(rid, set()))),
                })

            return {"outcomes": outcomes}

    except sqlite3.Error as err:
        app.logger.warning(f"/api/researchOutcomes DB error: {err}")
        return {"outcomes": [TEST_OUTCOME]}

@app.route("/api/tags")
def get_tags():
    """Return all expertise tags with counts."""
    conn = sqlite3.connect('data.db')
    cur = conn.cursor()
    cur.execute("SELECT field, COUNT(1) FROM OIExpertise GROUP BY field ORDER BY COUNT(1) DESC")
    rows = cur.fetchall()
    conn.close()
    return {"tags": [{"tag": r[0], "count": r[1]} for r in rows]}


@app.route("/api/researchers/<rid>/grants")
def grants_for_researcher(rid: str):
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT DISTINCT
                g.uuid AS id,
                g.grant_name AS title,
                g.start_date,
                g.end_date,
                g.total_funding,
                g.top_funding_source_name,
                g.school
            FROM OIResearchOutputsCollaborators c
            JOIN OIResearchOutputsToGrants rg ON rg.ro_uuid = c.ro_uuid
            JOIN OIResearchGrants g           ON g.uuid     = rg.grant_uuid
            WHERE c.researcher_uuid = ?
            ORDER BY g.end_date DESC NULLS LAST, g.start_date DESC NULLS LAST, g.rowid DESC
        """, (rid,)).fetchall()

        grant_ids = [r["id"] for r in rows]
        fs_map = {}
        if grant_ids:
            q = ",".join(["?"] * len(grant_ids))
            fs_rows = conn.execute(f"""
                SELECT grant_uuid AS gid, funding_source_name AS name, amount
                FROM OIResearchGrantsFundingSources
                WHERE grant_uuid IN ({q})
                ORDER BY name COLLATE NOCASE
            """, grant_ids).fetchall()
            for fr in fs_rows:
                fs_map.setdefault(fr["gid"], []).append({
                    "name": fr["name"], "amount": fr["amount"]
                })

        return jsonify([
            {
                "id": r["id"],
                "title": r["title"],
                "start_date": r["start_date"],
                "end_date": r["end_date"],
                "total_funding": r["total_funding"],
                "top_funding_source_name": r["top_funding_source_name"],
                "school": r["school"],
                "funding_sources": fs_map.get(r["id"], []),
            }
            for r in rows
        ])

# ---------------------------------------------------------------------------
# Search endpoint with simple weighted ranking
# Ranking priority (highest to lowest):
#   1) Strategic research focuses (configurable via STRATEGIC_FOCUSES env, ';' separated)
#   2) Top-level categories (hard-coded tags list below)
#   3) Member expertise fields
#   4) Member full name
# ---------------------------------------------------------------------------

STRATEGIC_FOCUSES = [s.strip().lower() for s in os.environ.get(
    "STRATEGIC_FOCUSES",
    "Climate Change;Ocean Health;Blue Economy"
).split(";") if s.strip()]

TOP_LEVEL_CATEGORIES = [
    "Climate Change",
    "Coral Reef Health",
    "Marine Biodiversity",
    "Ocean Acidification",
    "Deep Sea Exploration",
    "Fisheries Management",
    "Coastal Erosion",
    "Marine Pollution",
    "Ecosystem Restoration",
    "Sustainable Aquaculture",
    "Marine Protected Areas",
    "Ocean Circulation",
    "Marine Genetics",
    "Blue Carbon",
    "Microplastics",
]

def _like_param(s: str) -> str:
    return f"%{s.lower()}%"

def _compute_score(texts: list[str], query_terms: list[str]) -> int:
    score = 0
    ql = [t.lower() for t in query_terms if t]
    joined = "\n".join(texts).lower()
    # Strategic focus weight 4
    if any(focus in joined for focus in STRATEGIC_FOCUSES):
        score += 4
    # Category weight 3
    if any(cat.lower() in joined for cat in TOP_LEVEL_CATEGORIES):
        score += 3
    # Per-term presence adds smaller boosts
    for t in ql:
        if t and t in joined:
            score += 1
    return score

@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"members": [], "research_outputs": []})

    terms = [t for t in q.split() if t]

    conn = sqlite3.connect('data.db')
    cur = conn.cursor()

    # Fetch UWA members and their expertise (exclude external researchers for search)
    cur.execute(
        """
        SELECT m.uuid, m.name, m.email, m.education, m.bio, m.phone,
               GROUP_CONCAT(e.field, '\u001F') as expertise_concat
        FROM OIMembers m
        LEFT JOIN OIExpertise e ON e.researcher_uuid = m.uuid
        WHERE m.position != 'External Collaborator' OR m.position IS NULL
        GROUP BY m.uuid, m.name, m.email, m.education, m.bio, m.phone
        """
    )
    members_rows = cur.fetchall()

    members: list[dict] = []
    for row in members_rows:
        uuid, name, email, education, bio, phone, expertise_concat = row
        expertise = (expertise_concat or "").split("\u001F") if expertise_concat else []
        score = _compute_score([name or "", bio or "", " ".join(expertise)], terms)
        # Prefer direct name/expertise hits
        name_l = (name or "").lower()
        if any(t in name_l for t in [t.lower() for t in terms]):
            score += 1
        if any(t.lower() in " ".join([e.lower() for e in expertise]) for t in terms):
            score += 2
        if score > 0:
            members.append({
                "uuid": uuid,
                "name": name,
                "email": email,
                "education": education,
                "bio": bio,
                "phone": phone,
                "expertise": expertise,
                "score": score,
            })

    # Research outputs
    cur.execute(
        """
        SELECT uuid, researcher_uuid, publisher_name, name
        FROM OIResearchOutputs
        """
    )
    outputs_rows = cur.fetchall()
    conn.close()

    research_outputs: list[dict] = []
    for row in outputs_rows:
        uuid, researcher_uuid, publisher_name, name = row
        score = _compute_score([publisher_name or "", name or ""], terms)
        name_l = (name or "").lower()
        if any(t.lower() in name_l for t in terms):
            score += 1
        if score > 0:
            research_outputs.append({
                "uuid": uuid,
                "researcher_uuid": researcher_uuid,
                "publisher_name": publisher_name,
                "name": name,
                "score": score,
            })

    members.sort(key=lambda m: m["score"], reverse=True)
    research_outputs.sort(key=lambda r: r["score"], reverse=True)
    return jsonify({"members": members, "research_outputs": research_outputs})

# ---------------------------------------------------------------------------
# PURE API proxy (GET only), authenticated on the server via API key
# Example: /api/pure/persons?size=10&offset=0
# ---------------------------------------------------------------------------

PURE_BASE = os.environ.get("PURE_API_BASE", "").rstrip("/")
PURE_KEY = os.environ.get("PURE_API_KEY", "")

ALLOWED_PURE_PATHS = {
    "applications",
    "awards",
    "keyword-configurations",
    "organisational-units",
    "persons",
    "projects",
    "research-outputs",
}

@app.get("/api/researchers/<rid>/collaborators")
def get_collaborators(rid):
    rows = query("""
        SELECT 
          c2.researcher_uuid AS collaboratorId,
          COALESCE(m.name, c2.researcher_uuid) AS name,
          m.email,
          m.position AS title,
          m.profile_url,
          m.photo_url,
          COUNT(DISTINCT c1.ro_uuid) AS pubCount
        FROM OIResearchOutputsCollaborators c1
        JOIN OIResearchOutputsCollaborators c2
          ON c1.ro_uuid = c2.ro_uuid
        LEFT JOIN OIMembers m
          ON m.uuid = c2.researcher_uuid
        WHERE c1.researcher_uuid = ?
          AND c2.researcher_uuid != ?
        GROUP BY c2.researcher_uuid
        ORDER BY pubCount DESC
        LIMIT 10;
    """, (rid, rid))

    for r in rows:
        r["grantCount"] = 0
        r["total"] = r["pubCount"]

    return jsonify(rows)

@app.get("/api/researchers/<rid1>/shared-outputs/<rid2>")
def get_shared_outputs(rid1, rid2):
    """
    Get all research outputs that both researchers collaborated on.
    Works for both internal UWA researchers and external collaborators.
    """
    rows = query("""
        SELECT DISTINCT
          ro.uuid,
          ro.name AS title,
          ro.publication_year AS year,
          ro.journal_name AS journal,
          ro.abstract,
          ro.num_citations AS citations,
          ro.link_to_paper AS url,
          ro.publisher_name AS publisher
        FROM OIResearchOutputs ro
        JOIN OIResearchOutputsCollaborators c1 ON c1.ro_uuid = ro.uuid
        JOIN OIResearchOutputsCollaborators c2 ON c2.ro_uuid = ro.uuid
        WHERE c1.researcher_uuid = ?
          AND c2.researcher_uuid = ?
          AND c1.researcher_uuid != c2.researcher_uuid
        ORDER BY ro.publication_year DESC NULLS LAST, ro.name
    """, (rid1, rid2))

    # Add authors for each output
    for row in rows:
        authors = query("""
            SELECT COALESCE(m.name, c.researcher_uuid) AS name
            FROM OIResearchOutputsCollaborators c
            LEFT JOIN OIMembers m ON m.uuid = c.researcher_uuid
            WHERE c.ro_uuid = ?
            ORDER BY c.id
        """, (row['uuid'],))
        row['authors'] = [a['name'] for a in authors]
    
    return jsonify(rows)

@app.route('/api/pure/<path:resource>')
def pure_proxy(resource: str):
    if not PURE_BASE or not PURE_KEY:
        return jsonify({"error": "PURE API not configured"}), 503
    part = resource.strip("/")
    # Allow only first segment to prevent path traversal
    first = part.split('/')[0]
    if first not in ALLOWED_PURE_PATHS:
        return jsonify({"error": "Unsupported PURE resource"}), 400
    url = f"{PURE_BASE}/{first}"
    params = dict(request.args)  # passthrough query params
    # Allow either header (preferred) or apiKey query for systems requiring it
    send_key_in_query = params.pop('useQueryKey', 'false').lower() == 'true'
    if send_key_in_query:
        params['apiKey'] = PURE_KEY
        headers = {"Accept": "application/json"}
    else:
        headers = {"api-key": PURE_KEY, "Accept": "application/json"}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        return (resp.content, resp.status_code, {"Content-Type": resp.headers.get("Content-Type", "application/json")})
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502
# ------------------ end API routes ------------------

# SPA catch-all route (MUST be last so API routes win)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path: str):
    target = BUILD_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)

