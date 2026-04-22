#!/bin/bash
if [ -f .pid ]; then
  kill $(cat .pid) 2>/dev/null && rm .pid && echo 'Server stopped'
else
  echo 'No server running'
fi
