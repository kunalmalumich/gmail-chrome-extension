import * as InboxSDK from '@inboxsdk/core';
import jspreadsheet from 'jspreadsheet-ce';
import jsuites from 'jsuites';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import { buildSpreadsheet } from './spreadsheet-builder.js';
import { ThreadDataManager } from './thread-data-manager.js';
import { createLoadingController } from './ai-loading-component.js';
// Simple debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// DEBUG: Verify content script is loading
console.log('[CONTENT SCRIPT] ✅ Content script loaded and executing');

// Make jspreadsheet and jsuites available globally
window.jspreadsheet = jspreadsheet;
window.jsuites = jsuites;

// Global reference to the current worksheet for meta operations
let currentWorksheet = null;

// Utility functions for working with meta information
function getThreadIdFromInvoiceCell(cellAddress) {
  if (!currentWorksheet) {
    console.warn('[META INFO] Worksheet not available - navigate to invoice tracker first');
    return null;
  }
  const meta = currentWorksheet.getMeta(cellAddress);
  return meta?.threadId || null;
}

function getIdsFromStatusCell(cellAddress) {
  if (!currentWorksheet) {
    console.warn('[META INFO] Worksheet not available - navigate to invoice tracker first');
    return null;
  }
  const meta = currentWorksheet.getMeta(cellAddress);
  if (meta && meta.type === 'status_tracker') {
    return {
      threadId: meta.threadId,
      messageId: meta.messageId,
      status: meta.status,
      lastUpdated: meta.lastUpdated
    };
  }
  return null;
  }
  
function updateStatusMeta(cellAddress, newStatus) {
  if (!currentWorksheet) {
    console.warn('[META INFO] Worksheet not available - navigate to invoice tracker first');
    return;
  }
  const existingMeta = currentWorksheet.getMeta(cellAddress) || {};
  currentWorksheet.setMeta(cellAddress, {
    ...existingMeta,
    status: newStatus,
    lastUpdated: new Date().toISOString()
  });
  console.log('[META INFO] Updated status meta for', cellAddress, 'to:', newStatus);
  }
  
function getGmailUrlFromCell(cellAddress) {
  if (!currentWorksheet) {
    console.warn('[META INFO] Worksheet not available - navigate to invoice tracker first');
    return null;
  }
  const meta = currentWorksheet.getMeta(cellAddress);
  if (meta?.threadId) {
    const accountPath = getCurrentGmailAccount();
    return `https://mail.google.com/mail${accountPath}/#inbox/${meta.threadId}`;
  }
  return null;
  }
  
// Export utility functions for external use
window.SpreadsheetMetaUtils = {
  getThreadIdFromInvoiceCell,
  getIdsFromStatusCell,
  updateStatusMeta,
  getGmailUrlFromCell
};

// Make it available in multiple global scopes for maximum compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.SpreadsheetMetaUtils = window.SpreadsheetMetaUtils;
}
if (typeof self !== 'undefined') {
  self.SpreadsheetMetaUtils = window.SpreadsheetMetaUtils;
}
// Direct assignment to global scope (works in most contexts)
this.SpreadsheetMetaUtils = window.SpreadsheetMetaUtils;

// Function to set the current worksheet (called from spreadsheet-builder.js)
window.setCurrentWorksheet = function(worksheet) {
  currentWorksheet = worksheet;
  console.log('[META INFO] ✅ SpreadsheetMetaUtils now ready for use');
  
  // DEBUG: Test the utility functions with actual data
  setTimeout(() => {
    console.log('\n=== SPREADSHEET LOADED - META DATA TEST ===');
    console.log('[DEBUG] getThreadIdFromInvoiceCell("A2"):', window.SpreadsheetMetaUtils.getThreadIdFromInvoiceCell('A2')); // First data row
    console.log('[DEBUG] getThreadIdFromInvoiceCell("A3"):', window.SpreadsheetMetaUtils.getThreadIdFromInvoiceCell('A3')); // Second data row
    console.log('[DEBUG] getIdsFromStatusCell("E2"):', window.SpreadsheetMetaUtils.getIdsFromStatusCell('E2')); // First data row
    console.log('[DEBUG] getIdsFromStatusCell("E3"):', window.SpreadsheetMetaUtils.getIdsFromStatusCell('E3')); // Second data row
    console.log('[DEBUG] getGmailUrlFromCell("A2"):', window.SpreadsheetMetaUtils.getGmailUrlFromCell('A2'));
    console.log('[DEBUG] getGmailUrlFromCell("G2"):', window.SpreadsheetMetaUtils.getGmailUrlFromCell('G2'));
    
    // Show raw meta data from worksheet
    console.log('[DEBUG] Raw meta A1 (header):', worksheet.getMeta('A1')); // Should be undefined/null
    console.log('[DEBUG] Raw meta A2 (first data):', worksheet.getMeta('A2')); // Should have meta data
    console.log('[DEBUG] Raw meta E2 (first status):', worksheet.getMeta('E2')); // Should have meta data
    console.log('[DEBUG] Raw meta G2 (first thread):', worksheet.getMeta('G2')); // Should have meta data
    console.log('==========================================\n');
  }, 500);
};

console.log('[META INFO] ✅ SpreadsheetMetaUtils available globally');
console.log('[DEBUG] window.SpreadsheetMetaUtils:', window.SpreadsheetMetaUtils);
console.log('[DEBUG] typeof SpreadsheetMetaUtils:', typeof window.SpreadsheetMetaUtils);
console.log('[DEBUG] Testing direct access - this.SpreadsheetMetaUtils:', this.SpreadsheetMetaUtils);

// DEBUG: Test the utility functions and log their values
setTimeout(() => {
  console.log('\n=== SPREADSHEET META UTILS DEBUG TEST ===');
  console.log('[DEBUG] Testing getThreadIdFromInvoiceCell("A2"):', window.SpreadsheetMetaUtils.getThreadIdFromInvoiceCell('A2')); // First data row
  console.log('[DEBUG] Testing getIdsFromStatusCell("E2"):', window.SpreadsheetMetaUtils.getIdsFromStatusCell('E2')); // First data row
  console.log('[DEBUG] Testing getGmailUrlFromCell("A2"):', window.SpreadsheetMetaUtils.getGmailUrlFromCell('A2'));
  console.log('[DEBUG] All utility functions available:', Object.keys(window.SpreadsheetMetaUtils));
  console.log('============================================\n');
}, 1000);

// --- CONFIGURATION ---
// These values are injected by the build script (build.sh) as a global CONFIG object.
const API_ENDPOINT = CONFIG.API_ENDPOINT;
const AUTH_ENDPOINT = CONFIG.AUTH_ENDPOINT; 
const CLIENT_ID = CONFIG.CLIENT_ID;
const CLIENT_SECRET = CONFIG.CLIENT_SECRET;
const CHROME_CLIENT_ID = CONFIG.CHROME_CLIENT_ID;

if (!API_ENDPOINT) {
  console.error('[CONFIG] API_ENDPOINT is not set');
}
if (!AUTH_ENDPOINT) {
  console.error('[CONFIG] AUTH_ENDPOINT is not set (falling back to API_ENDPOINT)');
}

