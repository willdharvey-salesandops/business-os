"""
Fetch a cover image for a blog article.
Searches Unsplash first, falls back to Pexels.

Usage:
    python fetch_cover_image.py --query "delegation team building"
    python fetch_cover_image.py --query "sales systems" --source pexels

Returns the image URL to stdout.

Required env vars (from root .env):
    UNSPLASH_ACCESS_KEY (primary)
    PEXELS_API_KEY (fallback)
"""

import argparse
import os
import sys
from pathlib import Path

# Load .env from workspace root
ROOT = Path(__file__).resolve().parents[4]
ENV_PATH = ROOT / '.env'

if ENV_PATH.exists():
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                os.environ.setdefault(key.strip(), value.strip())

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. Install with: pip install requests")
    sys.exit(1)

UNSPLASH_KEY = os.environ.get('UNSPLASH_ACCESS_KEY', '')
PEXELS_KEY = os.environ.get('PEXELS_API_KEY', '')


def search_unsplash(query):
    """Search Unsplash for a landscape photo matching the query."""
    if not UNSPLASH_KEY:
        return None

    resp = requests.get(
        'https://api.unsplash.com/search/photos',
        params={
            'query': query,
            'orientation': 'landscape',
            'per_page': 5
        },
        headers={'Authorization': f'Client-ID {UNSPLASH_KEY}'},
        timeout=10
    )

    if resp.status_code != 200:
        return None

    results = resp.json().get('results', [])
    if not results:
        return None

    photo = results[0]
    url = photo['urls']['regular']

    # Append attribution source per Unsplash TOS
    if '?' in url:
        url += '&utm_source=leadership_growth_consulting&utm_medium=referral'
    else:
        url += '?utm_source=leadership_growth_consulting&utm_medium=referral'

    return url


def search_pexels(query):
    """Search Pexels for a landscape photo matching the query."""
    if not PEXELS_KEY:
        return None

    resp = requests.get(
        'https://api.pexels.com/v1/search',
        params={
            'query': query,
            'orientation': 'landscape',
            'per_page': 5
        },
        headers={'Authorization': PEXELS_KEY},
        timeout=10
    )

    if resp.status_code != 200:
        return None

    photos = resp.json().get('photos', [])
    if not photos:
        return None

    return photos[0]['src']['large']


def main():
    parser = argparse.ArgumentParser(description='Fetch a cover image for a blog article')
    parser.add_argument('--query', required=True, help='Search terms (e.g. "delegation team building")')
    parser.add_argument('--source', choices=['unsplash', 'pexels'], default='unsplash',
                        help='Image source (default: unsplash, auto-falls back to pexels)')
    args = parser.parse_args()

    url = None

    if args.source == 'unsplash':
        url = search_unsplash(args.query)
        if not url:
            url = search_pexels(args.query)
    else:
        url = search_pexels(args.query)
        if not url:
            url = search_unsplash(args.query)

    if url:
        print(url)
    else:
        print("ERROR: No image found. Check your API keys in .env", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
