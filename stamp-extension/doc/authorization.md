# Stamp Chrome Extension & Backend Integration Documentation

## System Overview

The Stamp system consists of two main components:
1. Backend Infrastructure (Existing)
2. Chrome Extension (To Be Implemented)

## 1. Backend Infrastructure

### 1.1 Core Components

#### A. Lambda Functions
1. **Authorizer Lambda**
   - Guards API Gateway endpoints
   - Validates installations and tokens
   - Generates IAM policies for each request
   - Validates three critical headers:
     - `Authorization`: Bearer token (Google access token)
     - `X-Installation-ID`: Installation identifier
     - `X-User-Email`: User's Gmail address

2. **Installation Lambda**
   - Handles initial setup flow
   - Processes OAuth code exchange
   - Creates user and installation records
   - Encrypts and stores tokens
   - Flow:
     1. Receives OAuth code
     2. Exchanges for access/refresh tokens
     3. Creates installation record
     4. Encrypts and stores tokens
     5. Initializes email poller

3. **Email-Poller Lambda**
   - Runs on schedule via Step Functions
   - Manages token refresh flow
   - Fetches new emails
   - Uses stored refresh tokens
   - Forwards emails to processor

4. **Email-Processor Lambda**
   - Processes email content
   - Protected by authorizer
   - Accessed via API Gateway

### 1.2 Database Schema

#### A. UserTokens Table
```typescript
interface UserTokens {
    userId: string;                // Partition Key
    encryptedAccessToken: string;  // KMS encrypted
    encryptedRefreshToken: string; // KMS encrypted
    accessTokenExpiry: string;     // ISO timestamp
    tokenStatus: 'valid' | 'invalid';
    createdAt: string;            // ISO timestamp
    lastUpdated: string;          // ISO timestamp
}
```

#### B. GmailAddOnInstallations Table
```typescript
interface Installation {
    installation_id: string;      // Partition Key
    user_email: string;          // GSI Key
    userId: string;              // Links to UserTokens
    install_status: 'pending' | 'active' | 'failed' | 'revoked';
    createdAt: string;
    lastUsed: string;
    installationSteps: {
        started: boolean;
        tokensStored: boolean;
        pollerInitialized: boolean;
        completed: boolean;
    }
}
```

#### C. EmailPollerState Table
```typescript
interface PollerState {
    userId: string;        // Partition Key
    lastCheckTime: string; // ISO timestamp
    lastHistoryId: string; // Gmail history ID
    lastSuccessfulRun: string;
}
```

### 1.3 Security Features

1. **Token Security**
   - Access & refresh tokens encrypted at rest using AWS KMS
   - Tokens never exposed in plaintext
   - Automatic token refresh handling
   - Token status tracking

2. **Installation Validation**
   - Every API request validated against installation record
   - Installation status checked on each request
   - User email must match installation record

3. **Authorization Flow**
   - API Gateway endpoints protected by authorizer
   - IAM policies generated per-request
   - User context passed securely

## 2. Chrome Extension Implementation

### 2.1 Extension Components

#### A. Manifest Configuration
```json
{
  "name": "Stamp",
  "manifest_version": 3,
  "permissions": [
    "identity",
    "storage"
  ],
  "oauth2": {
    "client_id": "${GOOGLE_CLIENT_ID}",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  }
}
```

#### B. Core Services

1. **Installation Service**
```typescript
class InstallationService {
  async install(): Promise<{
    installationId: string;
  }> {
    // Get authorization code with offline access
    const authUrl = this.getAuthUrl();
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });
    
    const code = new URL(responseUrl).searchParams.get('code');

    // Call installation endpoint with auth code
    const response = await fetch('${API_ENDPOINT}/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Installation-ID': `temp_${Date.now()}` // Temporary ID
      },
      body: JSON.stringify({
        code,
        redirect_uri: chrome.identity.getRedirectURL()
      })
    });

    const { installationId, userEmail } = await response.json();

    // Store only installation details, no tokens
    await chrome.storage.local.set({
      installationId,
      userEmail
    });

    return { installationId };
  }

  private getAuthUrl(): string {
    return `https://accounts.google.com/o/oauth2/v2/auth
      ?client_id=${CLIENT_ID}
      &response_type=code
      &access_type=offline
      &prompt=consent
      &scope=${SCOPES}
      &redirect_uri=${REDIRECT_URI}`;
  }
}
```

