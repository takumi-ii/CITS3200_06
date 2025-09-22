# Simple Flask server to serve a Vite/React build from ./build on localhost.

from __future__ import annotations
import os
from pathlib import Path
from flask import Flask, send_from_directory, Response, request, jsonify
import json
import sqlite3
import requests
from urllib.parse import urlencode
import re

try:
    # Optional: load environment variables from .env if present
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# -------------------- DB helpers --------------------
DB_PATH = "data.db"

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

    # Build grants map keyed by ro_name (if column/table exists); degrade gracefully otherwise
    grants_by_output = {}
    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='OIResearchGrants'")
        if cursor.fetchone():
            # Check for ro_name column
            cursor.execute("PRAGMA table_info('OIResearchGrants')")
            cols = {row[1] for row in cursor.fetchall()}
            if 'ro_name' in cols:
                cursor.execute(
                    """
                    SELECT ro_name, grant_name, start_date, end_date, funding, institute, school
                    FROM OIResearchGrants
                    """
                )
                for ro_name, grant_name, start_date, end_date, funding, institute, school in cursor.fetchall():
                    grants_by_output.setdefault(ro_name, []).append({
                        "grant_name": grant_name,
                        "start_date": start_date,
                        "end_date": end_date,
                        "funding": funding,
                        "institute": institute,
                        "school": school,
                    })
    except sqlite3.Error as e:
        app.logger.warning(f"/api/oiresearchoutputs grants fallback: {e}")
    conn.close()

    # (grants_by_output may be empty if no table/column)

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

@app.route("/api/researchers")
def api_researchers():
    TEST_RESEARCHER = {
        "id": "test-researcher-1",
        "name": "Test Researcher",
        "title": "Test Title",
        "department": "Test Department",
        "expertise": ["Test Expertise"],
        "publications": 1,
        "grants": 0,
        "collaborations": 0,
        "location": "Perth, Australia",
        "bio": "This is a TEST researcher returned because the database is empty or unavailable.",
        "recentPublications": [
            {"title": "Test Publication", "year": 2024, "journal": "Test Journal"}
        ],
    }

    sql = """
      SELECT
        m.uuid,
        m.name,
        m.education,
        m.bio,
        GROUP_CONCAT(e.field, '||') AS expertise_concat,
        COALESCE(pub.cnt, 0) AS publications
      FROM OIMembers m
      LEFT JOIN OIExpertise e
        ON e.researcher_uuid = m.uuid
      LEFT JOIN (
        SELECT researcher_uuid, COUNT(*) AS cnt
        FROM OIResearchOutputs
        GROUP BY researcher_uuid
      ) AS pub
        ON pub.researcher_uuid = m.uuid
      GROUP BY m.uuid, m.name, m.education, m.bio, pub.cnt
      ORDER BY m.name;
    """

    try:
        with get_db() as conn:
            rows = conn.execute(sql).fetchall()
    except sqlite3.Error as err:
        app.logger.warning(f"/api/researchers DB error: {err}")
        rows = []

    if not rows:
        return {"researchers": [TEST_RESEARCHER]}

    data = []
    for r in rows:
        expertise = (r["expertise_concat"] or "").split("||") if r["expertise_concat"] else []
        recent = recent_outputs_for(r["uuid"], limit=2)
        item = {
            "id": r["uuid"],
            "name": r["name"],
            "title": "",
            "department": "",
            "expertise": expertise,
            "publications": r["publications"],
            "grants": 0,
            "collaborations": 0,
            "location": "Perth, Australia",
            "bio": r["bio"],
        }
        if recent:
            item["recentPublications"] = recent
        data.append(item)
    return {"researchers": data}

