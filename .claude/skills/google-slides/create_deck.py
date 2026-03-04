#!/usr/bin/env python3
"""
Google Slides deck generator.
Reads a markdown brief and creates a Google Slides presentation via the Slides API.

Usage:
    python create_deck.py --brief path/to/brief.md --folder-env EMAILSHEPHERD_DRIVE_FOLDER_ID
"""

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive",
]


def load_credentials():
    load_dotenv()
    creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", ".google-credentials.json")
    if not Path(creds_path).exists():
        print(f"ERROR: Credentials file not found at '{creds_path}'")
        print("Set GOOGLE_CREDENTIALS_PATH in .env and ensure the file exists.")
        sys.exit(1)
    return service_account.Credentials.from_service_account_file(creds_path, scopes=SCOPES)


def parse_brief(brief_path: str) -> dict:
    """Parse a markdown brief file into a structured dict."""
    text = Path(brief_path).read_text()

    # Extract title
    title_match = re.search(r"^title:\s*(.+)$", text, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "Untitled Presentation"

    subtitle_match = re.search(r"^subtitle:\s*(.+)$", text, re.MULTILINE)
    subtitle = subtitle_match.group(1).strip() if subtitle_match else ""

    # Parse slides
    slides = []
    slide_blocks = re.split(r"^---$", text, flags=re.MULTILINE)
    for block in slide_blocks:
        heading_match = re.search(r"^#+\s*(.+)$", block, re.MULTILINE)
        if not heading_match:
            continue

        heading = heading_match.group(1).strip()

        # Extract bullet points
        bullets = re.findall(r"^[-*]\s+(.+)$", block, re.MULTILINE)

        # Extract speaker notes (lines after "Notes:" or "Speaker notes:")
        notes_match = re.search(r"(?:Notes|Speaker notes):\s*\n(.*?)(?:\n\n|\Z)", block, re.DOTALL)
        notes = notes_match.group(1).strip() if notes_match else ""

        # Body = bullets joined, or paragraph text if no bullets
        if bullets:
            body = "\n".join(f"• {b}" for b in bullets)
        else:
            # Grab non-heading, non-notes body text
            body_lines = []
            for line in block.split("\n"):
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("Notes:") and not line.startswith("Speaker"):
                    body_lines.append(line)
            body = "\n".join(body_lines[:6])  # cap at 6 lines

        slides.append({"heading": heading, "body": body, "notes": notes})

    return {"title": title, "subtitle": subtitle, "slides": slides}


def create_presentation(creds, title: str, folder_id: str) -> str:
    """Create an empty presentation and move it to the specified Drive folder."""
    slides_service = build("slides", "v1", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    # Create the presentation
    presentation = slides_service.presentations().create(body={"title": title}).execute()
    presentation_id = presentation["presentationId"]

    # Move to target folder
    file = drive_service.files().get(fileId=presentation_id, fields="parents").execute()
    previous_parents = ",".join(file.get("parents", []))
    drive_service.files().update(
        fileId=presentation_id,
        addParents=folder_id,
        removeParents=previous_parents,
        fields="id, parents",
    ).execute()

    return presentation_id


def build_requests(brief: dict) -> list:
    """Build the list of Slides API batchUpdate requests."""
    requests = []
    slides = brief["slides"]

    # The presentation starts with 1 default blank slide — use it as title slide
    # We'll add the remaining slides

    # Title slide (slide index 0, already exists)
    # We need to get the slide ID after creation — we'll do a two-pass approach:
    # First pass: add all slides, then populate them.
    # For simplicity here, we add new slides for each content slide (index 1+)
    # and use the first slide as title.

    for i, slide in enumerate(slides[1:], start=1):
        requests.append({
            "insertSlide": {
                "insertionIndex": i,
                "slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
            }
        })

    return requests


def populate_slides(creds, presentation_id: str, brief: dict):
    """Populate slide content after all slides are created."""
    slides_service = build("slides", "v1", credentials=creds)

    # Fetch current state
    presentation = slides_service.presentations().get(presentationId=presentation_id).execute()
    slide_objects = presentation.get("slides", [])

    requests = []

    for idx, (slide_obj, slide_data) in enumerate(zip(slide_objects, brief["slides"])):
        slide_id = slide_obj["objectId"]

        # Find placeholders
        placeholders = {}
        for element in slide_obj.get("pageElements", []):
            ph = element.get("shape", {}).get("placeholder", {})
            ph_type = ph.get("type", "")
            if ph_type in ("TITLE", "CENTERED_TITLE", "BODY", "SUBTITLE"):
                placeholders[ph_type] = element["objectId"]

        # Set title / heading
        heading_text = slide_data["heading"]
        title_id = placeholders.get("TITLE") or placeholders.get("CENTERED_TITLE")
        if title_id:
            requests.append({
                "insertText": {
                    "objectId": title_id,
                    "insertionIndex": 0,
                    "text": heading_text,
                }
            })

        # Set body
        body_text = slide_data.get("body", "")
        body_id = placeholders.get("BODY") or placeholders.get("SUBTITLE")
        if body_id and body_text:
            requests.append({
                "insertText": {
                    "objectId": body_id,
                    "insertionIndex": 0,
                    "text": body_text,
                }
            })

        # Set speaker notes
        notes_text = slide_data.get("notes", "")
        notes_page = slide_obj.get("slideProperties", {}).get("notesPage", {})
        for element in notes_page.get("pageElements", []):
            ph = element.get("shape", {}).get("placeholder", {})
            if ph.get("type") == "BODY":
                notes_id = element["objectId"]
                if notes_text:
                    requests.append({
                        "insertText": {
                            "objectId": notes_id,
                            "insertionIndex": 0,
                            "text": notes_text,
                        }
                    })
                break

    if requests:
        slides_service.presentations().batchUpdate(
            presentationId=presentation_id,
            body={"requests": requests},
        ).execute()


def main():
    parser = argparse.ArgumentParser(description="Create a Google Slides deck from a markdown brief.")
    parser.add_argument("--brief", required=True, help="Path to the markdown brief file")
    parser.add_argument("--folder-env", default="EMAILSHEPHERD_DRIVE_FOLDER_ID", help="Env var name for Drive folder ID")
    args = parser.parse_args()

    load_dotenv()
    folder_id = os.getenv(args.folder_env)
    if not folder_id:
        print(f"ERROR: {args.folder_env} not set in .env")
        sys.exit(1)

    brief = parse_brief(args.brief)
    print(f"Parsed brief: '{brief['title']}' — {len(brief['slides'])} slides")

    creds = load_credentials()

    print("Creating presentation...")
    presentation_id = create_presentation(creds, brief["title"], folder_id)

    print("Adding slides...")
    slides_service = build("slides", "v1", credentials=creds)
    add_requests = build_requests(brief)
    if add_requests:
        slides_service.presentations().batchUpdate(
            presentationId=presentation_id,
            body={"requests": add_requests},
        ).execute()

    print("Populating content...")
    populate_slides(creds, presentation_id, brief)

    url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
    print(f"\nDone. Google Slides link:\n{url}")


if __name__ == "__main__":
    main()
