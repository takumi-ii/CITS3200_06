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

# -------------------- NEW: per-researcher fingerprints --------------------
@app.get("/api/researchers/<rid>/fingerprints")
def get_researcher_fingerprints(rid: str):
    """
    Fingerprints for a single researcher (OIMembers).
    Query params:
      - limit: int (default 25)
      - min_score: float (default 0)
      - order: 'rank' (asc) or 'score' (desc), default 'rank'
    Response items include 'score' which is an alias of weightedRank.
    """
    limit = request.args.get("limit", "").strip()
    try:
        limit = int(limit) if limit else 25
    except ValueError:
        limit = 25

    try:
        min_score = float(request.args.get("min_score", "0").strip() or 0)
    except ValueError:
        min_score = 0.0

    order = (request.args.get("order", "rank") or "rank").lower()
    # 'score' means weightedRank in this schema.
    if order == "score":
        order_by = "f.weightedRank DESC, f.rank ASC"
    else:
        order_by = "f.rank ASC, f.weightedRank DESC"

    sql = f"""
        SELECT
          f.concept_uuid       AS conceptId,
          COALESCE(c.name, '') AS conceptName,
          f.weightedRank       AS score,       -- alias for frontend
          f.rank,
          f.frequency,
          f.weightedRank
        FROM OIFingerprints f
        LEFT JOIN ALLConcepts c ON c.uuid = f.concept_uuid
        WHERE f.origin_uuid = ?                -- no origin_type in schema
          AND f.weightedRank >= ?
        ORDER BY {order_by}
        LIMIT ?
    """

    try:
        with get_db() as conn:
            rows = conn.execute(sql, (rid, min_score, limit)).fetchall()
            return jsonify([dict(r) for r in rows])
    except sqlite3.Error as err:
        return jsonify({"error": str(err)}), 500