@app.route("/api/researchOutcomes")
def api_research_outcomes():
    TEST_OUTCOME = {
        "id": "test-output-1",
        "title": "Test Publication",
        "type": "Research Article (TEST)",
        "authors": ["Test Researcher"],
        "journal": "Test Journal",
        "year": 2024,
        "citations": 0,
        "abstract": "This is a TEST outcome returned because the database is empty or unavailable.",
        "keywords": ["Test"],
        "grantFunding": "",
    }

    sql = """
      SELECT
        ro.uuid            AS id,
        ro.researcher_uuid AS researcher_uuid,
        ro.name            AS title,
        ro.publisher_name  AS journal,
        m.name             AS author_name
      FROM OIResearchOutputs ro
        LEFT JOIN OIMembers m
          ON m.uuid = ro.researcher_uuid
      ORDER BY ro.rowid DESC;
    """

    try:
        with get_db() as conn:
            rows = conn.execute(sql).fetchall()
    except sqlite3.Error as err:
        app.logger.warning(f"/api/researchOutcomes DB error: {err}")
        rows = []

    if not rows:
        return {"outcomes": [TEST_OUTCOME]}

    outcomes = []
    cache = _maybe_load_ro_authors()
    for r in rows:
        title_val = r["title"] or "Untitled"
        authors_list: list[str] = []
        if r["author_name"]:
            authors_list = [r["author_name"]]
        else:
            # Fallback via JSON index
            aid = str(r["id"])
            if aid in cache.get("authors_by_id", {}):
                authors_list = cache["authors_by_id"][aid]
            else:
                ntitle = _norm(title_val)
                authors_list = cache.get("authors_by_title", {}).get(ntitle, [])

        outcomes.append({
            "id": r["id"],
            "researcher_uuid": r["researcher_uuid"],
            "title": title_val,
            "type": "Research Output",
            "authors": authors_list,
            "journal": r["journal"] or "",
            "year": None,
            "citations": 0,
            "abstract": "",
            "keywords": [],
            "grantFunding": "",
        })
    return {"outcomes": outcomes}

# ---------------------------------------------------------------------------
# Lightweight authors lookup using a large PURE export (research_outputs.json)
# Usage: /api/ro-authors?ids=uuid1,uuid2
# Returns: { "authors_by_id": { uuid: ["Name A", "Name B"], ... } }
# The file is read once, cached in memory, and the root copy is deleted after
# successful indexing as requested by the user.
# ---------------------------------------------------------------------------

_RO_AUTHORS_CACHE: dict | None = None  # {'authors_by_id': {uuid: [names]}, 'outputs_by_author': {key: [pub...]}, 'authors_by_title': {ntitle: [names]}}

def _norm(s: str) -> str:
    import re
    s = (s or "").strip().lower()
    # keep letters, numbers and spaces
    s = re.sub(r"[^a-z0-9\s]", "", s)
    # collapse spaces
    s = re.sub(r"\s+", " ", s)
    return s

