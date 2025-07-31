"use strict";
(() => {
  // background.js
  console.log("[Background] Starting in PRODUCTION mode");
  function getRedirectURL() {
    const redirectUri = chrome.identity.getRedirectURL ? chrome.identity.getRedirectURL() : "https://trystamp.ai/oauth2-callback";
    console.log("[Background] Using redirect URI:", redirectUri);
    return redirectUri;
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Received message:", message.type);
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
        console.log("[Background] Auth flow parameters:", { clientId, redirectUri });
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        console.log("[Background] Generated auth URL:", authUrl);
        try {
          chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
            if (chrome.runtime.lastError) {
              console.error("[Background] Auth flow error:", chrome.runtime.lastError.message);
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
    console.warn("[Background] Unhandled message type:", message.type);
    return false;
  });
})();
//# sourceMappingURL=background.js.map
