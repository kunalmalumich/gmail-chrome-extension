#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Load environment variables from .env file
echo "=> Checking for .env file..."
if [ -f .env ]; then
  echo "   .env file found. Loading variables..."
  export $(grep -v '^#' .env | xargs)
else
  echo "   .env file not found. Using default values."
  export API_ENDPOINT="http://localhost:8000"
  export AUTH_ENDPOINT="http://localhost:3000/email-poller" 
fi

# Handle client preference logic
if [ "${PREFER_GOOGLE_CLIENT}" = "true" ]; then
  echo "=> Using Google client credentials"
  FINAL_CLIENT_ID="${GOOGLE_CLIENT_ID}"
  FINAL_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}"
  FINAL_CHROME_CLIENT_ID="${GOOGLE_CHROME_CLIENT_ID}"
  echo "   Selected CLIENT_ID: ${FINAL_CLIENT_ID}"
  echo "   Selected CLIENT_SECRET: ${FINAL_CLIENT_SECRET:0:10}..." # Show first 10 chars only
  echo "   Selected CHROME_CLIENT_ID: ${FINAL_CHROME_CLIENT_ID}"
else
  echo "=> Using OAuth client credentials"
  FINAL_CLIENT_ID="${OAUTH_CLIENT_ID}"
  FINAL_CLIENT_SECRET="${OAUTH_CLIENT_SECRET}"
  FINAL_CHROME_CLIENT_ID="${OAUTH_CHROME_CLIENT_ID}"
  echo "   Selected CLIENT_ID: ${FINAL_CLIENT_ID}"
  echo "   Selected CLIENT_SECRET: ${FINAL_CLIENT_SECRET:0:10}..." # Show first 10 chars only
  echo "   Selected CHROME_CLIENT_ID: ${FINAL_CHROME_CLIENT_ID}"
fi

echo "Starting extension build..."
echo "   Value of API_ENDPOINT is: '${API_ENDPOINT}'"
echo "   Value of AUTH_ENDPOINT is: '${AUTH_ENDPOINT}'"
echo "   Value of FINAL_CHROME_CLIENT_ID is: '${FINAL_CHROME_CLIENT_ID}'"

# The 'dist' directory will contain the ready-to-load extension.
# Recreating it ensures a clean build from scratch.
echo "=> Cleaning up old build..."
rm -rf dist
mkdir -p dist

# Note: For dual OAuth flow, we use separate client IDs for Chrome extension and web OAuth
# The FINAL_CLIENT_ID and FINAL_CLIENT_SECRET are used by the content script for web OAuth
# The Chrome extension OAuth client ID is manually set in manifest.json
echo "   Chrome OAuth client ID: '${FINAL_CHROME_CLIENT_ID:-NOT_SET}'"

echo "=> Installing dependencies..."
npm install

echo "=> Building JavaScript files with esbuild..."
# Build content.js with node_modules support
npx esbuild content.js --bundle --outfile=dist/content.js --platform=browser --sourcemap \
  --minify=false \
  --define:"CONFIG.API_ENDPOINT='${API_ENDPOINT}'" \
  --define:"CONFIG.AUTH_ENDPOINT='${AUTH_ENDPOINT}'" \
  --define:"CONFIG.CLIENT_ID='${FINAL_CLIENT_ID:-}'" \
  --define:"CONFIG.CLIENT_SECRET='${FINAL_CLIENT_SECRET:-}'" \
  --define:"CONFIG.CHROME_CLIENT_ID='${FINAL_CHROME_CLIENT_ID:-}'"

# Build background.js
echo "=> Building background.js..."
npx esbuild background.js --bundle --outfile=dist/background.js --platform=browser --sourcemap \
  --minify=false \
  --define:"CONFIG.AUTH_ENDPOINT='${AUTH_ENDPOINT}'"

# Build OAuth callback detector
echo "=> Building oauth-callback-detector.js..."
npx esbuild oauth-callback-detector.js --bundle --outfile=dist/oauth-callback-detector.js --platform=browser --sourcemap \
  --minify=false

echo "=> Copying manifest.json..."
# Copy manifest.json to dist directory (no client_id replacement)
cp manifest.json dist/
echo "   manifest.json copied successfully (client_id left as-is)"

echo "=> Copying extension assets..."
# Copy the InboxSDK page world script
echo "   Copying InboxSDK files..."
cp ../packages/core/pageWorld.js dist/
cp ../packages/core/pageWorld.js.map dist/
echo "   pageWorld.js files copied successfully"

# Copy any PNG images (like logos)
echo "   Copying image files..."
cp *.png dist/ 2>/dev/null || echo "   Warning: No PNG files found"

# Copy CSS files for jspreadsheet integration
echo "   Copying CSS files..."
cp jspreadsheet.css dist/ 2>/dev/null || echo "   Warning: jspreadsheet.css not found"
cp jsuites.css dist/ 2>/dev/null || echo "   Warning: jsuites.css not found"
cp stamp-spreadsheet-theme.css dist/ 2>/dev/null || echo "   Warning: stamp-spreadsheet-theme.css not found"

# Copy floating chat files
echo "   Copying floating chat files..."
if [ -d "floating-chat" ]; then
  cp -r floating-chat dist/
  echo "   Floating chat files copied successfully"
else
  echo "   Warning: floating-chat directory not found"
fi

# Copy popup files (these are essential for the extension to work)
echo "   Copying popup files..."
if [ -f "popup.html" ]; then
  cp popup.html dist/
  echo "   popup.html copied successfully"
else
  echo "   ERROR: popup.html not found - this will break the extension!"
  exit 1
fi

if [ -f "popup.js" ]; then
  cp popup.js dist/
  echo "   popup.js copied successfully"
else
  echo "   ERROR: popup.js not found - this will break the extension!"
  exit 1
fi

# Copy additional required files for jsuites/jspreadsheet
echo "   Copying additional jsuites/jspreadsheet files..."
cp node_modules/jsuites/dist/jsuites.js dist/ 2>/dev/null || echo "   Warning: node_modules/jsuites/dist/jsuites.js not found"
cp node_modules/jspreadsheet/dist/jspreadsheet.js dist/ 2>/dev/null || echo "   Warning: node_modules/jspreadsheet/dist/jspreadsheet.js not found"

echo
echo "Build complete! 🎉"
echo "The complete extension has been built into the 'dist' directory."
echo "You can now load the 'dist' directory as an unpacked extension in your browser."
echo "Note: Make sure to manually set the correct client_id in dist/manifest.json if needed."