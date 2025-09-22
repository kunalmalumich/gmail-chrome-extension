# PowerShell build script for Stamp Chrome Extension
# This script builds the extension for production deployment

Write-Host "=> Checking for .env file..." -ForegroundColor Green

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "   .env file found. Loading variables..." -ForegroundColor Yellow
    
    # Read .env file and set environment variables
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            $value = $value -replace '^"(.*)"$', '$1'
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "   Set $name = $value" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   .env file not found. Using production values." -ForegroundColor Yellow
    $env:API_ENDPOINT = "https://nmuo25f2da.execute-api.us-east-2.amazonaws.com/prod"
    $env:AUTH_ENDPOINT = "https://70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller"
    $env:PREFER_GOOGLE_CLIENT = "true"
    $env:GOOGLE_CLIENT_ID = "759225635526-dsidm6o777blfol5h26g6jfqhad710td.apps.googleusercontent.com"
    $env:GOOGLE_CLIENT_SECRET = "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"
    $env:GOOGLE_CHROME_CLIENT_ID = "759225635526-gs69pgupgap87o4ul9ud9pv8pjrupcgc.apps.googleusercontent.com"
    $env:OAUTH_CLIENT_ID = "1092910314489-5ai7696i783lbetbqdfqdn14t0p4r05v.apps.googleusercontent.com"
    $env:OAUTH_CLIENT_SECRET = "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"
    $env:OAUTH_CHROME_CLIENT_ID = "1092910314489-fifnmecl4khjvm0nobb12lo4oimh8le6.apps.googleusercontent.com"
    $env:MOCK_BACKEND = "false"
}

# Handle client preference logic
if ($env:PREFER_GOOGLE_CLIENT -eq "true") {
    Write-Host "=> Using Google client credentials" -ForegroundColor Green
    $FINAL_CLIENT_ID = $env:GOOGLE_CLIENT_ID
    $FINAL_CLIENT_SECRET = $env:GOOGLE_CLIENT_SECRET
    $FINAL_CHROME_CLIENT_ID = $env:GOOGLE_CHROME_CLIENT_ID
    Write-Host "   Selected CLIENT_ID: $FINAL_CLIENT_ID" -ForegroundColor Gray
    Write-Host "   Selected CLIENT_SECRET: $($FINAL_CLIENT_SECRET.Substring(0, [Math]::Min(10, $FINAL_CLIENT_SECRET.Length)))..." -ForegroundColor Gray
    Write-Host "   Selected CHROME_CLIENT_ID: $FINAL_CHROME_CLIENT_ID" -ForegroundColor Gray
} else {
    Write-Host "=> Using OAuth client credentials" -ForegroundColor Green
    $FINAL_CLIENT_ID = $env:OAUTH_CLIENT_ID
    $FINAL_CLIENT_SECRET = $env:OAUTH_CLIENT_SECRET
    $FINAL_CHROME_CLIENT_ID = $env:OAUTH_CHROME_CLIENT_ID
    Write-Host "   Selected CLIENT_ID: $FINAL_CLIENT_ID" -ForegroundColor Gray
    Write-Host "   Selected CLIENT_SECRET: $($FINAL_CLIENT_SECRET.Substring(0, [Math]::Min(10, $FINAL_CLIENT_SECRET.Length)))..." -ForegroundColor Gray
    Write-Host "   Selected CHROME_CLIENT_ID: $FINAL_CHROME_CLIENT_ID" -ForegroundColor Gray
}

Write-Host "Starting extension build..." -ForegroundColor Green
Write-Host "   Value of API_ENDPOINT is: '$env:API_ENDPOINT'" -ForegroundColor Gray
Write-Host "   Value of AUTH_ENDPOINT is: '$env:AUTH_ENDPOINT'" -ForegroundColor Gray
Write-Host "   Value of FINAL_CHROME_CLIENT_ID is: '$FINAL_CHROME_CLIENT_ID'" -ForegroundColor Gray

# The 'dist' directory will contain the ready-to-load extension.
# Recreating it ensures a clean build from scratch.
Write-Host "=> Cleaning up old build..." -ForegroundColor Green
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
New-Item -ItemType Directory -Path "dist" | Out-Null

Write-Host "   Chrome OAuth client ID: '$FINAL_CHROME_CLIENT_ID'" -ForegroundColor Gray

Write-Host "=> Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "=> Building JavaScript files with esbuild..." -ForegroundColor Green

