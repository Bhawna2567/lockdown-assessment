# Render — enable PDF image extraction (poppler-utils)

ClassCurio's Quick Import and AI Generator now extract images from uploaded
PDFs and DOCX files so Claude can see embedded pictures, diagrams, and
match-with-picture artwork.

DOCX images work out of the box (handled by the `mammoth` npm package, no
extra setup needed).

For **PDFs**, the server shells out to `pdftoppm` (from `poppler-utils`).
Render's Node web service runner doesn't include it by default — add it
once and you're done.

## One-time Render setup

1. Sign in to https://dashboard.render.com.
2. Click on the **lockdown-asessment** web service.
3. Open **Settings** → scroll to **Build Command**.
4. Change the build command to:

   ```
   apt-get update && apt-get install -y poppler-utils && npm install
   ```

5. Click **Save**.
6. Click **Manual Deploy** → **Deploy latest commit**.

After the rebuild finishes (about 2-3 minutes), PDF page rasters get sent
to Claude on every Quick Import / AI Generator call. If poppler isn't
installed for any reason, image extraction silently returns [] and text
extraction works as before — no crashes.

## How to confirm it's working

After a fresh PDF import, open Render → Logs and search for "image". You
should see image content blocks being sent to Claude. The AI generator's
success status line also reports how many images were processed.

## Limits

- First 8 pages of each PDF are rasterised (110 DPI).
- Each image is capped at 4 MB and the total per request at 25 MB.
- Anthropic supports png, jpeg, gif, webp — we send everything as JPEG.
