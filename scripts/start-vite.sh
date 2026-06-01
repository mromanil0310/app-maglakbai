#!/bin/bash
# Dev server — runs at http://localhost:8082
# Usage: bash scripts/start-vite.sh
cd "$(dirname "$0")/.."
echo "Starting EvolveXP dev server at http://localhost:8082 ..."
node node_modules/.bin/vite --port 8082