def _maybe_load_ro_authors() -> dict[str, list[str]]:
    global _RO_AUTHORS_CACHE
    if _RO_AUTHORS_CACHE is not None:
        return _RO_AUTHORS_CACHE

    candidates = [
        Path("research_outputs.json"),
        Path("db/research_outputs.json"),
    ]
    file_path: Path | None = None
    for p in candidates:
        if p.exists():
            file_path = p
            break
    cache: dict = {"authors_by_id": {}, "outputs_by_author": {}, "authors_by_title": {}}
    if file_path:
        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            # Support either a raw list or a wrapped object containing the list
            items: list = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                # Heuristics: common keys that hold the list
                for k in [
                    "items", "results", "research_outputs", "outputs",
                    "data", "records", "content", "publications"
                ]:
                    v = data.get(k)
                    if isinstance(v, list):
                        items = v
                        break
                # Last resort: scan dict values for a list of dicts with personAssociations/title
                if not items:
                    for v in data.values():
                        if isinstance(v, list) and v and isinstance(v[0], dict):
                            if any("personAssociations" in vv or "title" in vv for vv in v):
                                items = v
                                break

            # The export list contains outputs; authors are under
            # personAssociations[*].personRole.term.text[].value == "Author"
            for item in items:
                rid = str(item.get("uuid") or item.get("id") or "").strip()
                if not rid:
                    continue
                # title
                title_val = ""
                t = item.get("title")
                if isinstance(t, dict):
                    title_val = t.get("value") or ""
                elif isinstance(t, str):
                    title_val = t
                # year
                year = None
                for ps in (item.get("publicationStatuses") or []):
                    pd = ps.get("publicationDate") or {}
                    if isinstance(pd, dict) and "year" in pd:
                        year = pd.get("year")
                        break
                # journal
                j = item.get("journalAssociation") or {}
                jtitle = j.get("title") or {}
                journal = jtitle.get("value") if isinstance(jtitle, dict) else ""

                authors: list[str] = []
                for pa in item.get("personAssociations", []) or []:
                    role = (((pa.get("personRole") or {}).get("term") or {}).get("text") or [{}])[0].get("value") if isinstance(((pa.get("personRole") or {}).get("term") or {}).get("text"), list) else None
                    if (role or "").lower() != "author":
                        continue
                    name = (pa.get("name") or {}).get("lastName") or (((pa.get("person") or {}).get("name") or {}).get("text") or [{}])[0].get("value")
                    first = (pa.get("name") or {}).get("firstName")
                    if first and name:
                        full = f"{first} {name}".strip()
                    else:
                        full = str(name or "").strip()
                    if full:
                        authors.append(full)
                        # index by normalized author name
                        key = _norm(full)
                        cache["outputs_by_author"].setdefault(key, []).append({
                            "title": title_val or "Untitled",
                            "year": year,
                            "journal": journal or "",
                        })
                if authors:
                    cache["authors_by_id"][rid] = authors
                    if title_val:
                        cache["authors_by_title"][_norm(title_val)] = authors
        except Exception as err:
            app.logger.warning(f"Failed to index research_outputs.json: {err}")
        else:
            # Optionally remove the root-level file after indexing (commented out to avoid surprises)
            try:
                root_file = Path("research_outputs.json")
                if root_file.exists():
                    pass
            except Exception:
                pass

    _RO_AUTHORS_CACHE = cache
    return cache

@app.route("/api/ro-authors")
def api_ro_authors():
    ids_param = (request.args.get("ids") or "").strip()
    ids = [s for s in ids_param.split(",") if s][:100]  # safety cap
    cache = _maybe_load_ro_authors()
    if not ids:
        # Return nothing by default to avoid sending a huge payload
        return jsonify({"authors_by_id": {}})
    out: dict[str, list[str]] = {}
    # 1) Use cache if present
    if cache.get("authors_by_id"):
        for rid in ids:
            if rid in cache["authors_by_id"]:
                out[rid] = cache["authors_by_id"][rid]
    # 2) Fallback to DB for any remaining IDs
    remaining = [rid for rid in ids if rid not in out]
    if remaining:
        qmarks = ",".join(["?"] * len(remaining))
        sql = f"""
          SELECT ro.uuid, m.name
          FROM OIResearchOutputs ro
          LEFT JOIN OIMembers m ON m.uuid = ro.researcher_uuid
          WHERE ro.uuid IN ({qmarks})
        """
        try:
            with get_db() as conn:
                rows = conn.execute(sql, remaining).fetchall()
            for r in rows:
                if r["uuid"] and r["name"]:
                    out.setdefault(r["uuid"], []).append(r["name"])
        except sqlite3.Error as err:
            app.logger.warning(f"/api/ro-authors fallback DB error: {err}")
    return jsonify({"authors_by_id": out})

