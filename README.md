# Lockdown Assessment

A two-layer student assessment platform: a web app with in-browser lockdown features, wrapped in an Electron desktop app that enforces kiosk-mode lockdown at the OS level. Includes webcam proctoring, virtual-machine detection, and a "Quick Import" that turns a PDF or Word exam paper into an online assessment.

## What it does

- **Teachers** register, sign in, build assessments (multiple-choice, true/false, short answer, essay) either from scratch or by uploading an existing PDF/DOCX exam, publish them, and view student results with auto-graded scores, violation logs, environment reports, and webcam snapshots.
- **Students** register, sign in, see available assessments, and take them inside the lockdown environment with webcam proctoring.
- **All data** is stored locally as JSON + image files in the `data/` directory — no database, no cloud dependencies.

## Lockdown features

### Web-app layer (always active)
- Fullscreen API enforcement; exiting fullscreen counts as a violation.
- `visibilitychange` + window `blur` detection — switching tabs, minimizing, or alt-tabbing is logged.
- Screen blurs when the window loses focus (discourages screenshots).
- Right-click, text selection outside answer fields, and drag-and-drop are disabled.
- Keyboard shortcuts blocked: copy/cut/paste, DevTools (F12, Ctrl+Shift+I), view source, print, save, find, new tab/window, reload, PrintScreen, Alt+Tab.
- `beforeunload` guard warns if the student tries to navigate away.
- After **3 violations** the assessment auto-submits with whatever answers the student has entered.
- A countdown timer auto-submits at time expiry.
- One attempt per student per assessment (server enforced).

### Electron desktop layer (the real lockdown)
- **Kiosk mode** — no taskbar, no title bar, no menu, no close button.
- **`setContentProtection(true)`** — the OS refuses to include the window in screenshots or screen recordings on Windows and macOS.
- **Global shortcut blocking** — registers and swallows Ctrl+C/V/X, Ctrl+P, Ctrl+S, Ctrl+F, Alt+F4, Alt+Tab, PrintScreen, macOS screenshot combos, DevTools shortcuts, F5/F11/F12.
- **DevTools disabled** (`devTools: false`).
- **Single-instance lock** — only one instance of the app can run at a time.
- **Navigation blocked** to anything outside the embedded server.
- **New-window attempts denied** (blocks `window.open`, Ctrl+click, etc.).

### Webcam proctoring
- Requests camera access before the assessment starts — students cannot proceed without granting it.
- Live preview is pinned to the bottom-right corner with a red "REC" indicator.
- A snapshot is uploaded to the server every 15 seconds (JPEG, 320px wide, ~55% quality).
- Start and submit moments also capture a frame for a clear before/after record.
- If the camera is covered, obstructed, or the stream dies mid-exam, a violation is logged.
- Teachers view all snapshots for a submission in a gallery under the results row.

### VM / virtual-machine detection (Electron only)
- At the consent screen, the Electron preload calls into the main process to run `electron/vm-detect.js`, which checks:
  - MAC address OUI prefixes (VMware, VirtualBox, Hyper-V, Parallels, Xen, QEMU/KVM)
  - CPU model string for hypervisor markers
  - Linux: `systemd-detect-virt`
  - macOS: `system_profiler SPHardwareDataType` and `ioreg -l`
  - Windows: `wmic computersystem` / `Get-CimInstance Win32_ComputerSystem`
  - Memory and CPU-count heuristics as tiebreakers
- If a VM is detected with confidence ≥ 50%, the **Start** button is disabled and the student cannot begin.
- The full detection report (reasons, signals, confidence) is attached to the student's result record for the teacher to review.

### Quick Import (PDF / DOCX / TXT)
- Teacher clicks **⇪ Quick Import**, drops in a PDF or .docx exam paper.
- Server extracts text using `pdf-parse` (PDFs) and `mammoth` (DOCX) and runs a heuristic parser that recognizes:
  - Questions numbered `1.`, `Q1.`, `(1)`, `1)` at line start.
  - Multiple-choice options labeled `A.`, `a)`, `(A)`, etc.
  - True/False cue phrases ("True or False", "T/F").
  - Essay cues ("Essay", "Explain", "Discuss", "Describe in detail").
  - Everything else becomes a short-answer question.
