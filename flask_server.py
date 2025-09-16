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
    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM OIMembers")
    rows = cursor.fetchall()
    conn.close()
    members = [
        {
            "name": row[0],
            "position": row[1],
            "expertise": row[2].split(", ") if row[2] else [],
            "email": row[3],
            "phone": row[4],
            "photo_url": row[5]
        }
        for row in rows
    ]
    return {"members": members}
    
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
