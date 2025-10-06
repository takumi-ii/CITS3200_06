import os
import time
import json
import requests
from typing import List, Tuple
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
API_KEY = os.getenv("API_KEY1")

if not API_KEY:
    raise RuntimeError("API key is missing. Please check your .env file.")

# Base URL for research repository API
BASE_URL = "https://api.research-repository.uwa.edu.au/ws/api/524/"
UWAOI_UUID = ""


# Configure session with headers
session = requests.Session()
session.headers.update({"Accept": "application/json", "api-key": API_KEY, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"})

PAGE_SIZE = 1000  # Pure default is 10; use a big but safe window


def fetch_page(url: str, page_num: int) -> dict:
    """Fetch a single page of results, handling rate limiting and errors."""
    full_url = f"{url}?pageSize={PAGE_SIZE}&page={page_num}"
    print(f"Fetching: {full_url}")
    resp = session.get(full_url, timeout=60)

    if resp.status_code == 429:  # Handle rate limiting
        retry_after = int(resp.headers.get("Retry-After", "2"))
        print(f"Rate limited (429). Sleeping {retry_after}s…")
        time.sleep(retry_after)
        resp = session.get(full_url, timeout=60)

    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]} [Full URL: {full_url}, Headers: {resp.request.headers}]")

    try:
        return resp.json()
    except ValueError as e:
        raise RuntimeError(f"Invalid JSON response: {resp.text[:200]}") from e


def fetch_and_save(endpoints: List[Tuple[str, str]]) -> None:
    """
    Fetch paginated results from multiple API endpoints and save to JSON files.

    Args:
        endpoints: A list of (endpoint_suffix, output_filename) tuples.
    """
    for endpoint_suffix, output_file in endpoints:
        print(f"\n=== Processing endpoint '{endpoint_suffix}' -> {output_file} ===")

        url = f"{BASE_URL}/{endpoint_suffix}"
        all_items = []
        page = 1
        maybe_total = None

        while True:
            body = fetch_page(url, page)

            # Record total if present
            if maybe_total is None:
                for key in ("count", "total", "totalElements", "totalCount"):
                    if isinstance(body.get(key), int):
                        maybe_total = body[key]
                        print(f"Total reported (best-effort): {maybe_total}")
                        break

            items = body.get("items") or []
            print(f"Page {page} returned {len(items)} items.")
            if not items:
                print("No items returned; stopping.")
                break

            all_items.extend(items)

            # Stop conditions
            if len(items) < PAGE_SIZE:
                print("Last page reached (fewer than pageSize items).")
                break
            if isinstance(maybe_total, int) and len(all_items) >= maybe_total:
                print("Collected all items according to reported total.")
                break

            page += 1

        # Save results to JSON file
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(all_items, f, indent=2, ensure_ascii=False)

        print(f"✅ Saved {len(all_items)} records to {output_file}")


# Example usage
if __name__ == "__main__":
    endpoints_to_fetch = [
        ("organisational-units/b3a31a78-ac4b-46f0-91e0-89423a64aea6/prizes", "OIPrizes.json"),
        ("organisational-units/b3a31a78-ac4b-46f0-91e0-89423a64aea6/projects", "OIProjects.json"),
        ("organisational-units/b3a31a78-ac4b-46f0-91e0-89423a64aea6/research-outputs", "OIResearchOutputs.json"),
        ("organisational-units/b3a31a78-ac4b-46f0-91e0-89423a64aea6/persons", "OIPersons.json"),
        ("organisational-units/b3a31a78-ac4b-46f0-91e0-89423a64aea6/awards", "OIAwards.json"),
        ("concepts", "ALLConcepts.json")
        
    ]
    fetch_and_save(endpoints_to_fetch)