@app.route("/api/researchers")
def api_researchers():
    """
    Paginated + filtered + sortable researchers.
    Query params:
      q: str (text search over name, bio, expertise)
      tags: comma-separated list; match ANY
      sort: 'default' | 'recent-publications' | 'position-rank'
      page: int (1-based)
      per_page: int
      promote_first: 'true'|'false'
      exclude_no_show: 'true'|'false'  (default true)
    Returns: { items: [...], total: int, page: int, per_page: int }
    """
    q = (request.args.get("q") or "").strip().lower()
    tag_param = (request.args.get("tags") or "").strip()
    tags = [t.strip().lower() for t in tag_param.split(",") if t.strip()]
    sort = (request.args.get("sort") or "default").strip().lower()
    page = max(int(request.args.get("page", 1) or 1), 1)
    per_page = min(max(int(request.args.get("per_page", 12) or 12), 1), 50)
    promote_first = (request.args.get("promote_first", "true").lower() == "true")
    exclude_no_show = (request.args.get("exclude_no_show", "true").lower() == "true")

    # position rank mapping for 'position-rank' sorting (can live in SQL as CASE)
    position_rank_case = """
      CASE LOWER(m.position)
        WHEN 'director' THEN 10
        WHEN 'deputy director' THEN 9
        WHEN 'chief executive officer' THEN 9
        WHEN 'head of department' THEN 8
        WHEN 'centre manager' THEN 7
        WHEN 'manager' THEN 7
        WHEN 'program coordinator' THEN 6
        WHEN 'winthrop professor' THEN 8
        WHEN 'professor' THEN 7
        WHEN 'professorial fellow' THEN 7
        WHEN 'emeritus professor' THEN 6
        WHEN 'associate professor' THEN 6
        WHEN 'senior lecturer' THEN 5
        WHEN 'lecturer' THEN 4
        WHEN 'adjunct senior lecturer' THEN 3
        WHEN 'senior research fellow' THEN 5
        WHEN 'senior research engineer' THEN 5
        WHEN 'senior research officer' THEN 4
        WHEN 'research fellow' THEN 4
        WHEN 'research associate' THEN 3
        WHEN 'research officer' THEN 3
        WHEN 'scientific officer' THEN 3
        WHEN 'research assistant' THEN 2
        WHEN 'premier''s science fellow' THEN 5
        WHEN 'decra fellow' THEN 4
        WHEN 'adjunct professor' THEN 2
        WHEN 'adjunct associate professor' THEN 2
        WHEN 'adjunct senior research fellow' THEN 2
        WHEN 'adjunct research fellow' THEN 2
        WHEN 'senior honorary fellow' THEN 3
        WHEN 'senior honorary research fellow' THEN 3
        WHEN 'honorary research fellow' THEN 2
        WHEN 'honorary research associate' THEN 2
        WHEN 'honorary fellow' THEN 2
        WHEN 'administrative officer' THEN 2
        WHEN 'electronics engineer' THEN 2
        WHEN 'field assistant' THEN 1
        WHEN 'technician (soils lab)' THEN 1
        WHEN 'casual teaching' THEN 2
        WHEN 'contractor / visitor' THEN 1
        WHEN 'contractor/visitor' THEN 1
        WHEN 'external collaborator' THEN 0
        ELSE 0
      END
    """

    # sorting blocks
    order_by_default = "LOWER(m.name) ASC"
    order_by_recent = """
      last_pub_year DESC NULLS LAST,
      publicationsCount DESC,
      LOWER(m.name) ASC
    """
    order_by_position = f"""
      position_rank DESC,
      publicationsCount DESC,
      LOWER(m.name) ASC
    """
    order_by_core = {
      "default": order_by_default,
      "recent-publications": order_by_recent,
      "position-rank": order_by_position,
    }.get(sort, order_by_default)

    # promotion pre-key (optional)
    promote_key = "CASE WHEN l.promote_weight IS NOT NULL THEN 1 ELSE 0 END"
    order_by = f"{promote_key} DESC, {order_by_core}" if promote_first else order_by_core

    with get_db() as conn:
        # base expertise and labels (active window)
        # NOTE: your schema & indexes already exist for these joins. :contentReference[oaicite:6]{index=6}
        where = ["(m.position != 'External Collaborator' OR m.position IS NULL)"]
        params: list = []

        if exclude_no_show:
            where.append("""
              NOT EXISTS (
                SELECT 1 FROM OIMemberLabels nx
                WHERE nx.researcher_uuid = m.uuid
                  AND nx.label = 'no_show'
                  AND (nx.starts_at IS NULL OR DATE(nx.starts_at) <= DATE('now'))
                  AND (nx.expires_at IS NULL OR DATE(nx.expires_at) >= DATE('now'))
              )
            """)

        if q:
            where.append("""
              (
                LOWER(m.name) LIKE ?
                OR LOWER(COALESCE(m.bio,'')) LIKE ?
                OR LOWER(COALESCE(e.expertise_concat,'')) LIKE ?
              )
            """)
            like = f"%{q}%"
            params += [like, like, like]

        if tags:
            # match ANY tag
            # We’ll check presence in the expertise_concat string
            or_clauses = []
            for t in tags:
                or_clauses.append("LOWER(COALESCE(e.expertise_concat,'')) LIKE ?")
                params.append(f"%{t}%")
            where.append("(" + " OR ".join(or_clauses) + ")")

        where_sql = " AND ".join(where)

        # derive last_pub_year + counts and total count via window function
        sql = f"""
          WITH exp AS (
            SELECT researcher_uuid, GROUP_CONCAT(field, '||') AS expertise_concat
            FROM OIExpertise
            GROUP BY researcher_uuid
          ),
          labels AS (
            SELECT
              researcher_uuid,
              MAX(CASE WHEN label='promote' THEN COALESCE(weight,0) END) AS promote_weight
            FROM OIMemberLabels
            WHERE (starts_at IS NULL OR DATE(starts_at) <= DATE('now'))
              AND (expires_at IS NULL OR DATE(expires_at) >= DATE('now'))
            GROUP BY researcher_uuid
          ),
          pubs AS (
            SELECT
              c.researcher_uuid AS rid,
              MAX(ro.publication_year) AS last_pub_year
            FROM OIResearchOutputsCollaborators c
            JOIN OIResearchOutputs ro ON ro.uuid = c.ro_uuid
            GROUP BY c.researcher_uuid
          )
          SELECT
            m.uuid AS id,
            m.name,
            COALESCE(m.first_title,'') AS title,
            COALESCE(m.position,'') AS role,
            COALESCE(m.main_research_area,'') AS department,
            NULLIF(m.email,'') AS email,
            NULLIF(m.phone,'') AS phone,
            NULLIF(m.photo_url,'') AS photoUrl,
            NULLIF(m.profile_url,'') AS profileUrl,
            COALESCE(meta.num_research_outputs,0) AS publicationsCount,
            COALESCE(meta.num_grants,0) AS grantsCount,
            COALESCE(meta.num_collaborations,0) AS collaboratorsCount,
            COALESCE(m.bio,'') AS bio,
            COALESCE(e.expertise_concat,'') AS expertise_concat,
            l.promote_weight,
            pubs.last_pub_year,
            {position_rank_case} AS position_rank,
            COUNT(*) OVER() AS total
          FROM OIMembers m
          LEFT JOIN OIMembersMetaInfo meta ON meta.researcher_uuid = m.uuid
          LEFT JOIN exp e ON e.researcher_uuid = m.uuid
          LEFT JOIN labels l ON l.researcher_uuid = m.uuid
          LEFT JOIN pubs   ON pubs.rid = m.uuid
          WHERE {where_sql}
          ORDER BY {order_by}
          LIMIT ? OFFSET ?;
        """
        offset = (page - 1) * per_page
        rows = conn.execute(sql, (*params, per_page, offset)).fetchall()

        # build items in your existing tile shape, BUT no fingerprints here
        items = []
        total = 0
        # lightweight "recentPublications" (N=2) via the collaborators join you already use. :contentReference[oaicite:7]{index=7}
        recent_sql = """
          SELECT ro.name AS title, ro.journal_name AS journal, ro.publication_year AS year
          FROM OIResearchOutputs ro
          JOIN OIResearchOutputsCollaborators c ON c.ro_uuid = ro.uuid
          WHERE c.researcher_uuid = ?
          ORDER BY (ro.publication_year IS NULL) ASC, ro.publication_year DESC, ro.rowid DESC
          LIMIT 2
        """
        for r in rows:
            total = r["total"]
            expertise = (r["expertise_concat"] or "").split("||") if r["expertise_concat"] else []
            recents = [
                {"title": rr["title"] or "Untitled", "journal": rr["journal"] or "", "year": rr["year"]}
                for rr in conn.execute(recent_sql, (r["id"],)).fetchall()
            ]
            items.append({
                "id": r["id"],
                "name": r["name"],
                "title": r["title"],
                "role": r["role"],
                "department": r["department"],
                "email": r["email"],
                "phone": r["phone"],
                "photoUrl": r["photoUrl"],
                "profileUrl": r["profileUrl"],
                "labels": ["promote"] if r["promote_weight"] is not None else [],
                "primaryLabel": "promote" if r["promote_weight"] is not None else None,
                "promoteWeight": int(r["promote_weight"] or 0),
                "expertise": expertise,
                "publicationsCount": int(r["publicationsCount"] or 0),
                "grantsCount": int(r["grantsCount"] or 0),
                "collaboratorsCount": int(r["collaboratorsCount"] or 0),
                "bio": r["bio"],
                "recentPublications": recents if recents else [{"title": "Untitled", "journal": "", "year": None}],
                "grantIds": [],
                "collaboratorIds": [],
                "awardIds": [],
                "fingerprints": [],  # list call stays light
            })

        return jsonify({"items": items, "total": total, "page": page, "per_page": per_page})

