# file: pure_quicktest.py
import os, sys, textwrap
from urllib.parse import urlencode
import requests
from dotenv import load_dotenv

load_dotenv()

BASE = os.getenv("PURE_API_BASE", "").rstrip("/")
API_KEY = os.getenv("PURE_API_KEY", "")

if not BASE or not API_KEY:
    print("Missing PURE_API_BASE or PURE_API_KEY in environment.")
    sys.exit(1)

# Choose header or query auth. Header is recommended by the docs.
HEADERS = {"api-key": API_KEY, "Accept": "application/json"}
USE_QUERY_PARAM = False  # set True if you must use ?apiKey=

ENDPOINTS = {
    "applications": "/applications",
    "awards": "/awards",
    "keyword-configurations": "/keyword-configurations",
    "organisational-units": "/organisational-units",
    "persons": "/persons",
    "projects": "/projects",
    "research-outputs": "/research-outputs",
}

def get(url, params=None):
    params = params or {}
    if USE_QUERY_PARAM:
        params = dict(params, apiKey=API_KEY)
        return requests.get(url, params=params, headers={"Accept": "application/json", }, timeout=30)
    return requests.get(url, params=params, headers=HEADERS, timeout=30)


def main():
    print(f"Base: {BASE}")
    print(f"Auth: {'Header api-key' if not USE_QUERY_PARAM else 'Query ?apiKey='}")
    print("-" * 60)
    results = []
    print(get(f"{BASE}/applications").json())

if __name__ == "__main__":
    main()
