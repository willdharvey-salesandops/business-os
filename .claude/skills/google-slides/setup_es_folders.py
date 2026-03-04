"""
setup_es_folders.py

One-time setup: creates the Sales subfolder structure inside the Email Shepherd
Drive folder.

Note: Shared Drive root folders cannot be renamed via the API — rename manually
in Drive if needed.

Run once, then copy the printed folder IDs into .env.

Usage:
    python3 .claude/skills/google-slides/setup_es_folders.py
"""

import os
import sys
from dotenv import load_dotenv
from googleapiclient.discovery import build
from google.oauth2 import service_account

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive']
CREDENTIALS_PATH = os.getenv('GOOGLE_CREDENTIALS_PATH', '.google-credentials.json')
PARENT_FOLDER_ID = os.getenv('EMAILSHEPHERD_DRIVE_FOLDER_ID')


def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES
    )
    return build('drive', 'v3', credentials=creds)


def create_folder(service, name, parent_id):
    metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    folder = service.files().create(
        body=metadata,
        fields='id, name',
        supportsAllDrives=True
    ).execute()
    return folder['id']


def main():
    if not PARENT_FOLDER_ID:
        print("ERROR: EMAILSHEPHERD_DRIVE_FOLDER_ID not set in .env")
        sys.exit(1)

    service = get_drive_service()

    # Create Sales subfolder
    sales_id = create_folder(service, 'Sales', PARENT_FOLDER_ID)
    print(f"Created: Sales/ ({sales_id})")

    # Create leaf subfolders under Sales
    decks_id = create_folder(service, 'Decks', sales_id)
    print(f"Created: Sales/Decks/ ({decks_id})")

    docs_id = create_folder(service, 'Documents', sales_id)
    print(f"Created: Sales/Documents/ ({docs_id})")

    cases_id = create_folder(service, 'Case Studies', sales_id)
    print(f"Created: Sales/Case Studies/ ({cases_id})")

    print("\n--- Add these to your .env ---")
    print(f"EMAILSHEPHERD_DECKS_FOLDER_ID={decks_id}")
    print(f"EMAILSHEPHERD_DOCUMENTS_FOLDER_ID={docs_id}")
    print(f"EMAILSHEPHERD_CASE_STUDIES_FOLDER_ID={cases_id}")
    print("-------------------------------")


if __name__ == '__main__':
    main()