# Build content.js with node_modules support
Write-Host "   Building content.js..." -ForegroundColor Yellow
npx esbuild content.js --bundle --outfile=dist/content.js --platform=browser --sourcemap --minify=false --define:"CONFIG.API_ENDPOINT='$env:API_ENDPOINT'" --define:"CONFIG.AUTH_ENDPOINT='$env:AUTH_ENDPOINT'" --define:"CONFIG.CLIENT_ID='$FINAL_CLIENT_ID'" --define:"CONFIG.CLIENT_SECRET='$FINAL_CLIENT_SECRET'" --define:"CONFIG.CHROME_CLIENT_ID='$FINAL_CHROME_CLIENT_ID'"

# Build background.js
Write-Host "=> Building background.js..." -ForegroundColor Green
npx esbuild background.js --bundle --outfile=dist/background.js --platform=browser --sourcemap --minify=false --define:"CONFIG.AUTH_ENDPOINT='$env:AUTH_ENDPOINT'"

# Build OAuth callback detector
Write-Host "=> Building oauth-callback-detector.js..." -ForegroundColor Green
npx esbuild oauth-callback-detector.js --bundle --outfile=dist/oauth-callback-detector.js --platform=browser --sourcemap --minify=false

Write-Host "=> Copying manifest.json..." -ForegroundColor Green
Copy-Item "manifest.json" "dist/"
Write-Host "   manifest.json copied successfully (client_id left as-is)" -ForegroundColor Gray

Write-Host "=> Copying extension assets..." -ForegroundColor Green

# Copy any PNG images (like logos)
Write-Host "   Copying image files..." -ForegroundColor Yellow
Copy-Item "*.png" "dist/" -ErrorAction SilentlyContinue

# Copy CSS files for jspreadsheet integration
Write-Host "   Copying CSS files..." -ForegroundColor Yellow
Copy-Item "jspreadsheet.css" "dist/" -ErrorAction SilentlyContinue
Copy-Item "jsuites.css" "dist/" -ErrorAction SilentlyContinue
Copy-Item "stamp-spreadsheet-theme.css" "dist/" -ErrorAction SilentlyContinue

# Copy jsuites.js file
Write-Host "   Copying jsuites.js..." -ForegroundColor Yellow
if (Test-Path "node_modules\jsuites\dist\jsuites.js") {
    Copy-Item "node_modules\jsuites\dist\jsuites.js" "dist/"
    Write-Host "   jsuites.js copied successfully" -ForegroundColor Gray
} else {
    Write-Host "   Warning: jsuites.js not found" -ForegroundColor Yellow
}

# Copy floating chat files
Write-Host "   Copying floating chat files..." -ForegroundColor Yellow
if (Test-Path "floating-chat") {
    Copy-Item -Recurse "floating-chat" "dist/"
    Write-Host "   Floating chat files copied successfully" -ForegroundColor Gray
} else {
    Write-Host "   Warning: floating-chat directory not found" -ForegroundColor Yellow
}

# Copy InboxSDK pageWorld files
Write-Host "   Copying InboxSDK pageWorld files..." -ForegroundColor Yellow
if (Test-Path "node_modules\@inboxsdk\core\pageWorld.js") {
    Copy-Item "node_modules\@inboxsdk\core\pageWorld.js" "dist/"
    Copy-Item "node_modules\@inboxsdk\core\pageWorld.js.map" "dist/"
    Write-Host "   InboxSDK pageWorld files copied successfully" -ForegroundColor Gray
} else {
    Write-Host "   Warning: InboxSDK pageWorld files not found" -ForegroundColor Yellow
}

# Copy popup files (these are essential for the extension to work)
Write-Host "   Copying popup files..." -ForegroundColor Yellow
if (Test-Path "popup.html") {
    Copy-Item "popup.html" "dist/"
    Write-Host "   popup.html copied successfully" -ForegroundColor Gray
} else {
    Write-Host "   ERROR: popup.html not found - this will break the extension!" -ForegroundColor Red
    exit 1
}

if (Test-Path "popup.js") {
    Copy-Item "popup.js" "dist/"
    Write-Host "   popup.js copied successfully" -ForegroundColor Gray
} else {
    Write-Host "   ERROR: popup.js not found - this will break the extension!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build complete! 🎉" -ForegroundColor Green
Write-Host "The complete extension has been built into the 'dist' directory." -ForegroundColor Green
Write-Host "You can now load the 'dist' directory as an unpacked extension in your browser." -ForegroundColor Green
Write-Host "Note: Make sure to manually set the correct client_id in dist/manifest.json if needed." -ForegroundColor Yellow
