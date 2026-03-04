"""
upload_docs.py

Uploads a markdown file to Google Drive as a native Google Doc.
Converts markdown to HTML first so formatting (headings, bold, tables) is
preserved in the resulting Google Doc.

On first run, creates the doc and caches its Drive ID.
On subsequent runs, replaces the existing doc content.

Usage:
    python3 .claude/skills/google-slides/upload_docs.py \
      --file clients/emailshepherd/sales/first-call-playbook.md \
      --folder-id 1PGZe4nwCPftlXdg4Pnaso0C60ZjM5PvH \
      --client emailshepherd \
      --name "First Call Playbook"

Arguments:
    --file        Path to the local markdown file (relative to workspace root)
    --folder-id   Drive folder ID to create/update the doc in (pass as literal value)
    --client      Client key for the drive_file_ids.json cache (e.g. emailshepherd)
    --name        Display name for the Google Doc in Drive
"""

import argparse
import io
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

import markdown
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2 import service_account

load_dotenv()

CREDENTIALS_PATH = os.getenv('GOOGLE_CREDENTIALS_PATH', '.google-credentials.json')
CACHE_FILE = Path('.claude/skills/google-slides/drive_file_ids.json')

# HTML wrapper with basic styling that Google Docs picks up on import
HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }}
  h1 {{ font-size: 20pt; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; }}
  h2 {{ font-size: 16pt; font-weight: bold; margin-top: 18pt; margin-bottom: 4pt; }}
  h3 {{ font-size: 13pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; }}
  table {{ border-collapse: collapse; width: 100%; margin: 12pt 0; }}
  th, td {{ border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; }}
  th {{ background-color: #f0f0f0; font-weight: bold; }}
  blockquote {{ border-left: 3px solid #ccc; margin: 8pt 0 8pt 16pt; padding-left: 12pt;
               color: #555; font-style: italic; }}
  code {{ background-color: #f4f4f4; padding: 1pt 4pt; font-family: Courier New, monospace;
          font-size: 10pt; }}
  pre {{ background-color: #f4f4f4; padding: 10pt; font-family: Courier New, monospace;
         font-size: 10pt; line-height: 1.4; white-space: pre-wrap; }}
  hr {{ border: none; border-top: 1px solid #ddd; margin: 16pt 0; }}
</style>
</head>
<body>
{body}
</body>
</html>"""


def convert_md_to_html(filepath):
    """Convert a markdown file to a styled HTML string."""
    text = Path(filepath).read_text(encoding='utf-8')
    body = markdown.markdown(
        text,
        extensions=['tables', 'fenced_code', 'nl2br', 'sane_lists']
    )
    return HTML_TEMPLATE.format(body=body)


def get_drive_service():
    scopes = ['https://www.googleapis.com/auth/drive']
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=scopes
    )
    return build('drive', 'v3', credentials=creds)


def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def upload_doc(service, html_content, folder_id, doc_name, existing_id=None):
    """Upload or update an HTML string as a Google Doc."""
    buf = io.BytesIO(html_content.encode('utf-8'))
    media = MediaIoBaseUpload(buf, mimetype='text/html', resumable=False)

    if existing_id:
        try:
            service.files().delete(fileId=existing_id, supportsAllDrives=True).execute()
            print(f"Deleted old doc: {existing_id}")
        except Exception as e:
            print(f"Warning: could not delete old doc ({e}). Creating new one.")

    metadata = {
        'name': doc_name,
        'parents': [folder_id],
        'mimeType': 'application/vnd.google-apps.document'
    }
    file = service.files().create(
        body=metadata,
        media_body=media,
        fields='id, webViewLink',
        supportsAllDrives=True
    ).execute()

    return file


def main():
    parser = argparse.ArgumentParser(description='Upload a markdown file to Google Drive as a Google Doc')
    parser.add_argument('--file',      required=True, help='Path to the markdown file')
    parser.add_argument('--folder-id', required=True, help='Drive folder ID (pass as literal value)')
    parser.add_argument('--client',    required=True, help='Client key for caching (e.g. emailshepherd)')
    parser.add_argument('--name',      required=True, help='Display name for the Google Doc')
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"ERROR: File not found: {filepath}")
        sys.exit(1)

    cache_key = filepath.stem

    print(f"Uploading: {filepath.name} as '{args.name}'")
    print("Converting markdown to HTML...")

    html_content = convert_md_to_html(filepath)

    service = get_drive_service()
    cache = load_cache()
    client_cache = cache.get(args.client, {})
    existing_id = client_cache.get(cache_key)

    if existing_id:
        print(f"Found existing doc ID: {existing_id} — replacing content")
    else:
        print("First upload — creating new Google Doc")

    file = upload_doc(service, html_content, args.folder_id, args.name, existing_id)

    if args.client not in cache:
        cache[args.client] = {}
    cache[args.client][cache_key] = file['id']
    save_cache(cache)

    link = file.get('webViewLink', f"https://docs.google.com/document/d/{file['id']}/edit")
    print(f"Done. Google Doc link:\n{link}")


if __name__ == '__main__':
    main()