@app.route("/api/ro-by-author")
def api_ro_by_author():
    name = (request.args.get("name") or "").strip()
    if not name:
        return jsonify({"publications": []})
    # 1) Try cache indexed from research_outputs.json
    cache = _maybe_load_ro_authors()
    key = _norm(name)
    pubs = cache.get("outputs_by_author", {}).get(key, [])[:5]
    if pubs:
        return jsonify({"publications": pubs})
    # 2) Fallback to DB by exact author match
    try:
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT ro.name AS title, ro.publisher_name AS journal
                FROM OIResearchOutputs ro
                LEFT JOIN OIMembers m ON m.uuid = ro.researcher_uuid
                WHERE LOWER(m.name) = LOWER(?)
                ORDER BY ro.rowid DESC
                LIMIT 5
                """,
                (name,),
            ).fetchall()
        pubs_db = [{"title": r["title"] or "Untitled", "journal": r["journal"] or "", "year": None} for r in rows]
        return jsonify({"publications": pubs_db})
    except sqlite3.Error as err:
        app.logger.warning(f"/api/ro-by-author fallback DB error: {err}")
        return jsonify({"publications": []})

@app.route("/api/ro-authors-by-title")
def api_ro_authors_by_title():
    titles_param = (request.args.get("titles") or "").strip()
    if not titles_param:
        return jsonify({"authors_by_title": {}})
    # Titles are joined by '|' to preserve commas within titles
    titles = [t for t in titles_param.split("|") if t][:100]
    cache = _maybe_load_ro_authors()
    out: dict[str, list[str]] = {}
    by_title = cache.get("authors_by_title", {})
    for t in titles:
        key = _norm(t)
        if key in by_title:
            out[t] = by_title[key]
    return jsonify({"authors_by_title": out})

@app.route("/api/ro-status")
def api_ro_status():
    cache = _maybe_load_ro_authors()
    c_id = len(cache.get("authors_by_id", {}))
    c_title = len(cache.get("authors_by_title", {}))
    c_author = len(cache.get("outputs_by_author", {}))
    return jsonify({
        "loaded": bool(c_id or c_title or c_author),
        "authors_by_id": c_id,
        "outputs_by_author": c_author,
        "authors_by_title": c_title,
    })

@app.route("/api/tags")
def get_tags():
    """Return all expertise tags with counts."""
    conn = sqlite3.connect('data.db')
    cur = conn.cursor()
    cur.execute("SELECT field, COUNT(1) FROM OIExpertise GROUP BY field ORDER BY COUNT(1) DESC")
    rows = cur.fetchall()
    conn.close()
    return {"tags": [{"tag": r[0], "count": r[1]} for r in rows]}

# ---------------------------------------------------------------------------
# Search endpoint with weighted ranking
# Ranking priority (highest to lowest):
#   1) Strategic research focuses (configurable via STRATEGIC_FOCUSES env, ';' separated)
#   2) Tier 1 expertise groupings (Condensed)
#   3) Tier 2 expertise groupings (Broad)
#   4) Historical top-level categories (kept for compatibility)
#   5) Member expertise fields
#   6) Member full name
# ---------------------------------------------------------------------------

STRATEGIC_FOCUSES = [s.strip().lower() for s in os.environ.get(
    "STRATEGIC_FOCUSES",
    "Climate Change;Ocean Health;Blue Economy"
).split(";") if s.strip()]

# Tier 1 (Condensed) research expertise groupings
TIER1_EXPERTISE = [
    "Archelogy and cultural heritage",
    "Conservation planning and ecosystem restoration",
    "Climate Law",
    "Environmental & resource economics and policy",
    "Environmental and human geography",
    "Environmental Fluid Mechanics",
    "Marine and spatial ecology",
    "Marine biodiversity",
    "Marine geonomics",
    "Marine geoscience",
    "Marine parks and fisheries science",
    "Maritime law and policy",
    "Nature based solutions",
    "Ocean and coastal engineering",
    "Oceanography",
]

# Tier 2 (Broad) research expertise groupings
TIER2_EXPERTISE = [
    "Archeology and heritage studies",
    "Biological or chemical oceanography",
    "Climate change",
    "Coastal engineering",
    "Coastal policy and governance",
    "Coastal processes and dynamics",
    "Conservation planning",
    "Conservation science",
    "Coral reef ecology",
    "Deep ocean systems",
    "Deep sea biology",
    "Environmental economics and social science",
    "Fish and invertebrate biology",
    "Fish stock assessment and modeling",
    "Fisheries ecology and conservation",
    "Fisheries science and management",
    "Governance and policy frameworks for sustainable fisheries",
    "Hydrography and mapping",
    "Indigenous knowledge",
    "Integrated coastal zone management",
    "Literature and arts of the sea",
    "Marine biology",
    "Marine biotechnology/pharmacology",
    "Marine ecology and biodiversity",
    "Marine genomics",
    "Marine geology and geophysics",
    "Marine geohazards",
    "Marine microbiology",
    "Marine sedimentology",
    "Marine social impact assessment",
    "Marine spatial planning",
    "Maritime history",
    "Maritime law",
    "Maritime governance and policy",
    "Megafauna",
    "Ocean atmosphere interactions",
    "Ocean circulation and currents",
    "Ocean health and conservation",
    "Offshore geotechnical engineering",
    "Offshore renewable energy",
    "Onshore renewable energy",
    "Physical Oceanography",
    "Pollution and contaminants",
    "Restoration science",
    "Robotics and autonomous systems",
    "Science communication",
]

# Keep legacy categories for compatibility with previous data
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
    """
    Compute a score using two signals:
      A) Query intent vs configured categories/focuses (high weight)
      B) Textual presence in the record (lower weight)

    This prioritises results when the query itself matches Tier 1/2 or Strategic Focus.
    """
    score = 0
    ql = [t.lower() for t in query_terms if t]
    q_phrase = " ".join(ql).strip()
    joined = "\n".join(texts).lower()

    def _phrase_match(query_l: str, phrase: str) -> bool:
        pl = phrase.lower()
        return bool(query_l) and (pl in query_l or query_l in pl)

    # A) Query intent vs groupings
    if any(_phrase_match(q_phrase, focus) for focus in STRATEGIC_FOCUSES):
        score += 6
    if any(_phrase_match(q_phrase, tag) for tag in TIER1_EXPERTISE):
        score += 5
    if any(_phrase_match(q_phrase, tag) for tag in TIER2_EXPERTISE):
        score += 4
    if any(_phrase_match(q_phrase, cat) for cat in TOP_LEVEL_CATEGORIES):
        score += 3

    # B) Textual presence within the record
    if q_phrase and q_phrase in joined:
        score += 2
    for t in ql:
        if t and t in joined:
            score += 1
    # Presence of groupings in the text (legacy boost)
    if any(focus in joined for focus in [f.lower() for f in STRATEGIC_FOCUSES]):
        score += 1
    if any(tag.lower() in joined for tag in TIER1_EXPERTISE):
        score += 1
    if any(tag.lower() in joined for tag in TIER2_EXPERTISE):
        score += 1
    if any(cat.lower() in joined for cat in TOP_LEVEL_CATEGORIES):
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

    # Fetch members and their expertise
    cur.execute(
        """
        SELECT m.uuid, m.name, m.email, m.education, m.bio, m.phone,
               GROUP_CONCAT(e.field, '\u001F') as expertise_concat
        FROM OIMembers m
        LEFT JOIN OIExpertise e ON e.researcher_uuid = m.uuid
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

    # Research outputs (include author name and expertise to improve matching)
    cur.execute(
        """
        SELECT
          ro.uuid,
          ro.researcher_uuid,
          ro.publisher_name,
          ro.name,
          m.name AS author_name,
          GROUP_CONCAT(e.field, '\u001F') AS expertise_concat
        FROM OIResearchOutputs ro
        LEFT JOIN OIMembers m
          ON m.uuid = ro.researcher_uuid
        LEFT JOIN OIExpertise e
          ON e.researcher_uuid = ro.researcher_uuid
        GROUP BY ro.uuid, ro.researcher_uuid, ro.publisher_name, ro.name, m.name
        """
    )
    outputs_rows = cur.fetchall()
    conn.close()

    research_outputs: list[dict] = []
    cache = _maybe_load_ro_authors()
    for row in outputs_rows:
        uuid, researcher_uuid, publisher_name, name, author_name, expertise_concat = row
        expertise_list = (expertise_concat or "").split("\u001F") if expertise_concat else []

        score = _compute_score([
            publisher_name or "",
            name or "",
            author_name or "",
            " ".join(expertise_list),
        ], terms)

        name_l = (name or "").lower()
        author_l = (author_name or "").lower()
        expertise_joined_l = " ".join([e.lower() for e in expertise_list])

        if any(t.lower() in name_l for t in terms):
            score += 1
        if any(t.lower() in author_l for t in terms):
            score += 1
        if any(t.lower() in expertise_joined_l for t in terms):
            score += 1

        if score > 0:
            # add authors via cache/title if not present
            authors_list: list[str] = []
            if author_name:
                authors_list = [author_name]
            else:
                aid = str(uuid)
                if aid in cache.get("authors_by_id", {}):
                    authors_list = cache["authors_by_id"][aid]
                else:
                    authors_list = cache.get("authors_by_title", {}).get(_norm(name or ""), [])

            research_outputs.append({
                "uuid": uuid,
                "researcher_uuid": researcher_uuid,
                "publisher_name": publisher_name,
                "name": name,
                "score": score,
                "authors": authors_list,
            })

    members.sort(key=lambda m: m["score"], reverse=True)
    research_outputs.sort(key=lambda r: r["score"], reverse=True)
    return jsonify({"members": members, "research_outputs": research_outputs})