// Utility function to get current Gmail account from URL
const getCurrentGmailAccount = () => {
  try {
    // Parse the current Gmail URL to extract account index
    const pathMatch = window.location.pathname.match(/(\/u\/\d+)\//i);
    if (pathMatch) {
      return pathMatch[1]; // Returns "/u/0", "/u/1", etc.
    }
    // Fallback to /u/0 if no account found in URL (single account)
    return '/u/0';
  } catch (error) {
    console.warn('[UTILS] Error detecting Gmail account, using default:', error);
    return '/u/0';
  }
};

// Make the function globally available for other modules
window.getCurrentGmailAccount = getCurrentGmailAccount;

if (!CHROME_CLIENT_ID) {
  console.warn('[CONFIG] CHROME_CLIENT_ID is not set - Chrome extension OAuth may not work');
}

if (!CLIENT_ID) {
  console.warn('[CONFIG] CLIENT_ID is not set - some features may not work');
}

// Log client ID configuration for comparison
console.log('[CONFIG] 🔍 CLIENT ID CONFIGURATION:');
console.log('[CONFIG] 🌐 WEB OAUTH CLIENT_ID:', CLIENT_ID);
console.log('[CONFIG] 🔧 CHROME EXTENSION CLIENT_ID:', CHROME_CLIENT_ID);
console.log('[CONFIG] 📡 AUTH_ENDPOINT:', AUTH_ENDPOINT);

// --- SERVICES ---

/**
 * Handles authenticated API calls to the backend.
 * Uses the backend's token management system for secure API access.
 */
class ApiClient {
  constructor() {
    this.baseUrl = API_ENDPOINT;
  }

  /**
   * Makes an authenticated request to the backend.
   * The backend will handle token refresh and validation.
   * Uses installation ID and user email for authentication (no Chrome tokens).
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    // Context Guard: If the extension context is invalidated, stop immediately.
    if (!chrome.runtime?.id) {
      console.warn('[API] Extension context invalidated. Halting request.');
      return Promise.reject(new Error('Extension context invalidated.'));
    }

    const { installationId, userEmail } = await chrome.storage.local.get(['installationId', 'userEmail']);
    
    console.log('[DEBUG] Chrome storage values:', { installationId, userEmail });
    
    if (!installationId) {
      throw new Error('User not authenticated. Please sign in first.');
    }
    
    if (!userEmail) {
      console.warn('[DEBUG] userEmail is missing from Chrome storage');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Installation-ID': installationId,
      'X-User-Email': userEmail,
      'ngrok-skip-browser-warning': 'true', // Add ngrok header
      "Origin": "chrome-extension://" + chrome.runtime.id,
      "User-Agent": "Chrome Extension Stamp v1.0",
      ...options.headers
    };

    // Only add Content-Type for requests with bodies
    if (options.method === 'POST' && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    console.log("[API] Request headers:", JSON.stringify(headers, null, 2));
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    } catch (error) {
      // Handle ngrok-specific errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('[API] Network error (possibly ngrok):', error);
        throw new Error('Cannot connect to backend server. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Gets user data from the backend.
   */
  async getUserData() {
    const response = await this.makeAuthenticatedRequest('/user');
    return response.json();
  }

  /**
   * Checks business rules table for document storage rules.
   * @returns {Promise<object|null>} The document storage rule if found, null otherwise
   */
  async getDocumentStorageRule() {
    try {
      console.log('[API] Checking for document storage business rules...');
      console.log('[API] Calling endpoint: /api/business-rules/rules');
      console.log('[API] Base URL:', this.baseUrl);
      
      const response = await this.makeAuthenticatedRequest("/api/business-rules/rules");
      
      const data = await response.json();
      console.log('[API] Business rules response:', data);
      
      if (!data.success || !data.rules || !Array.isArray(data.rules)) {
        console.log('[API] Invalid business rules response format');
        return null;
      }
      
      // Find rule with rule_category = 'document_storage'
      const storageRule = data.rules.find(rule => 
        rule.rule_category === 'document_storage' && 
        rule.status === 'active'
      );
      
      if (storageRule) {
        console.log('[API] Found document storage rule:', storageRule);
        return storageRule;
      } else {
        console.log('[API] No active document storage rule found');
        return null;
      }
    } catch (error) {
      console.error('[API] Error fetching business rules:', error);
      console.log('[API] This is expected if the business rules endpoint is not implemented yet');
      console.log('[API] Cards will display without storage buttons until the endpoint is available');
      return null;
    }
  }

  /**
   * Executes a business rule using the MCP AI rules endpoint.
   * @param {object} payload - The payload containing ruleId and cardData (uses cardData.fullDetails as natural_language_input)
   * @returns {Promise<object>} The execution result
   */
  async executeBusinessRule(payload) {
    try {
      console.log('[API] Executing business rule:', { 
        ruleId: payload.ruleId, 
        cardTitle: payload.cardData.title
      });
      
      // Use fullDetails from cardData with message_id at top level
      const naturalLanguageInput = {
        message_id: payload.cardData.messageId,
        ...payload.cardData.fullDetails
      };
      
      console.log('[API] Natural language input:', {
        hasFullDetails: !!naturalLanguageInput,
        messageId: naturalLanguageInput?.message_id,
        entityType: naturalLanguageInput?.type,
        entityValue: naturalLanguageInput?.value
      });
      
      const response = await this.makeAuthenticatedRequest('/mcp/ai-rules/tools/execute_rule_with_nl', {
        method: 'POST',
        body: JSON.stringify({
          rule_id: String(payload.ruleId),
          natural_language_input: naturalLanguageInput
        })
      });
      
      const result = await response.json();
      console.log('[API] Business rule execution result:', result);
      return result;
    } catch (error) {
      console.error('[API] Error executing business rule:', error);
      throw error;
    }
  }

  /**
   * Formats card data for rule execution.
   * @param {object} cardData - The card data object
   * @returns {object} The card data and details as JSON
   */
  _formatCardDataForRule(cardData) {
    // Return the complete card data and document details as JSON
    // The MCP AI rules endpoint can process JSON directly
    return {
      cardData: {
        cardType: cardData.cardType,
        title: cardData.title,
        icon: cardData.icon,
        status: cardData.status,
        vendor: cardData.vendor,
        amount: cardData.amount,
        currency: cardData.currency,
        hasDetails: cardData.hasDetails,
        messageId: cardData.messageId,
        docThreadId: cardData.docThreadId,
        docMessageId: cardData.docMessageId,
        statusMessageId: cardData.statusMessageId,
        statusThreadId: cardData.statusThreadId,
        firstThreadId: cardData.firstThreadId,
        firstMessageId: cardData.firstMessageId
      },
      documentDetails: cardData.fullDetails?.document?.details || {},
      documentMetadata: {
        message_id: cardData.fullDetails?.document?.message_id,
        thread_id: cardData.fullDetails?.document?.thread_id,
        final_status: cardData.fullDetails?.document?.final_status,
        status_message_id: cardData.fullDetails?.document?.status_message_id,
        status_thread_id: cardData.fullDetails?.document?.status_thread_id,
        first_thread_id: cardData.fullDetails?.document?.first_thread_id,
        first_message_id: cardData.fullDetails?.document?.first_message_id
      },
      fullDetails: cardData.fullDetails
    };
  }

  /**
   * Gets email processing status from the backend.
   */
  async getEmailStatus() {
    const response = await this.makeAuthenticatedRequest('/status');
    return response.json();
  }

  /**
   * Gets detailed document data from the backend.
   */
  async getDetailedDocuments() {
    console.log('[API] 🚀 Starting getDetailedDocuments request...');
    const response = await this.makeAuthenticatedRequest('/api/finops/documents/detailed');
    console.log('[API] ✅ Raw response received from /api/finops/documents/detailed');
    const jsonData = await response.json();
    console.log('[API] 📊 Parsed JSON response. It is an array of length:', jsonData?.length || 0);
    
    // Log detailed structure of first few documents for debugging
    if (jsonData && jsonData.length > 0) {
      console.log('[API] 🔍 First document structure for ID debugging:', jsonData[0]);
      console.log('[API] 🔍 Available top-level fields:', Object.keys(jsonData[0]));
      if (jsonData[0].document) {
        console.log('[API] 🔍 Document nested fields:', Object.keys(jsonData[0].document));
      }
    }
    
    return jsonData;
  }

  /**
   * Fetches a Gmail attachment PDF by calling the backend, which then uses its own
   * server-side OAuth tokens to access the Gmail API.
   */
  async fetchGmailAttachmentPdf({ threadId, documentName }) {
    if (!threadId || !documentName) {
      throw new Error('[API] fetchGmailAttachmentPdf: missing threadId or documentName');
    }
    
    console.log('[API] 📄 Requesting Gmail attachment PDF from backend:', { threadId, documentName });
    
    try {
      // Build the correct endpoint with query parameters
      const endpoint = `/api/finops/files/gmail/attachment?thread_id=${encodeURIComponent(threadId)}&filename=${encodeURIComponent(documentName)}`;
      
      // Use GET method instead of POST, and no body needed since we're using query parameters
      const response = await this.makeAuthenticatedRequest(endpoint, {
        method: 'GET'
        // No body needed for GET request with query parameters
      });

      // Assuming the backend returns the PDF file directly.
      // If it returns JSON with a URL, this part will need to be adjusted.
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Backend failed to fetch attachment: ${response.status}`, errorText);
        throw new Error(`Backend failed to fetch attachment: ${response.status} ${errorText}`);
      }

      console.log('[API] ✅ Successfully received PDF stream from backend.');
      return await response.blob();
    } catch (error) {
      console.error('[API] ❌ Error fetching attachment from backend:', error);
      // Re-throw the error so the calling function can handle it.
      throw error;
    }
  }

  /**
   * Validates Chrome extension token with the backend.
   * This endpoint validates the token and returns user/installation info.
   */
  async validateChromeToken() {
    console.log('[API] Validating Chrome extension token with backend...');
    
    try {
      // Get installation data for headers
      const { installationId, userEmail } = await chrome.storage.local.get(['installationId', 'userEmail']);
      
      if (!installationId) {
        throw new Error('User not authenticated. Please sign in first.');
      }

      // Get the Chrome extension access token
      console.log('[API] Getting Chrome extension access token for validation...');
      const tokenResult = await this._getChromeExtensionToken();
      
      if (!tokenResult.accessToken) {
        throw new Error('Could not obtain Chrome extension access token for validation');
      }

      // Use AUTH_ENDPOINT directly since this is an auth endpoint
      const url = `${AUTH_ENDPOINT}/auth/validate-chrome-token`;
      console.log('[API] Chrome token validation URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-ID': installationId,
          'X-User-Email': userEmail,
          'X-Chrome-Token': tokenResult.accessToken,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({}) // Empty body as per backend documentation
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Chrome token validation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Chrome token validation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('[API] Chrome token validation result:', result);
      return result;
    } catch (error) {
      console.error('[API] Chrome token validation failed:', error);
      throw error;
    }
  }

  /**
   * Gets a fresh Chrome extension access token for direct Gmail API access.
   * This token is used for Gmail API calls, not backend authentication.
   */
  async _getChromeExtensionToken() {
    console.log('[API] Getting fresh Chrome extension token for Gmail API access...');
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_CHROME_ACCESS_TOKEN' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[API] Chrome access token error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.error) {
          console.error('[API] Chrome access token failed:', response.error);
          reject(new Error(response.error));
          return;
        }
        
        console.log('[API] Chrome extension token obtained successfully');
        resolve(response);
      });
    });
  }
}

/**
 * Handles all authentication and installation logic.
 * Implements the dual OAuth flow for Chrome extension with Web client backend integration.
 */
class AuthService {
  constructor(uiManager) {
    this.uiManager = uiManager;
  }

  /**
   * Implements the complete dual OAuth flow for Chrome extension.
   * Step 1: Initiate Web OAuth flow for backend refresh tokens
   * Step 2: Wait for Web OAuth completion
   * Step 3: Get Chrome extension access token and user email
   * Step 4: Call backend install endpoint with dual_oauth mode
   * Step 5: Complete installation
   */
  async signInWithGoogle() {
    console.log('[AUTH] Starting dual OAuth sign-in flow');
    
    try {
      // Step 1: Initiate Web OAuth flow for backend refresh tokens
      console.log('[AUTH] Step 1: Starting Web OAuth flow');
      
      const webOAuthResult = await this._initiateWebClientOAuth();
      
      if (!webOAuthResult.success) {
        throw new Error(`Web OAuth flow failed: ${webOAuthResult.error}`);
      }
      
      console.log('[AUTH] Web OAuth completed successfully');
      
      // Step 2: Clear Chrome identity cache for fresh sign-up
      console.log('[AUTH] Step 2: Clearing Chrome identity cache for fresh sign-up');
      
      await this._clearChromeIdentityCache();
      
      // Step 3: Get Chrome extension access token and user email
      console.log('[AUTH] Step 3: Getting Chrome extension access token');
      
      const chromeTokenResult = await this._getChromeExtensionAccessToken();
      const userEmail = chromeTokenResult.userEmail;
      
      if (!userEmail) {
        const errorMsg = chromeTokenResult.error || 'Unknown error';
        console.error('[AUTH] Chrome extension OAuth failed:', {
          error: errorMsg,
          debug: chromeTokenResult.debug
        });
        console.error('[AUTH] Full chromeTokenResult:', chromeTokenResult);
        throw new Error(`Could not retrieve user email from Chrome extension OAuth: ${errorMsg}`);
      }
      
      console.log('[AUTH] User email obtained:', userEmail);
      
      // Step 4: Call backend install endpoint with dual OAuth mode
      console.log('[AUTH] Step 4: Calling backend install endpoint');
      
      const installResponse = await fetch(`${AUTH_ENDPOINT}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          //'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          installation_type: 'dual_oauth',
          user_email: userEmail
        })
      });

      if (!installResponse.ok) {
        const errorText = await installResponse.text();
        console.error('[AUTH] Installation failed:', installResponse.status, errorText);
        throw new Error(`Backend installation failed: ${errorText}`);
      }

      const installResult = await installResponse.json();
      const installationId = installResult.installationId;
      
      console.log('[AUTH] Installation successful, ID:', installationId);
      
      // Step 4: Store installation success state
      await chrome.storage.local.set({ 
        installationId, 
        userEmail,
        installationComplete: true,
        installationDate: new Date().toISOString()
      });
      
      // Step 5: Validate Chrome extension token with backend
      console.log('[AUTH] Step 5: Validating Chrome token');
      try {
        const validationResult = await this.uiManager.apiClient.validateChromeToken();
        if (!validationResult.success) {
          throw new Error(`Chrome token validation failed: ${validationResult.error || 'Unknown error'}`);
        }
        console.log('[AUTH] Chrome token validation successful');
      } catch (error) {
        console.error('[AUTH] Chrome token validation failed:', error.message);
        console.warn('[AUTH] Installation completed but token validation failed');
      }
      
      console.log('[AUTH] Dual OAuth installation completed successfully');
      console.log('[AUTH] 📊 OAUTH CLIENT ID COMPARISON SUMMARY:');
      console.log('[AUTH] 🔧 Chrome Extension OAuth used: manifest.json client_id');
      console.log('[AUTH] 🌐 Web OAuth used: backend server client_id');
      console.log('[AUTH] 📝 Check browser console for detailed client ID values');
      
    } catch (error) {
      console.error('[AUTH] Dual OAuth sign-in flow failed:', error.message);
      
      // Try to get the user email from Chrome storage for error context
      try {
        const { userEmail } = await chrome.storage.local.get(['userEmail']);
        if (userEmail) {
          console.error('[AUTH] Sign-up failed for email:', userEmail);
        } else {
          console.error('[AUTH] Sign-up failed - no user email found in storage');
        }
      } catch (storageError) {
        console.error('[AUTH] Sign-up failed - could not retrieve user email from storage');
      }
      
      // Clean up partial installation state on failure
      await this._cleanupPartialInstallation();
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to backend server. Please check your connection.');
      }
      
      throw error;
    }
  }

  /**
   * Initiates the Web client OAuth flow for backend refresh token storage.
   * This opens a new tab to the backend OAuth start endpoint and waits for completion.
   */
  async _initiateWebClientOAuth() {
    console.log('[AUTH] Initiating Web client OAuth flow...');
    console.log('[AUTH] 🌐 Web OAuth will use backend server at:', AUTH_ENDPOINT);
    console.log('[AUTH] 📝 Backend will determine the client ID for this flow');
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'START_WEB_OAUTH_FLOW' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AUTH] Web OAuth initiation error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.error) {
          console.error('[AUTH] Web OAuth initiation failed:', response.error);
          reject(new Error(response.error));
          return;
        }
        
        console.log('[AUTH] Web OAuth flow completed successfully');
        resolve(response);
      });
    });
  }

  /**
   * Gets Chrome extension access token and user email using chrome.identity API.
   * This is used for the extension's own API calls and to get user email if needed.
   * Does NOT send tokens to backend - they're for extension use only.
   */
  async _getChromeExtensionAccessToken() {
    console.log('[AUTH] Getting Chrome extension access token for direct API access...');
    
    // Log the user email being used for OAuth
    const { userEmail } = await chrome.storage.local.get(['userEmail']);
    console.log('[AUTH] 🔍 Attempting OAuth for user email:', userEmail || 'NOT_FOUND');
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_CHROME_ACCESS_TOKEN' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AUTH] Chrome access token error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.error) {
          console.error('[AUTH] Chrome access token failed:', response.error);
          reject(new Error(response.error));
          return;
        }
        
        console.log('[AUTH] Chrome extension access token obtained successfully');
        resolve(response);
      });
    });
  }

  /**
   * Clears Chrome identity cache and storage to ensure fresh authentication during sign-up.
   * This is only called during the sign-up flow, not during regular API calls.
   */
  async _clearChromeIdentityCache() {
    console.log('[AUTH] Clearing Chrome identity cache and storage for fresh sign-up...');
    
    try {
      // Clear Chrome storage first (removes old userEmail)
      console.log('[AUTH] Clearing Chrome storage...');
      await chrome.storage.local.remove(['installationId', 'userEmail', 'installationComplete']);
      console.log('[AUTH] Chrome storage cleared successfully');
      
      // Then clear Chrome identity cache
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'CLEAR_CHROME_IDENTITY_CACHE' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[AUTH] Clear cache error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response.error) {
            console.log('[AUTH] Cache clearing had issues (non-critical):', response.error);
            // Don't reject here - cache clearing issues are non-critical
          }
          
          console.log('[AUTH] Chrome identity cache cleared successfully');
          resolve(response);
        });
      });
    } catch (error) {
      console.error('[AUTH] Error clearing Chrome storage:', error);
      throw error;
    }
  }

  /**
   * Cleans up partial installation state on failure.
   */
  async _cleanupPartialInstallation() {
    try {
      console.log('[AUTH] Cleaning up partial installation state...');
      await chrome.storage.local.remove([
        'installationId', 
        'userEmail', 
        'installationComplete', 
        'installationDate'
      ]);
      console.log('[AUTH] Partial installation cleanup completed');
    } catch (error) {
      console.error('[AUTH] Failed to cleanup partial installation:', error);
    }
  }

  /**
   * Checks local storage for installation state and authentication status.
   */
  async getAuthState() {
    const result = await chrome.storage.local.get([
      'installationId', 
      'userEmail', 
      'installationComplete', 
      'installationDate'
    ]);
    
    return {
      isLoggedIn: !!result.installationId,
      isInstalled: !!result.installationComplete,
      userEmail: result.userEmail || null,
      installationId: result.installationId || null,
      installationDate: result.installationDate || null
    };
  }

  /**
   * Gets the user email from local storage.
   */
  async getUserEmail() {
    const { userEmail } = await chrome.storage.local.get(['userEmail']);
    return userEmail || null;
  }

  /**
   * Gets the installation ID from local storage.
   */
  async getInstallationId() {
    const { installationId } = await chrome.storage.local.get(['installationId']);
    return installationId || null;
  }

  /**
   * Standard sign-out that clears local extension storage.
   * Does not revoke Google OAuth permissions.
   */
  async signOut() {
    try {
      console.log('[AUTH] Starting standard sign-out...');
      const { installationId } = await chrome.storage.local.get('installationId');
      
      // Notify backend about sign out if we have an installation
      if (installationId) {
        console.log('[AUTH] Notifying backend of sign-out for installation:', installationId);
        await fetch(`${AUTH_ENDPOINT}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Installation-ID': installationId,
            'ngrok-skip-browser-warning': 'true'
          }
        });
      }

      // Clear local storage
      console.log('[AUTH] Clearing local storage...');
      await chrome.storage.local.remove([
        'installationId', 
        'userEmail', 
        'installationComplete', 
        'installationDate'
      ]);
      console.log('[AUTH] Sign-out complete.');
      
    } catch (error) {
      console.error('[AUTH] Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Development tool to completely reset the auth state.
   * Clears all local data and notifies backend to revoke tokens.
   */
  async hardReset() {
    try {
      console.log('[AUTH] Starting hard reset...');
      
      // Get current installation ID for backend notification
      const { installationId } = await chrome.storage.local.get(['installationId']);
      
      // Notify backend to revoke all tokens if we have an installation
      if (installationId) {
        console.log('[AUTH] Step 1: Notifying backend to revoke all tokens...');
        try {
          await fetch(`${AUTH_ENDPOINT}/hard-reset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Installation-ID': installationId,
              'ngrok-skip-browser-warning': 'true'
            }
          });
          console.log('[AUTH] Backend token revocation requested');
        } catch (error) {
          console.warn('[AUTH] Failed to notify backend of hard reset:', error.message);
          // Continue with local cleanup even if backend call fails
        }
      }

      // Perform thorough local cleanup
      console.log('[AUTH] Step 2: Performing thorough local cleanup...');
      await this._cleanupPartialInstallation();
      
      // Also clear any other potential Chrome storage
      try {
        await chrome.storage.sync.clear();
        console.log('[AUTH] Sync storage cleared');
      } catch (error) {
        console.warn('[AUTH] Could not clear sync storage:', error.message);
      }
      
      console.log('[AUTH] Hard reset completed successfully.');
      
    } catch (error) {
      console.error('[AUTH] Hard reset failed:', error);
      
      // Ensure local cleanup happens even if other steps fail
      try {
        await this._cleanupPartialInstallation();
      } catch (cleanupError) {
        console.error('[AUTH] Final cleanup also failed:', cleanupError);
      }
      
      throw error;
    }
  }
}

// Define the stages/labels we want to use (moved to global scope)
const INVOICE_STAGES = {
  PENDING_APPROVAL: 'Pending Approval',
  IN_REVIEW: 'In Review', 
  APPROVED: 'Approved',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  REJECTED: 'Rejected'
};

// Stage colors for labels and UI (moved to global scope)
const STAGE_COLORS = {
  [INVOICE_STAGES.PENDING_APPROVAL]: '#ffc107',
  [INVOICE_STAGES.IN_REVIEW]: '#9c27b0', 
  [INVOICE_STAGES.APPROVED]: '#2196f3',
  [INVOICE_STAGES.PAID]: '#4caf50',
  [INVOICE_STAGES.OVERDUE]: '#f44336',
  [INVOICE_STAGES.REJECTED]: '#607d8b'
};

// Mock data: Map of thread IDs to their assigned stages (moved to global scope)
const THREAD_STAGE_ASSIGNMENTS = {
  // Real Gmail thread IDs with their assigned stages
  'thread-1': INVOICE_STAGES.PENDING_APPROVAL,
  'thread-2': INVOICE_STAGES.PENDING_APPROVAL,
  'thread-3': INVOICE_STAGES.IN_REVIEW,
  'thread-4': INVOICE_STAGES.APPROVED,
  'thread-5': INVOICE_STAGES.PAID,
  'thread-6': INVOICE_STAGES.OVERDUE,
  'thread-7': INVOICE_STAGES.REJECTED,
  'thread-8': INVOICE_STAGES.PENDING_APPROVAL,
  'thread-9': INVOICE_STAGES.IN_REVIEW,
  'thread-10': INVOICE_STAGES.APPROVED,
  'thread-11': INVOICE_STAGES.PAID,
  'thread-12': INVOICE_STAGES.OVERDUE,
  'thread-13': INVOICE_STAGES.REJECTED,
  'thread-14': INVOICE_STAGES.PENDING_APPROVAL,
  'thread-15': INVOICE_STAGES.IN_REVIEW
};

