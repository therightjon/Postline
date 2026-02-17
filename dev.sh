#!/bin/bash
# Postline local dev runner
# Starts the Azure Functions API and React frontend concurrently.
# Press Ctrl+C to stop both.

set -e

CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RESET='\033[0m'
BOLD='\033[1m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Stopping all processes..."
  kill 0
}
trap cleanup EXIT INT TERM

# Prefix each line of a process's output with a colored label
prefix_output() {
  local label="$1"
  local color="$2"
  while IFS= read -r line; do
    echo -e "${color}${BOLD}[${label}]${RESET} ${line}"
  done
}

echo -e "${BOLD}Starting Postline locally...${RESET}"
echo -e "  API  →  http://localhost:7071"
echo -e "  App  →  http://localhost:5173"
echo ""

# Start API
(
  cd "$ROOT/api"
  func start 2>&1
) | prefix_output "api" "$CYAN" &

# Start client
(
  cd "$ROOT/client"
  npm run dev 2>&1
) | prefix_output "app" "$MAGENTA" &

# Wait for both background jobs
wait
