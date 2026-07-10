#!/bin/bash
# RO Digital Twin - Start App
# Double-click this file every time you want to open the app

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Starting RO Digital Twin..."

# Start ML Server
osascript -e "tell application \"Terminal\"
    activate
    do script \"echo 'Starting ML Server...' && cd '$DIR' && python3 ml_server.py\"
end tell"

sleep 2

# Start Backend Server
osascript -e "tell application \"Terminal\"
    activate
    do script \"echo 'Starting Backend Server...' && cd '$DIR' && node server.js\"
end tell"

sleep 2

# Start Frontend and open browser
osascript -e "tell application \"Terminal\"
    activate
    do script \"echo 'Starting Frontend...' && cd '$DIR/frontend' && npm run dev\"
end tell"

sleep 5

# Open browser automatically
open http://localhost:5173

echo "App is starting! Browser will open in a few seconds..."
