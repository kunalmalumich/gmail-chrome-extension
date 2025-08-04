import * as InboxSDK from '@inboxsdk/core';
import jspreadsheet from 'jspreadsheet-ce';
import jsuites from 'jsuites';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import { buildSpreadsheet } from './spreadsheet-builder.js';
import { ThreadDataManager } from './thread-data-manager.js';

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
    return `https://mail.google.com/mail/u/0/#inbox/${meta.threadId}`;
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
const OAUTH_CLIENT_ID = CONFIG.OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;

// Prioritize OAUTH_CLIENT_ID over GOOGLE_CLIENT_ID
const CLIENT_ID = OAUTH_CLIENT_ID || GOOGLE_CLIENT_ID;

if (!API_ENDPOINT) {
  console.error('[CONFIG] API_ENDPOINT is not set');
}

if (!CLIENT_ID) {
  console.error('[CONFIG] Neither OAUTH_CLIENT_ID nor GOOGLE_CLIENT_ID is set');
}

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
   */
  async makeAuthenticatedRequest(endpoint, options = {}) {
    const { installationId, userEmail } = await chrome.storage.local.get(['installationId', 'userEmail']);
    
    if (!installationId) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Installation-ID': installationId,
      'ngrok-skip-browser-warning': 'true', // Add ngrok header
      ...options.headers
    };

    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }

    console.log(`[API] Making authenticated request to: ${endpoint}`, {
      url,
      headers: { ...headers, Authorization: '[REDACTED]' }
    });
    
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
   * Gets email processing status from the backend.
   */
  async getEmailStatus() {
    const response = await this.makeAuthenticatedRequest('/status');
    return response.json();
  }
}

/**
 * Handles all authentication and installation logic.
 * Implements the production OAuth flow that works with the backend's Gmail add-on implementation.
 */
class AuthService {
  constructor(uiManager) {
    this.uiManager = uiManager;
  }