// Function to get stage for a thread ID (moved here for accessibility)
function getThreadStage(threadId) {
  return THREAD_STAGE_ASSIGNMENTS[threadId] || INVOICE_STAGES.PENDING_APPROVAL;
}

// Define the invoice status colors
const INVOICE_STATUS_COLORS = {
  // Core statuses
  pending: { backgroundColor: '#FFC107', textColor: '#000000', description: 'Awaiting approval' },
  approved: { backgroundColor: '#4CAF50', textColor: '#FFFFFF', description: 'Approved' },
  rejected: { backgroundColor: '#F44336', textColor: '#FFFFFF', description: 'Rejected' },
  paid: { backgroundColor: '#2196F3', textColor: '#FFFFFF', description: 'Payment confirmed' },

  // Extended statuses
  on_hold: { backgroundColor: '#9E9E9E', textColor: '#FFFFFF', description: 'On hold' },
  requires_review: { backgroundColor: '#FF9800', textColor: '#000000', description: 'Requires review' },
  partially_approved: { backgroundColor: '#81C784', textColor: '#FFFFFF', description: 'Partially approved' },
  ready_for_payment: { backgroundColor: '#26A69A', textColor: '#FFFFFF', description: 'Ready for payment' },
  duplicate: { backgroundColor: '#607D8B', textColor: '#FFFFFF', description: 'Duplicate detected' },

  // Legacy/optional
  submitted: { backgroundColor: '#90CAF9', textColor: '#000000', description: 'Invoice initially detected' }
};

// Define the primary intent colors
const PRIMARY_INTENT_COLORS = {
  // Financial Intents - Blues
  'payment_status_inquiry': {
    backgroundColor: '#E3F2FD',
    textColor: '#1565C0'
  },
  'payment_confirmation': {
    backgroundColor: '#BBDEFB',
    textColor: '#1565C0'
  },
  'refund_request': {
    backgroundColor: '#90CAF9',
    textColor: '#000000'
  },

  // Document Processing - Greens
  'invoice_submission': {
    backgroundColor: '#E8F5E9',
    textColor: '#2E7D32'
  },
  'expense_report': {
    backgroundColor: '#C8E6C9',
    textColor: '#2E7D32'
  },
  'tax_documentation': {
    backgroundColor: '#A5D6A7',
    textColor: '#000000'
  },

  // Inquiries - Purples
  'billing_inquiry': {
    backgroundColor: '#F3E5F5',
    textColor: '#6A1B9A'
  },
  'status_request': {
    backgroundColor: '#E1BEE7',
    textColor: '#6A1B9A'
  },
  'information_sharing': {
    backgroundColor: '#CE93D8',
    textColor: '#000000'
  },

  // Action Items - Warm Colors
  'approval_request': {
    backgroundColor: '#FFF3E0',
    textColor: '#E65100'
  },
  'urgent_request': {
    backgroundColor: '#FFE0B2',
    textColor: '#E65100'
  },
  'task_assignment': {
    backgroundColor: '#FFCC80',
    textColor: '#000000'
  },

  // Issues & Resolution - Reds
  'quality_issue': {
    backgroundColor: '#FFEBEE',
    textColor: '#C62828'
  },
  'dispute_resolution': {
    backgroundColor: '#FFCDD2',
    textColor: '#C62828'
  },
  'escalation': {
    backgroundColor: '#EF9A9A',
    textColor: '#000000'
  },

  // Administrative - Grays
  'vendor_onboarding': {
    backgroundColor: '#FAFAFA',
    textColor: '#424242'
  },
  'account_setup': {
    backgroundColor: '#F5F5F5',
    textColor: '#424242'
  },
  'system_access': {
    backgroundColor: '#EEEEEE',
    textColor: '#000000'
  },

  // Communication - Teals
  'follow_up': {
    backgroundColor: '#E0F2F1',
    textColor: '#00695C'
  },
  'routine_update': {
    backgroundColor: '#B2DFDB',
    textColor: '#00695C'
  },
  'general_communication': {
    backgroundColor: '#80CBC4',
    textColor: '#000000'
  }
};

/**
 * Creates a label object for InboxSDK from a thread label string.
 * @param {string} labelText - The label text from the API
 * @returns {object} InboxSDK label object
 */
function createLabelFromThreadLabel(labelText) {
  if (!labelText) {
    console.warn('[LABEL_CREATION] Received empty label text');
    return null;
  }

  const normalizedText = labelText.toLowerCase();
  console.log(`[LABEL_CREATION] Processing label text: "${labelText}"`);

  // Hide labels when backend explicitly says nothing definitive
  if (normalizedText.includes('no definitive label found')) {
    console.log('[LABEL_CREATION] Skipping label creation for "No definitive label found"');
    return null;
  }

  // Check for invoice status keywords (exact match preferred)
  for (const status of Object.keys(INVOICE_STATUS_COLORS)) {
    if (normalizedText.includes(status)) {
      const colorConfig = INVOICE_STATUS_COLORS[status];
      console.log(`[LABEL_CREATION] Found invoice status keyword "${status}" in: "${normalizedText}"`, colorConfig);
      return {
        title: labelText,
        backgroundColor: colorConfig.backgroundColor,
        textColor: colorConfig.textColor,
        iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      };
    }
  }

  // Check for primary intent keywords
  for (const intent of Object.keys(PRIMARY_INTENT_COLORS)) {
    if (normalizedText.includes(intent)) {
      const colorConfig = PRIMARY_INTENT_COLORS[intent];
      console.log(`[LABEL_CREATION] Found primary intent keyword "${intent}" in: "${normalizedText}"`, colorConfig);
      return {
        title: labelText,
        backgroundColor: colorConfig.backgroundColor,
        textColor: colorConfig.textColor,
        iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      };
    }
  }

  // No mapping => do not render a label
  console.log(`[LABEL_CREATION] No mapping found for: "${normalizedText}". Skipping label.`);
  return null;
}

/**
 * Creates multiple labels from thread labels array.
 * @param {string[]} threadLabels - Array of label strings from API
 * @returns {object[]} Array of InboxSDK label objects
 */
function createLabelsFromThreadLabels(threadLabels) {
  if (!threadLabels || !Array.isArray(threadLabels)) {
    return [];
  }
  
  return threadLabels.map(labelText => createLabelFromThreadLabel(labelText));
}

const ENTITY_CONFIG = {
  inv: { displayName: 'Invoice', icon: '🧾' },
  quote: { displayName: 'Quote', icon: '📊' },
  contract: { displayName: 'Contract', icon: '✍️' },
  po: { displayName: 'Purchase Order', icon: '📄' },
  statement: { displayName: 'Statement', icon: '📋' },
  approval: { displayName: 'Approval', icon: '👍' },
  default: { displayName: 'Document', icon: '📎' }
};

/**
 * Transforms the raw `processed_entities` from the API into a simplified array of objects
 * suitable for rendering as UI cards.
 * @param {object[]} processedEntities - The array from the API response.
 * @returns {object[]} A cleaned-up array for the UI.
 */
function transformProcessedEntitiesForSidebar(processedEntities) {
  if (!processedEntities || !Array.isArray(processedEntities)) {
    return [];
  }

  return processedEntities.map(entity => {
    // Determine if the entity has enough details to be interactive
    const hasDetails = !!(entity.document && entity.document.details && Object.keys(entity.document.details).length > 0);
    const config = ENTITY_CONFIG[entity.type] || ENTITY_CONFIG.default;
    const details = entity.document?.details || {};

    // Create a standardized card data object for the UI
    return {
      cardType: entity.type,
      title: `${config.displayName} ${entity.value}`,
      icon: config.icon,
      status: entity.document?.final_status || null,
      messageId: entity.document?.message_id,
      hasDetails: hasDetails,
      fullDetails: entity,
      // Conditionally add specific details
      vendor: hasDetails ? (details.vendor?.name || 'Unknown Vendor') : null,
      amount: hasDetails ? (details.amount || 0) : null,
      currency: hasDetails ? (details.currency || 'USD') : null,
      filename: details.filename || null, // Add filename for attachment matching
      // Add status message information for invoices
      statusMessageId: entity.document?.status_message_id || null,
      statusThreadId: entity.document?.status_thread_id || null,
      // Add document source information
      docThreadId: entity.document?.thread_id || null,
      docMessageId: entity.document?.message_id || null,
      firstThreadId: entity.document?.first_thread_id || null,
      firstMessageId: entity.document?.first_message_id || null,
    };
  });
}

/**
 * Creates the HTML for a single entity card.
 * @param {object} cardData - A simplified entity object from transformProcessedEntitiesForSidebar.
 * @param {string} threadId - The current Gmail thread ID for link generation.
 * @returns {string} The HTML string for the card.
 */
function createEntityCard(cardData, threadId) {
  const statusConfig = cardData.status ? (INVOICE_STATUS_COLORS[cardData.status] || { backgroundColor: '#E0E0E0', textColor: '#000000', description: '' }) : null;
  const amountFormatted = cardData.hasDetails
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cardData.currency }).format(cardData.amount)
    : null;

  // Card is only clickable if it has details
  const isClickable = cardData.hasDetails;
  const fullDetailsString = isClickable ? JSON.stringify(cardData.fullDetails).replace(/'/g, '&apos;') : '';
  const cursorStyle = isClickable ? 'cursor: pointer;' : 'cursor: default;';
  const cardClass = isClickable ? 'entity-card' : 'entity-card non-clickable';
  const cardId = `${cardData.cardType}-${cardData.messageId || 'unknown'}`;

  // Title can be a link if a messageId is available
  const accountPath = getCurrentGmailAccount();
  const messageLink = cardData.messageId ? `https://mail.google.com/mail${accountPath}/#inbox/${threadId}/${cardData.messageId}` : null;
  const titleHtml = messageLink
    ? `<a href="${messageLink}" target="_blank" style="text-decoration: none; color: #1a73e8;" onclick="event.stopPropagation();">${cardData.title}</a>`
    : cardData.title;

  // Build compact subline
  const sublineHtml = isClickable && (cardData.vendor || amountFormatted)
    ? `<div style="margin-top:4px; font-size:12px; color:#64748b; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
         ${cardData.vendor ? `<span style=\"white-space:nowrap;\">${cardData.vendor}</span>` : ''}
         ${(cardData.vendor && amountFormatted) ? `<span aria-hidden=\"true\" style=\"color:#cbd5e1;\">•</span>` : ''}
         ${amountFormatted ? `<span style=\"white-space:nowrap;\">${amountFormatted}</span>` : ''}
       </div>`
    : '';



  return `
    <div class="${cardClass}" 
         data-card-id="${cardId}"
         ${isClickable ? `data-full-details='${fullDetailsString}'` : ''} 
         style="
           background: white; 
           border: 1px solid #e5e0e0; 
           border-radius: 12px; 
           margin-bottom: 12px; 
           padding: 12px 14px; 
           ${cursorStyle} 
           transition: all 0.2s;
         ">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display:flex; flex-direction:column; min-width:0;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; color:#1f2937;">
            <span style="font-size: 18px;">${cardData.icon}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${titleHtml}</span>
          </h4>
          ${sublineHtml}
        </div>
        ${statusConfig ? `
        <span class="status-tag" title="${statusConfig.description || ''}" style="display:inline-flex; align-items:center; gap:6px; background-color: ${statusConfig.backgroundColor}; color: ${statusConfig.textColor}; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; white-space:nowrap;">
          <span style=\"display:inline-block; width:8px; height:8px; border-radius:50%; background:${statusConfig.textColor === '#000000' ? '#111827' : '#ffffff'}; opacity:0.6;\"></span>
          ${cardData.status.replace(/_/g, ' ')}
        </span>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Creates the HTML content for the detailed view in the sidebar.
 * @param {object} details - The full entity object to display.
 * @returns {string} The HTML string for the detailed view.
 */
function createDetailsSidebarContent(details) {
    console.log('[DETAILS] Full details object:', details);
    
    const doc = details.document;
    const docDetails = doc.details;
    
    console.log('[DETAILS] Document object:', doc);
    console.log('[DETAILS] Document details object:', docDetails);
    console.log('[DETAILS] Available keys in docDetails:', Object.keys(docDetails));
    
    // Format amount with currency
    const amountFormatted = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: docDetails.currency || 'USD' 
    }).format(docDetails.amount || 0);

    // Build dynamic details HTML
    let detailsHtml = '';
    
    // Add all available fields from docDetails (excluding complex objects)
    for (const [key, value] of Object.entries(docDetails)) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
            let displayValue = value;
            
            // Format special fields
            if (key === 'amount' && docDetails.currency) {
                displayValue = new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: docDetails.currency 
                }).format(value);
            } else if (key.includes('date') || key.includes('Date')) {
                try {
                    displayValue = new Date(value).toLocaleDateString();
                } catch (e) {
                    displayValue = value;
                }
            }
            
            detailsHtml += `
              <div style="margin-bottom: 12px;">
                <strong style="color: #5f6368; font-size: 12px; display: block;">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
                <div style="font-weight: 500; font-size: 14px;">${displayValue}</div>
              </div>
            `;
        }
    }
    
    // Handle vendor object separately
    if (docDetails.vendor && typeof docDetails.vendor === 'object') {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">Vendor Name</strong>
            <div style="font-weight: 500; font-size: 14px;">${docDetails.vendor.name || 'N/A'}</div>
          </div>
        `;
        
        if (docDetails.vendor.email) {
            detailsHtml += `
              <div style="margin-bottom: 12px;">
                <strong style="color: #5f6368; font-size: 12px; display: block;">Vendor Email</strong>
                <div style="font-weight: 500; font-size: 14px;">${docDetails.vendor.email}</div>
              </div>
            `;
        }
    }
    
    // Handle line items array separately
    if (docDetails.lineItems && Array.isArray(docDetails.lineItems) && docDetails.lineItems.length > 0) {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">Line Items</strong>
            <div style="margin-top: 8px;">
        `;
        
        docDetails.lineItems.forEach((item, index) => {
            const itemAmount = item.amount ? new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: docDetails.currency || 'USD' 
            }).format(item.amount) : 'N/A';
            
            detailsHtml += `
              <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px; margin-bottom: 4px;">
                <div style="font-weight: 500; font-size: 13px;">${item.description || 'No description'}</div>
                <div style="font-size: 12px; color: #666;">
                  Quantity: ${item.quantity || 'N/A'} | 
                  Unit Price: ${item.unitPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: docDetails.currency || 'USD' }).format(item.unitPrice) : 'N/A'} | 
                  Amount: ${itemAmount}
                </div>
                ${item.sku ? `<div style="font-size: 11px; color: #999;">SKU: ${item.sku}</div>` : ''}
              </div>
            `;
        });
        
        detailsHtml += `
            </div>
          </div>
        `;
    }
    
    // Add document-level fields
    if (doc.final_status) {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">Status</strong>
            <div style="font-weight: 500; font-size: 14px; text-transform: capitalize;">${doc.final_status}</div>
          </div>
        `;
    }
    
    if (doc.document_name) {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">Document Name</strong>
            <div style="font-weight: 500; font-size: 14px;">${doc.document_name}</div>
          </div>
        `;
    }
    
    if (doc.message_id) {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">Message ID</strong>
            <div style="font-family: monospace; font-size: 12px; color: #666;">${doc.message_id}</div>
          </div>
        `;
    }
    
    if (doc.first_message_id && doc.first_message_id !== doc.message_id) {
        detailsHtml += `
          <div style="margin-bottom: 12px;">
            <strong style="color: #5f6368; font-size: 12px; display: block;">First Message ID</strong>
            <div style="font-family: monospace; font-size: 12px; color: #666;">${doc.first_message_id}</div>
          </div>
        `;
    }

    return `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <button id="back-to-cards" style="background: #f1f3f4; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; color: #5f6368;">
            ← Back to Documents
          </button>
        </div>
        
        <h3 style="margin: 0 0 16px 0; color: #202124; font-size: 18px;">Document Details</h3>
        
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
          ${detailsHtml}
        </div>
      </div>
    `;
}

