#!/usr/bin/env bash
# analyze-setup.sh — Pre-flight checks for analysis test automation
#
# Automatically:
# 1. Verifies (and installs if missing) xvfb
# 2. Starts the Vite dev server on port 3000 (if not already running)
# 3. Runs the test command (passed as argument)
#
# Usage: scripts/analyze-setup.sh <vitest-command>
# Called automatically by npm run test:analysis and npm run test:all

set -euo pipefail

cd "$(dirname "$0")/.."

# ---- Cleanup handler ----
VITE_PID=""
cleanup() {
  if [[ -n "$VITE_PID" ]] && kill -0 "$VITE_PID" 2>/dev/null; then
    echo ""
    echo "⚠️  Stopping Vite dev server (PID $VITE_PID)..."
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ---- 1. Check/install xvfb ----
if command -v xvfb-run >/dev/null 2>&1; then
  echo "✅ xvfb is installed"
else
  echo "⚠️  xvfb not found. Attempting installation..."
  if command -v apt-get >/dev/null 2>&1; then
    echo "  → Installing via apt-get (may require sudo)..."
    sudo apt-get install -y xvfb 2>&1 | tail -1
  elif command -v yum >/dev/null 2>&1; then
    echo "  → Installing via yum..."
    sudo yum install -y xorg-x11-server-Xvfb 2>&1 | tail -1
  else
    echo "❌ Cannot determine package manager. Please install xvfb manually:"
    echo "   Debian/Ubuntu: sudo apt-get install xvfb"
    echo "   RHEL/CentOS:   sudo yum install xorg-x11-server-Xvfb"
    echo "   macOS:         brew install --cask xquartz"
    exit 1
  fi
  
  if ! command -v xvfb-run >/dev/null 2>&1; then
    echo "❌ Failed to install xvfb. Please install manually."
    exit 1
  fi
  echo "✅ xvfb installed successfully"
fi

# ---- 2. Start Vite dev server on port 3000 if not running ----
if lsof -i :3000 >/dev/null 2>&1; then
  echo "✅ Vite dev server already running on port 3000"
else
  echo "⚠️  Vite dev server not running on port 3000. Starting..."
  npx vite --port 3000 > /tmp/vite-analyze.log 2>&1 &
  VITE_PID=$!
  
  # Wait for server to be ready (up to 30 seconds)
  for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
      echo "✅ Vite dev server started (PID $VITE_PID)"
      break
    fi
    sleep 1
  done
  
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "❌ Failed to start Vite dev server. Check /tmp/vite-analyze.log"
    exit 1
  fi
fi

# ---- 3. Run the test command ----
echo ""
echo "▶️  Running: $*"
echo ""

# Execute the passed command under xvfb-run
xvfb-run "$@"
