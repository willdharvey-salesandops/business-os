# Governor Minutes Interface (Quorum)

AI-powered meeting minutes generator for school governing body meetings.

## What It Does
Converts raw meeting transcripts (from Plaud or similar recording tools) into properly formatted governing body minutes matching the client's existing format.

## How It Works
1. User pastes transcript or uploads a .txt file
2. AI generates structured minutes matching the standard format
3. User reviews and edits the draft
4. Download as PDF, copy to clipboard, or save as text

## Project Structure
This is a standalone Astro project, completely separate from the LGC site.

```
clients/governor-minutes/
  public/index.html        # Frontend (vanilla JS, dark theme "Quorum" branding)
  src/pages/api/meetings/
    generate-minutes.ts     # API endpoint (Claude Sonnet 4.6)
  examples/                 # Example minutes PDFs for reference
  docs/                     # Additional documentation
  astro.config.mjs
  package.json
```

## Local Development
```bash
cd clients/governor-minutes
npm install
npm run dev
```
Then open http://localhost:4321

## Deployment
Deployed as its own Vercel project (separate from the LGC site).

1. Create a new Vercel project pointing at this directory
2. Set Root Directory to `clients/governor-minutes`
3. Framework: Astro
4. Add environment variable: `ANTHROPIC_API_KEY`

## Tech
- Frontend: Standalone HTML page (vanilla JS)
- Backend: Astro API endpoint on Vercel
- AI: Claude Sonnet 4.6 via Anthropic API
- PDF: Client-side generation via jsPDF + autoTable

## API Key
Currently using Will's ANTHROPIC_API_KEY. Plan to switch to client's own key when ready.

## Handoff Checklist
- [ ] Vercel project created and deployed
- [ ] Domain configured (custom or Vercel subdomain)
- [ ] Client has tested and approved the output format
- [ ] System prompt refined to match all meeting types
- [ ] API key switched to client's own Anthropic account
- [ ] Vercel project transferred or cloned to client