/**
 * Manages rendering the correct UI based on authentication state.
 */
class UIManager {
  constructor(sdk) {
    this.sdk = sdk;
    this.authService = null;
    this.apiClient = null;
    this.sidebarPanel = null;
    this.sidebarElement = null; // Add this to store the DOM element reference
    this.dataManager = new ThreadDataManager(null); // Initialize dataManager without apiClient initially
    this.floatingChatManager = null; // Add floating chat manager
    this._messageIndex = new Map(); // Track messageId -> messageView for instant lookup
    this._documentStorageRule = null; // Cache for business rule
  }

  // NOTE: Old reactive message indexing removed in favor of proactive indexing in _indexAllThreadMessages()
  // This ensures we index ALL messages in a thread (including collapsed ones) when the thread opens

  /**
   * Initializes and caches the document storage business rule.
   * Called once during UI setup.
   */
  async initializeBusinessRules() {
    if (!this.apiClient) {
      console.log('[UI] API client not available, skipping business rules initialization');
      return;
    }
    
    try {
      console.log('[UI] Initializing business rules...');
      this._documentStorageRule = await this.apiClient.getDocumentStorageRule();
      
      if (this._documentStorageRule) {
        console.log('[UI] Document storage rule initialized:', this._documentStorageRule);
      } else {
        console.log('[UI] No document storage rule found');
      }
    } catch (error) {
      console.error('[UI] Error initializing business rules:', error);
      this._documentStorageRule = null;
    }
  }

  /**
   * Handles storing a document to Google Drive using business rules.
   * @param {object} cardData - The card data to store
   */
  async handleDocumentStorage(cardData) {
    if (!this._documentStorageRule) {
      console.error('[UI] No document storage rule available');
      return;
    }

    try {
      console.log('[UI] Starting document storage for card:', cardData.title);
      console.log('[UI] Using business rule ID:', this._documentStorageRule.id);
      
      // Gather cached data from when sidebar card was created
      const cachedCardData = this._currentCardData || [];
      console.log('[UI] Cached card data available:', cachedCardData.length, 'items');
      console.log('[UI] Looking for document:', {
        title: cardData.title,
        messageId: cardData.messageId,
        docMessageId: cardData.docMessageId
      });
      
      // Find the specific cached data for this document using multiple matching strategies
      const matchingCachedData = this.findMatchingCachedDocument(cachedCardData, cardData);
      
      if (matchingCachedData) {
        console.log('[UI] ✅ Found matching cached data for:', matchingCachedData.title);
        console.log('[UI] Cached document details:', {
          title: matchingCachedData.title,
          messageId: matchingCachedData.messageId,
          docMessageId: matchingCachedData.docMessageId,
          vendor: matchingCachedData.vendor,
          amount: matchingCachedData.amount
        });
      } else {
        console.log('[UI] ❌ No matching cached data found, using provided cardData');
        console.log('[UI] Available cached documents:', cachedCardData.map(doc => ({
          title: doc.title,
          messageId: doc.messageId,
          docMessageId: doc.docMessageId
        })));
      }
      
      // Prepare the payload with rule ID and best available data
      const payload = {
        ruleId: this._documentStorageRule.id,
        cardData: matchingCachedData || cardData,
        timestamp: new Date().toISOString()
      };
      
      console.log('[UI] Sending storage request with payload:', {
        ruleId: payload.ruleId,
        cardTitle: payload.cardData.title,
        hasMatchingData: !!matchingCachedData
      });

      // Execute the business rule with enhanced payload
      const result = await this.apiClient.executeBusinessRule(payload);

      console.log('[UI] Document storage result:', result);

      // Show success notification
      this.showNotification('Document stored successfully in Google Drive!', 'success');

    } catch (error) {
      console.error('[UI] Error storing document:', error);
      
      // Show error notification
      this.showNotification('Failed to store document. Please try again.', 'error');
    }
  }

  /**
   * Finds the matching cached document data for a specific document being stored.
   * Uses exact filename matching between cached.filename and targetCardData.title.
   * @param {Array} cachedCardData - Array of all cached documents from sidebar creation
   * @param {Object} targetCardData - The specific document we're trying to store
   * @returns {Object|null} The matching cached document or null if not found
   */
    findMatchingCachedDocument(cachedCardData, targetCardData) {
    if (!cachedCardData || cachedCardData.length === 0) {
      console.log('[MATCH] No cached data available');
      return null;
    }

    console.log('[MATCH] Searching for document match...');
    console.log('[MATCH] Target data:', {
      filename: targetCardData.filename,
      messageId: targetCardData.messageId,
      title: targetCardData.title
    });

    // PRIORITY 1: Match by filename + messageId (most reliable for attachments)
    if (targetCardData.filename && targetCardData.messageId) {
      const filenameMessageMatch = cachedCardData.find(cached => {
        return cached.filename === targetCardData.filename && 
               cached.messageId === targetCardData.messageId;
      });
      
      if (filenameMessageMatch) {
        console.log('[MATCH] ✅ Found filename + messageId match:', {
          filename: filenameMessageMatch.filename,
          messageId: filenameMessageMatch.messageId,
          title: filenameMessageMatch.title
        });
        return filenameMessageMatch;
      }
    }

    // PRIORITY 2: Match by messageId only (for sidebar card matching)
    if (targetCardData.messageId) {
      const messageIdMatch = cachedCardData.find(cached => {
        return cached.messageId === targetCardData.messageId;
      });
      
      if (messageIdMatch) {
        console.log('[MATCH] ✅ Found messageId match:', {
          messageId: messageIdMatch.messageId,
          title: messageIdMatch.title,
          filename: messageIdMatch.filename
        });
        return messageIdMatch;
      }
    }

    // PRIORITY 3: Match by title (fallback for backward compatibility)
    if (targetCardData.title) {
      const titleMatch = cachedCardData.find(cached => {
        return cached.title === targetCardData.title;
      });
      
      if (titleMatch) {
        console.log('[MATCH] ✅ Found title match:', {
          title: titleMatch.title,
          filename: titleMatch.filename,
          messageId: titleMatch.messageId
        });
        return titleMatch;
      }
    }

    console.log('[MATCH] ❌ No match found');
    console.log('[MATCH] Available cached documents:');
    cachedCardData.forEach((doc, index) => {
      console.log(`[MATCH]   ${index + 1}. Title: "${doc.title}", Filename: "${doc.filename || 'N/A'}", MessageId: "${doc.messageId || 'N/A'}"`);  
    });
    
    return null;
  }

  /**
   * Shows a notification to the user.
   * @param {string} message - The notification message
   * @param {string} type - The notification type ('success', 'error', 'info')
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    // Add animation styles if not already present
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  async _indexAllThreadMessages(threadView) {
    try {
      console.log('[THREAD_INDEX] Proactively indexing all messages in thread...');
      const allMessageViews = threadView.getMessageViewsAll();
      console.log('[THREAD_INDEX] Found', allMessageViews.length, 'total messages in thread (including collapsed)');
      
      for (let i = 0; i < allMessageViews.length; i++) {
        const messageView = allMessageViews[i];
        try {
          const messageId = await messageView.getMessageIDAsync();
          
          // Only add if not already indexed
          if (!this._messageIndex.has(messageId)) {
            this._messageIndex.set(messageId, messageView);
            console.log('[THREAD_INDEX] Proactively indexed message:', messageId, 'isLoaded:', messageView.isLoaded ? messageView.isLoaded() : 'unknown');
            
            // Set up cleanup when message is destroyed
            messageView.on('destroy', () => {
              this._messageIndex.delete(messageId);
              console.log('[THREAD_INDEX] Removed proactively indexed message:', messageId);
            });
          } else {
            console.log('[THREAD_INDEX] Message already indexed:', messageId);
          }
        } catch (e) {
          console.log('[THREAD_INDEX] Failed to index message', i, ':', e.message);
        }
      }
      
      console.log('[THREAD_INDEX] Finished indexing. Total messages in index:', this._messageIndex.size);
      console.log('[THREAD_INDEX] All indexed message IDs:', Array.from(this._messageIndex.keys()));
    } catch (e) {
      console.error('[THREAD_INDEX] Failed to proactively index thread messages:', e);
    }
  }

  setAuthService(authService) {
    this.authService = authService;
  }

  setApiClient(apiClient) {
    this.apiClient = apiClient;
    // Update the dataManager with the apiClient
    this.dataManager.apiClient = apiClient;
  }

  initializeFloatingChat() {
    console.log('[FLOATING CHAT] Starting initialization...');
    try {
      // Load floating chat scripts using chrome.scripting.executeScript
      this.loadFloatingChatScripts().then(() => {
        console.log('[FLOATING CHAT] Scripts loaded successfully');
        // Initialize floating chat manager
        this.floatingChatManager = new FloatingChatManager(this);
        console.log('[FLOATING CHAT] Manager initialized:', this.floatingChatManager);
      }).catch(error => {
        console.error('[FLOATING CHAT] Failed to load scripts:', error);
      });
    } catch (error) {
      console.error('[FLOATING CHAT] Failed to initialize floating chat:', error);
    }
  }

  async loadFloatingChatScripts() {
    console.log('[FLOATING CHAT] Requesting script injection from background script...');
    
    try {
      // Load CSS (this is allowed in content scripts)
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = chrome.runtime.getURL('floating-chat/floating-chat.css');
      console.log('[FLOATING CHAT] Injected CSS link.');
      document.head.appendChild(cssLink);

      // Send a message to the background script to inject the JS files
      const response = await chrome.runtime.sendMessage({
        type: 'INJECT_FLOATING_CHAT_SCRIPTS'
      });

      if (response && response.success) {
        console.log('[FLOATING CHAT] Background script confirmed injection.');
      } else {
        throw new Error(response.error || 'Unknown error during script injection.');
      }

    } catch (error) {
      console.error('[FLOATING CHAT] Failed to load scripts via background script:', error);
      throw error;
    }
  }

  // Test method for floating chat (can be called from console)
  testFloatingChat() {
    if (this.floatingChatManager) {
      console.log('[TEST] Floating chat state:', this.floatingChatManager.getState());
      this.floatingChatManager.addMessage('This is a test message from the console!', 'assistant');
    } else {
      console.log('[TEST] Floating chat manager not initialized');
    }
  }

  /**
   * Initializes the UI by checking the auth state and rendering the correct view.
   */
  async initialize() {
    console.log('[UI DEBUG] 1. UIManager initializing...');
    
    // Start listening for URL changes to handle actions like opening the sidebar.
    this.setupURLObserver();

    try {
      const authState = await this.authService.getAuthState();
      if (authState.isLoggedIn) {
        console.log('[UI DEBUG] 2. User is logged in. Calling renderMainView.');
        this.renderMainView();
        
        // Initialize floating chat after main view is rendered
        this.initializeFloatingChat();
      } else {
        console.log('[UI DEBUG] 2. User is NOT logged in. Calling renderLoginView.');
        this.renderLoginView();
      }
    } catch (error) {
      console.error('[UI] Failed to initialize:', error);
      // Render login view as a fallback
      this.renderLoginView();
    }
  }

  // Method to update the sidebar with invoice details for the current thread
  async handleThreadView(threadView) {
    const threadId = await threadView.getThreadIDAsync();
    console.log('[UI] Thread view changed:', threadId);
    // Store current threadView for in-thread actions (scroll/highlight)
    this._currentThreadView = threadView;

    // Ensure business rules are initialized before processing thread
    if (!this._documentStorageRule && this.apiClient) {
      console.log('[UI] Business rules not initialized yet, initializing now...');
      await this.initializeBusinessRules();
    }

    // Index ALL messages in this thread proactively (including collapsed ones)
    await this._indexAllThreadMessages(threadView);

    // Use the data manager to get data for this specific thread
    const threadDataMap = await this.dataManager.getThreadData([threadId]);
    const threadInfo = threadDataMap[threadId];

    // Add labels into the open thread header (inside the email)
    try {
      const labels = (threadInfo && threadInfo.threadLabels) ? threadInfo.threadLabels : [];
      await this.applyLabelsToThreadView(threadView, labels);
      // Persist labels into shared cache so both list and thread share the same source
      try { await this.dataManager.addThreadLabels(threadId, labels); } catch {}
    } catch (e) {
      console.warn('[ThreadViewLabels] Failed to apply labels to open thread:', e);
    }
    
    // Transform all entities for the sidebar. Returns an array.
    const cardDataArray = threadInfo && threadInfo.processedEntities 
      ? transformProcessedEntitiesForSidebar(threadInfo.processedEntities)
      : [];

    if (this.sidebarElement) {
      this.sidebarElement.innerHTML = this.createSidebarContent(threadId, cardDataArray);
      

      
      // Attach new event listeners for the cards
      this.attachCardClickListeners(this.sidebarElement);
      
      // Auto-open the sidebar if there are documents to show
      if (cardDataArray && cardDataArray.length > 0) {
        console.log('[UI] Auto-opening sidebar for thread with documents:', threadId);
        // Use a short delay to ensure the content is rendered
        setTimeout(() => {
          this.openSidebar();
        }, 500);
      } else {
        console.log('[UI] No documents found for thread, keeping sidebar closed:', threadId);
      }
      
    } else {
      console.log('[DEBUG] this.sidebarElement is not available');
    }
  }



  // Method to restore the original chat interface in the sidebar
  restoreChatInterface() {
      if (this.sidebarElement) {
      console.log('[DEBUG] Restoring chat interface using this.sidebarElement');
      this.sidebarElement.innerHTML = this.createMainAppContent();
      
      // Re-attach event listeners for the chat interface
      this.attachChatEventListeners(this.sidebarElement);
    } else {
      console.log('[DEBUG] this.sidebarElement is not available for restore');
    }
  }

  /**
   * Method to handle individual file attachment cards (for existing attachments).
   * Uses filename + messageId matching to determine if attachment has been AI-processed.
   * Only adds "Store in Google Drive" button if matching cached data is found.
   */
  handleFileAttachmentCard(attachmentCard) {
    // Only add button if we have storage rules
    if (!this._documentStorageRule) {
      return;
    }

    try {
      const attachmentFilename = attachmentCard.getTitle(); // Original filename
      const messageView = attachmentCard.getMessageView();
      const attachmentMessageId = messageView.getMessageID();
      
      console.log('[ATTACHMENT] Processing existing attachment card:', {
        filename: attachmentFilename,
        messageId: attachmentMessageId
      });

      // Check if this attachment matches any of our tracked documents
      const cachedCardData = this._currentCardData || [];
      console.log('[ATTACHMENT] Checking if attachment matches cached documents');
      console.log('[ATTACHMENT] Available cached documents:', cachedCardData.length);
      
      // Find the cached document that matches this attachment by filename AND messageId
      const matchingCachedData = this.findMatchingCachedDocument(cachedCardData, { 
        filename: attachmentFilename,
        messageId: attachmentMessageId 
      });
      
      // Only add button if we have matching cached data with complete information
      if (matchingCachedData) {
        console.log('[ATTACHMENT] ✅ Found matching cached data, adding Store in Drive button:', {
          title: matchingCachedData.title,
          messageId: matchingCachedData.messageId,
          filename: matchingCachedData.filename
        });
        
        attachmentCard.addButton({
          iconUrl: chrome.runtime.getURL('stamp-logo.png'),
          tooltip: 'Store in Google Drive',
          onClick: (event) => {
            console.log('[ATTACHMENT] Store button clicked for existing attachment:', attachmentFilename);
            console.log('[ATTACHMENT] Using cached data:', {
              title: matchingCachedData.title,
              messageId: matchingCachedData.messageId,
              vendor: matchingCachedData.vendor,
              amount: matchingCachedData.amount
            });
            
            // Always use the rich cached data which includes messageId and all other fields
            this.handleDocumentStorageWithConfirmation(matchingCachedData);
          }
        });
      } else {
        console.log('[ATTACHMENT] ❌ No matching cached data found for attachment:', attachmentFilename);
        console.log('[ATTACHMENT] Available cached data:', cachedCardData.map(doc => ({ filename: doc.filename || 'N/A', messageId: doc.messageId || 'N/A', title: doc.title })));
        console.log('[ATTACHMENT] Skipping Store in Drive button for this attachment');
      }

    } catch (error) {
      console.error('[ATTACHMENT] Error processing file attachment card:', error);
    }
  }

