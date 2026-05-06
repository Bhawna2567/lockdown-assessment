# Hosting ClassCurio for everyone (Render walk-through)

The desktop app you have right now only works on your laptop. To give your colleagues and students a link they can open from any computer on any network, you need to put ClassCurio on a public web host.

The recommended option is **Render** — it has a free tier, deploys directly from a GitHub repository, gives you a stable URL like `https://classcurio.onrender.com`, and includes a persistent disk so student data isn't wiped on restart.

Total time: about 25 minutes once.

---

## Step 1 — Put ClassCurio on GitHub

Render deploys from GitHub, so the code needs to live there.

1. Create a free account at **github.com** if you don't already have one.
2. Install **GitHub Desktop** from `desktop.github.com`. It's the easy way to push code without the command line.
3. Open GitHub Desktop → **File → Add Local Repository** → choose your `~/Desktop/lockdown-assessment` folder.
4. Click **Publish repository**. Untick "Keep this code private" if you want colleagues to be able to fork it; otherwise leave it private.

Important: before publishing, make sure no API keys or student data are in the repo. The repo should ignore `data/` and `node_modules/`. Add a file called `.gitignore` next to `package.json` with:

```
node_modules/
data/
.DS_Store
*.log
```

(If `data/` already has student records on your laptop, GitHub Desktop will offer to ignore it. Say yes.)

---

## Step 2 — Create the Render service

1. Sign up at **render.com** (free tier is fine).
2. Click **New** → **Web Service**.
3. Connect the GitHub repo you just published.
4. Fill in:
   - **Name**: `classcurio` (or whatever you like — this becomes part of the URL).
   - **Region**: pick the closest one to your students.
   - **Branch**: `main`.
   - **Runtime**: `Node`.
   - **Build command**: `npm install`
   - **Start command**: `node server/server.js`
   - **Plan**: Free is fine for a small class. Upgrade to **Starter** ($7/month) if you have more than ~25 concurrent students or want it to stay awake 24/7.
5. Click **Advanced** and set **Environment Variables**:
   - `SESSION_SECRET` → click **Generate** to get a random value
   - `ANTHROPIC_API_KEY` → paste your Claude API key (only needed for auto-grading; you can leave it out and add it later from the Settings page in ClassCurio)
   - `PORT` → `10000` (Render expects this)
6. Click **Add Disk** at the bottom of the page to create persistent storage:
   - **Name**: `classcurio-data`
   - **Mount path**: `/opt/render/project/src/data`
   - **Size**: 1 GB (plenty for thousands of students)
7. Click **Create Web Service**. Render will build and deploy. After ~3 minutes you'll have a live URL.

---

## Step 3 — Tell students and colleagues the URL

Render gives you a URL like `https://classcurio-abcd.onrender.com`. From now on:

- Anyone (you, colleagues, students) goes to that URL in any browser.
- Your existing share link (`/take/<id>`) works on the public URL too — just click **🔗 Share with students** in your dashboard.
- The first time someone visits, they register an account. Mark teachers as Teacher, students as Student. They can then sign in from any computer.

---

## Step 4 — Updating the deployed version

Whenever I send you new code:

1. Apply it to your `~/Desktop/lockdown-assessment` folder (using `APPLY-UPDATE.command`).
2. Open GitHub Desktop. It will show the changed files.
3. Type a short summary, click **Commit to main**, then **Push origin**.
4. Render auto-detects the push and redeploys in a few minutes.

---

## Free tier limitations to know about

- Free services **sleep after 15 minutes of inactivity**. The first request after sleep takes ~30 seconds to wake up. For a classroom assessment, ask students to load the link 1 minute before the exam starts so it's warm.
- Free disk is included only on Starter+ plans. The free tier deletes the disk on restart, which means student data resets. **For real classroom use, the $7/month Starter plan is what you want.**
- Render only watches `main` branch. If you commit to a different branch, deploy won't trigger.

---

## Alternatives if Render doesn't fit

- **Railway** (`railway.app`) — same model, ~$5/month.
- **Fly.io** — free tier, more technical to set up.
- **A school server** — if your IT department runs a Linux box and can give you a public hostname, install Node and run `npm install && node server/server.js` there. Open port 80 / 443 with HTTPS.
- **Self-hosted on a Raspberry Pi at home** — works, but you'd need a static IP or a DDNS service like duckdns.org. Not recommended for production student use because of reliability and privacy.

---

## Privacy and student data

- The `data/` folder on the host contains all student submissions and accounts. On Render, that's the persistent disk you set up in Step 2.
- Set **strong passwords** on teacher accounts. Anyone with your teacher login can see all submissions, change grades, and download scoresheets.
- The `SESSION_SECRET` env var keeps logged-in sessions secure. **Don't reuse the same secret across deploys** — if you redeploy fresh, generate a new one (existing users will be logged out, which is fine).
- The `ANTHROPIC_API_KEY` env var should never be put in the code or pushed to GitHub. Only in the env-vars panel.
