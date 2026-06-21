#!/bin/bash
# Deploy-Now.command — commits and pushes whatever's been changed locally so
# Render redeploys the live site. Just double-click this file.

set -u
cd "$(dirname "$0")"
echo "============================================================"
echo "  ClassCurio · Deploy Now"
echo "============================================================"
echo

# Clear any leftover lock file from previous crashed commits.
if [ -f .git/index.lock ]; then
  echo "Removing leftover .git/index.lock ..."
  rm -f .git/index.lock
fi

# Make sure we know about the latest remote state.
git fetch origin main 2>/dev/null || true

# If there is an unpushed local commit that includes a workflow-file change,
# the PAT can't push it. Undo that commit cleanly, restore workflow files to
# remote's version, and re-commit the rest. Without this, deploy gets stuck
# because git status shows "nothing modified" but the push keeps failing.
if git log origin/main..HEAD --name-only 2>/dev/null | grep -q "^\.github/workflows/"; then
  echo "Repairing previous failed commit (it included workflow-file changes)..."
  git reset --soft origin/main 2>/dev/null
  git checkout origin/main -- .github/workflows/ 2>/dev/null || true
  git restore --staged .github/workflows/ 2>/dev/null || git reset HEAD -- .github/workflows/ 2>/dev/null
  # Re-commit using the standard message; only run if there's anything left.
  if ! git diff --cached --quiet; then
    git commit -m "Deploy: latest from ClassCurio dashboard" 2>/dev/null
    echo "Repaired. The unpushed commit is rebuilt without workflow files."
  fi
fi

# Discard any working-tree edits to workflow files too — PAT can't push them.
git checkout HEAD -- .github/workflows/ 2>/dev/null || true

echo "Files that will be deployed:"
git status --short | grep -E '^ ?[MA] ' || echo "  (none modified — working tree clean)"
# Show whether there's an unpushed commit ready to go.
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" != "0" ]; then
  echo "  ($AHEAD commit(s) ahead of GitHub — will be pushed)"
fi
echo

# Stage the four files that contain the recent changes.
# Stage everything we expect to deploy. Files that don't exist are
# silently ignored by `git add -A -- <paths>`.
git add -A -- public/css/styles.css public/js/student.js public/js/teacher.js \
  public/index.html public/teacher.html public/student.html public/preview.html \
  server/server.js server/grader.js server/store.js \
  package.json server/importer.js RENDER-POPPLER-SETUP.md public/docs/ClassCurio_Teacher_Guide.docx public/docs/ClassCurio_Teacher_Guide.pdf electron/icons/icon.ico electron/icons/icon.png \
  Deploy-Now.command Stop-Wipe.command Verify-Persistence.command 2>/dev/null || true

# If there's an unpushed commit but nothing new to stage, jump straight to push.
if git diff --cached --quiet && [ "$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)" != "0" ]; then
  echo "No new changes — but you have unpushed commit(s). Pushing now..."
  if git push origin HEAD; then
    echo "✓ DEPLOYED SUCCESSFULLY."
  else
    echo "PUSH FAILED. See error above."
  fi
  read -n 1 -s -r -p "Press any key to close..."
  exit 0
fi

# If nothing changed, exit politely.
if git diff --cached --quiet; then
  echo "Nothing to commit — your local files match GitHub already."
  echo "If the live site still looks wrong, the issue is browser cache."
  echo "Press Cmd+Shift+R on the live page to force a hard reload."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 0
fi

echo "Committing..."
git commit -m "Deploy: Re-entry grant + resume answers + resume timer + split-screen passage"

echo

echo "Running npm audit (warning-only, never blocks deploy)..."
npm audit --audit-level=high --omit=dev 2>&1 | tail -20 || true
echo
echo "Pushing to GitHub..."
git push origin HEAD

PUSH_STATUS=$?
echo
if [ $PUSH_STATUS -eq 0 ]; then
  echo "============================================================"
  echo "  SUCCESS — pushed to GitHub."
  echo "  Render will start redeploying in ~30 seconds."
  echo "  Watch https://dashboard.render.com — wait for 'Live'."
  echo "  Then HARD reload the page in your browser (Cmd+Shift+R)."
  echo "============================================================"
else
  echo "============================================================"
  echo "  PUSH FAILED. Read the error above this line."
  echo "  Most likely: your GitHub token expired or is missing."
  echo "  Fix: generate a new token at"
  echo "       https://github.com/settings/tokens"
  echo "  with the 'repo' scope, then double-click this file again"
  echo "  and paste the new token when prompted."
  echo "============================================================"
fi
echo
read -n 1 -s -r -p "Press any key to close..."