  // Method to handle existing attachment cards in message views
  async handleExistingAttachmentCards(messageView) {
    // Ensure business rules are initialized
    if (!this._documentStorageRule && this.apiClient) {
      console.log('[ATTACHMENT] Business rules not initialized, initializing now...');
      await this.initializeBusinessRules();
    }

    // Only process if we have storage rules
    if (!this._documentStorageRule) {
      return;
    }

    try {
      const messageId = messageView.getMessageID();
      console.log('[ATTACHMENT] Processing existing attachments for message:', messageId);

      // Get thread data to check if this message has tracked documents
      const threadView = messageView.getThreadView();
      const threadId = await threadView.getThreadIDAsync();
      const threadDataMap = await this.dataManager.getThreadData([threadId]);
      const threadInfo = threadDataMap[threadId];

      if (!threadInfo || !threadInfo.processedEntities) {
        console.log('[ATTACHMENT] No processed entities for thread:', threadId);
        return;
      }

      // Transform entities and find ones matching this message
      const cardDataArray = transformProcessedEntitiesForSidebar(threadInfo.processedEntities);
      const messageCards = cardDataArray.filter(card => 
        card.docMessageId === messageId
      );

      if (messageCards.length === 0) {
        console.log('[ATTACHMENT] No tracked documents found for message:', messageId);
        return;
      }

      // Get existing attachment cards and add enhanced buttons to matching ones
      const existingAttachments = messageView.getFileAttachmentCardViews();
      console.log('[ATTACHMENT] Found', existingAttachments.length, 'existing attachment cards');
      
      existingAttachments.forEach((attachmentCard, index) => {
        const attachmentTitle = attachmentCard.getTitle();
        console.log(`[ATTACHMENT] Existing attachment ${index + 1}:`, attachmentTitle);
        
        // Try to match with our tracked documents
        const matchingCard = messageCards.find(card => 
          attachmentTitle.includes(card.title) || 
          card.title.includes(attachmentTitle) ||
          attachmentTitle.toLowerCase().includes('invoice') ||
          attachmentTitle.toLowerCase().includes('receipt')
        );
        
        if (matchingCard) {
          console.log('[ATTACHMENT] Adding enhanced Store button for tracked document:', matchingCard.title);
          
          attachmentCard.addButton({
            iconUrl: chrome.runtime.getURL('stamp-logo.png'),
            tooltip: `Store ${matchingCard.title} in Google Drive`,
            onClick: (event) => {
              console.log('[ATTACHMENT] Enhanced store button clicked for:', matchingCard.title);
              this.handleDocumentStorageWithConfirmation(matchingCard);
            }
          });
        }
      });

    } catch (error) {
      console.error('[ATTACHMENT] Error processing existing attachment cards:', error);
    }
  }

  // Method to handle document storage with confirmation modal
  async handleDocumentStorageWithConfirmation(cardData) {
    try {
      // Check if document is already stored (placeholder for now)
      const isAlreadyStored = false; // TODO: Implement actual check
      
      if (isAlreadyStored) {
        this.showAlreadyStoredModal(cardData);
        return;
      }

      // Show confirmation modal
      const modal = this.sdk.Widgets.showModalView({
        title: `Store Document in Google Drive`,
        el: this.createConfirmationModalContent(cardData),
        buttons: [
          {
            text: 'Store in Drive',
            type: 'PRIMARY_ACTION',
            onClick: async (event) => {
              event.modalView.close();
              await this.handleDocumentStorage(cardData);
              this.showSuccessModal(cardData);
            }
          },
          {
            text: 'Cancel',
            onClick: (event) => {
              event.modalView.close();
            }
          }
        ]
      });

    } catch (error) {
      console.error('[ATTACHMENT] Error in document storage confirmation:', error);
    }
  }