2. **API Client Service**
```typescript
class ApiClient {
  async makeAuthenticatedRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const { installationId, userEmail } = 
      await chrome.storage.local.get(['installationId', 'userEmail']);

    // Step 1: Get a fresh access token from our backend.
    const accessToken = await this.getFreshAccessToken(installationId);

    // Step 2: Use the fresh token to make the authenticated request.
    return fetch(`${API_ENDPOINT}/${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'X-Installation-ID': installationId,
        'X-User-Email': userEmail
      }
    });
  }

  private async getFreshAccessToken(installationId: string): Promise<string> {
    // This endpoint must be implemented on the backend.
    // It should be protected by an authorizer that validates the X-Installation-ID.
    const response = await fetch('${API_ENDPOINT}/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Installation-ID': installationId
        }
    });
    if (!response.ok) {
        throw new Error('Failed to retrieve access token from backend.');
    }
    const { accessToken } = await response.json();
    return accessToken;
  }
}
```

### 2.2 Security Model

#### A. Token Handling
1. **Access Tokens**
   - Managed by Chrome's secure storage
   - Never stored in extension storage
   - Fresh token requested for each API call
   - Automatic refresh handled by Chrome

2. **Installation Security**
   - Only installationId and userEmail stored
   - No sensitive tokens in extension storage
   - Matches Gmail add-on security model

3. **API Security**
   - Every request includes:
     - Fresh access token
     - Installation ID
     - User email
   - Matches existing authorizer requirements

### 2.3 Integration Flow

1. **Installation Process**
   ```mermaid
   sequenceDiagram
       participant User
       participant Extension
       participant Chrome
       participant Google
       participant Backend

       User->>Extension: Click Install
       Extension->>Chrome: Launch Auth Flow
       Chrome->>Google: OAuth (offline access)
       Google-->>Chrome: Auth Code
       Chrome-->>Extension: Auth Code
       Extension->>Backend: Install (Auth Code)
       Backend->>Google: Exchange Code
       Google-->>Backend: Access + Refresh Tokens
       Backend->>Backend: Store Encrypted Tokens
       Backend-->>Extension: Installation ID
       Extension->>Extension: Store Installation ID
   ```

2. **API Request Flow**
   ```mermaid
   sequenceDiagram
       participant Extension
       participant Backend
       participant Google
       
       Extension->>Backend: Request for Fresh Token (POST /token)
       Backend->>Backend: Look up Refresh Token via Installation ID
       Backend->>Google: Use Refresh Token to get new Access Token
       Google-->>Backend: Fresh Access Token
       Backend-->>Extension: Return Fresh Access Token
       
       Extension->>Backend: API Request with new Access Token
       Backend->>Backend: Authorizer validates token, then process
       Backend-->>Extension: API Response
   ```

### 2.4 Error Handling

1. **Token Errors**
   - Invalid token triggers re-authentication
   - Chrome handles token refresh
   - Backend validates token on each request

2. **Installation Errors**
   - Installation status tracked
   - Failed installations can be retried
   - Clear error messages to user

### 2.5 Development Requirements

1. **Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=
   API_ENDPOINT=
   ```

2. **Build Process**
   - Bundle extension code
   - Process environment variables
   - Generate source maps

## 3. Integration Points

### 3.1 Key Integration Points

1. **Installation Flow**
   - Extension initiates OAuth
   - Backend handles token storage
   - Extension stores installation ID

2. **API Requests**
   - Extension gets fresh token
   - Backend authorizes request
   - Email poller works independently

3. **Token Refresh**
   - Chrome handles access token refresh
   - Backend handles Gmail API refresh
   - No token handling in extension

### 3.2 Testing Points

1. **Installation Testing**
   - OAuth flow
   - Token exchange
   - Installation record creation

2. **API Testing**
   - Request authorization
   - Token validation
   - Error handling

3. **Integration Testing**
   - End-to-end flow
   - Error scenarios
   - Token refresh scenarios

## 4. Development Phases

### Phase 1: Basic Setup
1. Configure manifest
2. Implement OAuth flow
3. Test token acquisition

### Phase 2: Installation Flow
1. Implement installation service
2. Add storage handling
3. Test backend integration

### Phase 3: API Integration
1. Implement API client
2. Add request authentication
3. Test API endpoints

### Phase 4: UI Implementation
1. Create installation UI
2. Add success/error states
3. Implement loading states

### Phase 5: Testing & Refinement
1. End-to-end testing
2. Error handling
3. Performance optimization

## 5. Security Considerations

### 5.1 Chrome Extension Security
1. No sensitive data in storage
2. Fresh tokens for each request
3. Secure communication channels

### 5.2 Backend Security
1. Token encryption
2. Request validation
3. Installation verification

### 5.3 Integration Security
1. Matching security models
2. Consistent validation
3. Proper error handling

### 5.4 Required Security Improvements

#### A. Content Security Policy
```json
{
  "manifest_version": 3,
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  }
}
```
This CSP configuration:
- Restricts script sources to extension's own domain
- Prevents object injection attacks
- Enhances overall extension security

#### B. Request Origin Validation
```typescript
// In Authorizer Lambda
const validateOrigin = (headers: Record<string, string>, extensionId: string) => {
  const origin = headers['Origin'];
  const validOrigin = `chrome-extension://${extensionId}`;
  
  if (!origin || !origin.startsWith(validOrigin)) {
    throw new Error('Invalid request origin');
  }
};
```
This ensures:
- Requests only come from our extension
- Prevents request spoofing
- Adds additional layer of request validation

#### C. Token Rotation Detection
```typescript
class ApiClient {
  private async validateTokenFreshness(token: string): Promise<boolean> {
    const { lastKnownToken } = await chrome.storage.local.get('lastKnownToken');
    
    if (token !== lastKnownToken) {
      // Token has been rotated
      await this.refreshInstallation();
      await chrome.storage.local.set({ lastKnownToken: token });
      return true;
    }
    
    return false;
  }

  async makeAuthenticatedRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const accessToken = await this.getFreshAccessToken();
    await this.validateTokenFreshness(accessToken);
    
    // ... rest of the request logic ...
  }
}
```
Benefits:
- Detects token changes early
- Prevents token mismatch issues
- Maintains installation synchronization

#### D. Implementation Guidelines
1. **CSP Implementation**
   - Add CSP to manifest.json
   - Test with security scanner
   - Monitor CSP violations

2. **Origin Validation**
   - Implement in Authorizer Lambda
   - Add to existing validation chain
   - Log invalid origins for monitoring

3. **Token Rotation**
   - Implement in ApiClient
   - Add to request pipeline
   - Monitor rotation frequency

These security improvements should be implemented during the Phase 1: Basic Setup, before any API integration begins. They form the foundation of the extension's security model and ensure alignment with the backend's security requirements. 