- The parsed draft opens in the builder, where the teacher reviews, marks correct answers, tweaks point values, and saves.

## Honest limitations

This is a strong deterrent, not an unbreakable system. A determined student with physical access to the device can still:
- Use a second phone/computer to look things up.
- Photograph the screen with an external camera.
- Boot from a different OS or VM to bypass Electron entirely.

Commercial lockdown browsers like Respondus or Proctorio add webcam proctoring, VM detection, driver-level hooks, and remote human review — those require commercial anti-cheat engineering. For classroom-scale deterrence, this app covers the common cheating vectors (tab switching, copy-paste, screenshots, searching during the test).

## Project structure

```
lockdown-assessment/
├── package.json             # Dependencies and build scripts
├── electron/
│   ├── main.js              # Electron main process (kiosk + global shortcuts)
│   ├── preload.js           # Safe bridge from page to main
│   └── vm-detect.js         # Cross-platform VM detection
├── server/
│   ├── server.js            # Express API + static host
│   ├── store.js             # JSON file store helpers
│   └── importer.js          # PDF/DOCX → questions parser
├── public/
│   ├── index.html           # Login / register
│   ├── teacher.html         # Teacher dashboard + Quick Import UI
│   ├── student.html         # Student portal + lockdown UI + webcam preview
│   ├── css/styles.css
│   └── js/
│       ├── teacher.js       # Dashboard, builder, import, results
│       └── student.js       # Lockdown, webcam proctor, VM gate
└── data/
    ├── users.json
    ├── assessments.json
    ├── results.json
    ├── uploads/             # Temp uploaded PDFs/DOCX (auto-deleted)
    └── proctor/             # Webcam snapshots by <studentId>__<assessmentId>/
```

## Install

Requirements: Node.js 18+ and npm.

```bash
cd lockdown-assessment
npm install
```

## Run (development)

### Web app only (browser-level lockdown)

```bash
npm start
```

Open http://localhost:3000 in Chrome/Edge/Firefox. Register one teacher account and one student account. Teachers go to `/teacher.html`, students to `/student.html` (the login page routes automatically).

### Desktop app (full lockdown — recommended for real exams)

```bash
npm run dev
```

This launches the Express server *and* the Electron window in kiosk mode. The Electron window will only exit after submission or if you force-quit (Cmd+Opt+Esc on Mac, Ctrl+Alt+Del on Windows).

### Build distributable desktop apps

```bash
npm run build:mac     # produces a .dmg
npm run build:win     # produces an .exe installer
npm run build:linux   # produces an AppImage
```

Built artifacts land in `dist/`. Distribute the installer to student machines.

## Day-of-exam workflow

1. **You (teacher)** create the assessment in the web dashboard, mark it **Published**.
2. **Students** launch the Lockdown Assessment desktop app on their machines.
3. They sign in, pick the assessment, and accept the lockdown rules.
4. The window goes fullscreen kiosk; all shortcuts / screenshot / copy-paste are blocked.
5. They submit (or the timer / violation counter submits for them).
6. You review results, scores, and per-student violation logs in the dashboard.

## Customization ideas

- Swap the JSON store for SQLite or Postgres by editing `server/store.js`.
- Add webcam proctoring by enabling `navigator.mediaDevices.getUserMedia` in `student.js` and streaming frames to the server.
- Add question randomization (shuffle `currentAssessment.questions` in `startAssessment()`).
- Add time-window scheduling (only allow taking assessments within a `startDate`/`endDate` range).
- Add essay manual-grading UI in the teacher results view.

## Security notes for production

- Change the `SESSION_SECRET` environment variable from the default.
- Run behind HTTPS (use a reverse proxy like Caddy or nginx).
- Back up `data/*.json` — that's your entire database.
- Sign the Electron app (macOS notarization, Windows code signing) so students can install it without scary OS warnings.