  // Create confirmation modal content
  createConfirmationModalContent(cardData) {
    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.minWidth = '600px';
    el.style.maxWidth = '800px';
    
    // Get the natural language description from the business rule
    const naturalLanguageDescription = this._documentStorageRule?.natural_language_description || 'Store this document in Google Drive?';
    
    // Prepare the exact same payload that will be sent to the API
    const cachedCardData = this._currentCardData || [];
    const matchingCachedData = this.findMatchingCachedDocument(cachedCardData, cardData);
    
    const payload = {
      ruleId: this._documentStorageRule?.id,
      cardData: matchingCachedData || cardData,
      timestamp: new Date().toISOString()
    };
    
    // Use fullDetails from cardData with message_id at top level
    const naturalLanguageInput = {
      message_id: payload.cardData.messageId,
      ...payload.cardData.fullDetails
    };
    
    // These are the exact two variables sent to the API endpoint
    const actualApiPayload = {
      rule_id: String(payload.ruleId),
      natural_language_input: JSON.stringify(naturalLanguageInput)
    };
        
    el.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">${cardData.icon || '📄'}</div>
        <div style="color: #1f2937; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${naturalLanguageDescription}</div>
      </div>
      
    `;
    
    return el;
  }

  // Show success modal after storage
  showSuccessModal(cardData) {
    const modal = this.sdk.Widgets.showModalView({
      title: 'Document Stored Successfully',
      el: this.createSuccessModalContent(cardData),
      buttons: [
        {
          text: 'Close',
          type: 'PRIMARY_ACTION',
          onClick: (event) => {
            event.modalView.close();
          }
        }
      ]
    });
  }

  // Create success modal content
  createSuccessModalContent(cardData) {
    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.textAlign = 'center';
    
    el.innerHTML = `
      <div style="color: #10b981; font-size: 48px; margin-bottom: 16px;">✅</div>
      <h3 style="margin: 0 0 8px 0; color: #1f2937;">Success!</h3>
      <p style="margin: 0; color: #6b7280;">${cardData.title} has been stored in Google Drive.</p>
    `;
    
    return el;
  }

  // Show already stored modal
  showAlreadyStoredModal(cardData) {
    const modal = this.sdk.Widgets.showModalView({
      title: 'Document Already Stored',
      el: this.createAlreadyStoredContent(cardData),
      buttons: [
        {
          text: 'View in Drive',
          type: 'PRIMARY_ACTION',
          onClick: (event) => {
            // TODO: Open actual Drive URL
            window.open('https://drive.google.com', '_blank');
            event.modalView.close();
          }
        },
        {
          text: 'Store Again',
          onClick: async (event) => {
            event.modalView.close();
            await this.handleDocumentStorage(cardData);
            this.showSuccessModal(cardData);
          }
        },
        {
          text: 'Close',
          onClick: (event) => {
            event.modalView.close();
          }
        }
      ]
    });
  }

  // Create already stored modal content
  createAlreadyStoredContent(cardData) {
    const el = document.createElement('div');
    el.style.padding = '20px';
    el.style.textAlign = 'center';
    
    el.innerHTML = `
      <div style="color: #f59e0b; font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h3 style="margin: 0 0 8px 0; color: #1f2937;">Already Stored</h3>
      <p style="margin: 0; color: #6b7280;">${cardData.title} is already stored in Google Drive.</p>
    `;
    
    return el;
  }

  // Updated method to create sidebar content dynamically
  createSidebarContent(threadId, cardDataArray) {
    // Store the current card data for later use
    this._currentCardData = cardDataArray;
    
    if (cardDataArray && cardDataArray.length > 0) {
      const cardsHtml = cardDataArray.map(cardData => {
        const cardHtml = createEntityCard(cardData, threadId);
        const cardWithThreadId = cardHtml.replace('class="entity-card"', `class="entity-card" data-thread-id="${threadId}"`);
        
        // Build capsules for invoice entities only
        let capsulesRow = '';
        if (cardData.cardType === 'inv') {
          console.log('[SIDEBAR] Building capsules for invoice:', cardData.title);
          console.log('[SIDEBAR] Card data:', {
            statusMessageId: cardData.statusMessageId,
            statusThreadId: cardData.statusThreadId,
            docMessageId: cardData.docMessageId,
            docThreadId: cardData.docThreadId,
            currentThreadId: threadId
          });
          
          // Status capsule state
          let statusState = 'missing';
          let statusLink = null;
          if (cardData.statusMessageId && cardData.statusThreadId) {
            if (cardData.statusThreadId === threadId) {
              statusState = 'same-thread';
              console.log('[SIDEBAR] Status is in same thread - will show "Show" button');
            } else { 
              statusState = 'link'; 
              statusLink = `https://mail.google.com/mail/u/0/#inbox/${cardData.statusThreadId}/${cardData.statusMessageId}`;
              console.log('[SIDEBAR] Status is in different thread - will show link:', statusLink);
            }
          } else {
            console.log('[SIDEBAR] No status source data available');
          }
          
          // Document capsule state
          let docState = 'missing';
          let docLink = null;
          if (cardData.docMessageId && cardData.docThreadId) {
            if (cardData.docThreadId === threadId) {
              docState = 'same-thread';
              console.log('[SIDEBAR] Document is in same thread - will show button');
              console.log('[SIDEBAR] Document messageId for same-thread:', cardData.docMessageId);
            } else { 
              docState = 'link'; 
              const accountPath = getCurrentGmailAccount();
              docLink = `https://mail.google.com/mail${accountPath}/#inbox/${cardData.docThreadId}/${cardData.docMessageId}`;
              console.log('[SIDEBAR] Document is in different thread - will show link:', docLink);
            }
          } else {
            console.log('[SIDEBAR] No document source data available - docMessageId:', cardData.docMessageId, 'docThreadId:', cardData.docThreadId);
          }

          const statusCapsule = this._renderSourceCapsule({ kind: 'status', state: statusState, link: statusLink });
          const docCapsule = this._renderSourceCapsule({ kind: 'document', state: docState, link: docLink });

          // Wrap in a row; embed message ids for same-thread actions
          const statusDataAttr = statusState==='same-thread' ? `data-status-mid="${cardData.statusMessageId}"` : '';
          const docDataAttr = docState==='same-thread' ? `data-doc-mid="${cardData.docMessageId}"` : '';
          
          console.log('[SIDEBAR] Building data attributes:', {
            statusDataAttr,
            docDataAttr,
            statusState,
            docState,
            statusMessageId: cardData.statusMessageId,
            docMessageId: cardData.docMessageId
          });
          
          capsulesRow = `
            <div class="stamp-sources" style="margin-top: 10px; display:flex; gap:8px; flex-wrap:wrap;" ${statusDataAttr} ${docDataAttr}>
              ${statusCapsule}
              ${docCapsule}
            </div>`;
          
          console.log('[SIDEBAR] Capsules row built with data attributes:', {
            statusMid: statusState==='same-thread' ? cardData.statusMessageId : null,
            docMid: docState==='same-thread' ? cardData.docMessageId : null,
            statusState,
            docState
          });
          console.log('[SIDEBAR] HTML data attributes will be:', {
            'data-status-mid': statusState==='same-thread' ? cardData.statusMessageId : 'not-set',
            'data-doc-mid': docState==='same-thread' ? cardData.docMessageId : 'not-set'
          });
        }

        return `
          <div class="card-container" style="margin-bottom: 16px;">
            ${cardWithThreadId}
            ${capsulesRow}
          </div>`
      }).join('');
      
      const containerHtml = `
        <div style="padding: 12px; border-bottom: 1px solid #e0e0e0; background: #fafafa;">
          <h3 style="margin: 0; font-size: 16px;">Documents in this thread</h3>
        </div>
        <div id="stamp-cards-container" style="padding: 16px;">
          ${cardsHtml}
        </div>
      `;

      // Return and also attach delegated click after mount
      return containerHtml;
    } else {
      return `
        <div style="padding: 16px;">
          <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🧾</div>
            <h4 style="margin: 0 0 8px 0; color: #333;">No Documents Found</h4>
            <p style="margin: 0; color: #666; font-size: 14px;">This email thread doesn't contain any recognized documents.</p>
          </div>
        </div>
      `;
    }
  }

  // Method to attach card click event listeners
  attachCardClickListeners(container) {
    console.log('[CARD_CLICKS] Attaching click listeners to container');
    
    // Remove any existing click listeners
    container.removeEventListener('click', this._cardClickHandler);
    
    // Create a bound version of the click handler
    this._cardClickHandler = (event) => {
        console.log('[CARD_CLICKS] Click event detected on:', event.target);
        
        
        const card = event.target.closest('.entity-card');
        if (card && card.dataset.fullDetails) {
            console.log('[CARD_CLICKS] Card clicked, parsing details...');
            try {
                const fullDetails = JSON.parse(card.dataset.fullDetails);
                console.log('[CARD_CLICKS] Parsed details:', fullDetails);
                
                const detailsHtml = createDetailsSidebarContent(fullDetails);
                
                // Store the current thread ID and card data for restoration
                const threadId = card.dataset.threadId;
                const cardDataArray = this._currentCardData;
                
                container.innerHTML = detailsHtml;
                console.log('[CARD_CLICKS] Updated container with details HTML');
                
                // Add back button functionality
                const backButton = container.querySelector('#back-to-cards');
                console.log('[CARD_CLICKS] Back button found:', !!backButton);
                
                if (backButton) {
                    console.log('[CARD_CLICKS] Adding click listener to back button');
                    backButton.addEventListener('click', (e) => {
                        console.log('[CARD_CLICKS] Back button clicked');
                        e.stopPropagation(); // Prevent event bubbling
                        
                        // Recreate the cards view
                        container.innerHTML = this.createSidebarContent(threadId, cardDataArray);
                        console.log('[CARD_CLICKS] Restored cards view');
                        
                        // Re-attach click listeners to the cards
                        this.attachCardClickListeners(container);
                    });
                } else {
                    console.error('[CARD_CLICKS] Back button not found in container');
                }
            } catch (e) {
                console.error("Error parsing card details or showing details:", e);
            }
        } else {
            console.log('[CARD_CLICKS] Click was not on a card or card has no details');
        }
    };
    
    // Attach the click handler
    container.addEventListener('click', this._cardClickHandler);
  }

  // Method to attach chat event listeners
  attachChatEventListeners(sidebarElement) {
    const self = this;
    
    // Sign out button
    sidebarElement.querySelector('#sign-out-btn').addEventListener('click', async () => {
      console.log('[UI] Sign-out button clicked');
      await self.authService.signOut();
      self.sidebarPanel.remove();
      self.renderLoginView();
    });

    // Hard reset button
    sidebarElement.querySelector('#hard-reset-btn').addEventListener('click', async () => {
      console.log('[UI] Dev: Hard-reset button clicked');
      if (confirm('This will completely revoke Google OAuth permissions. You will need to re-authorize the extension. Continue?')) {
        try {
          await self.authService.hardReset();
          self.sidebarPanel.remove();
          self.renderLoginView();
        } catch (error) {
          alert('Hard reset failed: ' + error.message);
        }
      }
    });

    // Settings menu functionality
    const settingsBtn = sidebarElement.querySelector('#settings-btn');
    const settingsMenu = sidebarElement.querySelector('#settings-menu');
    const closeSettingsBtn = sidebarElement.querySelector('#close-settings-btn');

    // Open settings menu
    settingsBtn.addEventListener('click', () => {
      settingsMenu.style.display = 'flex';
      settingsMenu.style.opacity = '0';
      setTimeout(() => {
        settingsMenu.style.opacity = '1';
      }, 10);
    });

    // Close settings menu
    const closeSettings = () => {
      settingsMenu.style.opacity = '0';
      setTimeout(() => {
        settingsMenu.style.display = 'none';
      }, 2000);
    };

    closeSettingsBtn.addEventListener('click', closeSettings);
    
    // Close on backdrop click
    settingsMenu.addEventListener('click', (e) => {
      if (e.target === settingsMenu) {
        closeSettings();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsMenu.style.display === 'flex') {
        closeSettings();
      }
    });

    // Chat functionality
    const questionInput = sidebarElement.querySelector('#question-input');
    const sendButton = sidebarElement.querySelector('#send-question-btn');
    const chatOutput = sidebarElement.querySelector('#chat-output');

    const sendQuestion = async () => {
      const question = questionInput.value.trim();
      if (!question) return;

      // Add user question to chat
      const userDiv = document.createElement('div');
      userDiv.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
        justify-content: flex-end;
      `;
      userDiv.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 12px;
          padding: 16px 20px;
          max-width: 85%;
          color: white;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
        ">
          <p style="
            margin: 0;
            font-size: 15px;
            line-height: 1.6;
            font-weight: 500;
          ">${question}</p>
        </div>
        <div style="
          width: 32px;
          height: 32px;
          background: #f1f5f9;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
        ">👤</div>
      `;
      chatOutput.appendChild(userDiv);

      // Clear input
      questionInput.value = '';
      questionInput.style.height = 'auto';

      // Add assistant response placeholder
      const assistantDiv = document.createElement('div');
      assistantDiv.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      `;
      assistantDiv.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: white;
        ">🤖</div>
        <div style="
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          max-width: 85%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          flex: 1;
        ">
          <div id="progress-indicator" style="display: none;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top: 2px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="font-size: 14px; color: #6b7280;">Processing...</span>
            </div>
          </div>
          <div id="reasoning-section" style="display: none; margin-bottom: 12px;">
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 6px;">
              <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">🤔 Reasoning</div>
              <div id="reasoning-content" style="color: #92400e; font-size: 14px; line-height: 1.5;"></div>
            </div>
          </div>
          <div id="main-content" style="color: #374151; line-height: 1.6; font-size: 15px;"></div>
          <div id="tool-calls-section" style="display: none; margin-top: 12px;">
            <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 12px; border-radius: 6px;">
              <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">🔧 Tool Calls</div>
              <div id="tool-calls-content" style="color: #6b7280; font-size: 14px; line-height: 1.5;"></div>
            </div>
          </div>
        </div>
      `;
      chatOutput.appendChild(assistantDiv);

      // Scroll to bottom
      chatOutput.scrollTop = chatOutput.scrollHeight;

      try {
        // Show loading state
        self.showLoading(assistantDiv);

        // Make API call
        const response = await self.apiClient.makeAuthenticatedRequest('/api/finops/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: question,
            userEmail: await self.authService.getUserEmail(),
            installationId: await self.authService.getInstallationId(),
          }),
        });

        console.log('[CHAT] Raw response object:', response);
        console.log('[CHAT] Response headers:', {
          contentType: response.headers.get('content-type'),
          status: response.status,
          statusText: response.statusText
        });

        // Hide loading state
        self.hideLoading(assistantDiv);

        // Check if response is streaming
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
          console.log('[CHAT] Handling streaming response');
          await self.handleStreamingResponse(response, assistantDiv);
        } else {
          console.log('[CHAT] Handling JSON response');
          const data = await response.json();
          console.log('[CHAT] Parsed response data:', data);
          console.log('[CHAT] Response data type:', typeof data);
          console.log('[CHAT] Response keys:', Object.keys(data));
          
          if (data.response) {
            console.log('[CHAT] Found response content:', data.response);
            assistantDiv.querySelector('#main-content').textContent = data.response;
          } else if (data.AGENT_OUTPUT) {
            console.log('[CHAT] Found AGENT_OUTPUT:', data.AGENT_OUTPUT);
            assistantDiv.querySelector('#main-content').textContent = data.AGENT_OUTPUT;
          } else if (data.answer) {
            console.log('[CHAT] Found answer:', data.answer);
            assistantDiv.querySelector('#main-content').textContent = data.answer;
          } else {
            console.warn('[CHAT] No recognized response format found in:', data);
            assistantDiv.querySelector('#main-content').textContent = 'I received your question but no response was provided.';
          }
        }

      } catch (error) {
        console.error('[UI] Failed to send question:', error);
        self.hideLoading(assistantDiv);
        self.showError(assistantDiv, `Failed to send question: ${error.message}`);
      }
    };

    // Send button click
    sendButton.addEventListener('click', sendQuestion);

    // Enter key press
    questionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
      }
    });

    // Auto-resize textarea
    questionInput.addEventListener('input', () => {
      questionInput.style.height = 'auto';
      questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
    });
  }

  // Attach event listeners for sidebar panel toggle events to clear preview content
  attachSidebarToggleListeners() {
    console.log('[SIDEBAR TOGGLE] Setting up sidebar panel toggle event listeners');
    
    // Listen for sidebar panel activation (when opened)
    document.body.addEventListener('inboxsdkSidebarPanelActivated', (event) => {
      console.log('[SIDEBAR TOGGLE] Sidebar panel activated event received:', event.detail);
      // Clear any existing preview content when panel is opened
      this.clearPreviewContent();
    });
    
    // Listen for sidebar panel deactivation (when closed)
    document.body.addEventListener('inboxsdkSidebarPanelDeactivated', (event) => {
      console.log('[SIDEBAR TOGGLE] Sidebar panel deactivated event received:', event.detail);
      // Clear any existing preview content when panel is closed
      this.clearPreviewContent();
    });
  }

  // Clear any loaded documents or images from the preview panel
  clearPreviewContent() {
    console.log('[PREVIEW CLEAR] Clearing preview content from sidebar');
    
    if (!this.sidebarElement) {
      console.log('[PREVIEW CLEAR] No sidebar element available, nothing to clear');
      return;
    }
    
    // Check if there's any preview content currently loaded
    const previewContentArea = this.sidebarElement.querySelector('#preview-content-area');
    const hasPreviewContent = this.sidebarElement.querySelector('iframe, img, #pdf-viewer-container, #image-viewer-container');
    
    if (hasPreviewContent || previewContentArea) {
      console.log('[PREVIEW CLEAR] Preview content detected, clearing...');
      
      // Reset sidebar content to default state (empty or with default content)
      // This will remove any loaded documents, images, or preview content
      this.sidebarElement.innerHTML = this.createMainAppContent();
      
      // Re-attach event listeners since we replaced the innerHTML
      this.attachChatEventListeners(this.sidebarElement);
      
      console.log('[PREVIEW CLEAR] ✅ Preview content cleared and sidebar reset to default state');
    } else {
      console.log('[PREVIEW CLEAR] No preview content found, nothing to clear');
    }
  }

  async handleStreamingResponse(response, assistantDiv) {
    console.log('[STREAM] Starting to handle streaming response...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const mainContent = assistantDiv.querySelector('#main-content');
    let buffer = '';
    let contentBuffer = ''; // For accumulating actual content
    let reasoningBuffer = ''; // For accumulating reasoning content

    mainContent.textContent = ''; // Clear any previous content

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('[STREAM] Stream finished.');
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            console.log(`[STREAM] Received chunk, buffer is now: "${buffer}"`);

            // Parse Server-Sent Events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const eventData = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
                        console.log('[STREAM] Parsed event:', eventData);
                        console.log('[STREAM] Event type:', eventData.type);

                        // Handle different event types
                        if (eventData.type === 'content') {
                            const content = eventData.data.content || '';
                            contentBuffer += content;
                            
                            // Create or update content display
                            let contentDiv = mainContent.querySelector('#content-display');
                            if (!contentDiv) {
                                contentDiv = document.createElement('div');
                                contentDiv.id = 'content-display';
                                contentDiv.style.marginTop = '10px';
                                mainContent.appendChild(contentDiv);
                            }
                            contentDiv.textContent = contentBuffer;
                            
                        } else if (eventData.type === 'reasoning') {
                            const reasoning = eventData.data.content || '';
                            reasoningBuffer += reasoning + '\n';
                            
                            // Create or update reasoning display
                            let reasoningDiv = mainContent.querySelector('#reasoning-display');
                            if (!reasoningDiv) {
                                reasoningDiv = document.createElement('div');
                                reasoningDiv.id = 'reasoning-display';
                                reasoningDiv.style.color = '#666';
                                reasoningDiv.style.fontStyle = 'italic';
                                reasoningDiv.style.marginBottom = '10px';
                                reasoningDiv.style.borderLeft = '3px solid #ddd';
                                reasoningDiv.style.paddingLeft = '10px';
                                mainContent.appendChild(reasoningDiv);
                            }
                            reasoningDiv.textContent = reasoningBuffer;
                            
                        } else if (eventData.type === 'workflow_start') {
                            console.log('[STREAM] Workflow started');
                            
                        } else if (eventData.type === 'agent_start') {
                            console.log('[STREAM] Agent started:', eventData.data.agent_name);
                            
                        } else if (eventData.type === 'synthesis') {
                            console.log('[STREAM] Synthesis step completed');
                            
                        } else if (eventData.type === 'workflow_complete') {
                            console.log('[STREAM] Workflow completed successfully');
                            
                        } else if (eventData.type === 'tool_call') {
                            // Skip tool calls - don't show them to users
                            console.log('[STREAM] Tool call (hidden from user):', eventData.data.tool_name);
                            
                        } else if (eventData.type === 'tool_result') {
                            // Skip tool results - don't show them to users
                            console.log('[STREAM] Tool result (hidden from user):', eventData.data.tool_name);
                            
                        } else if (eventData.type === 'error') {
                            const errorDiv = document.createElement('div');
                            errorDiv.style.color = '#d32f2f';
                            errorDiv.style.fontWeight = 'bold';
                            errorDiv.textContent = `❌ Error: ${eventData.data.error}`;
                            mainContent.appendChild(errorDiv);
                            
                        } else {
                            // Log any unhandled event types
                            console.log('[STREAM] Unhandled event type:', eventData.type, eventData);
                        }

                        // Scroll to the bottom of the chat output
                        const chatOutput = assistantDiv.closest('#chat-output');
                        if (chatOutput) {
                            chatOutput.scrollTop = chatOutput.scrollHeight;
                        }

                    } catch (parseError) {
                        console.error('[STREAM] Failed to parse event:', line, parseError);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[STREAM] Error reading stream:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#d32f2f';
        errorDiv.style.fontWeight = 'bold';
        errorDiv.textContent = `❌ Error reading stream: ${error.message}`;
        mainContent.appendChild(errorDiv);
    }
  }



  createLoginContent() {
      return `
        <div style="padding: 24px; text-align: center; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
          <img src="${chrome.runtime.getURL('stamp-logo.png')}" alt="Stamp Logo" style="width: 64px; height: 64px; margin-bottom: 16px;">
          <h2 style="margin-top: 0; margin-bottom: 8px; font-size: 22px;">Connect to Stamp</h2>
          <p style="margin-top: 0; margin-bottom: 24px; color: #5f6368;">Manage your Accounts Payable directly within Gmail.</p>
          <div id="loading-indicator" style="display: none; padding: 10px; text-align: center; color: #5f6368;">Loading...</div>
          <div id="error-indicator" style="display: none; padding: 10px; text-align: center; color: #d93025; background: #fce8e6; border: 1px solid #f9c6c2; border-radius: 4px; margin-bottom: 16px;"></div>
          <button id="google-signin-btn" style="background-color: #4285F4; color: white; border: none; padding: 10px 24px; font-size: 14px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-weight: 500;">
            <img src="${chrome.runtime.getURL('google-logo.png')}" alt="Google Logo" style="width: 18px; height: 18px; margin-right: 12px;">
            Sign in with Google
          </button>
        </div>
      `;
  }

  createMainAppContent() {
        return `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #ffffff;
                min-height: 100vh;
                padding: 0;
                margin: 0;
            ">
                <!-- Header -->
                <div style="
                    background: white;
                    border-bottom: 1px solid #f0f0f0;
                    padding: 16px 20px;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                ">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="
                                width: 32px;
                                height: 32px;
                                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                border-radius: 8px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-weight: 700;
                                font-size: 16px;
                                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
                            ">S</div>
                            <div>
                                <h1 style="
                                    margin: 0;
                                    font-size: 20px;
                                    font-weight: 700;
                                    color: #1e293b;
                                    letter-spacing: -0.025em;
                                ">Stamp</h1>
                                <p style="
                                    margin: 0;
                                    font-size: 13px;
                                    color: #64748b;
                                    font-weight: 500;
                                ">AI Assistant</p>
                            </div>
                        </div>
                        
                        <!-- Settings Button -->
                        <button id="settings-btn" style="
                            width: 36px;
                            height: 36px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s ease;
                            color: #64748b;
                        ">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Main Content -->
                        <div style="
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 80px);
                    padding: 0;
                ">
                            <!-- Chat Messages -->
                            <div id="chat-output" style="
                        flex: 1;
                                padding: 20px;
                                overflow-y: auto;
                                background: #ffffff;
                            ">
                                <div style="
                                    display: flex;
                                    align-items: flex-start;
                                    gap: 12px;
                            margin-bottom: 20px;
                                ">
                                    <div style="
                                width: 32px;
                                height: 32px;
                                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                border-radius: 8px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: white;
                                font-size: 14px;
                                font-weight: 700;
                                        flex-shrink: 0;
                                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
                                    ">S</div>
                                    <div style="
                                        background: #f8fafc;
                                        border-radius: 12px;
                                padding: 16px 20px;
                                        max-width: 85%;
                                        border: 1px solid #e2e8f0;
                                    ">
                                        <p style="
                                            margin: 0;
                                    font-size: 15px;
                                    color: #374151;
                                    line-height: 1.6;
                                ">Hi! I'm your Stamp AI assistant. Ask me anything about your invoices, payments, or accounts payable data. I'm here to help you stay on top of your financial operations.</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Input Area -->
                            <div style="
                        padding: 20px;
                        background: #ffffff;
                        border-top: 1px solid #f0f0f0;
                            ">
                                <div style="
                                    display: flex;
                                    gap: 12px;
                                    align-items: flex-end;
                            max-width: 900px;
                            margin: 0 auto;
                                ">
                                    <div style="flex: 1; position: relative;">
                                <textarea id="question-input" placeholder="Ask me about your invoices, payments, or accounts payable..." style="
                                            width: 100%;
                                    padding: 16px 20px;
                                            border: 1px solid #e2e8f0;
                                    border-radius: 12px;
                                    font-size: 15px;
                                            font-family: inherit;
                                            resize: none;
                                    min-height: 56px;
                                            max-height: 120px;
                                            outline: none;
                                            transition: all 0.2s ease;
                                    background: #ffffff;
                                            color: #1e293b;
                                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                                        "></textarea>
                                    </div>
                                    <button id="send-question-btn" style="
                                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                        color: white;
                                        border: none;
                                padding: 16px 24px;
                                border-radius: 12px;
                                        cursor: pointer;
                                font-size: 15px;
                                        font-weight: 600;
                                        white-space: nowrap;
                                        transition: all 0.2s ease;
                                min-width: 100px;
                                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
                                    ">Send</button>
                        </div>
                    </div>
                </div>

                <!-- Settings Menu (Hidden by default) -->
                <div id="settings-menu" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                    display: none;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        background: white;
                        border-radius: 12px;
                        padding: 24px;
                        max-width: 400px;
                        width: 90%;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                        position: relative;
                    ">
                        <!-- Close Button -->
                        <button id="close-settings-btn" style="
                            position: absolute;
                            top: 16px;
                            right: 16px;
                            width: 32px;
                            height: 32px;
                            background: #f1f5f9;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #64748b;
                            transition: all 0.2s ease;
                        ">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <h2 style="
                            margin: 0 0 20px 0;
                            font-size: 20px;
                            font-weight: 600;
                            color: #1e293b;
                        ">Settings</h2>

                        <!-- Account Section -->
                        <div style="margin-bottom: 24px;">
                            <h3 style="
                                margin: 0 0 12px 0;
                                font-size: 14px;
                                font-weight: 600;
                                color: #374151;
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                            ">Account</h3>
                            <button id="sign-out-btn" style="
                                width: 100%;
                                padding: 12px 16px;
                                background: #f8fafc;
                                border: 1px solid #e2e8f0;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 14px;
                                color: #64748b;
                                font-weight: 500;
                                transition: all 0.2s ease;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16,17 21,12 16,7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Sign Out
                            </button>
                        </div>

                        <!-- Developer Tools Section -->
                        <div style="
                            background: #fef3c7;
                            border: 1px solid #f59e0b;
                            padding: 16px;
                            border-radius: 8px;
                            margin-bottom: 16px;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="font-size: 16px;">🛠️</span>
                                <h3 style="
                                    margin: 0;
                                    font-size: 14px;
                                    font-weight: 600;
                                    color: #92400e;
                                    text-transform: uppercase;
                                    letter-spacing: 0.05em;
                                ">Developer Tools</h3>
                            </div>
                            <button id="hard-reset-btn" style="
                                width: 100%;
                                background: #dc2626;
                                color: white;
                                border: none;
                                padding: 10px 16px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 13px;
                                font-weight: 500;
                                transition: all 0.2s ease;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            ">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="1,4 1,10 7,10"></polyline>
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                </svg>
                                Hard Reset & Sign Out
                            </button>
                            <div style="
                                font-size: 11px;
                                color: #92400e;
                                margin-top: 8px;
                                opacity: 0.8;
                                line-height: 1.4;
                            ">⚠️ This will completely revoke Google OAuth permissions and require re-authorization.</div>
                        </div>

                        <!-- Version Info -->
                        <div style="
                            text-align: center;
                            padding-top: 16px;
                            border-top: 1px solid #e2e8f0;
                            font-size: 11px;
                            color: #9ca3af;
                        ">
                            Stamp Extension v1.0.0
                        </div>
                    </div>
                </div>

                <style>
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    
                    #question-input:focus {
                        border-color: #10b981;
                        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                        outline: none;
                    }
                    
                    #send-question-btn:hover {
                        background: linear-gradient(135deg, #059669 0%, #047857 100%);
                        transform: translateY(-1px);
                        box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
                    }
                    
                    #send-question-btn:active {
                        transform: translateY(0);
                        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
                    }
                    
                    #settings-btn:hover {
                        background: #f1f5f9;
                        border-color: #cbd5e1;
                        transform: scale(1.05);
                    }
                    
                    #sign-out-btn:hover {
                        background: #f1f5f9;
                        border-color: #cbd5e1;
                    }
                    
                    #hard-reset-btn:hover {
                        background: #b91c1c;
                    }
                </style>
            </div>
        `;
  }

  renderLoginView() {
    const self = this;
    const el = document.createElement('div');
    el.innerHTML = this.createLoginContent();

    // We must await the creation of the sidebar panel
    const setupPanel = async () => {
      // Create the sidebar panel and wait for it to be ready
      self.sidebarPanel = await self.sdk.Global.addSidebarContentPanel({
            title: 'Stamp',
            iconUrl: chrome.runtime.getURL('stamp-logo.png'),
            el: el,
        });

      // Now that self.sidebarPanel is the actual panel object, set up event listeners
        el.querySelector('#google-signin-btn').addEventListener('click', async () => {
            console.log('[UI] "Sign in with Google" button clicked - starting sign-up process');
            self.showLoading(el);
        self.hideError(el);
            try {
                await self.authService.signInWithGoogle();
          // Now this will work because self.sidebarPanel is the correct object
          if (self.sidebarPanel) {
                self.sidebarPanel.remove();
          }
                self.renderMainView();
            } catch (error) {
                console.error('[UI] Sign-in failed:', error);
                self.hideLoading(el);
                self.showError(el, `Sign-in failed: ${error.message}. Please try again.`);
            }
        });
    };

    setupPanel();
  }

  renderMainView() {
    console.log('[UI DEBUG] 3. Entered renderMainView.');
    const self = this; // Capture the correct 'this' context

    const el = this.createAndMount(this.createMainAppContent(), async (el) => {
        // Initialize business rules first
        console.log('[UI DEBUG] Initializing business rules...');
        await this.initializeBusinessRules();
        
        // Create the sidebar panel first
        console.log('[UI DEBUG] Creating sidebar panel...');
        this.sidebarPanel = await this.sdk.Global.addSidebarContentPanel({
            title: 'Stamp',
            iconUrl: chrome.runtime.getURL('stamp-logo.png'),
            el: el,
        });
        
        console.log('[UI DEBUG] Sidebar panel created:', this.sidebarPanel);
        
        // Store the DOM element reference for later use
        this.sidebarElement = el;
        console.log('[UI DEBUG] Sidebar element stored:', this.sidebarElement);

        // Now set up event listeners
        this.attachChatEventListeners(el); // Call the new method here
        console.log('[UI DEBUG] Chat event listeners attached');
        
        // Set up sidebar panel toggle event listeners to clear preview content
        this.attachSidebarToggleListeners();
        console.log('[UI DEBUG] Sidebar toggle event listeners attached');

        // Delegated click for in-thread capsules
        el.addEventListener('click', (evt) => {
          console.log('[CLICK] Click detected on sidebar element');
          const row = evt.target && evt.target.closest && evt.target.closest('.stamp-sources');
          if (!row) {
            console.log('[CLICK] Click not on a stamp-sources row, ignoring');
            return;
          }
          console.log('[CLICK] Click is on a stamp-sources row');
          
          const target = evt.target;
          const capsule = target.closest('.stamp-capsule');
          const isButton = capsule && capsule.tagName.toLowerCase() === 'button';
          if (!isButton) {
            console.log('[CLICK] Click not on a button capsule, ignoring');
            return;
          }
          console.log('[CLICK] Click is on a button capsule');
          
          evt.preventDefault();
          evt.stopPropagation();
          
          const statusMid = row.getAttribute('data-status-mid');
          const docMid = row.getAttribute('data-doc-mid');
          console.log('[CLICK] Row data attributes:', { statusMid, docMid });
          
          // Determine which button was clicked by icon within
          const capsuleText = capsule ? capsule.textContent : '';
          const isStatus = capsuleText.includes('Status');
          const isDocument = capsuleText.includes('Document');
          const mid = isStatus ? statusMid : docMid;
          console.log('[CLICK] Capsule text:', capsuleText);
          console.log('[CLICK] isStatus:', isStatus, 'isDocument:', isDocument);
          console.log('[CLICK] Determined click type:', isStatus ? 'status' : 'document', 'messageId:', mid);
          console.log('[CLICK] Available messageIds - statusMid:', statusMid, 'docMid:', docMid);
          
          if (mid) {
            console.log('[CLICK] Calling _showMessageInThisThread with messageId:', mid);
            this._showMessageInThisThread(mid);
          } else {
            console.warn('[CLICK] No messageId found for clicked capsule');
          }
        });
    });
  }

  showLoading(container) {
        const loadingIndicator = container.querySelector('#loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
  }

  hideLoading(container) {
        const loadingIndicator = container.querySelector('#loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
  }

  showError(container, message) {
        const errorIndicator = container.querySelector('#error-indicator');
        if (errorIndicator) {
            errorIndicator.textContent = message;
            errorIndicator.style.display = 'block';
        }
  }

  hideError(container) {
        const errorIndicator = container.querySelector('#error-indicator');
        if (errorIndicator) {
            errorIndicator.style.display = 'none';
        }
  }

  createAndMount(innerHTML, onMount) {
        const el = document.createElement('div');
        el.innerHTML = innerHTML;
        onMount(el);
        return el;
  }

  // Method to open the sidebar panel
  openSidebar() {
    if (this.sidebarPanel) {
      console.log('[UI] Programmatically opening sidebar panel.');
      try {
        this.sidebarPanel.open();
        console.log('[UI] Sidebar panel opened successfully.');
      } catch (error) {
        console.error('[UI] Error opening sidebar panel:', error);
      }
    } else {
      console.warn('[UI] Sidebar panel reference not available. Cannot open.');
      console.log('[UI] Sidebar panel state:', {
        hasSidebarPanel: !!this.sidebarPanel,
        hasSidebarElement: !!this.sidebarElement,
        sidebarPanelType: this.sidebarPanel ? typeof this.sidebarPanel : 'undefined'
      });
    }
  }

  // Sets up the MutationObserver to watch for URL changes
  setupURLObserver() {
    const titleObserver = new MutationObserver(() => this.handleStampURLActions());
    const titleElement = document.querySelector('title');
    if (titleElement) {
      titleObserver.observe(titleElement, { childList: true });
    }
  }
  
  // Handles Stamp-specific actions from URL parameters
  handleStampURLActions() {
    const url = new URL(window.location.href);
    const stampAction = url.searchParams.get('stamp_action');

    if (stampAction === 'open_sidebar') {
      console.log('[STAMP ACTION] Detected "open_sidebar" action.');
      
      // Use a short delay to ensure the sidebar has been created
      setTimeout(() => {
        this.openSidebar();
      }, 1000);

      // Clean up the URL
      url.searchParams.delete('stamp_action');
      window.history.replaceState({}, document.title, url.href);
    }
  }

  // Adds labels into the open thread header using InboxSDK ThreadView.addLabel
  async applyLabelsToThreadView(threadView, threadLabels) {
    try {
      if (!Array.isArray(threadLabels) || threadLabels.length === 0) {
        return;
      }

      // Prepare map for tracking SimpleElementView handles per thread
      if (!this._threadViewLabelHandles) {
        this._threadViewLabelHandles = new Map();
      }

      const threadId = await threadView.getThreadIDAsync();

      // Remove any labels we previously added for this thread
      const previousHandles = this._threadViewLabelHandles.get(threadId) || [];
      for (const handle of previousHandles) {
        try { handle.remove(); } catch (e) { /* ignore */ }
      }

      const applyOnce = () => {
        const newHandles = [];
        for (const labelText of threadLabels) {
          const labelDescriptor = createLabelFromThreadLabel(labelText);
          if (!labelDescriptor) continue;
          try {
            const handle = threadView.addLabel(labelDescriptor);
            newHandles.push(handle);
          } catch (err) {
            console.warn('[ThreadViewLabels] addLabel failed for', labelText, err);
            throw err;
          }
        }
        this._threadViewLabelHandles.set(threadId, newHandles);
        console.log('[ThreadViewLabels] Added', newHandles.length, 'labels to open thread header');
      };

      const hasHeaderContainer = () => !!document.querySelector('.ha .J-J5-Ji');

      const delays = [0, 120, 240, 400, 600, 900, 1200, 1600];
      let attempt = 0;

      const tryApplyWithRetry = () => {
        if (threadView.destroyed) {
          console.warn('[ThreadViewLabels] Aborting label apply: threadView destroyed');
          return;
        }
        const delay = delays[Math.min(attempt, delays.length - 1)];
        setTimeout(() => {
          const containerPresent = hasHeaderContainer();
          console.log('[ThreadViewLabels] Attempt', attempt + 1, 'containerPresent:', containerPresent);
          try {
            if (!containerPresent) throw new Error('Header label container not ready');
            applyOnce();

            // Verify at least one pill is visible; if not, fallback-inject
            const container = document.querySelector('.ha .J-J5-Ji');
            const hasAnyPill = !!(container && container.querySelector('.inboxsdk__thread_label, .inboxsdk__label, .stamp-fallback-pill'));
            if (!hasAnyPill && container) {
              const fallback = document.createElement('span');
              fallback.className = 'stamp-fallback-pill';
              fallback.textContent = (Array.isArray(threadLabels) && threadLabels[0]) ? threadLabels[0] : 'Stamp';
              fallback.style.cssText = 'display:inline-block;padding:2px 8px;background:#E0F2F1;color:#00695C;border-radius:12px;margin-left:6px;font-size:11px;font-weight:600;';
              container.appendChild(fallback);
              // Track for cleanup
              if (!this._threadViewFallbackPills) this._threadViewFallbackPills = new Map();
              const arr = this._threadViewFallbackPills.get(threadId) || [];
              arr.push(fallback);
              this._threadViewFallbackPills.set(threadId, arr);
              console.log('[ThreadViewLabels] Fallback-injected a visible label pill');
            }
          } catch (e) {
            attempt++;
            if (attempt < delays.length) {
              tryApplyWithRetry();
            } else {
              console.warn('[ThreadViewLabels] Giving up after retries:', e);
            }
          }
        }, delay);
      };

      tryApplyWithRetry();

      // Cleanup when the thread view is destroyed
      threadView.on('destroy', () => {
        const handles = this._threadViewLabelHandles.get(threadId) || [];
        for (const handle of handles) {
          try { handle.remove(); } catch (e) { /* ignore */ }
        }
        this._threadViewLabelHandles.delete(threadId);
        // Cleanup fallback pills
        const fallbacks = (this._threadViewFallbackPills && this._threadViewFallbackPills.get(threadId)) || [];
        for (const node of fallbacks) {
          try { node.remove(); } catch (e) { /* ignore */ }
        }
        if (this._threadViewFallbackPills) this._threadViewFallbackPills.delete(threadId);
      });
    } catch (error) {
      console.warn('[ThreadViewLabels] Failed to apply labels to thread view:', error);
    }
  }

  // Scroll to a message in the current thread and highlight briefly
  async _showMessageInThisThread(messageId) {
    console.log('[INTHREAD] Attempting to show message in current thread:', messageId);
    console.log('[INTHREAD] Current message index size:', this._messageIndex.size);
    console.log('[INTHREAD] Available message IDs in index:', Array.from(this._messageIndex.keys()));
    
    // First try immediate lookup
    let messageView = this._messageIndex.get(messageId);
    if (messageView && messageView.getElement) {
      const el = messageView.getElement();
      if (el) {
        console.log('[INTHREAD] Found message via index, scrolling into view');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.6s ease';
        const prev = el.style.backgroundColor;
        el.style.backgroundColor = 'rgba(255, 235, 59, 0.35)';
        console.log('[INTHREAD] Applied highlight, will remove in 1200ms');
        setTimeout(() => { 
          el.style.backgroundColor = prev || ''; 
          console.log('[INTHREAD] Highlight removed');
        }, 1200);
        return;
      }
    }
    
    // If not found, wait a bit for messages to load and try again
    console.log('[INTHREAD] Message not found immediately, waiting for messages to load...');
    const delays = [200, 500, 1000];
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log('[INTHREAD] Retrying after', delay, 'ms. Index size:', this._messageIndex.size);
      console.log('[INTHREAD] Available IDs:', Array.from(this._messageIndex.keys()));
      
      messageView = this._messageIndex.get(messageId);
      if (messageView && messageView.getElement) {
        const el = messageView.getElement();
        if (el) {
          console.log('[INTHREAD] Found message after retry, scrolling into view');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'background-color 0.6s ease';
          const prev = el.style.backgroundColor;
          el.style.backgroundColor = 'rgba(255, 235, 59, 0.35)';
          setTimeout(() => { el.style.backgroundColor = prev || ''; }, 1200);
          return;
        }
      }
    }
    
    console.warn('[INTHREAD] Message still not found after retries:', messageId);
    console.log('[INTHREAD] Final index state - size:', this._messageIndex.size, 'IDs:', Array.from(this._messageIndex.keys()));
  }

    _renderSourceCapsule({ kind, state, link, onClickTitle }) {
    // kind: 'status' | 'document'
    // state: 'same-thread' | 'link' | 'missing'
    const icon = kind === 'status' ? '📧' : '📎';
    const label = kind === 'status' ? 'Status' : 'Document';
    
    console.log('[CAPSULE] Rendering', kind, 'capsule with state:', state, 'link:', link);
    
    if (state === 'same-thread') {
      return `
      <button class="stamp-capsule" title="Show in this thread" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #e6e7ea;border-radius:999px;background:#fff;color:#334155;cursor:pointer;">
        <span>${icon}</span>
        <span style="font-size:12px;font-weight:600;">${label}</span>
      </button>`;
    } else if (state === 'link') {
      return `
      <a class="stamp-capsule" href="${link}" target="_blank" onclick="event.stopPropagation();" title="Open in Gmail" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #e6e7ea;border-radius:999px;background:#fff;color:#1a73e8;text-decoration:none;">
        <span>${icon}</span>
        <span style="font-size:12px;font-weight:600;">${label}</span>
        <span style="margin-left:6px;font-size:12px;">→</span>
      </a>`;
    } else {
      return `
      <div class="stamp-capsule" title="Not found" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px dashed #e6e7ea;border-radius:999px;background:#fafafa;color:#9aa0a6;cursor:not-allowed;">
        <span>${icon}</span>
        <span style="font-size:12px;font-weight:600;">${label}</span>
      </div>`;
    }
  }
}


