#!/bin/bash
# Stop-Wipe.command — protect data/*.json from being overwritten on deploy.
# Adds data/*.json to .gitignore, untracks them from git, then commits + pushes.
# Run this BEFORE any future Deploy-Now.command, otherwise your Render data
# keeps getting wiped on each redeploy.

set -u
cd "$(dirname "$0")"
echo "============================================================"
echo "  ClassCurio · Stop the data wipe"
echo "============================================================"
echo

# Remove any stale lock
[ -f .git/index.lock ] && rm -f .git/index.lock

# Step 1: ensure data/*.json is in .gitignore.
GI=".gitignore"
touch "$GI"
if ! grep -qE '^data/\*\.json$' "$GI"; then
  echo "" >> "$GI"
  echo "# Persistent app data — never commit. Wiping this on deploy" >> "$GI"
  echo "# overwrites real teacher + student data on the server." >> "$GI"
  echo "data/*.json" >> "$GI"
  echo "✓ Added data/*.json to .gitignore"
else
  echo "✓ data/*.json was already in .gitignore"
fi

# Step 2: stop tracking the JSON data files in git (keeps them on disk).
TRACKED=$(git ls-files data/ 2>/dev/null | grep '\.json$' || true)
if [ -n "$TRACKED" ]; then
  echo
  echo "Removing these files from git tracking (they stay on your disk):"
  echo "$TRACKED" | sed 's/^/   - /'
  echo "$TRACKED" | xargs git rm --cached -q
  echo "✓ Untracked"
else
  echo "✓ No data/*.json files are currently tracked — nothing to remove."
fi

# Step 3: commit and push.
git add .gitignore
if git diff --cached --quiet; then
  echo
  echo "No changes to commit. Your repo already protects data/*.json."
else
  echo
  echo "Committing and pushing..."
  git commit -m "Stop tracking data/*.json so deploys don't wipe Render's live data"
  if git push origin HEAD; then
    echo
    echo "============================================================"
    echo "  SUCCESS"
    echo "  Future deploys will NOT touch data/*.json on Render."
    echo "  However, Render's FREE plan still wipes disk on every"
    echo "  restart (15-min idle, manual restart, etc.)."
    echo "  Upgrade to Render Starter + a 1GB Disk (\$7.25/mo) to make"
    echo "  the data truly survive restarts."
    echo "============================================================"
  else
    echo "PUSH FAILED — see error above."
  fi
fi
echo
read -n 1 -s -r -p "Press any key to close..."
