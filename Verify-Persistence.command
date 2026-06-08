#!/bin/bash
# Verify-Persistence.command — runs after you've added the Render Disk.
# Hits the live ClassCurio server, confirms it's responding, and prints
# what to do next. You'll do the real persistence test by hand (create a
# class, click Manual Redeploy, refresh, check it survived) — this script
# just confirms the server is reachable BEFORE you bother rebuilding data.

set -u
URL="https://lockdown-asessment.onrender.com"
echo "============================================================"
echo "  ClassCurio · Persistence Check"
echo "============================================================"
echo
echo "Checking ${URL} ..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$URL/")
case "$CODE" in
  200|301|302)
    echo "✓ Server is responding (HTTP $CODE)."
    echo
    echo "Now do the manual persistence test:"
    echo
    echo "  1. Open $URL in your browser, sign in as a teacher."
    echo "  2. Click 'Manage classes' and add a class called  TEST PERSISTENCE  ."
    echo "  3. Go to https://dashboard.render.com → your service →"
    echo "     'Manual Deploy' → 'Clear build cache & deploy'."
    echo "  4. Wait until the deploy banner says 'Live' (~2 minutes)."
    echo "  5. Hard-reload the app:  Cmd + Shift + R"
    echo "  6. Open Manage classes again."
    echo
    echo "  ✓ If 'TEST PERSISTENCE' is still there → your Disk is mounted"
    echo "    correctly and you can safely start rebuilding everything."
    echo
    echo "  ✗ If it's gone → the Disk mount path is wrong. Open Render"
    echo "    → your service → Disks, check Mount path is exactly:"
    echo "       /opt/render/project/src/data"
    echo "    Edit if needed, save, and re-run this test."
    ;;
  000)
    echo "✗ Server did not respond. Could be:"
    echo "  - Render is still deploying (wait 2 minutes, try again)"
    echo "  - The service is paused/spun down — hit the URL in a browser"
    echo "    to wake it, then re-run this script."
    ;;
  502|503|504)
    echo "✗ Server returned HTTP $CODE — Render is mid-deploy or the app"
    echo "  crashed at startup. Open Render → Logs and look for an error."
    ;;
  *)
    echo "? Server returned HTTP $CODE (not the usual 200)."
    echo "  Open $URL/ in your browser to see what's happening."
    ;;
esac
echo
read -n 1 -s -r -p "Press any key to close..."
