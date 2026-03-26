# Content Automation Pipeline

Fully automated: record video, drop in Google Drive, system handles captions, hosting, scheduling, and publishing.

## Daily Workflow (Weekdays)

1. Record 1 long-form video + 5 vertical shorts (edit in Riverside with captions/hooks baked in)
2. Name each short with its hook text: `Why your best people keep leaving.mp4`
3. Name long-form + thumbnail with same base name: `VIDEO.mp4` + `VIDEO.jpg`
4. Drop in Google Drive inbox folders
5. Done. Pipeline runs at 10:30am cron or manual trigger.

## How to Trigger

```bash
# Shorts (processes one at a time, self-chains for remaining)
curl -s -X POST "https://leadershipgrowthconsulting.com/api/content-pipeline/check-drive" | python3 -m json.tool

# Long-form (triggered automatically after shorts, or manually)
curl -s -X POST "https://leadershipgrowthconsulting.com/api/content-pipeline/check-drive-longform" | python3 -m json.tool

# Check status
curl -s "https://leadershipgrowthconsulting.com/api/content-pipeline/status?days=1" | python3 -m json.tool
```

## Architecture

### Shorts Pipeline (fully automated)
**Trigger:** Cron at 10:30am daily or manual POST

1. List .mp4 files in Drive `Shorts/Inbox/`
2. Find first untracked file (not in Supabase)
3. Extract hook text from filename (strip `riverside_` prefix, `_william_harvey...` suffix, `(1)` markers)
4. Download video from Drive (authenticated)
5. Upload to Supabase Storage (`content-videos` public bucket)
6. Claude generates platform captions (no hashtags, no emojis, UK English)
7. Schedule to Buffer (YouTube Shorts + Instagram Reels)
8. Move file to Drive `Shorts/Processed/`
9. Email notification
10. Self-trigger for next file if more remain

**Publish timing:** First short 15 min after processing, then +2hr stagger.

### Long-Form Pipeline (semi-automated)
**Trigger:** Fires after shorts are done, or manual POST

1. List .mp4 files in Drive `Long-Form/Inbox/`
2. Match thumbnail (.jpg/.png, same base name, case-insensitive)
3. If no thumbnail found: email alert, skip
4. Claude generates YouTube SEO metadata (title, description, tags)
5. Move video + thumbnail to `Long-Form/Processed/`
6. Email Will with ready-to-paste metadata + YouTube Studio upload link
7. Manual YouTube upload required (Vercel 10s timeout prevents API upload)

## Tech Stack

| Tool | Role |
|---|---|
| Google Drive | Drop zone. Service account with JWT auth, raw HTTP (no googleapis npm - crashes Vercel). |
| Supabase Storage | Video hosting. `content-videos` public bucket. Buffer fetches from here. |
| Supabase DB | `content_pipeline` table tracks files and statuses. |
| Claude API | Caption + SEO generation (Sonnet 4.6). |
| Buffer | Publishes to YouTube Shorts + Instagram Reels (GraphQL API). |
| Vercel | Hosts API endpoints. Hobby plan = 10s timeout. |
| Nodemailer | Gmail notifications. |

## Google Drive Folders

```
/LGC-Content/
  Long-Form/
    Inbox/          <- Drop .mp4 + .jpg here
    Processed/      <- Auto-moved after processing
  Shorts/
    Inbox/          <- Drop 5 named shorts here
    Processing/     <- (exists but unused)
    Processed/      <- Auto-moved after scheduling
```

## Caption Rules

- No hashtags
- No emojis
- British English only
- Never reference apps, tools, or software by name
- Tone: direct, punchy, no corporate fluff
- Never use em dashes

### Caption Prompt (Shorts)

```
System: You are a social media copywriter for Leadership Growth Consulting, a fractional growth partner helping founders of 3-20 person companies build systems and step back from day-to-day. Tone: direct, punchy, no corporate fluff. Never use em dashes. Never use emojis. Always use British English spellings. Do not reference any apps, tools, or software by name.

User: Here is the hook/topic of a short-form video: "[HOOK]"

Write three captions. No hashtags. No emojis. Keep it punchy and direct.
1. YouTube Shorts: 1-2 sentences that make people stop scrolling
2. Instagram Reels: Hook sentence + 2-3 lines of value + call to action
3. TikTok: Conversational, 1-3 sentences, feel native to TikTok

Return as JSON only (no markdown fences): { "youtube": "...", "instagram": "...", "tiktok": "..." }
```

