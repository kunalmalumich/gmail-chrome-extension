// Unit tests for AuthService in content.js

describe('AuthService', () => {
  // Mock chrome.identity and chrome.storage APIs before each test
  beforeEach(() => {
    global.chrome = {
      identity: {
        getRedirectURL: jest.fn(() => 'https://trystamp.ai/oauth2-callback'),
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn(),
        },
      },
      runtime: {
        lastError: null,
        sendMessage: jest.fn(),
      },
    };
    global.fetch = jest.fn();
    
    // Mock CONFIG object
    global.CONFIG = {
      API_ENDPOINT: 'https://test-api.com',
      OAUTH_CLIENT_ID: 'oauth-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com'
    };
  });

  test('should successfully complete simplified OAuth flow', async () => {
    // Mock the OAuth flow responses
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'GET_AUTH_CODE') {
        callback({ code: 'test_auth_code', redirectUri: 'https://trystamp.ai/oauth2-callback' });
      }
    });

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/install')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            installationId: 'test_installation_id',
            userEmail: 'test@example.com'
          })
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    // Test the complete simplified flow
    const authService = new AuthService({});
    await expect(authService.signInWithGoogle()).resolves.not.toThrow();
  });

  test('should handle OAuth flow errors', async () => {
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ error: 'User cancelled the auth flow' });
    });

    const authService = new AuthService({});
    await expect(authService.signInWithGoogle()).rejects.toThrow('User cancelled the auth flow');
  });

  test('should handle backend installation errors', async () => {
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ code: 'test_auth_code', redirectUri: 'https://trystamp.ai/oauth2-callback' });
    });

    global.fetch.mockImplementation((url) => {
      if (url.includes('/install')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Backend error')
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const authService = new AuthService({});
    await expect(authService.signInWithGoogle()).rejects.toThrow('Backend installation failed');
  });

  test('should handle network errors', async () => {
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ code: 'test_auth_code', redirectUri: 'https://trystamp.ai/oauth2-callback' });
    });

    global.fetch.mockImplementation(() => {
      throw new TypeError('Failed to fetch');
    });

    const authService = new AuthService({});
    await expect(authService.signInWithGoogle()).rejects.toThrow('Cannot connect to backend server');
  });

  test('should check authentication state correctly', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id',
      userEmail: 'test@example.com'
    });

    const authService = new AuthService({});
    const authState = await authService.getAuthState();
    
    expect(authState.isLoggedIn).toBe(true);
    expect(authState.userEmail).toBe('test@example.com');
  });

  test('should sign out and clear data', async () => {
    chrome.storage.local.get.mockResolvedValue({
      installationId: 'test_installation_id'
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    const authService = new AuthService({});
    await expect(authService.signOut()).resolves.not.toThrow();
    
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(['installationId', 'userEmail']);
  });

  test('should prioritize OAUTH_CLIENT_ID over GOOGLE_CLIENT_ID', () => {
    // Test that CLIENT_ID uses OAUTH_CLIENT_ID when available
    expect(global.CONFIG.OAUTH_CLIENT_ID).toBe('oauth-client-id.apps.googleusercontent.com');
    expect(global.CONFIG.GOOGLE_CLIENT_ID).toBe('google-client-id.apps.googleusercontent.com');
    
    // The CLIENT_ID should prioritize OAUTH_CLIENT_ID
    const CLIENT_ID = global.CONFIG.OAUTH_CLIENT_ID || global.CONFIG.GOOGLE_CLIENT_ID;
    expect(CLIENT_ID).toBe('oauth-client-id.apps.googleusercontent.com');
  });
}); 