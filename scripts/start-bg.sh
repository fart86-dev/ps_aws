#!/bin/bash
set -e
cd "$(dirname "$0")/.."
nohup node dist/index.js > app.log 2>&1 &
echo $! > .pid
echo "Server started (PID: $(cat .pid))"
