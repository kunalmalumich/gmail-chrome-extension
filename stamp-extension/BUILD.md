# Build Instructions

This project uses dedicated build scripts instead of npm scripts for building the Chrome extension.

## Building the Extension

### Windows (PowerShell)
```powershell
.\build.ps1
```

### Linux/macOS (Bash)
```bash
./build.sh
```

## What the Build Scripts Do

1. **Load Environment Variables**: Reads from `.env` file if present
2. **Clean Build Directory**: Removes old `dist/` folder and creates fresh one
3. **Install Dependencies**: Runs `npm install` to ensure all packages are available
4. **Build JavaScript Files**: Uses esbuild to bundle:
   - `content.js` → `dist/content.js`
   - `background.js` → `dist/background.js`
   - `oauth-callback-detector.js` → `dist/oauth-callback-detector.js`
5. **Copy Assets**: Copies all necessary files to `dist/`:
   - `manifest.json`
   - InboxSDK files (`pageWorld.js`)
   - Images (`*.png`)
   - CSS files (`jspreadsheet.css`, `jsuites.css`)
   - Floating chat files
   - Popup files (`popup.html`, `popup.js`)

## Environment Variables

The build scripts support the following environment variables (via `.env` file):

- `API_ENDPOINT`: Backend API endpoint
- `AUTH_ENDPOINT`: Authentication endpoint
- `PREFER_GOOGLE_CLIENT`: Set to "true" to use Google client credentials
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_CHROME_CLIENT_ID`: Google Chrome extension client ID
- `OAUTH_CLIENT_ID`: OAuth client ID
- `OAUTH_CLIENT_SECRET`: OAuth client secret
- `OAUTH_CHROME_CLIENT_ID`: OAuth Chrome extension client ID

## Output

After building, the complete Chrome extension will be in the `dist/` directory, ready to be loaded as an unpacked extension in Chrome.

## Notes

- The build scripts handle all the complexity of bundling, copying files, and setting up the extension structure
- No need to use `npm run build` - use the dedicated build scripts instead
- The scripts are cross-platform (PowerShell for Windows, Bash for Unix-like systems)
