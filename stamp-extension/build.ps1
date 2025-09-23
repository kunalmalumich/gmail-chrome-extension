# PowerShell Build Script for Stamp Extension
# Converted from build.sh

# Exit on any error
$ErrorActionPreference = "Stop"

# Load environment variables from .env file
Write-Host "=> Checking for .env file..." -ForegroundColor Green
if (Test-Path ".env") {
    Write-Host "   .env file found. Loading variables..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "   .env file not found. Using default values." -ForegroundColor Yellow
    $env:API_ENDPOINT = "http://localhost:8000"
    $env:AUTH_ENDPOINT = "http://localhost:3000/email-poller"
}

# Handle client preference logic
if ($env:PREFER_GOOGLE_CLIENT -eq "true") {
    Write-Host "=> Using Google client credentials" -ForegroundColor Green
    $env:FINAL_CLIENT_ID = $env:GOOGLE_CLIENT_ID
    $env:FINAL_CLIENT_SECRET = $env:GOOGLE_CLIENT_SECRET
    $env:FINAL_CHROME_CLIENT_ID = $env:GOOGLE_CHROME_CLIENT_ID
    if ($env:FINAL_CLIENT_ID) {
        Write-Host "   Selected CLIENT_ID: $($env:FINAL_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CLIENT_ID.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CLIENT_ID: (not set)" -ForegroundColor Cyan
    }
    if ($env:FINAL_CLIENT_SECRET) {
        Write-Host "   Selected CLIENT_SECRET: $($env:FINAL_CLIENT_SECRET.Substring(0, [Math]::Min(10, $env:FINAL_CLIENT_SECRET.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CLIENT_SECRET: (not set)" -ForegroundColor Cyan
    }
    if ($env:FINAL_CHROME_CLIENT_ID) {
        Write-Host "   Selected CHROME_CLIENT_ID: $($env:FINAL_CHROME_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CHROME_CLIENT_ID.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CHROME_CLIENT_ID: (not set)" -ForegroundColor Cyan
    }
} else {
    Write-Host "=> Using OAuth client credentials" -ForegroundColor Green
    $env:FINAL_CLIENT_ID = $env:OAUTH_CLIENT_ID
    $env:FINAL_CLIENT_SECRET = $env:OAUTH_CLIENT_SECRET
    $env:FINAL_CHROME_CLIENT_ID = $env:OAUTH_CHROME_CLIENT_ID
    if ($env:FINAL_CLIENT_ID) {
        Write-Host "   Selected CLIENT_ID: $($env:FINAL_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CLIENT_ID.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CLIENT_ID: (not set)" -ForegroundColor Cyan
    }
    if ($env:FINAL_CLIENT_SECRET) {
        Write-Host "   Selected CLIENT_SECRET: $($env:FINAL_CLIENT_SECRET.Substring(0, [Math]::Min(10, $env:FINAL_CLIENT_SECRET.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CLIENT_SECRET: (not set)" -ForegroundColor Cyan
    }
    if ($env:FINAL_CHROME_CLIENT_ID) {
        Write-Host "   Selected CHROME_CLIENT_ID: $($env:FINAL_CHROME_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CHROME_CLIENT_ID.Length)))..." -ForegroundColor Cyan
    } else {
        Write-Host "   Selected CHROME_CLIENT_ID: (not set)" -ForegroundColor Cyan
    }
}

Write-Host "Starting extension build..." -ForegroundColor Green
Write-Host "   Value of API_ENDPOINT is: '$($env:API_ENDPOINT)'" -ForegroundColor Cyan
Write-Host "   Value of AUTH_ENDPOINT is: '$($env:AUTH_ENDPOINT)'" -ForegroundColor Cyan
if ($env:FINAL_CHROME_CLIENT_ID) {
    Write-Host "   Value of FINAL_CHROME_CLIENT_ID is: '$($env:FINAL_CHROME_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CHROME_CLIENT_ID.Length)))...'" -ForegroundColor Cyan
} else {
    Write-Host "   Value of FINAL_CHROME_CLIENT_ID is: (not set)" -ForegroundColor Cyan
}

# The 'dist' directory will contain the ready-to-load extension.
# Recreating it ensures a clean build from scratch.
Write-Host "=> Cleaning up old build..." -ForegroundColor Green
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
New-Item -ItemType Directory -Path "dist" | Out-Null

# Note: For dual OAuth flow, we use separate client IDs for Chrome extension and web OAuth
# The FINAL_CLIENT_ID and FINAL_CLIENT_SECRET are used by the content script for web OAuth
# The Chrome extension OAuth client ID is manually set in manifest.json
if ($env:FINAL_CHROME_CLIENT_ID) {
    Write-Host "   Chrome OAuth client ID: '$($env:FINAL_CHROME_CLIENT_ID.Substring(0, [Math]::Min(10, $env:FINAL_CHROME_CLIENT_ID.Length)))...'" -ForegroundColor Cyan
} else {
    Write-Host "   Chrome OAuth client ID: (not set)" -ForegroundColor Cyan
}

