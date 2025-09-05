"use strict";
(() => {
  // oauth-callback-detector.js
  console.log("[OAuth Callback Detector] Script loaded on:", window.location.href);
  function isOAuthCallbackPage() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hasCode = params.has("code");
    const hasState = params.has("state");
    const hasError = params.has("error");
    const isOAuth = hasCode || hasError || hasState;
    if (isOAuth) {
      console.log("[OAuth Callback Detector] Detected OAuth callback page");
    }
    return isOAuth;
  }
  function extractOAuthResult() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (params.has("error")) {
      return {
        success: false,
        error: params.get("error"),
        errorDescription: params.get("error_description"),
        state: params.get("state")
      };
    }
    if (params.has("code")) {
      return {
        success: true,
        code: params.get("code"),
        state: params.get("state")
      };
    }
    return null;
  }
  function detectStampOAuthSuccess() {
    const pageTitle = document.title;
    const urlHash = window.location.hash;
    const hasStampSuccessTitle = pageTitle.includes("STAMP_OAUTH_SUCCESS");
    const hasStampSuccessHash = urlHash.includes("STAMP_OAUTH_SUCCESS");
    if (hasStampSuccessTitle || hasStampSuccessHash) {
      console.log("[OAuth Callback Detector] STAMP OAuth success detected via:", {
        title: hasStampSuccessTitle ? pageTitle : null,
        hash: hasStampSuccessHash ? urlHash : null
      });
      return {
        success: true,
        method: "stamp_enhanced",
        detectedVia: hasStampSuccessTitle ? "title" : "hash",
        userEmail: null
        // Will be extracted separately if needed
      };
    }
    return null;
  }
  function detectPageContent() {
    const bodyText = document.body ? document.body.textContent.toLowerCase() : "";
    const bodyHTML = document.body ? document.body.innerHTML : "";
    const successPhrases = [
      "successfully authorized",
      "authorization successful",
      "access granted",
      "authentication complete",
      "you have been authenticated",
      "installation complete",
      "setup successful",
      "oauth complete",
      "authentication success",
      "gmail add-on installation complete",
      "installation successful",
      "oauth flow completed",
      "refresh token stored",
      "stamp_oauth_success"
      // Add lowercase version for content detection
    ];
    const errorPhrases = [
      "authorization failed",
      "access denied",
      "authentication failed",
      "error occurred",
      "installation failed",
      "unauthorized_client",
      "invalid_request",
      "oauth error",
      "installation error"
    ];
    const successMatches = successPhrases.filter((phrase) => bodyText.includes(phrase));
    const errorMatches = errorPhrases.filter((phrase) => bodyText.includes(phrase));
    if (successMatches.length > 0) {
      console.log("[OAuth Callback Detector] Found success indicators:", successMatches);
    }
    if (errorMatches.length > 0) {
      console.log("[OAuth Callback Detector] Found error indicators:", errorMatches);
    }
    const hasSuccessPhrase = successMatches.length > 0;
    const hasErrorPhrase = errorMatches.length > 0;
    let userEmail = null;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = bodyHTML.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      userEmail = emailMatches[0];
      console.log("[OAuth Callback Detector] Found user email:", userEmail);
    }
    const pageTitle = document.title.toLowerCase();
    const titleSuccess = successPhrases.some((phrase) => pageTitle.includes(phrase));
    const titleError = errorPhrases.some((phrase) => pageTitle.includes(phrase));
    if (hasSuccessPhrase || titleSuccess) {
      console.log("[OAuth Callback Detector] SUCCESS detected");
      return { success: true, method: "content", userEmail };
    }
    if (hasErrorPhrase || titleError) {
      console.log("[OAuth Callback Detector] ERROR detected");
      return { success: false, method: "content", error: "Page indicates authentication failed" };
    }
    return null;
  }
  function notifyExtension(result) {
    console.log("[OAuth Callback Detector] Sending result to extension:", result.success ? "SUCCESS" : "FAILED");
    chrome.runtime.sendMessage({
      type: "OAUTH_WEB_CLIENT_COMPLETE",
      result,
      url: window.location.href,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[OAuth Callback Detector] Message send error (expected):", chrome.runtime.lastError.message);
      } else {
        console.log("[OAuth Callback Detector] Message sent successfully");
      }
    });
  }
  function detectOAuthCompletion() {
    console.log("[OAuth Callback Detector] Starting detection on:", window.location.href);
    const stampResult = detectStampOAuthSuccess();
    if (stampResult) {
      console.log("[OAuth Callback Detector] Found STAMP OAuth success signal");
      notifyExtension(stampResult);
      return;
    }
    if (isOAuthCallbackPage()) {
      const urlResult = extractOAuthResult();
      if (urlResult) {
        console.log("[OAuth Callback Detector] Found result in URL parameters");
        notifyExtension(urlResult);
        return;
      }
    }
    const contentResult = detectPageContent();
    if (contentResult) {
      console.log("[OAuth Callback Detector] Found result in page content");
      notifyExtension(contentResult);
      return;
    }
    console.log("[OAuth Callback Detector] No OAuth completion detected");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", detectOAuthCompletion);
  } else {
    detectOAuthCompletion();
  }
  setTimeout(() => {
    detectOAuthCompletion();
  }, 2e3);
  var lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("[OAuth Callback Detector] URL changed, re-checking:", currentUrl);
      setTimeout(detectOAuthCompletion, 500);
    }
  }).observe(document, { subtree: true, childList: true });
  var lastHash = location.hash;
  window.addEventListener("hashchange", () => {
    const currentHash = location.hash;
    if (currentHash !== lastHash) {
      lastHash = currentHash;
      console.log("[OAuth Callback Detector] Hash changed, re-checking:", currentHash);
      setTimeout(detectOAuthCompletion, 100);
    }
  });
  var lastTitle = document.title;
  var titleObserver = new MutationObserver(() => {
    const currentTitle = document.title;
    if (currentTitle !== lastTitle) {
      lastTitle = currentTitle;
      console.log("[OAuth Callback Detector] Title changed, re-checking:", currentTitle);
      setTimeout(detectOAuthCompletion, 100);
    }
  });
  titleObserver.observe(document.querySelector("title") || document.head, {
    childList: true,
    subtree: true,
    characterData: true
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "OAUTH_DETECTOR_CLEANUP") {
      console.log("[OAuth Callback Detector] Cleanup requested");
      sendResponse({ success: true });
    }
  });
  console.log("[OAuth Callback Detector] Setup complete, monitoring for OAuth completion");
})();
//# sourceMappingURL=oauth-callback-detector.js.map
