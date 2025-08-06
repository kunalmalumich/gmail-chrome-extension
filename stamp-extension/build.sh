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
  export API_ENDPOINT="https://86cb9e6d9329.ngrok-free.app/email-poller"
  # OAUTH_CLIENT_ID or GOOGLE_CLIENT_ID must be provided
fi

echo "Starting extension build..."
echo "   Value of API_ENDPOINT is: '${API_ENDPOINT}'"
echo "   Value of OAUTH_CLIENT_ID is: '${OAUTH_CLIENT_ID}'"
echo "   Value of GOOGLE_CLIENT_ID is: '${GOOGLE_CLIENT_ID}'"

# The 'dist' directory will contain the ready-to-load extension.
# Recreating it ensures a clean build from scratch.
echo "=> Cleaning up old build..."
rm -rf dist
mkdir -p dist

# Validate required environment variables - prioritize OAUTH_CLIENT_ID
if [ -z "${OAUTH_CLIENT_ID}" ] && [ -z "${GOOGLE_CLIENT_ID}" ]; then
  echo "Error: Neither OAUTH_CLIENT_ID nor GOOGLE_CLIENT_ID is set in .env file"
  exit 1
fi

# Use OAUTH_CLIENT_ID if available, otherwise fall back to GOOGLE_CLIENT_ID
CLIENT_ID_TO_USE="${OAUTH_CLIENT_ID:-$GOOGLE_CLIENT_ID}"
echo "   Using CLIENT_ID: '${CLIENT_ID_TO_USE}'"

echo "=> Installing dependencies..."
npm install

echo "=> Building JavaScript files with esbuild..."
# Build content.js with node_modules support
npx esbuild content.js --bundle --outfile=dist/content.js --platform=browser --sourcemap \
  --minify=false \
  --define:"CONFIG.API_ENDPOINT='${API_ENDPOINT}'" \
  --define:"CONFIG.OAUTH_CLIENT_ID='${OAUTH_CLIENT_ID:-}'" \
  --define:"CONFIG.GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID:-}'"

# Build background.js
echo "=> Building background.js..."
npx esbuild background.js --bundle --outfile=dist/background.js --platform=browser --sourcemap \
  --minify=false

echo "=> Copying and processing manifest.json..."
# Replace client ID in manifest.json
# Use a different delimiter for sed to handle URLs safely
sed "s|759225635526-dsidm6o777blfol5h26g6jfqhad710td.apps.googleusercontent.com|${CLIENT_ID_TO_USE}|" manifest.json > dist/manifest.json

echo "=> Copying extension assets..."
# Copy the InboxSDK page world script
cp ../packages/core/pageWorld.js dist/
cp ../packages/core/pageWorld.js.map dist/

# Copy any PNG images (like logos)
cp *.png dist/ 2>/dev/null || true

# Copy CSS files for jspreadsheet integration
echo "=> Copying CSS files for jspreadsheet..."
cp jspreadsheet.css dist/ 2>/dev/null || echo "   Warning: jspreadsheet.css not found"
cp jsuites.css dist/ 2>/dev/null || echo "   Warning: jsuites.css not found"

# Copy floating chat files
echo "=> Copying floating chat files..."
if [ -d "floating-chat" ]; then
  cp -r floating-chat dist/
  echo "   Floating chat files copied successfully"
else
  echo "   Warning: floating-chat directory not found"
fi

echo
echo "Build complete! 🎉"
echo "The complete extension has been built into the 'dist' directory."
echo "You can now load the 'dist' directory as an unpacked extension in your browser." 