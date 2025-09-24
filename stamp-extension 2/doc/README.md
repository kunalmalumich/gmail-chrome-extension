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
   - `OAUTH_CHROME_CLIENT_ID`: Your Google OAuth Chrome extension client ID
   - `API_ENDPOINT`: Your backend API endpoint
   - `AUTH_ENDPOINT`: Your backend authentication endpoint

## Configuration

### Google OAuth Setup

The extension requires **two OAuth client IDs** for the dual OAuth flow:

#### Web App Client ID (for backend refresh tokens)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API and Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-backend.com/auth/google/callback`
   - Add your domain to authorized JavaScript origins
5. Copy the Client ID to your `.env` file as `OAUTH_CLIENT_ID` (preferred) or `GOOGLE_CLIENT_ID`

#### Chrome Extension Client ID (for user authentication)
1. In the same Google Cloud Console project
2. Create another OAuth 2.0 credentials:
   - Application type: Chrome App
   - Authorized origins: `chrome-extension://your-extension-id`
3. Copy the Client ID to your `.env` file as `OAUTH_CHROME_CLIENT_ID`

### Environment Variables Priority

The extension uses the following priority for client ID configuration:
1. `OAUTH_CLIENT_ID` (preferred)
2. `GOOGLE_CLIENT_ID` (fallback)

**Required for dual OAuth:**
- `OAUTH_CHROME_CLIENT_ID`: Must be set for Chrome extension OAuth
- `AUTH_ENDPOINT`: Must point to your backend authentication endpoint

If neither `OAUTH_CLIENT_ID` nor `GOOGLE_CLIENT_ID` is set, the build will fail with an error.

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

The extension implements a **dual OAuth flow** as specified in the backend documentation:

### **Web OAuth Flow (for backend refresh tokens)**
1. **Extension opens Web OAuth tab** (`/auth/google/start`)
2. **User completes OAuth consent** (Web App client, gets refresh token)
3. **Backend stores refresh token** in UserTokens table
4. **OAuth completion detected** by content script

### **Chrome Extension OAuth Flow (for user authentication)**
1. **Extension gets Chrome access token** using `chrome.identity.getAuthToken`
2. **User email extracted** from Google userinfo API
3. **Installation completed** via backend `/install` endpoint
4. **Chrome token validated** with backend `/auth/validate-chrome-token`

### **API Authentication Strategy**
- **Backend API calls**: Use `X-Installation-ID` + `X-User-Email` headers
- **Direct Gmail API calls**: Use Chrome extension access tokens
- **No Chrome tokens sent to backend** for regular API calls

## Recent Implementation Updates

### **✅ High Priority Changes Implemented**
1. **OAuth Scopes Updated**: Reduced to only `gmail.readonly` + `userinfo.email`
2. **Chrome Tokens Removed**: No longer sent to backend for regular API calls
3. **Token Validation Added**: New `/auth/validate-chrome-token` endpoint support
4. **Direct Gmail API Access**: Extension can now call Gmail APIs directly

### **✅ Medium Priority Changes Implemented**
1. **Direct Gmail API Access**: PDF attachments fetched directly from Gmail API
2. **Post-Installation Validation**: Chrome tokens validated after installation
3. **Code Cleanup**: Removed unused Gmail API methods for cleaner codebase

### **🔧 Gmail API Integration**
- `fetchGmailAttachmentPdf()` - Fetch PDF attachments directly from Gmail API
- `validateChromeToken()` - Validate Chrome extension token with backend

### **🔄 Direct Gmail API Access**
The extension now:
1. **Fetches PDF attachments** directly from Gmail API using Chrome extension tokens
2. **Bypasses backend OAuth issues** by using the same client ID for all operations
3. **Provides faster PDF access** with no backend roundtrip required
4. **Maintains security** by using Chrome's built-in OAuth token management

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