@app.route("/api/researchOutcomes")
def api_research_outcomes():
    q = (request.args.get("q") or "").strip().lower()
    tag_param = (request.args.get("tags") or "").strip()
    tags = [t.strip().lower() for t in tag_param.split(",") if t.strip()]
    page = max(int(request.args.get("page", 1) or 1), 1)
    per_page = min(max(int(request.args.get("per_page", 12) or 12), 1), 50)

    with get_db() as conn:
        where = []
        params = []
        if q:
            where.append("(LOWER(COALESCE(ro.name,'')) LIKE ? OR LOWER(COALESCE(ro.publisher_name,'')) LIKE ? OR LOWER(COALESCE(ro.journal_name,'')) LIKE ?)")
            like = f"%{q}%"
            params += [like, like, like]

        # tag filter (ANY)
        tag_join = ""
        if tags:
            tag_join = "LEFT JOIN OIResearchOutputTags t ON t.ro_uuid = ro.uuid"
            or_clauses = []
            for t in tags:
                or_clauses.append("LOWER(t.name) LIKE ?")
                params.append(f"%{t}%")
            where.append("(" + " OR ".join(or_clauses) + ")")

        where_sql = ("WHERE " + " AND ".join(where)) if where else ""

        sql = f"""
          WITH base AS (
            SELECT
              ro.uuid  AS id,
              ro.name  AS title,
              ro.journal_name AS journal,
              ro.publication_year AS year,
              COALESCE(ro.num_citations,0) AS citations,
              COALESCE(ro.abstract,'')     AS abstract,
              ro.link_to_paper AS link_to_paper
            FROM OIResearchOutputs ro
            {tag_join}
            {where_sql}
          )
          SELECT *, COUNT(*) OVER() AS total
          FROM base
          ORDER BY (year IS NULL), year DESC, title
          LIMIT ? OFFSET ?;
        """
        rows = conn.execute(sql, (*params, per_page, (page-1)*per_page)).fetchall()
        total = rows[0]["total"] if rows else 0
        ro_ids = [r["id"] for r in rows]

        # authors & keywords only for the current page
        authors_map, kw_map = {}, {}
        if ro_ids:
            qmarks = ",".join(["?"] * len(ro_ids))
            for a in conn.execute(f"""
              SELECT c.ro_uuid AS rid, COALESCE(m.name, c.researcher_uuid) AS name
              FROM OIResearchOutputsCollaborators c
              LEFT JOIN OIMembers m ON m.uuid = c.researcher_uuid
              WHERE c.ro_uuid IN ({qmarks})
              ORDER BY name COLLATE NOCASE
            """, ro_ids):
                authors_map.setdefault(a["rid"], []).append(a["name"])

            for k in conn.execute(f"""
              SELECT ro_uuid AS rid, name AS kw
              FROM OIResearchOutputTags
              WHERE ro_uuid IN ({qmarks})
              ORDER BY kw COLLATE NOCASE
            """, ro_ids):
                kw_map.setdefault(k["rid"], []).append(k["kw"])

        items = [{
            "id": r["id"],
            "title": r["title"] or "Untitled",
            "type": "Research Output",
            "authors": authors_map.get(r["id"], []),
            "journal": r["journal"] or "",
            "year": r["year"],
            "citations": int(r["citations"] or 0),
            "abstract": r["abstract"] or "",
            "keywords": kw_map.get(r["id"], []),
            "grantFunding": "",   # can be added via joins if needed
            "link_to_paper": r["link_to_paper"],
          } for r in rows]

        return jsonify({"items": items, "total": total, "page": page, "per_page": per_page})

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

