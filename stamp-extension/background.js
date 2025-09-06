/* global chrome */

// --- CONFIGURATION ---
// These values are injected by the build script (build.sh) as a global CONFIG object.
console.log('[Background] Starting in PRODUCTION mode');

// Get AUTH_ENDPOINT from CONFIG (injected by build script)
const AUTH_ENDPOINT = CONFIG?.AUTH_ENDPOINT || 'https://trystamp.ai/email-poller';

// Map to track Web OAuth flows by tab ID
const webOAuthFlows = new Map();

// Helper function to get redirect URL that works in both Chrome and Edge
function getRedirectURL() {
  // For Edge compatibility, use the hardcoded URL if getRedirectURL is not available
  const redirectUri = chrome.identity.getRedirectURL 
    ? chrome.identity.getRedirectURL()
    : "https://trystamp.ai/oauth2-callback";
  
  console.log('[Background] Using redirect URI:', redirectUri);
  return redirectUri;
}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  // --- Message Handler 1: InboxSDK Page World Injection ---
  if (message.type === 'inboxsdk__injectPageWorld' && sender.tab) {
    const promise = new Promise((resolve) => {
      console.log('[Background] Handling InboxSDK page world injection');
      if (chrome.scripting) {
        const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
        chrome.scripting.executeScript({
          target: target,
          world: 'MAIN',
          files: ['pageWorld.js'],
        }, () => resolve(true));
      } else {
        resolve(false);
      }
    });
    promise.then(sendResponse);
    return true;
  }

  // --- Message Handler 2: Get Authentication Code ---
  if (message.type === 'GET_AUTH_CODE') {
    const promise = new Promise((resolve, reject) => {
      console.log('[Background] Starting GET_AUTH_CODE flow using launchWebAuthFlow.');

      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2.client_id;
      const scopes = manifest.oauth2.scopes.join(' ');
      const redirectUri = getRedirectURL();

      console.log('[Background] Auth flow parameters:', { clientId, redirectUri });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `access_type=online&` + // Changed to online for Chrome extension
        `prompt=consent&` +      
        `scope=${encodeURIComponent(scopes)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log('[Background] Generated auth URL:', authUrl);

      try {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Background] Auth flow error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (responseUrl) {
            console.log('[Background] Received response URL:', responseUrl);
            const code = new URL(responseUrl).searchParams.get('code');
            resolve({ code: code, redirectUri: redirectUri });
          } else {
            console.log('[Background] Auth flow cancelled by user.');
            reject(new Error('Auth flow cancelled by user.'));
          }
        });
      } catch (error) {
        console.error('[Background] Error in launchWebAuthFlow:', error);
        reject(error);
      }
    });

    promise.then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true; // Indicates an async response
  }



  // --- Message Handler 3: Start Web Client OAuth Flow ---
  if (message.type === 'START_WEB_OAUTH_FLOW') {
    const promise = new Promise((resolve, reject) => {
      console.log('[Background] Starting Web OAuth flow');

      // Use the full AUTH_ENDPOINT path since backend endpoints are at /email-poller/auth/...
      const oauthStartUrl = `${AUTH_ENDPOINT}/auth/google/start`;
      console.log('[Background] Opening OAuth tab:', oauthStartUrl);

      // Create a new tab for the Web OAuth flow
      chrome.tabs.create({
        url: oauthStartUrl,
        active: true
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('[Background] Error creating OAuth tab:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        console.log('[Background] OAuth tab created, ID:', tab.id);

        // Set up timeout for OAuth flow
        const timeout = setTimeout(() => {
          console.log('[Background] OAuth flow timed out');
          webOAuthFlows.delete(tab.id);
          chrome.tabs.remove(tab.id).catch(() => {});
          reject(new Error('Web OAuth flow timed out'));
        }, 5 * 60 * 1000); // 5 minute timeout

        // Store the flow state
        webOAuthFlows.set(tab.id, { resolve, reject, timeout });
        console.log('[Background] Waiting for OAuth completion...');
      });
    });

    promise.then(result => {
      console.log('[Background] Web OAuth completed successfully');
      sendResponse(result);
    }).catch(error => {
      console.error('[Background] Web OAuth failed:', error.message);
      sendResponse({ error: error.message });
    });
    return true; // Indicates an async response
  }

  // --- Message Handler 4: OAuth Web Client Complete ---
  if (message.type === 'OAUTH_WEB_CLIENT_COMPLETE') {
    console.log('[Background] Received OAuth completion:', message.result.success ? 'SUCCESS' : 'FAILED');

    // Find the tab that sent this message
    if (sender.tab) {
      const tabId = sender.tab.id;
      const flowState = webOAuthFlows.get(tabId);

      if (flowState) {
        console.log('[Background] Found matching OAuth flow, cleaning up...');

        // Clear the timeout
        clearTimeout(flowState.timeout);
        webOAuthFlows.delete(tabId);

        // Close the OAuth tab
        chrome.tabs.remove(tabId).catch(() => {});

        // Resolve or reject based on the result
        if (message.result.success) {
          console.log('[Background] OAuth flow completed successfully');
          flowState.resolve({
            success: true,
            url: message.url,
            result: message.result
          });
        } else {
          console.error('[Background] OAuth flow failed:', message.result.error);
          flowState.reject(new Error(message.result.error || 'Web OAuth flow failed'));
        }
      } else {
        console.warn('[Background] No matching OAuth flow found for tab:', tabId);
      }
    }

    sendResponse({ received: true });
    return false;
  }

  // --- Message Handler 5: Get Chrome Extension Access Token ---
  if (message.type === 'GET_CHROME_ACCESS_TOKEN') {
    const promise = new Promise((resolve, reject) => {
      console.log('[Background] Getting Chrome extension access token for direct API access');

      const manifest = chrome.runtime.getManifest();
      const scopes = manifest.oauth2.scopes;

      console.log('[Background] Requesting access token with scopes:', scopes);

      try {
        console.log('[Background] Requesting Chrome identity token with scopes:', scopes);
        chrome.identity.getAuthToken({
          interactive: true,
          scopes: scopes
        }, (token) => {
          console.log('[Background] Chrome identity callback received');
          console.log('[Background] Token received:', token ? 'YES (' + token.length + ' chars)' : 'NO');

          if (chrome.runtime.lastError) {
            console.error('[Background] Access token error:', chrome.runtime.lastError.message);
            console.error('[Background] Full runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (token) {
            console.log('[Background] Access token obtained, fetching user info...');
            
            // Get user email using the access token
            console.log('[Background] Fetching user info from Google API...');
            fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            .then(response => {
              console.log('[Background] Userinfo API response status:', response.status);
              console.log('[Background] Userinfo API response ok:', response.ok);

              if (!response.ok) {
                console.error('[Background] Userinfo API error response:', response.status, response.statusText);
                return response.text().then(text => {
                  console.error('[Background] Userinfo API error body:', text);
                  throw new Error(`HTTP ${response.status}: ${text}`);
                });
              }

              return response.json();
            })
            .then(userInfo => {
              console.log('[Background] User info obtained successfully:', userInfo);
              console.log('[Background] User email:', userInfo.email);
              resolve({
                accessToken: token,
                userEmail: userInfo.email,
                userInfo: userInfo
              });
            })
            .catch(error => {
              console.error('[Background] Detailed error fetching user info:', {
                message: error.message,
                stack: error.stack,
                tokenLength: token ? token.length : 0,
                tokenPrefix: token ? token.substring(0, 10) + '...' : 'null'
              });

              resolve({
                accessToken: token,
                userEmail: null,
                error: 'Could not fetch user info: ' + error.message,
                debug: {
                  tokenLength: token ? token.length : 0,
                  tokenPrefix: token ? token.substring(0, 10) : null,
                  scopes: scopes,
                  errorType: error.name,
                  errorMessage: error.message
                }
              });
            });
          } else {
            console.log('[Background] Access token request cancelled by user.');
            reject(new Error('Access token request cancelled by user.'));
          }
        });
      } catch (error) {
        console.error('[Background] Error in getAuthToken:', error);
        reject(error);
      }
    });

    promise.then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true; // Indicates an async response
  }



  // --- Message Handler 4: Inject Floating Chat Scripts ---
  if (message.type === 'INJECT_FLOATING_CHAT_SCRIPTS') {
    (async () => {
      try {
        console.log('[Background] Handling INJECT_FLOATING_CHAT_SCRIPTS');
        const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        if (tab) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
              'floating-chat/floating-chat.js',
              'floating-chat/floating-chat-manager.js'
            ]
          });
          console.log('[Background] Successfully injected floating chat scripts.');
          sendResponse({ success: true });
        } else {
          throw new Error('No active tab found to inject scripts into.');
        }
      } catch (error) {
        console.error('[Background] Failed to inject floating chat scripts:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates an async response
  }

  // --- Message Handler 5: Get Installation State ---
  if (message.type === 'GET_INSTALLATION_STATE') {
    const promise = new Promise(async (resolve) => {
      try {
        const result = await chrome.storage.local.get(['installationId', 'userEmail']);
        resolve({
          isInstalled: !!result.installationId,
          userEmail: result.userEmail || null,
          installationId: result.installationId || null
        });
      } catch (error) {
        console.error('[Background] Error getting installation state:', error);
        resolve({ isInstalled: false, error: error.message });
      }
    });

    promise.then(sendResponse);
    return true;
  }

  // Log unhandled message types
  console.warn('[Background] Unhandled message type:', message.type);
  return false;
}); 

// Clean up OAuth flows when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const flowState = webOAuthFlows.get(tabId);
  if (flowState) {
    console.log('[Background] OAuth tab closed, cleaning up flow:', tabId);
    clearTimeout(flowState.timeout);
    webOAuthFlows.delete(tabId);
    flowState.reject(new Error('OAuth tab was closed'));
  }
});