Write-Host "=> Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "=> Building JavaScript files with esbuild..." -ForegroundColor Green
# Build content.js with node_modules support
Write-Host "   Building content.js..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -Command ".\node_modules\.bin\esbuild content.js --bundle --outfile=dist/content.js --platform=browser --sourcemap --minify=false"

# Build background.js
Write-Host "=> Building background.js..." -ForegroundColor Green
& powershell -ExecutionPolicy Bypass -Command ".\node_modules\.bin\esbuild background.js --bundle --outfile=dist/background.js --platform=browser --sourcemap --minify=false"

# Build OAuth callback detector
Write-Host "=> Building oauth-callback-detector.js..." -ForegroundColor Green
& powershell -ExecutionPolicy Bypass -Command ".\node_modules\.bin\esbuild oauth-callback-detector.js --bundle --outfile=dist/oauth-callback-detector.js --platform=browser --sourcemap --minify=false"

Write-Host "=> Copying manifest.json..." -ForegroundColor Green
# Copy manifest.json to dist directory (no client_id replacement)
Copy-Item "manifest.json" "dist/"
Write-Host "   manifest.json copied successfully (client_id left as-is)" -ForegroundColor Yellow

Write-Host "=> Copying extension assets..." -ForegroundColor Green
# Copy the InboxSDK page world script
Write-Host "   Copying InboxSDK files..." -ForegroundColor Yellow
# Skip copying pageWorld.js as it's already in dist from previous build
Write-Host "   pageWorld.js files already present in dist/" -ForegroundColor Yellow

# Copy any PNG images (like logos)
Write-Host "   Copying image files..." -ForegroundColor Yellow
$pngFiles = Get-ChildItem "*.png" -ErrorAction SilentlyContinue
if ($pngFiles) {
    Copy-Item "*.png" "dist/"
    Write-Host "   PNG files copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   Warning: No PNG files found" -ForegroundColor Yellow
}

# Copy CSS files for jspreadsheet integration
Write-Host "   Copying CSS files..." -ForegroundColor Yellow
if (Test-Path "jspreadsheet.css") {
    Copy-Item "jspreadsheet.css" "dist/"
    Write-Host "   jspreadsheet.css copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   Warning: jspreadsheet.css not found" -ForegroundColor Yellow
}

if (Test-Path "jsuites.css") {
    Copy-Item "jsuites.css" "dist/"
    Write-Host "   jsuites.css copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   Warning: jsuites.css not found" -ForegroundColor Yellow
}

# Copy floating chat files
Write-Host "   Copying floating chat files..." -ForegroundColor Yellow
if (Test-Path "floating-chat") {
    Copy-Item -Recurse "floating-chat" "dist/"
    Write-Host "   Floating chat files copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   Warning: floating-chat directory not found" -ForegroundColor Yellow
}

# Copy popup files (these are essential for the extension to work)
Write-Host "   Copying popup files..." -ForegroundColor Yellow
if (Test-Path "popup.html") {
    Copy-Item "popup.html" "dist/"
    Write-Host "   popup.html copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   ERROR: popup.html not found - this will break the extension!" -ForegroundColor Red
    exit 1
}

if (Test-Path "popup.js") {
    Copy-Item "popup.js" "dist/"
    Write-Host "   popup.js copied successfully" -ForegroundColor Yellow
} else {
    Write-Host "   ERROR: popup.js not found - this will break the extension!" -ForegroundColor Red
    exit 1
}

# Copy additional required files
Write-Host "   Copying additional required files..." -ForegroundColor Yellow
if (Test-Path "stamp-spreadsheet-theme.css") {
    Copy-Item "stamp-spreadsheet-theme.css" "dist/"
    Write-Host "   stamp-spreadsheet-theme.css copied successfully" -ForegroundColor Yellow
}

if (Test-Path "node_modules\@inboxsdk\core\pageWorld.js") {
    Copy-Item "node_modules\@inboxsdk\core\pageWorld.js" "dist/"
    Write-Host "   pageWorld.js copied successfully" -ForegroundColor Yellow
}

if (Test-Path "node_modules\jsuites\dist\jsuites.js") {
    Copy-Item "node_modules\jsuites\dist\jsuites.js" "dist/"
    Write-Host "   jsuites.js copied successfully" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build complete! 🎉" -ForegroundColor Green
Write-Host "The complete extension has been built into the 'dist' directory." -ForegroundColor Green
Write-Host "You can now load the 'dist' directory as an unpacked extension in your browser." -ForegroundColor Green
Write-Host "Note: Make sure to manually set the correct client_id in dist/manifest.json if needed." -ForegroundColor Yellow