// --- MAIN EXECUTION ---

InboxSDK.load(2, 'YOUR_APP_ID_HERE').then((sdk) => {
  console.log("Stamp Extension: InboxSDK loaded successfully.");
  
  // Initialize your core extension components
  const apiClient = new ApiClient();
  const dataManager = new ThreadDataManager(apiClient);
  
  // --- DYNAMIC LABELING FOR THREAD ROWS (WITH BATCHING/DEBOUNCING) ---

  // We need a temporary place to store the thread row views as they appear.
  const threadViewRegistry = new Map();
  let debounceTimer = null;

  // This function will be called after a short delay to process all collected threads at once.
  const processThreadQueue = async () => {
    if (threadViewRegistry.size === 0) {
      return; // Nothing to do
    }

    // Get a copy of the thread IDs to process and clear the registry for the next batch.
    const idsToProcess = [...threadViewRegistry.keys()];
    const viewsToUpdate = new Map(threadViewRegistry); // Make a copy of the views map
    threadViewRegistry.clear();

    console.log(`[Batching] Processing batch of ${idsToProcess.length} threads.`, { threadIds: idsToProcess });

    try {
      // Make ONE single API call for the entire batch of threads.
      const threadDataMap = await dataManager.getThreadData(idsToProcess);
      console.log('[Batching] Received data from ThreadDataManager:', threadDataMap);

      // Now, iterate over the API results and apply labels to the corresponding views.
      for (const threadId in threadDataMap) {
        const threadInfo = threadDataMap[threadId];
        const threadRowView = viewsToUpdate.get(threadId);

        console.log(`[LABEL_APPLY] Preparing to apply labels for thread: ${threadId}`, { hasView: !!threadRowView, isDestroyed: threadRowView ? threadRowView.destroyed : 'N/A', threadInfo });

        // Ensure we have a view and that it hasn't been destroyed by Gmail
        if (threadRowView && !threadRowView.destroyed && threadInfo) {
          
          // Handle new API response format with thread_labels array
          if (threadInfo.threadLabels && Array.isArray(threadInfo.threadLabels) && threadInfo.threadLabels.length > 0) {
            console.log(`[LABEL_APPLY] Found ${threadInfo.threadLabels.length} labels to apply.`, { labels: threadInfo.threadLabels });
            
            // Create and apply labels from thread_labels array
            threadInfo.threadLabels.forEach(labelText => {
              const label = createLabelFromThreadLabel(labelText);
              if (label) {
                console.log(`[LABEL_APPLY] ADDING label to view for thread ${threadId}:`, label);
                threadRowView.addLabel(label);
              } else {
                console.warn(`[LABEL_APPLY] SKIPPED adding a null or invalid label for text: "${labelText}"`);
              }
            });
            // Persist labels to the shared cache so open-thread view can reuse
            try { await dataManager.addThreadLabels(threadId, threadInfo.threadLabels); } catch (e) { console.warn('[LABEL_APPLY] Failed to persist labels to cache', e); }
          } else {
              console.log(`[LABEL_APPLY] No labels to apply for thread ${threadId}.`, { threadLabels: threadInfo.threadLabels });
          }
        } else {
            console.warn(`[LABEL_APPLY] Skipped applying labels for thread ${threadId} due to invalid view or missing info.`);
        }
      }
    } catch (error) {
      console.error('[Batching] Failed to process thread queue:', error);
    }
  };

  const debouncedProcessThreadQueue = debounce(processThreadQueue, 100);

  // This is the "doorman" function that runs for every single thread row.
  sdk.Lists.registerThreadRowViewHandler(async function(threadRowView) {
    const threadId = await threadRowView.getThreadIDAsync();
    
    // If we haven't seen this thread before, add it to our registry.
    threadViewRegistry.set(threadId, threadRowView);

    // Every time a new thread appears, we reset our timer.
    clearTimeout(debounceTimer);

    // After 150ms of no new threads appearing, we'll process the entire batch.
    debounceTimer = setTimeout(debouncedProcessThreadQueue, 150);
  });

  // 1. Claim the "invoice-tracker-view" route to prevent Gmail from treating it as a search.
  sdk.Router.handleCustomRoute("invoice-tracker-view", async (customRouteView) => {
    console.log('[UI DEBUG] "invoice-tracker-view" route loaded.');
    customRouteView.setFullWidth(true); // Use full width for the spreadsheet
    
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      background: #fff !important;
    `;
    
    customRouteView.getElement().appendChild(container);

    // Initialize AI-style loading controller
    const loadingController = createLoadingController(container);
    
    // Hoist for cleanup handlers
    let spreadsheetResult = null;
    let handleCleanup = () => {};

    try {
      // Step 1: Start fetching invoices
      loadingController.startFetching();
      console.log('[AI LOADING] 🚀 Starting invoice fetch...');
      
      // Fetch live data from our data manager
      const allInvoices = await dataManager.getAllInvoices();
      loadingController.completeFetching();
      console.log('[AI LOADING] ✅ Invoice fetch completed');
      
      // Step 2: Start processing details (immediate)
      loadingController.startDetails();
      loadingController.completeDetails();
      console.log('[AI LOADING] ✅ Invoice details processed');
      
      // Step 3: Start status processing (immediate)
      loadingController.startStatus();
      loadingController.completeStatus();
      console.log('[AI LOADING] ✅ Invoice status processed');
      
      // Build and render the spreadsheet
      spreadsheetResult = await buildSpreadsheet(container, allInvoices, {
        apiClient: apiClient,
        fetchPdf: (params) => apiClient.fetchGmailAttachmentPdf(params), // Correctly use apiClient
        sdk: sdk
      });
      
      console.log("[SPREADSHEET] Spreadsheet built and rendered successfully.");
      
      // Single cleanup handler using sendBeacon
      handleCleanup = () => {
        if (spreadsheetResult?.correctionsBatcher?.hasPendingCorrections()) {
          console.log('[CLEANUP] Sending pending corrections via sendBeacon');
          spreadsheetResult.correctionsBatcher.sendBeaconBatch();
        }
      };

      // Single event listener for page unload
      window.addEventListener('pagehide', handleCleanup);
      
    } catch (error) {
      console.error('[AI LOADING] ❌ Error during invoice loading:', error);
      loadingController.showError(error);
    }
    
    // Handle route cleanup
    customRouteView.on('destroy', () => {
      console.log('[UI DEBUG] Cleaning up invoice tracker view');

      // Send any remaining corrections on route destroy
      if (spreadsheetResult?.correctionsBatcher?.hasPendingCorrections()) {
        console.log('[CLEANUP] Sending final corrections on route destroy');
        spreadsheetResult.correctionsBatcher.sendBatch(); // Use async send here since route destroy allows it
      }

      // Remove event listener
      window.removeEventListener('pagehide', handleCleanup);

      if (container._resizeObserver) {
        container._resizeObserver.disconnect();
        console.log('[UI DEBUG] Resize observer disconnected');
      }
    });
  });

  // Register a handler for ALL route views to inject our UI when our route is active
  sdk.Router.handleAllRoutes(routeView => {
    // Only log route changes for debugging, don't try to modify non-custom routes
    console.log('[ROUTE DEBUG] Route changed:', routeView.getRouteID(), routeView.getRouteType());
  });

  // 2. Add the Nav Item with retry mechanism
  const addNavItemWithRetry = (retries = 5, delay = 1000) => {
    try {
      console.log(`[UI DEBUG] Attempting to add NavItem (attempt ${6 - retries}/5)...`);
      
      // Check if Gmail's navigation structure is ready
      const navMenuContainer = document.querySelector('[role="navigation"]');
      if (!navMenuContainer) {
        throw new Error('Gmail navigation not ready - no navigation role element found');
      }

      const navItem = sdk.NavMenu.addNavItem({
        name: "Invoice Tracker",
        iconUrl: chrome.runtime.getURL("stamp-logo.png"),
        routeID: "invoice-tracker-view",
      });
      console.log('[UI DEBUG] ✅ NavItem added successfully!', navItem);
      return navItem;
      
    } catch (error) {
      console.error(`[UI DEBUG] ❌ NavItem creation failed (attempt ${6 - retries}/5):`, error.message);
      
      if (retries > 0) {
        console.log(`[UI DEBUG] 🔄 Retrying in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => addNavItemWithRetry(retries - 1, Math.min(delay * 1.5, 5000)), delay);
      } else {
        console.error('[UI DEBUG] 💀 All retry attempts exhausted. NavItem will not be visible.');
        console.error('[UI DEBUG] Final error details:', error);
        
        // Try to provide helpful debugging info
        console.log('[UI DEBUG] Gmail DOM state:', {
          hasNavigation: !!document.querySelector('[role="navigation"]'),
          hasLeftNav: !!document.querySelector('[data-testid="sidenav"]'),
          hasNavItems: !!document.querySelector('.TK'),
          inboxSDKNavMenu: !!document.querySelector('.inboxsdk__navMenu'),
          currentUrl: window.location.href,
          gmailMode: window.location.hash
        });
      }
    }
  };

  // Wait for Gmail to initialize before attempting nav item creation
  const waitForGmailAndAddNavItem = () => {
    // Check if we're definitely in Gmail and it's loaded
    if (window.location.hostname !== 'mail.google.com') {
      console.error('[UI DEBUG] Not on Gmail, skipping nav item creation');
      return;
    }

    // Wait for basic Gmail structure
    const checkGmailReady = () => {
      const navigation = document.querySelector('[role="navigation"]');
      const main = document.querySelector('[role="main"]');
      
      if (navigation && main) {
        console.log('[UI DEBUG] 🎯 Gmail appears ready, attempting nav item creation...');
        // Give it another moment for InboxSDK to settle
        setTimeout(() => addNavItemWithRetry(), 500);
      } else {
        console.log('[UI DEBUG] ⏳ Gmail not fully loaded yet, waiting...');
        setTimeout(checkGmailReady, 1000);
      }
    };

    // Start checking
    checkGmailReady();
  };

  // Start the process
  waitForGmailAndAddNavItem();

  // --- INITIALIZE UI AND AUTH ---
  // 1. Create instances
  const uiManager = new UIManager(sdk);
  const authService = new AuthService(uiManager);
  // apiClient is already created above

  // 2. Link them
  uiManager.setAuthService(authService);
  uiManager.setApiClient(apiClient);

  // Initialize the UIManager, which will now only handle the sidebar content
  uiManager.initialize();

  // Make UIManager globally accessible for testing
  window.uiManager = uiManager;

  // Make handleStreamingResponse globally available for floating chat
  window.sharedHandleStreamingResponse = uiManager.handleStreamingResponse.bind(uiManager);

  // Global test function for console access
  window.testFloatingChat = () => {
    console.log('[GLOBAL TEST] Testing floating chat...');
    if (window.uiManager) {
      window.uiManager.testFloatingChat();
    } else {
      console.log('[GLOBAL TEST] UIManager not available');
    }
  };

  // Global function to manually create floating chat
  window.createFloatingChat = () => {
    console.log('[GLOBAL TEST] Manually creating floating chat...');
    if (window.uiManager && window.uiManager.apiClient && window.uiManager.authService) {
      try {
        const floatingChat = new FloatingChat(
          window.uiManager.apiClient,
          window.uiManager.authService
        );
        console.log('[GLOBAL TEST] Floating chat created:', floatingChat);
        return floatingChat;
      } catch (error) {
        console.error('[GLOBAL TEST] Failed to create floating chat:', error);
      }
    } else {
      console.log('[GLOBAL TEST] UIManager or dependencies not available');
    }
  };

  // Add Material Icons for jspreadsheet toolbar
  const materialIconsLink = document.createElement('link');
  materialIconsLink.rel = 'stylesheet';
  materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(materialIconsLink);

  // Expose the uiManager to the window for debugging and extensions
  window.stampUIManager = uiManager;

  // --- ROUTE HANDLING FOR AP TRACKER ---
  
  // When a thread is opened, show the invoice details in the sidebar.
  sdk.Conversations.registerThreadViewHandler(async (threadView) => {
    await uiManager.handleThreadView(threadView);
  });

  // Add Store in Drive buttons to existing attachment cards
  sdk.Conversations.registerFileAttachmentCardViewHandler((attachmentCard) => {
    uiManager.handleFileAttachmentCard(attachmentCard);
  });

  // Also handle message views to add buttons to existing attachment cards
  sdk.Conversations.registerMessageViewHandler(async (messageView) => {
    await uiManager.handleExistingAttachmentCards(messageView);
  });



  // Register a handler for ALL route views to inject our UI when our route is active
  sdk.Router.handleAllRoutes(routeView => {
    // Only log route changes for debugging, don't try to modify non-custom routes
    console.log('[ROUTE DEBUG] Route changed:', routeView.getRouteID(), routeView.getRouteType());
  });

}).catch((error) => {
  console.error("Stamp Extension: Failed to load InboxSDK.", error);
});

