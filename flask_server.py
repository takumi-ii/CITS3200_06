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
        data.append({
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
            "recentPublications": recent or [{"title": "Test Publication", "year": 2024, "journal": "Test Journal"}],
        })
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
        ro.uuid           AS id,
        ro.name           AS title,
        ro.publisher_name AS journal,
        m.name            AS author_name
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
    for r in rows:
        outcomes.append({
            "id": r["id"],
            "title": r["title"] or "Untitled",
            "type": "Research Output",
            "authors": [r["author_name"]] if r["author_name"] else [],
            "journal": r["journal"] or "",
            "year": None,
            "citations": 0,
            "abstract": "",
            "keywords": [],
            "grantFunding": "",
        })
    return {"outcomes": outcomes}

@app.route("/api/tags")
def get_tags():
    """Return all expertise tags with counts."""
    conn = sqlite3.connect('data.db')
    cur = conn.cursor()
    cur.execute("SELECT field, COUNT(1) FROM OIExpertise GROUP BY field ORDER BY COUNT(1) DESC")
    rows = cur.fetchall()
    conn.close()
    return {"tags": [{"tag": r[0], "count": r[1]} for r in rows]}

# Register SPA catch-all LAST so it doesn't shadow /api/* routes
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path: str):
    target = BUILD_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, "index.html")

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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
else:
    # When imported (e.g., by a WSGI server), register the SPA route last so API routes win
    pass