# ---------------------------------------------------------------------------
# Expertise groupings endpoint for frontend use
# ---------------------------------------------------------------------------

@app.route("/api/expertise-groups")
def api_expertise_groups():
    return jsonify({
        "tier1": TIER1_EXPERTISE,
        "tier2": TIER2_EXPERTISE,
    })

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

# ------------------ UWA Repository portraits ------------------
_PROFILE_PHOTO_CACHE: dict[str, str] = {}

def _slugify_name(name: str) -> str:
    s = (name or "").strip().lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s

@app.route("/api/profile-photo")
def api_profile_photo():
    """Return a public portrait URL from the UWA repository for a researcher name.

    Query: name=Full Name
    Response: { "photo_url": "https://research-repository.uwa.edu.au/files-asset/.../Name_img?..." }
    """
    name = (request.args.get("name") or "").strip()
    if not name:
        return jsonify({"photo_url": ""})

    if name in _PROFILE_PHOTO_CACHE:
        return jsonify({"photo_url": _PROFILE_PHOTO_CACHE[name]})

    slug = _slugify_name(name)
    if not slug:
        return jsonify({"photo_url": ""})

    base = "https://research-repository.uwa.edu.au"
    url = f"{base}/en/persons/{slug}"
    try:
        resp = requests.get(url, timeout=15)
        html = resp.text
    except requests.RequestException as err:
        app.logger.warning(f"profile-photo fetch failed for {name}: {err}")
        return jsonify({"photo_url": ""})

    # Look for files-asset path ending with _img
    match = re.search(r"(\/files-asset\/[\w\-\/]+?_img[^'\"\s>]*)", html)
    photo_url = ""
    if match:
        src = match.group(1)
        # Ensure we request a small, square image if sizing params are supported
        if "?" in src:
            if "w=" not in src:
                src += ("&" if "?" in src else "?") + "w=160"
            if "h=" not in src:
                src += "&h=160"
        else:
            src += "?w=160&h=160"
        photo_url = base + src

    _PROFILE_PHOTO_CACHE[name] = photo_url
    return jsonify({"photo_url": photo_url})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
else:
    # When imported (e.g., by a WSGI server), register the SPA route last so API routes win
    pass

# Register SPA catch-all LAST so it doesn't shadow /api/* routes
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path: str):
    target = BUILD_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, "index.html")