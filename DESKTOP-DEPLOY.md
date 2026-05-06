# Building and distributing the ClassCurio desktop app

This document is for **you, the teacher**. It walks you through turning the source code in `~/Desktop/lockdown-assessment/` into a `.dmg` file (Mac) and `.exe` file (Windows) that you can email or share with your students. Once they install it, they get a locked-down ClassCurio window that can't be screenshotted, alt-tabbed away from, or copy-pasted out of during exams.

---

## Why a desktop app vs the browser

| | Browser (lockdown-asessment.onrender.com) | Desktop app |
|---|---|---|
| Screenshot prevention | Not possible | **Yes** — screenshots come out black on macOS |
| Phone photo detection | Webcam evidence only | Webcam evidence only (hardware limit) |
| Tab switching | Logged as violation | Blocked at OS level |
| Cmd+Q / Alt+F4 quit | Logged | Blocked during exam |
| OS screenshot shortcuts | Cannot block | Blocked globally |
| Right-click | Blocked in page | Blocked at OS level |
| What students see | Standard browser tab | Dedicated kiosk window |
| Install required? | No | Yes (one-time) |

For high-stakes exams, push students to the desktop app. For low-stakes practice, the browser version is fine.

---

## Step 1 — Build the Mac app (run on your Mac)

Open Terminal:

```
cd ~/Desktop/lockdown-assessment
npm install
npm run build:mac
```

`npm install` may take 2–3 minutes the first time (it pulls in electron-builder).
`npm run build:mac` takes another 2–4 minutes — Electron is large.

When it finishes you'll have a folder called `dist/` inside `lockdown-assessment`. Open it in Finder. You should see:

- `ClassCurio-1.0.0.dmg` — the macOS installer (~80–100 MB).
- `ClassCurio-1.0.0-mac.zip` — same content, zipped.
- A `mac/` folder with `ClassCurio.app` (the raw bundle).

**Test it on your own Mac first** before sharing:

1. Double-click `ClassCurio-1.0.0.dmg`.
2. In the Finder window that opens, drag `ClassCurio.app` to Applications.
3. Open Applications → double-click ClassCurio.

The first time, macOS will block it because it's not signed by a registered Apple developer. To allow it: **right-click ClassCurio.app → Open → Open**. After this once, it launches normally.

You should see your ClassCurio sign-in page open in a normal-sized window, pointed at your Render URL.

---

## Step 2 — Build the Windows app

Cross-compiling Windows builds from a Mac is technically possible but unreliable. The clean way is to run the build on a Windows machine.

**On a Windows laptop:**

1. Install Node.js from `nodejs.org` (LTS version).
2. Install Git from `git-scm.com`.
3. Open Command Prompt or PowerShell.
4. Clone your repo:
   ```
   git clone https://github.com/Bhawna2567/lockdown-assessment.git
   cd lockdown-assessment
   npm install
   npm run build:win
   ```
5. Output appears in `dist/` — look for `ClassCurio Setup 1.0.0.exe` (~80–100 MB).

If you don't have a Windows machine handy, two options:

- **Borrow one for 30 minutes** — the build is fully scripted; just follow the steps above.
- **Use GitHub Actions** to build automatically when you push to GitHub. Tell me if you want the GitHub Actions workflow file and I'll write it.

---

## Step 3 — Sharing the files with students

The `.dmg` is ~80 MB, which is too big for most school email systems. Use one of:

- **Google Drive** — upload the `.dmg`/`.exe`, set sharing to "Anyone with the link can view", paste the link in your class group / Teams / WhatsApp.
- **Dropbox / OneDrive** — same idea.
- **A page on your school's intranet or LMS** — if your school has one.
- **A USB stick** — if you're handing out exam laptops in person.

Keep both `.dmg` and `.exe` in the same folder so Mac users grab the Mac one and Windows users grab the Windows one.

---

## Step 4 — Instructions for students

Send students this short message along with the download link:

> ## Installing ClassCurio
>
> **Mac:**
> 1. Download `ClassCurio-1.0.0.dmg` from the link.
> 2. Open the file. A Finder window appears.
> 3. Drag the **ClassCurio** icon onto the **Applications** folder.
> 4. Open Applications → **right-click ClassCurio → Open** → click **Open** in the dialog. (Only needed the first time. After that, double-click to launch.)
>
> **Windows:**
> 1. Download `ClassCurio Setup 1.0.0.exe` from the link.
> 2. Double-click the installer. If Windows shows a "Windows protected your PC" warning, click **More info** → **Run anyway**.
> 3. Follow the wizard. ClassCurio will appear in your Start menu.
>
> When it's open you'll see the ClassCurio sign-in page. Use the same email and password you'd use on the website. The app behaves like a normal window between exams; it locks down to fullscreen automatically when you start an assessment.

---

## Step 5 — When you push code updates

Because the desktop app loads your **live Render URL**, students don't need to redownload when you change the assessment website. Pushing to GitHub → Render redeploys → next time the student opens the desktop app, they see the new version automatically.

You only need to rebuild and redistribute the desktop app when:
- Your Render URL changes (you renamed the service).
- You change `electron/main.js` (rare).
- A bug in the desktop wrapper itself needs fixing.

If your Render URL changes, edit `APP_URL` near the top of `electron/main.js`, then rerun `npm run build:mac` / `build:win`.

---

## Limits to be aware of

- **Unsigned app warnings.** Until you join the Apple Developer Program ($99/year) and the Microsoft Partner Center, students will see "unidentified developer" / SmartScreen warnings on first launch. They can be dismissed (right-click → Open on Mac, More info → Run anyway on Windows), but it's friction. For a school deployment this is acceptable; for a wider release, code signing is worth it.
- **Phone photos still aren't preventable.** The desktop app blocks screenshots at the OS level, but a student can still take a photo of their laptop screen with their mobile. The webcam recordings are your evidence trail for that.
- **Two devices.** A student could take the exam on one laptop while their friend looks something up on a second laptop. Webcam helps deter this; ID watermark catches it on screenshots; otherwise this is a proctoring policy issue, not a technical one.
- **VPN / VM detection** is in the codebase but disabled by default (`FEATURES.vmDetection = false` in `student.js`). If you want to block students from running the app inside VMs, flip that flag on.
