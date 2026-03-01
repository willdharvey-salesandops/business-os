# Blog Publishing

Publish articles to the Leadership Growth Consulting blog. Articles are stored in Supabase and served at leadershipgrowthconsulting.com/blog/.

---

## MCP Publishing (Primary Method)

If the Supabase MCP server is configured, publish directly without the Python script.

### Setup

```bash
claude mcp add --transport http supabase "https://mcp.supabase.com/mcp"
```

### Usage

Insert into the `blog_posts` table with these fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | text | Yes | Article title |
| `slug` | text | Yes | URL-friendly slug (lowercase, hyphens) |
| `content` | text | Yes | Full markdown content |
| `category` | text | No | Default: General |
| `excerpt` | text | No | 1-2 sentences for listing |
| `meta_description` | text | No | Under 160 chars |
| `meta_keywords` | text | No | Comma-separated |
| `cover_image_url` | text | No | Full URL to cover image |
| `author` | text | No | Default: Will Harvey |
| `faqs` | jsonb | No | Array of {question, answer} objects |
| `read_time` | text | No | e.g. "5 min read" |
| `published` | boolean | No | Default: true |
| `published_at` | timestamptz | No | ISO 8601 UTC timestamp |

After publishing, the article is immediately live at:
`https://www.leadershipgrowthconsulting.com/blog/{slug}`

---

## Script Publishing (Fallback)

```bash
# Publish from a markdown file
python3 .claude/skills/blog-publishing/scripts/publish_article.py \
  --title "Your Article Title" \
  --content path/to/article.md \
  --category "Systems"

# Publish with inline content
python3 .claude/skills/blog-publishing/scripts/publish_article.py \
  --title "Your Article Title" \
  --content-text "# Heading\n\nYour content here..." \
  --category "AI"
```

### Full Options

| Flag | Required | Description |
|------|----------|-------------|
| `--title` | Yes | Article title |
| `--content` | One required | Path to markdown file |
| `--content-text` | One required | Inline markdown content |
| `--category` | No | Category (default: General) |
| `--excerpt` | No | Short summary for listing (auto-generated if omitted) |
| `--meta-description` | No | SEO meta description (defaults to excerpt) |
| `--meta-keywords` | No | Comma-separated SEO keywords |
| `--cover-image` | No | Cover image URL |
| `--read-time` | No | e.g. "5 min read" (auto-calculated if omitted) |
| `--faqs` | No | JSON array: `[{"question":"...","answer":"..."}]` |
| `--draft` | No | Save as draft instead of publishing |

---

## Cover Image Sourcing

Every article requires a cover image. The blog listing page renders images at full card width x 220px height. The blog post page renders a full-width cover.

### Image Script

```bash
python3 .claude/skills/blog-publishing/scripts/fetch_cover_image.py \
  --query "business delegation teamwork"
```

Returns an Unsplash URL. Falls back to Pexels if Unsplash returns nothing.

### Image Guidelines

- Landscape orientation
- Professional, calm aesthetic (not corporate stock)
- No text overlays, logos, or AI-generated imagery
- Good subjects: architecture, paths, workspaces, nature patterns, hands-on work
- Avoid: handshakes, people pointing at screens, forced group smiles

### Required Env Vars for Images

```
UNSPLASH_ACCESS_KEY=your_key_here
PEXELS_API_KEY=your_key_here  # fallback
```

---

## For Content Agents

When the Writer agent creates an article, it should:

1. Write the article content to `workspace/content/articles/[slug].md`
2. Source a cover image using the image script or web search
3. Publish via Supabase MCP (primary) or the Python script (fallback)
4. Verify the output shows the published URL
5. Update the content corpus status

**Brand voice reference:** `context/business/voice.md`

**Article requirements:**
- Clear, descriptive title (not clickbait)
- 2-3 sentence excerpt
- Content with H2/H3 subheadings
- 3-5 FAQs matching real search queries
- Meta description under 160 characters
- Cover image URL (required)
- No em dashes anywhere

---

## Architecture

```
Supabase MCP (primary) OR publish_article.py (fallback)
    ↓ (insert into blog_posts table)
Supabase database
    ↓ (fetched on request)
/blog/{slug} (server-rendered by api/blog.py)
```

---

## Requirements

- Python 3.x
- `requests` package (`pip install requests`)
- `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `.env` with `UNSPLASH_ACCESS_KEY` (for image sourcing)

---

## Admin Dashboard

Manual article management is available at:
`https://www.leadershipgrowthconsulting.com/admin.html`

Login with the Supabase auth credentials.

---

## Where Things Live

| What | Location |
|------|----------|
| Publishing script | `.claude/skills/blog-publishing/scripts/publish_article.py` |
| Image script | `.claude/skills/blog-publishing/scripts/fetch_cover_image.py` |
| Blog listing page | `clients/self/website/blog.html` |
| Blog post renderer | `clients/self/website/api/blog.py` |
| Admin dashboard | `clients/self/website/admin.html` |
| Vercel config | `clients/self/website/vercel.json` |
| Content corpus | `workspace/content/blog-corpus.md` |
| Article drafts | `workspace/content/articles/` |
| Brand voice | `context/business/voice.md` |
| ICP | `context/business/clients.md` |
| Content agents | `.claude/agents/content-team/` |
