# Skill: Google Drive Publishing

Create and upload sales materials to Google Drive for EmailShepherd. Includes the qualification call deck (as PPTX) and all supporting documents (as Google Docs). Local files are the source of truth — Drive is the published copy.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `create_pptx.py` | Builds the 10-slide qualification call deck as PPTX and uploads to Drive Decks/ folder |
| `upload_docs.py` | Uploads a markdown file to Drive as a native Google Doc |
| `setup_es_folders.py` | One-time: creates Sales/Decks/Documents/Case Studies folder structure in Drive |

## Edit-from-Claude Workflow

**To update the deck:**
> "Change slide 3 to say X instead of Y"
1. Claude edits `create_pptx.py` directly (slide content is in the slide functions)
2. Runs `python3 .claude/skills/google-slides/create_pptx.py`
3. Script finds the cached Drive file ID and updates in place
4. Returns the Drive link

**To update a document:**
> "Add a new objection to the playbook"
1. Claude edits the local `.md` file
2. Runs `upload_docs.py` with the correct `--folder-id` (see IDs below)
3. Script finds the cached Drive file ID, deletes and recreates the Google Doc
4. Returns the Drive link

## Known Drive File IDs (EmailShepherd)

All IDs stored in `drive_file_ids.json`. Folder IDs in `.env`:
- Decks: `EMAILSHEPHERD_DECKS_FOLDER_ID`
- Documents: `EMAILSHEPHERD_DOCUMENTS_FOLDER_ID`
- Case Studies: `EMAILSHEPHERD_CASE_STUDIES_FOLDER_ID`

## Running upload_docs.py

Always pass the folder ID as a literal value (not a shell variable — dotenv handles it internally via `--folder-id`):

```bash
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/first-call-playbook.md \
  --folder-id "1PGZe4nwCPftlXdg4Pnaso0C60ZjM5PvH" \
  --client emailshepherd \
  --name "First Call Playbook"
```

**EmailShepherd document commands:**

```bash
# First Call Playbook
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/first-call-playbook.md \
  --folder-id "1PGZe4nwCPftlXdg4Pnaso0C60ZjM5PvH" \
  --client emailshepherd --name "First Call Playbook"

# Qualification Call Document
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/qualification-call.md \
  --folder-id "1PGZe4nwCPftlXdg4Pnaso0C60ZjM5PvH" \
  --client emailshepherd --name "Qualification Call Document"

# Case Study: BBC
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/case-studies/bbc.md \
  --folder-id "1VT9k-yPPPhYPezIHKUNZB6aWqdvWplgd" \
  --client emailshepherd --name "Case Study: BBC"

# Case Study: Major Online Retailer
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/case-studies/major-online-retailer.md \
  --folder-id "1VT9k-yPPPhYPezIHKUNZB6aWqdvWplgd" \
  --client emailshepherd --name "Case Study: Major Online Retailer"

# Case Study: Global Financial Institution
python3 .claude/skills/google-slides/upload_docs.py \
  --file clients/emailshepherd/sales/case-studies/global-financial-institution.md \
  --folder-id "1VT9k-yPPPhYPezIHKUNZB6aWqdvWplgd" \
  --client emailshepherd --name "Case Study: Global Financial Institution"
```

Note: documents are converted from markdown to HTML before upload, so formatting (headings, bold, tables, blockquotes) renders correctly in Google Docs.

## Current Drive Links (EmailShepherd)

| Document | Drive link |
|----------|-----------|
| Qualification Call Deck (PPTX) | https://docs.google.com/presentation/d/1TtNqIwey9ywbXEFs9zoXIoDcGcFHIox1/edit |
| Qualification Call Deck (HTML) | https://drive.google.com/file/d/1raggum0pePH28cRrCdvBV3WkyN1C_prB/view |
| First Call Playbook | https://docs.google.com/document/d/1dWhJtRTZAedjrenkRcFHfr1eMrVLJvX9dx6q-QYly3g/edit |
| Qualification Call Document | https://docs.google.com/document/d/1RgWSul4JunK9vDEDULC2mDDW8miCGNIZoilchodKjjQ/edit |
| Case Study: BBC | https://docs.google.com/document/d/1neBmVKeTlOSrmxXrDYRvClzjULRisSDxrED2nj-AoO4/edit |
| Case Study: Major Online Retailer | https://docs.google.com/document/d/1Iq5QVOA1exSz693vpc5aS5Nk8lKkMDZBJs4jAVTh3H8/edit |
| Case Study: Global Financial Institution | https://docs.google.com/document/d/1ZM4HycminLPqhc-_FPDUYtsYW8S9LHKWW59D2m8BHzQ/edit |
| Business Case Call Playbook | https://docs.google.com/document/d/1aiouMms-l-lon94sGBeru-S-UCfuUzk3exuliZMKmAI/edit |
| Business Case Deck (HTML) | https://drive.google.com/file/d/1oSif8gVUVLmp1dtrrQl1Se87CMLzoeTG/view |
| ROI Calculator (HTML) | https://drive.google.com/file/d/1vYilzwnP4gO_K0I-ykqimwiQ_nda5ulp/view |
| ROI Calculator: How It Works | https://docs.google.com/document/d/1dn1s7hgoX23NWcFDudocKsY4NGzJgKrehSygxtNkG5s/edit |

