#!/bin/bash
set -e
cd "$(dirname "$0")/.."
nohup npx tsx src/index.ts > app.log 2>&1 &
echo $! > .pid
echo "Server started (PID: $(cat .pid))"
