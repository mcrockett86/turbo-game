#!/usr/bin/env bash
# run-with-xvfb.sh — Run a command under Xvfb with GPU support
# Usage: ./run-with-xvfb.sh <command> [args...]
#
# Starts a virtual X display, exports DISPLAY, and executes the command.
# The Xvfb process is cleaned up automatically on exit.

set -euo pipefail

# Find Xvfb
XVFB="$(command -v Xvfb 2>/dev/null || echo "")"
if [[ -z "$XVFB" ]]; then
  echo "ERROR: Xvfb not found. Install with: sudo apt-get install xvfb" >&2
  exit 1
fi

# Pick a free display number (start at 99)
DISPLAY_NUM=99
while true; do
  # Check if display is already in use
  if ! pgrep -f "Xvfb :${DISPLAY_NUM}" >/dev/null 2>&1; then
    break
  fi
  DISPLAY_NUM=$((DISPLAY_NUM + 1))
  if [[ $DISPLAY_NUM -gt 110 ]]; then
    echo "ERROR: Could not find a free X display" >&2
    exit 1
  fi
done

export DISPLAY=":${DISPLAY_NUM}"
SCREEN="0:1920x1080x24"

echo "[xvfb] Starting Xvfb on display ${DISPLAY} (${SCREEN})"
XVFB_PID=""

cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "[xvfb] Stopping Xvfb (PID ${XVFB_PID})"
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Start Xvfb in background
"$XVFB" "$DISPLAY" -screen "$SCREEN" -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 1

# Verify Xvfb is running
if ! kill -0 "$XVFB_PID" 2>/dev/null; then
  echo "ERROR: Xvfb failed to start on display ${DISPLAY}" >&2
  exit 1
fi

echo "[xvfb] Xvfb running (PID ${XVFB_PID}), DISPLAY=${DISPLAY}"
echo "[xvfb] Running: $*"
echo ""

# Execute the command
exec "$@"