---

## When to Use This Skill

Use when the user asks to:
- Create or update the EmailShepherd deck
- Push an updated document to Drive
- Check the Drive link for a sales file

---

## Prerequisites

Before running, confirm these are in place:

1. **Python dependencies installed:**
   ```bash
   pip install google-api-python-client google-auth
   ```

2. **Credentials file exists** at path set in `.env`:
   ```
   GOOGLE_CREDENTIALS_PATH=.google-credentials.json
   ```

3. **Drive folder ID set** in `.env`:
   ```
   EMAILSHEPHERD_DRIVE_FOLDER_ID=<folder-id>
   ```

If not set up, direct the user to the setup instructions below.

---

## How to Create a Deck

### Step 1 — Build the brief

Collect from the user (or infer from context):

```
title: [Presentation title]
subtitle: [Optional subtitle or date]
template: discovery-call | proposal | custom
slides:
  - heading: [Slide title]
    body: [Bullet points or paragraph]
    notes: [Optional speaker notes]
  - ...
```

### Step 2 — Write the brief to a file

Save to: `clients/[client]/sales/decks/[YYYY-MM-DD]-[slug]-brief.md`

### Step 3 — Run the script

```bash
python .claude/skills/google-slides/create_deck.py \
  --brief clients/[client]/sales/decks/[brief-file].md \
  --folder-env EMAILSHEPHERD_DRIVE_FOLDER_ID
```

### Step 4 — Return the link

The script prints the Google Slides URL. Share it with the user.

---

## Templates

### `discovery-call`
Standard structure for a qualification/discovery call deck:
1. Title slide (company name, date)
2. Agenda
3. About Email Shepherd (1 slide — brief)
4. Understanding your setup (3–4 questions as prompts)
5. Where we typically see friction (pain points)
6. How Email Shepherd solves it
7. Next steps

### `proposal`
Standard proposal structure:
1. Title slide
2. What we heard (summary of discovery)
3. The challenge
4. Our solution
5. How it works
6. Pricing / engagement
7. Next steps

### `custom`
Use any slide structure provided in the brief.

---

## Google Cloud Setup (One-Time — ~15 mins)

### Step 1 — Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project" → name it (e.g. `emailshepherd-tools`)
3. Click "Create"

### Step 2 — Enable the APIs
1. In the left sidebar: APIs & Services → Library
2. Search for and enable: **Google Slides API**
3. Search for and enable: **Google Drive API**

### Step 3 — Create a Service Account
1. APIs & Services → Credentials → "Create Credentials" → Service Account
2. Name it (e.g. `deck-generator`), click Create and Continue, skip optional steps, click Done
3. Click the new service account → Keys tab → Add Key → Create new key → JSON
4. Download the JSON file → save it as `.google-credentials.json` in the workspace root
5. **Add `.google-credentials.json` to `.gitignore`** (contains sensitive credentials)

### Step 4 — Set up the Drive folder
1. In Google Drive, create a folder called "Email Shepherd Decks"
2. Right-click the folder → Share → paste the service account email (visible in the JSON file as `"client_email"`)
3. Give it "Editor" access → Share
4. Open the folder in Drive — copy the folder ID from the URL: `https://drive.google.com/drive/folders/[THIS_IS_THE_ID]`

### Step 5 — Add to `.env`
```
GOOGLE_CREDENTIALS_PATH=.google-credentials.json
EMAILSHEPHERD_DRIVE_FOLDER_ID=paste_folder_id_here
```

### Step 6 — Install Python dependency
```bash
pip3 install google-api-python-client google-auth python-dotenv
```

### Test it
```bash
python3 .claude/skills/google-slides/create_deck.py --brief clients/emailshepherd/sales/decks/test-brief.md
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `credentials not found` | Check `GOOGLE_CREDENTIALS_PATH` in `.env` |
| `403 forbidden` | Service account not shared on Drive folder |
| `API not enabled` | Enable Slides API + Drive API in Cloud Console |
| `ModuleNotFoundError` | Run `pip install google-api-python-client google-auth` |