  /**
   * Implements the production OAuth flow for Chrome extension.
   * Now simplified to only send the OAuth code to backend.
   * The backend handles all OAuth processing including token exchange and user email retrieval.
   */
  async signInWithGoogle() {
    console.log('[AUTH] Starting production sign-in with Google...');
    try {
      // Step 1: Get authorization code using launchWebAuthFlow
      console.log('[AUTH] Step 1: Getting authorization code...');
      const { code, redirectUri } = await this._getGoogleAuthCode();
      
      // Step 2: Send auth code to backend for complete processing
      console.log('[AUTH] Step 2: Sending auth code to backend...');
        const response = await fetch(`${API_ENDPOINT}/install`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
          code: code,
          redirect_uri: redirectUri
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
        console.error('[AUTH] Installation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Backend installation failed: ${errorText}`);
      }

      const { installationId, userEmail } = await response.json();
      await chrome.storage.local.set({ installationId, userEmail });
      console.log(`[AUTH] Installation successful for ${userEmail}.`);
      console.log('[AUTH] Sign-in flow completed successfully.');
    } catch (error) {
      console.error('[AUTH] Sign-in flow failed:', error);
      
      // Check if it's a network error (likely ngrok issue)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to backend server. Please check your connection.');
      }
      
      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('CORS')) {
        throw new Error('CORS error: Backend server not accessible.');
      }
      
      throw error;
    }
  }

  /**
   * Gets the authorization code using chrome.identity.launchWebAuthFlow.
   * This is the correct approach for Chrome extensions with web app OAuth client IDs.
   */
  async _getGoogleAuthCode() {
    console.log('[AUTH] Requesting auth code from background...');
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_CODE' }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res.error) return reject(new Error(res.error));
        resolve(res);
      });
    });
    return response;
  }

  /**
   * Checks local storage for an installation ID to determine auth state.
   */
  async getAuthState() {
    const { installationId, userEmail } = await chrome.storage.local.get(['installationId', 'userEmail']);
    return {
      isLoggedIn: !!installationId,
      userEmail: userEmail || null
    };
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
        await fetch(`${API_ENDPOINT}/revoke`, {
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
      await chrome.storage.local.remove(['installationId', 'userEmail']);
      console.log('[AUTH] Sign-out complete.');
      
    } catch (error) {
      console.error('[AUTH] Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Development tool to completely reset the auth state.
   * Revokes Google OAuth permissions and clears all local data.
   */
  async hardReset() {
    try {
      console.log('[AUTH] Starting hard reset...');
      
      // Get current access token for revocation by going through OAuth flow again
      console.log('[AUTH] Step 1: Getting current access token for revocation...');
      const { code, redirectUri } = await this._getGoogleAuthCode();
      
      // Exchange code for token just for revocation
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: OAUTH_CLIENT_ID,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (accessToken) {
        console.log('[AUTH] Step 2: Revoking Google OAuth token...');

        // Revoke the token with Google
          console.log('[AUTH] Sending revocation request to Google...');
          await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
            method: 'POST',
            headers: {
              'Content-type': 'application/x-www-form-urlencoded'
            }
          });
          console.log('[AUTH] Google token revocation request sent.');
        }
      }

      // Perform normal sign out to clear local storage
      console.log('[AUTH] Step 3: Performing standard sign-out to complete hard reset...');
      await this.signOut();
      console.log('[AUTH] Hard reset completed successfully.');
    } catch (error) {
      console.error('[AUTH] Hard reset failed:', error);
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
  submitted: {
    backgroundColor: '#90CAF9',
    textColor: '#000000',
    description: 'Invoice initially detected'
  },
  pending: {
    backgroundColor: '#FFC107',
    textColor: '#000000',
    description: 'Awaiting approval or low confidence'
  },
  approved: {
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    description: 'Explicit or high-confidence approval'
  },
  paid: {
    backgroundColor: '#2196F3',
    textColor: '#FFFFFF',
    description: 'Payment confirmed'
  },
  rejected: {
    backgroundColor: '#F44336',
    textColor: '#FFFFFF',
    description: 'Explicitly denied'
  }
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

  // Check for invoice status keywords
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

  // If no keywords found, use default styling
  console.log(`[LABEL_CREATION] No status or intent keywords found in: "${normalizedText}", using default colors`);
  return {
    title: labelText,
    backgroundColor: '#E0E0E0',
    textColor: '#000000',
    iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  };
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
  const statusConfig = cardData.status ? (INVOICE_STATUS_COLORS[cardData.status] || { backgroundColor: '#E0E0E0', textColor: '#000000' }) : null;
  const amountFormatted = cardData.hasDetails ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cardData.currency }).format(cardData.amount) : null;
  
  // Card is only clickable if it has details
  const isClickable = cardData.hasDetails;
  const fullDetailsString = isClickable ? JSON.stringify(cardData.fullDetails).replace(/'/g, '&apos;') : '';
  const cursorStyle = isClickable ? 'cursor: pointer;' : 'cursor: default;';
  const cardClass = isClickable ? 'entity-card' : 'entity-card non-clickable';

  // Title can be a link if a messageId is available
  const messageLink = cardData.messageId ? `https://mail.google.com/mail/u/0/#inbox/${threadId}/${cardData.messageId}` : null;
  const titleHtml = messageLink 
    ? `<a href="${messageLink}" target="_blank" style="text-decoration: none; color: #1a73e8;" onclick="event.stopPropagation();">${cardData.title}</a>`
    : cardData.title;

  return `
    <div class="${cardClass}" ${isClickable ? `data-full-details='${fullDetailsString}'` : ''} style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; padding: 16px; ${cursorStyle} transition: box-shadow 0.2s;">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">${cardData.icon}</span>
          <span>${titleHtml}</span>
        </h4>
        ${statusConfig ? `
        <span class="status-tag" style="background-color: ${statusConfig.backgroundColor}; color: ${statusConfig.textColor}; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: capitalize;">
          ${cardData.status.replace(/_/g, ' ')}
        </span>
        ` : ''}
      </div>
      ${isClickable ? `
      <div class="card-body" style="font-size: 13px; color: #5f6368;">
        <p style="margin: 4px 0;"><strong>Vendor:</strong> ${cardData.vendor}</p>
        <p style="margin: 4px 0;"><strong>Amount:</strong> ${amountFormatted}</p>
      </div>
      ` : ''}
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
  }

  setAuthService(authService) {
    this.authService = authService;
  }

  setApiClient(apiClient) {
    this.apiClient = apiClient;
    // Update the dataManager with the apiClient
    this.dataManager.apiClient = apiClient;
  }

  /**
   * Initializes the UI by checking the auth state and rendering the correct view.
   */
  async initialize() {
    console.log('[UI DEBUG] 1. UIManager initialize() called.');
    if (!this.authService) {
      console.error('[UI DEBUG] AuthService not set on UIManager. Cannot initialize.');
      return;
    }

    // Register thread view handler with proper binding
    this.sdk.Conversations.registerThreadViewHandler(this.handleThreadView.bind(this));
    
    // Register route change handler to restore chat interface when leaving threads
    this.sdk.Router.handleAllRoutes((routeView) => {
      const routeId = routeView.getRouteID();
      console.log('[UI] Route changed to:', routeId);
      
      // If we're not in a thread view, restore the chat interface
      if (routeId !== 'thread' && routeId !== 'thread/:threadID') {
        this.restoreChatInterface();
      }
    });

    try {
      const { isLoggedIn } = await this.authService.getAuthState();
      if (isLoggedIn) {
        console.log('[UI DEBUG] 2. User is logged in. Calling renderMainView.');
        this.renderMainView();
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
    const threadId = await threadView.getThreadID();
    console.log('[UI] Thread view changed:', threadId);

    // Use the data manager to get data for this specific thread
    const threadDataMap = await this.dataManager.getThreadData([threadId]);
    const threadInfo = threadDataMap[threadId];
    
    // Transform all entities for the sidebar. Returns an array.
    const cardDataArray = threadInfo && threadInfo.processedEntities 
      ? transformProcessedEntitiesForSidebar(threadInfo.processedEntities)
      : [];

    if (this.sidebarElement) {
      this.sidebarElement.innerHTML = this.createSidebarContent(threadId, cardDataArray);
      
      // Attach new event listeners for the cards
      this.attachCardClickListeners(this.sidebarElement);
      
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

  // Updated method to create sidebar content dynamically
  createSidebarContent(threadId, cardDataArray) {
    // Store the current card data for later use
    this._currentCardData = cardDataArray;
    
    if (cardDataArray && cardDataArray.length > 0) {
      const cardsHtml = cardDataArray.map(cardData => {
        const cardHtml = createEntityCard(cardData, threadId);
        // Add thread ID to the card for restoration
        return cardHtml.replace('class="entity-card"', `class="entity-card" data-thread-id="${threadId}"`);
      }).join('');
      
      return `
        <div style="padding: 12px; border-bottom: 1px solid #e0e0e0; background: #fafafa;">
          <h3 style="margin: 0; font-size: 16px;">Documents in this thread</h3>
        </div>
        <div style="padding: 16px;">
          ${cardsHtml}
        </div>
      `;
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
        const response = await self.apiClient.makeAuthenticatedRequest('/api/finops', {
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

        // Hide loading state
        self.hideLoading(assistantDiv);

        // Check if response is streaming
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
          // Handle streaming response
          await self.handleStreamingResponse(response, assistantDiv);
        } else {
          // Handle JSON response
          const data = await response.json();
          if (data.answer) {
            assistantDiv.querySelector('#main-content').textContent = data.answer;
          } else {
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
            console.log('[UI] "Sign in with Google" button clicked');
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
        // Create the sidebar panel first
    this.sidebarPanel = await this.sdk.Global.addSidebarContentPanel({
            title: 'Stamp',
            iconUrl: chrome.runtime.getURL('stamp-logo.png'),
            el: el,
        });
        
        // Store the DOM element reference for later use
        this.sidebarElement = el;

        // Now set up event listeners
        this.attachChatEventListeners(el); // Call the new method here
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
}


// --- MAIN EXECUTION ---

InboxSDK.load(2, 'YOUR_APP_ID_HERE').then((sdk) => {
  console.log("Stamp Extension: InboxSDK loaded successfully.");

  // --- SETUP GLOBAL COMPONENTS ---
  // Create apiClient first so we can pass it to dataManager
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

  // This is the "doorman" function that runs for every single thread row.
  sdk.Lists.registerThreadRowViewHandler(function (threadRowView) {
    const threadId = threadRowView.getThreadID();
    
    // Instead of fetching immediately, we just add the thread's view to our list.
    threadViewRegistry.set(threadId, threadRowView);

    // Every time a new thread appears, we reset our timer.
    clearTimeout(debounceTimer);

    // After 150ms of no new threads appearing, we'll process the entire batch.
    debounceTimer = setTimeout(processThreadQueue, 150);
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

    // Fetch live data from our data manager instead of using a static sample
    const allInvoices = await dataManager.getAllInvoices();
        
    // Build spreadsheet with the live data
    await buildSpreadsheet(container, allInvoices);
    
    // Handle route cleanup
    customRouteView.on('destroy', () => {
      console.log('[UI DEBUG] Cleaning up invoice tracker view');
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

  // Add Material Icons for jspreadsheet toolbar
  const materialIconsLink = document.createElement('link');
  materialIconsLink.rel = 'stylesheet';
  materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(materialIconsLink);

}).catch((error) => {
  console.error("Stamp Extension: Failed to load InboxSDK.", error);
}); 