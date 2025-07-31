# Stamp Chrome Extension

Chrome extension for managing Accounts Payable workflow inside Gmail.

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your configuration:
   - `OAUTH_CLIENT_ID`: Your Google OAuth web app client ID (preferred)
   - `GOOGLE_CLIENT_ID`: Your Google OAuth web app client ID (fallback)
   - `API_ENDPOINT`: Your backend API endpoint

## Configuration

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API and Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://trystamp.ai/oauth2-callback`
   - Add your domain to authorized JavaScript origins
5. Copy the Client ID to your `.env` file as `OAUTH_CLIENT_ID` (preferred) or `GOOGLE_CLIENT_ID`

### Environment Variables Priority

The extension uses the following priority for client ID configuration:
1. `OAUTH_CLIENT_ID` (preferred)
2. `GOOGLE_CLIENT_ID` (fallback)

If neither is set, the build will fail with an error.

### Backend API

The extension expects a backend API that implements:
- `POST /install` - Installation endpoint that accepts OAuth code
- `POST /revoke` - Revocation endpoint for sign-out
- `GET /user` - User data endpoint
- `GET /status` - Email processing status endpoint

## Building

```bash
# Install dependencies
npm install

# Build the extension
./build.sh
```

The built extension will be in the `dist` directory.

## Loading in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` directory

## Testing

```bash
# Run unit tests
npm test
```

## Files

- `content.js`: Main extension code with simplified OAuth flow
- `background.js`: Background script for OAuth handling
- `manifest.json`: Extension configuration
- `build.sh`: Build script
- `api.test.js`: API client tests
- `auth.test.js`: Authentication tests

## Required Assets

Make sure these files exist:
- `stamp-logo.png`: Extension icon
- `google-logo.png`: Sign-in button icon

## OAuth Flow

The extension implements a simplified OAuth flow:

1. **Authorization Code Flow**: Uses `chrome.identity.launchWebAuthFlow` to get an authorization code
2. **Backend Processing**: Sends the auth code to backend for token exchange and user email retrieval
3. **Backend Installation**: Backend handles all OAuth processing and token storage
4. **Token Management**: Backend handles token refresh and storage securely

## Security

The extension implements several security measures:
1. **Content Security Policy (CSP)**: Restricts script execution
2. **OAuth 2.0 Flow**: Uses standard OAuth 2.0 authorization code flow
3. **Secure Storage**: Only stores installation ID and user email locally
4. **Backend Token Management**: All sensitive tokens managed by backend
5. **Request Validation**: Every API request includes installation ID for validation

## Development

For development, the extension includes:
- Hard reset functionality to revoke OAuth permissions
- Detailed logging for debugging
- Error handling and user feedback

See `IMPLEMENTATION.md` for detailed security documentation. 