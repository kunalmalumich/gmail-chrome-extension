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
  # OAUTH_CLIENT_ID or GOOGLE_CLIENT_ID must be provided
fi

echo "Starting extension build..."
echo "   Value of API_ENDPOINT is: '${API_ENDPOINT}'"
echo "   Value of AUTH_ENDPOINT is: '${AUTH_ENDPOINT}'"
echo "   Value of OAUTH_CHROME_CLIENT_ID is: '${OAUTH_CHROME_CLIENT_ID}'"

# The 'dist' directory will contain the ready-to-load extension.
# Recreating it ensures a clean build from scratch.
echo "=> Cleaning up old build..."
rm -rf dist
mkdir -p dist

# Note: For dual OAuth flow, we only need OAUTH_CHROME_CLIENT_ID for the manifest
# The OAUTH_CLIENT_ID and GOOGLE_CLIENT_ID are used by the content script for other purposes
echo "   Chrome OAuth client ID: '${OAUTH_CHROME_CLIENT_ID:-NOT_SET}'"

echo "=> Installing dependencies..."
npm install

echo "=> Building JavaScript files with esbuild..."
# Build content.js with node_modules support
npx esbuild content.js --bundle --outfile=dist/content.js --platform=browser --sourcemap \
  --minify=false \
  --define:"CONFIG.API_ENDPOINT='${API_ENDPOINT}'" \
  --define:"CONFIG.AUTH_ENDPOINT='${AUTH_ENDPOINT}'" \
  --define:"CONFIG.OAUTH_CLIENT_ID='${OAUTH_CLIENT_ID:-}'" \
  --define:"CONFIG.GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID:-}'" \
  --define:"CONFIG.OAUTH_CHROME_CLIENT_ID='${OAUTH_CHROME_CLIENT_ID:-}'"

# Build background.js
echo "=> Building background.js..."
npx esbuild background.js --bundle --outfile=dist/background.js --platform=browser --sourcemap \
  --minify=false \
  --define:"CONFIG.AUTH_ENDPOINT='${AUTH_ENDPOINT}'"

# Build OAuth callback detector
echo "=> Building oauth-callback-detector.js..."
npx esbuild oauth-callback-detector.js --bundle --outfile=dist/oauth-callback-detector.js --platform=browser --sourcemap \
  --minify=false

echo "=> Copying and processing manifest.json..."
# Copy manifest.json to dist directory
cp manifest.json dist/

# Replace Chrome OAuth client ID in the copied manifest.json
if [ -n "${OAUTH_CHROME_CLIENT_ID}" ]; then
  echo "   Replacing Chrome OAuth client ID in manifest.json..."
  # Use different sed syntax for macOS compatibility
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|1092910314489-oufjb6noqvia815318h8d40ontatbb08.apps.googleusercontent.com|${OAUTH_CHROME_CLIENT_ID}|g" dist/manifest.json
  else
    # Linux
    sed -i "s|1092910314489-oufjb6noqvia815318h8d40ontatbb08.apps.googleusercontent.com|${OAUTH_CHROME_CLIENT_ID}|g" dist/manifest.json
  fi
  echo "   Chrome OAuth client ID updated successfully"
else
  echo "   Warning: OAUTH_CHROME_CLIENT_ID not set, using existing client ID in manifest.json"
fi

echo "=> Copying extension assets..."
# Copy the InboxSDK page world script
echo "   Copying InboxSDK files..."
cp ../packages/core/pageWorld.js dist/
cp ../packages/core/pageWorld.js.map dist/

# Copy any PNG images (like logos)
echo "   Copying image files..."
cp *.png dist/ 2>/dev/null || echo "   Warning: No PNG files found"

# Copy CSS files for jspreadsheet integration
echo "   Copying CSS files..."
cp jspreadsheet.css dist/ 2>/dev/null || echo "   Warning: jspreadsheet.css not found"
cp jsuites.css dist/ 2>/dev/null || echo "   Warning: jsuites.css not found"

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

echo
echo "Build complete! 🎉"
echo "The complete extension has been built into the 'dist' directory."
echo "You can now load the 'dist' directory as an unpacked extension in your browser." 