### SEO Prompt (Long-Form)

```
System: You are a YouTube SEO specialist for Leadership Growth Consulting, a fractional growth partner helping founders of 2-20 person companies build systems, step back from day-to-day operations, and scale. Tone: direct, practical, no corporate fluff. Never use em dashes. Always use British English spellings.

User: Generate YouTube SEO metadata for a long-form video with this topic: "[HOOK]"

Return JSON only: { "title": "...", "description": "...", "tags": ["...", "..."] }

Title: Compelling, under 60 characters, include the core keyword. Do not wrap in quotes.
Description: 2-3 paragraphs. Strong hook sentence. Include "[TIMESTAMPS]" placeholder. End with CTA to subscribe and visit leadershipgrowthconsulting.com.
Tags: 10-15 relevant tags for YouTube search discovery.
```

## API Routes

All in `site/src/pages/api/content-pipeline/`:

| Endpoint | Method | Purpose |
|---|---|---|
| `check-drive` | GET/POST | Process shorts. One file per invocation, self-chains. Cron trigger. |
| `check-drive-longform` | GET/POST | Process long-form. Triggered after shorts. |
| `creatomate-webhook` | POST | Legacy (Creatomate abandoned). |
| `status` | GET | Pipeline status. `?days=7` for history. |
| `youtube-auth` | GET | One-time OAuth2 setup (future YouTube API auto-upload). |

## Key Libraries

- `site/src/lib/google-drive.ts` - Drive API: list, move, download, permissions (JWT service account)
- `site/src/lib/buffer-api.ts` - Buffer GraphQL: schedule video posts to channels
- `site/src/lib/youtube-api.ts` - YouTube Data API: OAuth2, upload, thumbnail (future use)

## Supabase

### Table: `content_pipeline`
- `content_type`: 'short' | 'longform'
- `status`: detected | captioned | rendered | seo_generated | ready_for_upload | publishing | published | failed
- Key columns: drive_file_id, filename, hook_text, captions (jsonb), seo_data (jsonb), rendered_video_url, buffer_post_ids (jsonb), scheduled_publish_at, error

### Storage: `content-videos` (public bucket)
- Path: `shorts/{row-uuid}.mp4`

## Vercel Cron

`site/vercel.json` - single cron at `30 10 * * *` (10:30am daily). Triggers check-drive which chains to check-drive-longform.

## Known Constraints

- **Vercel Hobby 10s timeout:** Shorts processed one at a time with self-chaining.
- **Buffer:** No delete API. Delete posts manually in Buffer dashboard.
- **Self-chain reliability:** Fire-and-forget fetch may not always trigger. If shorts stop mid-batch, trigger again manually.
- **Supabase Storage free tier:** 1GB. Clean up old videos periodically.
- **YouTube auto-upload:** Code ready in youtube-api.ts but needs Vercel Pro for longer timeout. Currently manual upload via email with metadata.

## What We Tried and Abandoned

- **Creatomate** ($54/mo Essential, free tier truncated at 38s, low res)
- **Google Drive URLs for Buffer** (CORS `same-site` policy blocks Buffer)
- **Vercel Blob Storage** (token linking issues)
- **Make.com** (unnecessary, everything built as API routes)

## Cleanup Tasks

When clearing out for re-testing:
```bash
# Delete all short entries from Supabase
curl -s -X DELETE "https://zgtaskiordteelfvlmti.supabase.co/rest/v1/content_pipeline?content_type=eq.short" \
  -H "apikey: SERVICE_ROLE_KEY" -H "Authorization: Bearer SERVICE_ROLE_KEY"

# Move files back to Inbox in Google Drive (manual via Drive UI)
# Delete posts from Buffer dashboard (no API for this)
```