// --- MESSAGE HANDLERS FOR POPUP COMMUNICATION ---

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Received message from popup:', message.type);

  // Handle installation request from popup
  if (message.type === 'START_INSTALLATION') {
    (async () => {
      try {
        console.log('[Content] Starting installation from popup request');
        
        if (!window.uiManager || !window.uiManager.authService) {
          throw new Error('Authentication service not available. Please refresh Gmail and try again.');
        }

        // Start the dual OAuth installation flow
        await window.uiManager.authService.signInWithGoogle();
        
        console.log('[Content] Installation completed successfully');
        sendResponse({ success: true });
        
      } catch (error) {
        console.error('[Content] Installation failed:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }

  // Handle sign out request from popup
  if (message.type === 'SIGN_OUT') {
    (async () => {
      try {
        console.log('[Content] Starting sign out from popup request');
        
        if (!window.uiManager || !window.uiManager.authService) {
          throw new Error('Authentication service not available. Please refresh Gmail and try again.');
        }

        // Sign out using the auth service
        await window.uiManager.authService.signOut();
        
        // Refresh the UI to logged out state
        if (window.uiManager.sidebarPanel) {
          window.uiManager.sidebarPanel.remove();
        }
        window.uiManager.renderLoginView();
        
        console.log('[Content] Sign out completed successfully');
        sendResponse({ success: true });
        
      } catch (error) {
        console.error('[Content] Sign out failed:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }

  // Handle cleanup installation request
  if (message.type === 'CLEANUP_INSTALLATION') {
    (async () => {
      try {
        console.log('[Content] Cleaning up installation state');
        
        if (window.uiManager && window.uiManager.authService) {
          await window.uiManager.authService._cleanupPartialInstallation();
        }
        
        sendResponse({ success: true });
        
      } catch (error) {
        console.error('[Content] Cleanup failed:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }

  return false; // Not handled
}); 