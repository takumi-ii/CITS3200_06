# Simple Flask server to serve a Vite/React build from ./build on localhost.

from __future__ import annotations
import os
from pathlib import Path
from flask import Flask, send_from_directory, Response
import sqlite3

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
    
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
