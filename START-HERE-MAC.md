# Start Here — Mac Setup (one time, ~3 minutes)

## Step 1. Install Node.js (one-time, skip if you've done it before)

1. Go to **https://nodejs.org**
2. Click the big green button labeled **"LTS"** (it says something like "24.x.x LTS").
3. Open the downloaded file (`node-v24.x.x.pkg`) from your Downloads folder.
4. Click **Continue → Continue → Agree → Install**. Enter your Mac password if asked.
5. When it says "The installation was successful," click **Close**.

You only ever have to do this once, even if you rebuild the app.

## Step 2. Launch the app

1. Open the `lockdown-assessment` folder in Finder.
2. Double-click **`Launch.command`**.

### If macOS blocks it ("cannot be opened because the developer cannot be verified")

This is a one-time security prompt for any downloaded script. To allow it:

1. Right-click (or Control-click) **`Launch.command`** → choose **Open**.
2. A new dialog appears with an **Open** button — click it.
3. Terminal will open and run the app.

From then on, plain double-click works.

## Step 3. Use the app

- The first launch installs dependencies (2–3 minutes with a progress spinner in Terminal).
- A fullscreen kiosk window opens with the sign-in page.
- **Register** one teacher account and one student account (you can use two different email addresses — they don't need to be real).
- As the teacher: build an assessment or use Quick Import (PDF/DOCX) and hit **Publish**.
- As the student: sign out, sign in with the student account, take the assessment.

### To quit during development

Press **⌘+Option+Esc** to Force Quit and pick "LockdownAssessment" (because kiosk mode disables the usual close button on purpose).

## Step 4 (later, optional). Build a proper installable .app

Once you've confirmed everything works, you can package it as a real double-clickable macOS app:

1. Open Terminal (Spotlight → type "Terminal").
2. Drag the `lockdown-assessment` folder into the Terminal window — this types the path for you. Then hit Return.
3. Type: `npm run build:mac` and hit Return.

After a few minutes you'll have `dist/LockdownAssessment.dmg` — that's the installer you can give to students.

## Troubleshooting

**"command not found: node" after installing:** close Terminal and open a new window. The installer needs a fresh shell.

**"EACCES" errors during npm install:** open Terminal and run `sudo chown -R $(whoami) ~/.npm` then try `Launch.command` again.

**Webcam shows a black square:** macOS probably asked for camera permission and you said No. Open **System Settings → Privacy & Security → Camera** and toggle on the entry for Terminal / LockdownAssessment.

**Nothing happens when I double-click Launch.command:** the executable bit may have been stripped during transfer. Open Terminal, drag the folder in, hit Return, then run: `chmod +x Launch.command` and try again.
