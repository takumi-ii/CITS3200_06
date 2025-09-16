# Simple Flask server to serve a Vite/React build from ./build on localhost.

from __future__ import annotations
import os
from pathlib import Path
from flask import Flask, send_from_directory, Response
import sqlite3

# -------------------- NEW: DB helpers --------------------
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
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
BUILD_DIR = (BASE_DIR / "build").resolve()

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

# Serve static files if present; otherwise fall back to index.html for SPA routing
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path: str):
    target = BUILD_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(BUILD_DIR, path)
    return send_from_directory(BUILD_DIR, "index.html")

# API Routes for data to pass Table data from the DB to the front end:
@app.route("/api/oimembers")
def get_oimembers():
    """
    Get all members from the OIMembers table.
    """
    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM OIMembers")
    rows = cursor.fetchall()
    conn.close()
    members = [
        {
            "uuid": row[0],
            "name": row[1],
            "email": row[2],
            "education": row[3],
            "bio": row[4],
            "phone": row[5]
        }
        for row in rows
    ]
    return {"members": members}

@app.route("/api/oiexpertise")
def get_oiexpertise():
    """
    Get all expertise entries from the OIExpertise table.
    """
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
    Get all research outputs from the OIResearchOutputs table.
    """
    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM OIResearchOutputs")
    rows = cursor.fetchall()
    conn.close()
    research_outputs = [
        {
            "uuid": row[0],
            "researcher_uuid": row[1],
            "publisher_name": row[2],
            "name": row[3]
        }
        for row in rows
    ]
    return {"research_outputs": research_outputs}
    
# -------------------- NEW: front-end-ready shape --------------------
@app.route("/api/researchers")
def api_researchers():
    """
    Returns objects shaped like your mockResearchers:
    {
      id, name, title, department, expertise[], publications, grants,
      collaborations, location, bio, recentPublications[{title, year, journal}]
    }
    """
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

    with get_db() as conn:
        rows = conn.execute(sql).fetchall()

    data = []
    for r in rows:
        expertise = (r["expertise_concat"] or "").split("||") if r["expertise_concat"] else []
        recent = recent_outputs_for(r["uuid"], limit=2)

        data.append({
            "id": r["uuid"],
            "name": r["name"],
            "title": "",                # add column/table later if you have it
            "department": "",           # add column/table later if you have it
            "expertise": expertise,
            "publications": r["publications"],
            "grants": 0,                # join a grants table later
            "collaborations": 0,        # join a collaborations table later
            "location": "Perth, Australia",
            "bio": r["bio"],
            "recentPublications": recent,
        })

    return {"researchers": data}
# --------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
