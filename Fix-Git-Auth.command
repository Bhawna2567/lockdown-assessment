#!/bin/bash
# Fix-Git-Auth.command — one-time setup so Deploy-Now.command
# never asks for GitHub credentials again.
#
# What it does:
#   1. Configures git to use macOS Keychain for credential storage.
#   2. Sets the remote URL with your GitHub username.
#   3. Prompts once for your token — stored securely in Keychain.
#   4. After this runs, Deploy-Now.command pushes with no prompts.
#
# You only need to run this ONCE (or again if you generate a new token).

set -e
cd "/Users/minnie/Desktop/App docs/Classcurio Docs/lockdown-assessment" || {
  echo "ERROR: repo folder not found."
  echo "Press any key to close..."
  read -n 1
  exit 1
}

echo "======================================================"
echo "  ClassCurio · Git Auth Setup"
echo "======================================================"
echo ""
echo "This will configure git to remember your GitHub token"
echo "in macOS Keychain, so you never have to paste it again."
echo ""

# 1) Configure macOS keychain as the credential helper.
git config --global credential.helper osxkeychain
echo "OK — macOS Keychain configured as credential store."

# 2) Fix the remote URL so it uses your username.
git remote set-url origin https://Bhawna2567@github.com/Bhawna2567/lockdown-assessment.git
echo "OK — remote URL set with GitHub username Bhawna2567."

# 3) Clear any stale keychain entry so git prompts fresh.
security delete-internet-password -a Bhawna2567 -s github.com 2>/dev/null || true

echo ""
echo "======================================================"
echo "  Step 1 of 2 — generate a GitHub token"
echo "======================================================"
echo ""
echo "  1. Open: https://github.com/settings/tokens"
echo "  2. Click 'Tokens (classic)' in the left sidebar."
echo "  3. Click 'Generate new token (classic)'."
echo "  4. Note: 'ClassCurio deploy'"
echo "     Expiration: 90 days (or No expiration)"
echo "     Scopes: check the 'repo' box"
echo "  5. Click 'Generate token' at the bottom."
echo "  6. COPY the token that appears (starts with ghp_...)"
echo ""
echo "When you've copied the token, press Enter here to continue..."
read

echo ""
echo "======================================================"
echo "  Step 2 of 2 — test the push"
echo "======================================================"
echo ""
echo "Git will prompt you for a password. Paste your token."
echo "  - If Cmd+V doesn't work, right-click and choose Paste."
echo "  - The prompt won't show anything as you paste. That's normal."
echo "  - Then press Enter."
echo ""
echo "After this succeeds, your token is saved in Keychain forever."
echo ""

# Trigger a push. Git will prompt once, keychain remembers, done.
git push origin main

echo ""
echo "======================================================"
echo "  DONE — Deploy-Now.command will now push silently."
echo "======================================================"
echo ""
echo "Press any key to close..."
read -n 1
