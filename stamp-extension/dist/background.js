"use strict";
(() => {
  // background.js
  console.log("[Background] Starting in PRODUCTION mode");
  if (typeof CONFIG === "undefined") {
    globalThis.CONFIG = {
      AUTH_ENDPOINT: "https://70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller"
    };
  }
  var AUTH_ENDPOINT = CONFIG?.AUTH_ENDPOINT || "https://70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller";
  var webOAuthFlows = /* @__PURE__ */ new Map();
  function getRedirectURL() {
    const redirectUri = chrome.identity.getRedirectURL ? chrome.identity.getRedirectURL() : "https://70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller/oauth2-callback";
    console.log("[Background] Using redirect URI:", redirectUri);
    return redirectUri;
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Received message:", message.type);
    console.log("[Background] Message details:", { type: message.type, sender: sender.tab?.url || "no-tab" });
    if (message.type === "fetchFileForPreview" && message.url) {
      console.log("[Background] Fetching file for preview:", message.url);
      fetch(message.url, {
        method: "GET",
        headers: {
          "Accept": "application/pdf, image/*, */*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1"
        }
      }).then((response) => {
        console.log("[Background] Fetch response status:", response.status);
        console.log("[Background] Fetch response headers:", Object.fromEntries(response.headers.entries()));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type");
        const contentLength = response.headers.get("content-length");
        console.log("[Background] File details:", {
          contentType,
          contentLength: contentLength ? `${Math.round(contentLength / 1024)}KB` : "unknown"
        });
        return response.blob();
      }).then((blob) => {
        console.log("[Background] Blob created:", {
          type: blob.type,
          size: blob.size,
          sizeKB: Math.round(blob.size / 1024)
        });
        const reader = new FileReader();
        reader.onload = () => {
          console.log("[Background] File converted to data URL successfully");
          sendResponse({
            success: true,
            dataUrl: reader.result,
            mimeType: blob.type,
            fileSize: blob.size,
            originalUrl: message.url
          });
        };
        reader.onerror = () => {
          console.error("[Background] Failed to convert file to data URL");
          sendResponse({ success: false, error: "Failed to convert file to data URL" });
        };
        reader.readAsDataURL(blob);
      }).catch((error) => {
        console.error("[Background] Failed to fetch file:", error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    if (message.type === "inboxsdk__injectPageWorld" && sender.tab) {
      const promise = new Promise((resolve) => {
        console.log("[Background] Handling InboxSDK page world injection");
        if (chrome.scripting) {
          const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
          chrome.scripting.executeScript({
            target,
            world: "MAIN",
            files: ["pageWorld.js"]
          }, () => resolve(true));
        } else {
          resolve(false);
        }
      });
      promise.then(sendResponse);
      return true;
    }
    if (message.type === "GET_AUTH_CODE") {
      const promise = new Promise((resolve, reject) => {
        console.log("[Background] Starting GET_AUTH_CODE flow using launchWebAuthFlow.");
        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2.client_id;
        const scopes = manifest.oauth2.scopes.join(" ");
        const redirectUri = getRedirectURL();
        console.log("[Background] Chrome Extension OAuth flow parameters:", {
          clientId,
          redirectUri,
          scopes: manifest.oauth2.scopes
        });
        console.log("[Background] \u{1F50D} CHROME EXTENSION CLIENT ID:", clientId);
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&access_type=online&prompt=consent&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        console.log("[Background] Generated Chrome Extension auth URL:", authUrl);
        try {
          console.log("[Background] \u{1F680} Launching Chrome Extension OAuth flow...");
          console.log("[Background] \u{1F50D} OAuth will prompt user to sign in with their Google account");
          chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
            if (chrome.runtime.lastError) {
              console.error("[Background] \u274C Chrome Extension OAuth flow error:", chrome.runtime.lastError.message);
              console.error("[Background] \u{1F50D} Error details:", {
                error: chrome.runtime.lastError.message,
                clientId,
                redirectUri,
                authUrl
              });
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (responseUrl) {
              console.log("[Background] Received response URL:", responseUrl);
              const code = new URL(responseUrl).searchParams.get("code");
              resolve({ code, redirectUri });
            } else {
              console.log("[Background] Auth flow cancelled by user.");
              reject(new Error("Auth flow cancelled by user."));
            }
          });
        } catch (error) {
          console.error("[Background] Error in launchWebAuthFlow:", error);
          reject(error);
        }
      });
      promise.then(sendResponse).catch((error) => sendResponse({ error: error.message }));
      return true;
    }
    if (message.type === "START_WEB_OAUTH_FLOW") {
      const promise = new Promise((resolve, reject) => {
        console.log("[Background] Starting Web OAuth flow");
        console.log("[Background] \u{1F310} WEB OAUTH ENDPOINT:", AUTH_ENDPOINT);
        console.log("[Background] \u{1F4DD} Note: Web OAuth client ID will be determined by backend server");
        const oauthStartUrl = `${AUTH_ENDPOINT}/auth/google/start`;
        console.log("[Background] Opening Web OAuth tab:", oauthStartUrl);
        console.log("[Background] \u{1F50D} Expected OAuth flow:");
        console.log("[Background]   1. Backend OAuth start \u2192 Google OAuth \u2192 Backend callback");
        console.log("[Background]   2. Backend should show success page with user email");
        console.log("[Background]   3. OAuth callback detector should detect success on backend page");
        console.log("[Background] \u{1F680} Creating Web OAuth tab...");
        console.log("[Background] \u{1F4CB} OAuth tab will open:", oauthStartUrl);
        chrome.tabs.create({
          url: oauthStartUrl,
          active: true
        }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error("[Background] \u274C Error creating Web OAuth tab:", chrome.runtime.lastError.message);
            console.error("[Background] \u{1F50D} Web OAuth error details:", {
              error: chrome.runtime.lastError.message,
              oauthStartUrl,
              authEndpoint: AUTH_ENDPOINT
            });
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          console.log("[Background] OAuth tab created, ID:", tab.id);
          const timeout = setTimeout(() => {
            console.log("[Background] OAuth flow timed out");
            webOAuthFlows.delete(tab.id);
            chrome.tabs.remove(tab.id).catch(() => {
            });
            reject(new Error("Web OAuth flow timed out"));
          }, 5 * 60 * 1e3);
          webOAuthFlows.set(tab.id, { resolve, reject, timeout });
          const tabUpdateListener = (tabId, changeInfo, updatedTab) => {
            if (tabId === tab.id && changeInfo.url) {
              console.log("[Background] OAuth tab navigated to:", changeInfo.url);
              if (changeInfo.url.includes("70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller/oauth2-callback")) {
                console.log("[Background] \u{1F3AF} OAuth callback page detected!");
              }
              if (changeInfo.url.includes("70h4jbuv95.execute-api.us-east-2.amazonaws.com")) {
                console.log("[Background] \u{1F3AF} Backend OAuth page detected!");
              }
              if (changeInfo.url.includes("accounts.google.com")) {
                console.log("[Background] \u{1F3AF} Google OAuth page detected!");
              }
            }
          };
          chrome.tabs.onUpdated.addListener(tabUpdateListener);
          webOAuthFlows.get(tab.id).tabUpdateListener = tabUpdateListener;
          console.log("[Background] Waiting for OAuth completion...");
        });
      });
      promise.then((result) => {
        console.log("[Background] Web OAuth completed successfully");
        sendResponse(result);
      }).catch((error) => {
        console.error("[Background] Web OAuth failed:", error.message);
        sendResponse({ error: error.message });
      });
      return true;
    }
    if (message.type === "OAUTH_WEB_CLIENT_COMPLETE") {
      console.log("[Background] Received OAuth completion:", message.result.success ? "SUCCESS" : "FAILED");
      console.log("[Background] OAuth result details:", {
        success: message.result.success,
        userEmail: message.result.userEmail,
        method: message.result.method,
        error: message.result.error,
        url: message.url
      });
      if (sender.tab) {
        const tabId = sender.tab.id;
        const flowState = webOAuthFlows.get(tabId);
        if (flowState) {
          console.log("[Background] Found matching OAuth flow, cleaning up...");
          clearTimeout(flowState.timeout);
          if (flowState.tabUpdateListener) {
            chrome.tabs.onUpdated.removeListener(flowState.tabUpdateListener);
          }
          webOAuthFlows.delete(tabId);
          chrome.tabs.remove(tabId).catch(() => {
          });
          if (message.result.success) {
            console.log("[Background] OAuth flow completed successfully");
            if (message.result.userEmail) {
              console.log("[Background] Storing user email:", message.result.userEmail);
              chrome.storage.local.set({ userEmail: message.result.userEmail });
            } else {
              console.warn("[Background] No user email found in OAuth result");
            }
            flowState.resolve({
              success: true,
              url: message.url,
              result: message.result
            });
          } else {
            console.error("[Background] OAuth flow failed:", message.result.error);
            flowState.reject(new Error(message.result.error || "Web OAuth flow failed"));
          }
        } else {
          console.warn("[Background] No matching OAuth flow found for tab:", tabId);
        }
      }
      sendResponse({ received: true });
      return false;
    }
    if (message.type === "GET_CHROME_ACCESS_TOKEN") {
      const promise = new Promise((resolve, reject) => {
        console.log("[Background] Getting Chrome extension access token for direct API access");
        const manifest = chrome.runtime.getManifest();
        const scopes = manifest.oauth2.scopes;
        console.log("[Background] Requesting access token with scopes:", scopes);
        try {
          console.log("[Background] Requesting Chrome identity token with scopes:", scopes);
          chrome.identity.getAuthToken({
            interactive: true,
            scopes
          }, (token) => {
            console.log("[Background] Chrome identity callback received");
            console.log("[Background] Token received:", token ? "YES (" + token.length + " chars)" : "NO");
            if (chrome.runtime.lastError) {
              console.error("[Background] Access token error:", chrome.runtime.lastError.message);
              console.error("[Background] Full runtime error:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (token) {
              console.log("[Background] Access token obtained, fetching user info...");
              console.log("[Background] Fetching user info from Google API...");
              fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: {
                  "Authorization": `Bearer ${token}`
                }
              }).then((response) => {
                console.log("[Background] Userinfo API response status:", response.status);
                console.log("[Background] Userinfo API response ok:", response.ok);
                if (!response.ok) {
                  console.error("[Background] Userinfo API error response:", response.status, response.statusText);
                  return response.text().then((text) => {
                    console.error("[Background] Userinfo API error body:", text);
                    throw new Error(`HTTP ${response.status}: ${text}`);
                  });
                }
                return response.json();
              }).then((userInfo) => {
                console.log("[Background] User info obtained successfully:", userInfo);
                console.log("[Background] User email:", userInfo.email);
                resolve({
                  accessToken: token,
                  userEmail: userInfo.email,
                  userInfo
                });
              }).catch((error) => {
                console.error("[Background] Detailed error fetching user info:", {
                  message: error.message,
                  stack: error.stack,
                  tokenLength: token ? token.length : 0,
                  tokenPrefix: token ? token.substring(0, 10) + "..." : "null"
                });
                resolve({
                  accessToken: token,
                  userEmail: null,
                  error: "Could not fetch user info: " + error.message,
                  debug: {
                    tokenLength: token ? token.length : 0,
                    tokenPrefix: token ? token.substring(0, 10) : null,
                    scopes,
                    errorType: error.name,
                    errorMessage: error.message
                  }
                });
              });
            } else {
              console.log("[Background] Access token request cancelled by user.");
              reject(new Error("Access token request cancelled by user."));
            }
          });
        } catch (error) {
          console.error("[Background] Error in getAuthToken:", error);
          reject(error);
        }
      });
      promise.then(sendResponse).catch((error) => sendResponse({ error: error.message }));
      return true;
    }
    if (message.type === "CLEAR_CHROME_IDENTITY_CACHE") {
      const promise = new Promise((resolve, reject) => {
        console.log("[Background] Clearing Chrome identity cache for fresh sign-up...");
        chrome.identity.clearAllCachedAuthTokens(() => {
          if (chrome.runtime.lastError) {
            console.log("[Background] Could not clear cached tokens (non-critical):", chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log("[Background] Cached auth tokens cleared successfully");
            resolve({ success: true });
          }
        });
      });
      promise.then(sendResponse).catch((error) => sendResponse({ error: error.message }));
      return true;
    }
    if (message.type === "INJECT_FLOATING_CHAT_SCRIPTS") {
      (async () => {
        try {
          console.log("[Background] Handling INJECT_FLOATING_CHAT_SCRIPTS");
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (tab) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [
                "floating-chat/floating-chat.js",
                "floating-chat/floating-chat-manager.js"
              ]
            });
            console.log("[Background] Successfully injected floating chat scripts.");
            sendResponse({ success: true });
          } else {
            throw new Error("No active tab found to inject scripts into.");
          }
        } catch (error) {
          console.error("[Background] Failed to inject floating chat scripts:", error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }
    if (message.type === "GET_INSTALLATION_STATE") {
      const promise = new Promise(async (resolve) => {
        try {
          const result = await chrome.storage.local.get(["installationId", "userEmail"]);
          resolve({
            isInstalled: !!result.installationId,
            userEmail: result.userEmail || null,
            installationId: result.installationId || null
          });
        } catch (error) {
          console.error("[Background] Error getting installation state:", error);
          resolve({ isInstalled: false, error: error.message });
        }
      });
      promise.then(sendResponse);
      return true;
    }
    console.warn("[Background] Unhandled message type:", message.type);
    return false;
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    const flowState = webOAuthFlows.get(tabId);
    if (flowState) {
      console.log("[Background] OAuth tab closed, cleaning up flow:", tabId);
      clearTimeout(flowState.timeout);
      webOAuthFlows.delete(tabId);
      flowState.reject(new Error("OAuth tab was closed"));
    }
  });
})();
//# sourceMappingURL=background.js.map
