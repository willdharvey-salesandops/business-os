"""
Publish an article to the blog via Supabase.
Used by Claude Code content agents to publish articles programmatically.

Usage:
    python publish_article.py --title "My Article" --content content.md --category "Systems"

    Or pass content inline:
    python publish_article.py --title "My Article" --content-text "# Hello\n\nArticle body here" --category "AI"

Required env vars (from root .env):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Load .env from workspace root
ROOT = Path(__file__).resolve().parents[4]  # .claude/skills/blog-publishing/scripts/ -> root
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

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def slugify(title):
    """Convert title to URL-friendly slug."""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def publish(title, content, category='General', excerpt=None, meta_description=None,
            meta_keywords=None, faqs=None, read_time=None, cover_image_url=None,
            author='Will Harvey', published=True):
    """Publish an article to Supabase."""

    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    slug = slugify(title)

    # Estimate read time if not provided
    if not read_time:
        word_count = len(content.split())
        minutes = max(1, round(word_count / 230))
        read_time = f"{minutes} min read"

    # Auto-generate excerpt from content if not provided
    if not excerpt:
        plain = re.sub(r'[#*_\[\]()>`]', '', content)
        plain = re.sub(r'\n+', ' ', plain).strip()
        excerpt = plain[:160].rsplit(' ', 1)[0] + '...' if len(plain) > 160 else plain

    body = {
        'title': title,
        'slug': slug,
        'content': content,
        'category': category,
        'excerpt': excerpt,
        'meta_description': meta_description or excerpt,
        'meta_keywords': meta_keywords,
        'read_time': read_time,
        'cover_image_url': cover_image_url,
        'author': author,
        'faqs': faqs or [],
        'published': published,
        'published_at': datetime.now(timezone.utc).isoformat() if published else None
    }

    headers = {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/blog_posts",
        headers=headers,
        json=body,
        timeout=15
    )

    if resp.status_code == 201:
        data = resp.json()
        post = data[0] if data else {}
        print(f"Published: {title}")
        print(f"Slug: {slug}")
        print(f"URL: https://www.leadershipgrowthconsulting.com/blog/{slug}")
        print(f"ID: {post.get('id', 'unknown')}")
        return post
    else:
        print(f"ERROR: {resp.status_code}")
        print(resp.text)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Publish an article to the blog')
    parser.add_argument('--title', required=True, help='Article title')
    parser.add_argument('--content', help='Path to markdown file with article content')
    parser.add_argument('--content-text', help='Article content as inline text (alternative to --content)')
    parser.add_argument('--category', default='General', help='Article category')
    parser.add_argument('--excerpt', help='Short summary for blog listing')
    parser.add_argument('--meta-description', help='SEO meta description')
    parser.add_argument('--meta-keywords', help='SEO keywords (comma-separated)')
    parser.add_argument('--cover-image', help='Cover image URL')
    parser.add_argument('--read-time', help='Read time (e.g. "5 min read")')
    parser.add_argument('--faqs', help='JSON string of FAQs: [{"question":"...","answer":"..."}]')
    parser.add_argument('--draft', action='store_true', help='Save as draft instead of publishing')

    args = parser.parse_args()

    # Get content
    if args.content:
        content_path = Path(args.content)
        if not content_path.exists():
            print(f"ERROR: File not found: {args.content}")
            sys.exit(1)
        content = content_path.read_text()
    elif args.content_text:
        content = args.content_text
    else:
        print("ERROR: Provide --content (file path) or --content-text (inline content)")
        sys.exit(1)

    # Parse FAQs
    faqs = None
    if args.faqs:
        try:
            faqs = json.loads(args.faqs)
        except json.JSONDecodeError:
            print("ERROR: FAQs must be valid JSON")
            sys.exit(1)

    publish(
        title=args.title,
        content=content,
        category=args.category,
        excerpt=args.excerpt,
        meta_description=args.meta_description,
        meta_keywords=args.meta_keywords,
        cover_image_url=args.cover_image,
        read_time=args.read_time,
        faqs=faqs,
        published=not args.draft
    )


if __name__ == '__main__':
    main()
