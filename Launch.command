#!/bin/bash
# Double-click this file on a Mac to launch the Lockdown Assessment app.
# On first run it will install dependencies; after that, it just launches.

set -e
cd "$(dirname "$0")"

# Make Terminal more useful while this runs.
clear
echo "==================================================="
echo "  Lockdown Assessment — Launching…"
echo "==================================================="
echo

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo
  echo "Please install it first:"
  echo "  1. A browser window will open to https://nodejs.org"
  echo "  2. Click the big green 'LTS' button to download the installer"
  echo "  3. Open the downloaded .pkg and click through it"
  echo "  4. Come back and double-click Launch.command again"
  echo
  open "https://nodejs.org/en/download/prebuilt-installer"
  echo "Press Return to close this window…"
  read
  exit 1
fi

echo "Node.js found: $(node -v)"
echo

# 2. Install dependencies the first time.
if [ ! -d "node_modules" ]; then
  echo "First-time setup: installing dependencies. This takes 2–3 minutes…"
  echo
  npm install
  echo
  echo "Setup complete."
  echo
fi

# 3. Launch.
echo "Starting the app. A fullscreen window will open shortly."
echo "(Leave this Terminal window alone — closing it will close the app.)"
echo
npm run dev
