#!/bin/bash
# Double-click this file to start Nuuge locally.
# It will open in Terminal, start the app, and open your browser.

cd "$(dirname "$0")"

echo ""
echo "  Starting Nuuge..."
echo "  (This window needs to stay open while you use the app.)"
echo "  To stop: press Control+C or close this window."
echo ""

# Wait for the server to be ready, then open browser
(sleep 5 && open http://localhost:3000) &

npm run dev