@app.route("/api/researchers/<rid>/awards")
def awards_for_researcher(rid: str):
    """
    Return all prizes/awards for a specific researcher in a grants-like shape.
    Array return (not wrapped), to mirror /grants.
    """
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT
              p.uuid  AS id,
              p.title AS title,
              p.first_description              AS description,
              p.first_granting_organization_name AS organization,
              p.degree_of_recognition          AS recognition,
              p.year, p.month, p.day
            FROM OIPrizes p
            JOIN OIMembersToPrizes mp ON mp.prize_uuid = p.uuid
            WHERE mp.re_uuid = ?
            ORDER BY p.year DESC, p.month DESC, p.day DESC, p.rowid DESC
        """, (rid,)).fetchall()

        def iso_date(y, m, d):
            # year is required in schema; month/day optional
            try:
                y = int(y) if y is not None else None
                m = int(m) if m is not None else None
                d = int(d) if d is not None else None
            except Exception:
                y = m = d = None
            if not y:
                return None
            if m and d:
                return f"{y:04d}-{m:02d}-{d:02d}"
            if m:
                return f"{y:04d}-{m:02d}-01"
            return f"{y:04d}-01-01"

        return jsonify([
            {
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "organization": r["organization"],
                "recognition": r["recognition"],
                "date": iso_date(r["year"], r["month"], r["day"]),
                "year": r["year"],
                "month": r["month"],
                "day": r["day"],
            }
            for r in rows
        ])

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
        LIMIT 50;
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



@app.get("/api/researchers/<rid>/outcomes")
def outcomes_for_researcher(rid: string):
    """
    Paginated research outputs for a single researcher.
    Query params:
      - page: 1-based page number (default 1)
      - per_page: items per page (default 25, max 100)
      - order: 'year-desc' (default) | 'year-asc' | 'title'
    Response: { items: [...], total: int, page: int, per_page: int }
    """
    try:
        page = max(int(request.args.get("page", 1) or 1), 1)
    except ValueError:
        page = 1

    try:
        per_page = min(max(int(request.args.get("per_page", 25) or 25), 1), 100)
    except ValueError:
        per_page = 25

    order = (request.args.get("order", "year-desc") or "year-desc").lower()
    if order == "year-asc":
        order_by = " (ro.publication_year IS NULL) ASC, ro.publication_year ASC, ro.rowid ASC "
    elif order == "title":
        order_by = " LOWER(COALESCE(ro.name, '')) ASC, ro.rowid DESC "
    else:
        # default: newest first, then stable by rowid
        order_by = " (ro.publication_year IS NULL) ASC, ro.publication_year DESC, ro.rowid DESC "

    offset = (page - 1) * per_page

    with get_db() as conn:
        # total distinct outputs for this researcher
        total = conn.execute(
            """
            SELECT COUNT(DISTINCT ro.uuid) AS c
            FROM OIResearchOutputs ro
            JOIN OIResearchOutputsCollaborators c ON c.ro_uuid = ro.uuid
            WHERE c.researcher_uuid = ?
            """,
            (rid,),
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT DISTINCT
              ro.uuid                         AS id,
              COALESCE(ro.name, '')           AS title,
              COALESCE(ro.journal_name, '')   AS journal,
              ro.publication_year             AS year,
              NULL                            AS url   -- fill if you have doi/url columns
            FROM OIResearchOutputs ro
            JOIN OIResearchOutputsCollaborators c ON c.ro_uuid = ro.uuid
            WHERE c.researcher_uuid = ?
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
            """,
            (rid, per_page, offset),
        ).fetchall()

        items = []
        # Optional: attach authors for each output (so UI can show chips)
        for r in rows:
            authors = conn.execute(
                """
                SELECT
                  m.uuid AS id,
                  COALESCE(m.name, '') AS name
                FROM OIResearchOutputsCollaborators cc
                LEFT JOIN OIMembers m ON m.uuid = cc.researcher_uuid
                WHERE cc.ro_uuid = ?
                ORDER BY LOWER(COALESCE(m.name, '')) ASC
                """,
                (r["id"],),
            ).fetchall()

            items.append({
                "id": r["id"],
                "title": r["title"],
                "journal": r["journal"],
                "year": r["year"],
                "url": r["url"],
                "authors": [dict(a) for a in authors],
                # keep a minimal, stable shape your UI expects
                "keywords": [],  # add if/when you have them
                "type": None,
            })

        return jsonify({
            "items": items,
            "total": int(total or 0),
            "page": page,
            "per_page": per_page,
        })

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

