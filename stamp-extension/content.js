import * as InboxSDK from '@inboxsdk/core';
import jspreadsheet from 'jspreadsheet-ce';
import jsuites from 'jsuites';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import { buildSpreadsheet } from './spreadsheet-builder.js';

// Make jspreadsheet and jsuites available globally
window.jspreadsheet = jspreadsheet;
window.jsuites = jsuites;

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
  }

  setAuthService(authService) {
    this.authService = authService;
  }

  setApiClient(apiClient) {
    this.apiClient = apiClient;
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

  handleThreadView(threadView) {
    console.log('[UI] Thread view opened:', threadView);
    
    // Safety check to ensure 'this' is properly bound
    if (!this) {
      console.error('[ERROR] handleThreadView called without proper context');
      return;
    }

    // Get thread ID first
    threadView.getThreadIDAsync().then(threadId => {
      console.log('[UI] Fetched Thread ID:', threadId);
      const invoiceDetails = getInvoiceDetailsForThread(threadId);

      // Detailed logging for sidebar panel
      console.log('[DEBUG] this.sidebarPanel:', this.sidebarPanel);
      console.log('[DEBUG] this.sidebarElement:', this.sidebarElement);
      
      if (this.sidebarPanel) {
        console.log('[DEBUG] typeof this.sidebarPanel:', typeof this.sidebarPanel);
      } else {
        console.log('[DEBUG] this.sidebarPanel is undefined or null');
      }

      // Update the existing Stamp sidebar content instead of creating a new panel
      if (this.sidebarElement) {
        console.log('[DEBUG] Using this.sidebarElement to update content');
        
        // Create thread information content
        let threadInfoHtml = `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #333;">📧 Thread Information</h3>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Thread ID</strong>
                <div style="font-weight: 600; color: #2196F3; font-family: monospace; font-size: 12px;">${threadId}</div>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Message ID</strong>
                <div style="font-weight: 600; color: #2196F3; font-family: monospace; font-size: 12px;" id="message-id-span">Loading...</div>
              </div>
            </div>
          </div>
        `;
        
        if (invoiceDetails && invoiceDetails.invoices && invoiceDetails.invoices.length > 0) {
          // Show invoice information in sidebar
          const invoice = invoiceDetails.invoices[0]; // Show first invoice
          const stage = getThreadStage(threadId);
          
          const invoiceHtml = `
            <div style="margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #333;">🧾 Invoice Details</h3>
              <div style="background: ${STAGE_COLORS[stage]}; color: white; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                ${stage}
              </div>
            </div>
            
            <div style="margin-bottom: 16px;">
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Invoice Number</strong>
                <div style="font-weight: 600; color: #2196F3;">${invoice.invoiceNumber}</div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Vendor</strong>
                <div style="font-weight: 500;">${invoice.vendor}</div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Amount</strong>
                <div style="font-weight: 600; color: #333; font-size: 16px;">$${invoice.amount.toLocaleString()}</div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong style="color: #666; font-size: 12px;">Due Date</strong>
                <div style="font-weight: 500; ${new Date(invoice.dueDate) < new Date() && stage !== INVOICE_STAGES.PAID ? 'color: #f44336;' : ''}">${new Date(invoice.dueDate).toLocaleDateString()}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <strong style="color: #666; font-size: 12px;">Assigned To</strong>
                <div style="font-weight: 500; color: #666;">${invoice.assignedTo}</div>
              </div>
            </div>
            
            <button id="view-in-invoice-tracker" style="
              width: 100%;
              padding: 10px 16px;
              background: #2196F3;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              margin-bottom: 12px;
            ">View in Invoice Tracker</button>
            
            <button id="take-action" style="
              width: 100%;
              padding: 10px 16px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
            ">Take Action</button>
          `;
          
          this.sidebarElement.innerHTML = threadInfoHtml + invoiceHtml;
          
          // Add event listeners
          this.sidebarElement.querySelector('#view-in-invoice-tracker').addEventListener('click', () => {
            alert("The invoice tracker is currently unavailable.");
          });
          
          this.sidebarElement.querySelector('#take-action').addEventListener('click', () => {
            console.log(`[ACTION] Taking action on invoice ${invoice.invoiceNumber}`);
            alert(`Action button clicked for ${invoice.invoiceNumber}`);
          });
          
        } else {
          // No invoice data for this thread
          const noInvoiceHtml = `
            <div style="margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #333;">🧾 Invoice Data</h3>
              <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🧾</div>
                <h4 style="margin: 0 0 8px 0; color: #333;">No Invoice Data</h4>
                <p style="margin: 0; color: #666; font-size: 14px;">This email thread doesn't contain invoice information.</p>
              </div>
            </div>
            
            <button id="view-invoice-tracker-general" style="
              width: 100%;
              padding: 10px 16px;
              background: #2196F3;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              margin-bottom: 12px;
            ">View Invoice Tracker</button>
          `;
          
          this.sidebarElement.innerHTML = threadInfoHtml + noInvoiceHtml;
          
          // Add event listener for general invoice tracker navigation
          this.sidebarElement.querySelector('#view-invoice-tracker-general').addEventListener('click', () => {
            alert("The invoice tracker is currently unavailable.");
          });
        }
        
        // Get message ID
        const messageViews = threadView.getMessageViews();
        if (messageViews.length > 0) {
          messageViews[0].getMessageIDAsync().then(messageId => {
            console.log('[UI] Fetched Message ID:', messageId);
            const messageIdSpan = this.sidebarElement.querySelector('#message-id-span');
            if (messageIdSpan) {
              messageIdSpan.textContent = messageId;
            }
          });
        } else {
          const messageIdSpan = this.sidebarElement.querySelector('#message-id-span');
          if (messageIdSpan) {
            messageIdSpan.textContent = 'No messages in this view.';
          }
        }
      } else {
        console.log('[DEBUG] this.sidebarElement is not available');
      }
    });
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
  // This allows the SDK to manage waiting for the correct DOM elements.

  // --- LABEL-BASED EMAIL CLASSIFICATION SYSTEM ---

  // Mock invoice details data with real thread IDs
  // In a real app, this would come from your backend API
  const INVOICE_DETAILS = {
    '1985f8728a45ce6b': {
      invoices: [
        {
          invoiceNumber: 'INV-001',
          vendor: 'Vendor ABC',
          amount: 1500.00,
          currency: 'USD',
          dueDate: '2024-01-30',
          issueDate: '2024-01-01',
          status: INVOICE_STAGES.PENDING_APPROVAL,
          category: 'Software Services',
          assignedTo: 'john@company.com'
        }
      ]
    },
    '197f8e706fbe9a78': {
      invoices: [
        {
          invoiceNumber: 'INV-002',
          vendor: 'Vendor XYZ',
          amount: 2300.00,
          currency: 'USD',
          dueDate: '2024-01-25',
          issueDate: '2024-01-05',
          status: INVOICE_STAGES.PENDING_APPROVAL,
          category: 'Marketing Services',
          assignedTo: 'sarah@company.com'
        }
      ]
    },
    '1985d4b9df0f880d': {
      invoices: [
        {
          invoiceNumber: 'INV-008',
          vendor: 'Tech Solutions Inc',
          amount: 4500.00,
          currency: 'USD',
          dueDate: '2024-02-10',
          issueDate: '2024-01-20',
          status: INVOICE_STAGES.PENDING_APPROVAL,
          category: 'IT Services',
          assignedTo: 'tech@company.com'
        }
      ]
    },
    '198610cb7f43f9d6': {
      invoices: [
        {
          invoiceNumber: 'INV-014',
          vendor: 'Printing Solutions',
          amount: 950.00,
          currency: 'USD',
          dueDate: '2024-02-05',
          issueDate: '2024-01-15',
          status: INVOICE_STAGES.PENDING_APPROVAL,
          category: 'Printing Services',
          assignedTo: 'marketing@company.com'
        }
      ]
    },
    '1980f4557688b088': {
      invoices: [
        {
          invoiceNumber: 'INV-003',
          vendor: 'Vendor DEF',
          amount: 800.00,
          currency: 'USD',
          dueDate: '2024-01-20',
          issueDate: '2024-01-10',
          status: INVOICE_STAGES.IN_REVIEW,
          category: 'Office Supplies',
          assignedTo: 'mike@company.com'
        }
      ]
    },
    '1985ff48522d033e': {
      invoices: [
        {
          invoiceNumber: 'INV-009',
          vendor: 'Creative Agency Pro',
          amount: 2800.00,
          currency: 'USD',
          dueDate: '2024-01-28',
          issueDate: '2024-01-08',
          status: INVOICE_STAGES.IN_REVIEW,
          category: 'Design Services',
          assignedTo: 'marketing@company.com'
        }
      ]
    },
    '1985df699de1d999': {
      invoices: [
        {
          invoiceNumber: 'INV-015',
          vendor: 'Maintenance Plus',
          amount: 2200.00,
          currency: 'USD',
          dueDate: '2024-01-27',
          issueDate: '2024-01-07',
          status: INVOICE_STAGES.IN_REVIEW,
          category: 'Maintenance Services',
          assignedTo: 'facilities@company.com'
        }
      ]
    },
    '1985c5c28c8b93fc': {
      invoices: [
        {
          invoiceNumber: 'INV-004',
          vendor: 'Vendor GHI',
          amount: 3200.00,
          currency: 'USD',
          dueDate: '2024-02-15',
          issueDate: '2024-01-15',
          status: INVOICE_STAGES.APPROVED,
          category: 'Consulting Services',
          assignedTo: 'lisa@company.com'
        }
      ]
    },
    '1985b51cce81485c': {
      invoices: [
        {
          invoiceNumber: 'INV-010',
          vendor: 'Office Supply Co',
          amount: 650.00,
          currency: 'USD',
          dueDate: '2024-01-22',
          issueDate: '2024-01-12',
          status: INVOICE_STAGES.APPROVED,
          category: 'Office Supplies',
          assignedTo: 'admin@company.com'
        }
      ]
    },
    '1985a8b7e2f1c9d8': {
      invoices: [
        {
          invoiceNumber: 'INV-005',
          vendor: 'Vendor JKL',
          amount: 950.00,
          currency: 'USD',
          dueDate: '2024-01-10',
          issueDate: '2024-01-01',
          status: INVOICE_STAGES.PAID,
          category: 'Utilities',
          assignedTo: 'finance@company.com'
        }
      ]
    },
    '198599c6d3e2f1a0': {
      invoices: [
        {
          invoiceNumber: 'INV-011',
          vendor: 'Cloud Hosting Ltd',
          amount: 1200.00,
          currency: 'USD',
          dueDate: '2024-01-15',
          issueDate: '2024-01-01',
          status: INVOICE_STAGES.PAID,
          category: 'Hosting Services',
          assignedTo: 'it@company.com'
        }
      ]
    },
    '19858ad5e4f3g2b1': {
      invoices: [
        {
          invoiceNumber: 'INV-006',
          vendor: 'Vendor MNO',
          amount: 1800.00,
          currency: 'USD',
          dueDate: '2024-01-05',
          issueDate: '2023-12-15',
          status: INVOICE_STAGES.OVERDUE,
          category: 'Legal Services',
          assignedTo: 'legal@company.com'
        }
      ]
    },
    '19857be4f5g4h3c2': {
      invoices: [
        {
          invoiceNumber: 'INV-012',
          vendor: 'Security Systems Corp',
          amount: 3500.00,
          currency: 'USD',
          dueDate: '2024-01-03',
          issueDate: '2023-12-20',
          status: INVOICE_STAGES.OVERDUE,
          category: 'Security Services',
          assignedTo: 'security@company.com'
        }
      ]
    },
    '19856cf3g6h5i4d3': {
      invoices: [
        {
          invoiceNumber: 'INV-007',
          vendor: 'Vendor PQR',
          amount: 1200.00,
          currency: 'USD',
          dueDate: '2024-01-15',
          issueDate: '2024-01-01',
          status: INVOICE_STAGES.REJECTED,
          category: 'Travel Expenses',
          assignedTo: 'hr@company.com'
        }
      ]
    },
    '19855dg2h7i6j5e4': {
      invoices: [
        {
          invoiceNumber: 'INV-013',
          vendor: 'Training Institute',
          amount: 1800.00,
          currency: 'USD',
          dueDate: '2024-01-18',
          issueDate: '2024-01-05',
          status: INVOICE_STAGES.REJECTED,
          category: 'Training Services',
          assignedTo: 'hr@company.com'
        }
      ]
    }
  };

  // Track all thread row views as they're created
  const trackedThreadRowViews = new Map();

  // Helper function to assign a stage to a thread (for testing)
  function assignStageToThread(threadId, stage) {
    if (!Object.values(INVOICE_STAGES).includes(stage)) {
      console.error(`[LABELS] Invalid stage: ${stage}. Valid stages are:`, Object.values(INVOICE_STAGES));
      return false;
    }
    
    THREAD_STAGE_ASSIGNMENTS[threadId] = stage;
    console.log(`[LABELS] Assigned stage "${stage}" to thread ${threadId}`);
    
    // Refresh the invoice tracker view if it's currently open
    const currentRoute = sdk.Router.getCurrentRouteView();
    if (currentRoute && currentRoute.getRouteID() === 'invoice-tracker-view') {
      console.log('[LABELS] Refreshing invoice tracker view...');
      // Trigger a refresh by navigating to the same route
      sdk.Router.goto('invoice-tracker-view');
    }
    
    return true;
  }

  // Example: Assign some stages to common Gmail thread patterns
  // You can call these functions in the browser console to test
  window.assignInvoiceStage = assignStageToThread;
  window.INVOICE_STAGES = INVOICE_STAGES;
  
  // Example assignments for testing (uncomment and modify as needed)
  // assignStageToThread('your-actual-thread-id-here', INVOICE_STAGES.INCOMING);
  // assignStageToThread('another-thread-id', INVOICE_STAGES.WORKING_ON);

  // Auto-assign stages to the first few threads for testing
  let autoAssignCounter = 0;
  const autoAssignStages = [
    INVOICE_STAGES.PENDING_APPROVAL,
    INVOICE_STAGES.PENDING_APPROVAL,
    INVOICE_STAGES.IN_REVIEW,
    INVOICE_STAGES.APPROVED,
    INVOICE_STAGES.PAID,
    INVOICE_STAGES.OVERDUE,
    INVOICE_STAGES.REJECTED,
    INVOICE_STAGES.PENDING_APPROVAL,
    INVOICE_STAGES.IN_REVIEW,
    INVOICE_STAGES.APPROVED,
    INVOICE_STAGES.PAID,
    INVOICE_STAGES.OVERDUE,
    INVOICE_STAGES.REJECTED,
    INVOICE_STAGES.PENDING_APPROVAL,
    INVOICE_STAGES.IN_REVIEW
  ];

  // Function to auto-assign stages to new threads for testing
  function autoAssignStageToNewThread(threadId) {
    if (autoAssignCounter < autoAssignStages.length) {
      const stage = autoAssignStages[autoAssignCounter];
      assignStageToThread(threadId, stage);
      autoAssignCounter++;
      console.log(`[AUTO-ASSIGN] Assigned "${stage}" to thread ${threadId} (${autoAssignCounter}/${autoAssignStages.length})`);
    }
  }

  // Make auto-assign function available globally
  window.autoAssignStageToNewThread = autoAssignStageToNewThread;

  // Function to create label descriptor for a stage
  function createStageLabel(stage) {
    return {
      title: stage,
      backgroundColor: STAGE_COLORS[stage],
      foregroundColor: '#fff',
      iconUrl: chrome.runtime.getURL('stamp-logo.png'),
      maxWidth: '120px'
    };
  }

  // Register thread row handler to add labels to email threads and track them
  sdk.Lists.registerThreadRowViewHandler(function (threadRowView) {
    const threadId = threadRowView.getThreadID();
    let stage = getThreadStage(threadId);
    
    // Auto-assign stage if this is a new thread and we haven't assigned it yet
    if (stage === INVOICE_STAGES.PENDING_APPROVAL && !THREAD_STAGE_ASSIGNMENTS[threadId]) {
      autoAssignStageToNewThread(threadId);
      stage = getThreadStage(threadId); // Get the updated stage
    }
    
    console.log(`[LABELS] Adding label "${stage}" to thread ${threadId}`);
    
    // Track this thread row view for later use
    trackedThreadRowViews.set(threadId, {
      threadRowView,
      stage,
      timestamp: Date.now()
    });
    
    // Add the stage label to this thread
    threadRowView.addLabel(createStageLabel(stage));
    
    // Optional: Add additional labels for more granular classification
    if (stage === INVOICE_STAGES.PENDING_APPROVAL) {
      threadRowView.addLabel({
        title: 'Invoice',
        backgroundColor: '#2196F3',
        foregroundColor: '#fff',
        maxWidth: '80px'
      });
    }
    
    if (stage === INVOICE_STAGES.IN_REVIEW) {
      threadRowView.addLabel({
        title: 'Review',
        backgroundColor: '#FF9800',
        foregroundColor: '#fff',
        maxWidth: '100px'
      });
    }
  });

  // Function to get all invoices for a specific stage
  async function getInvoicesForStage(stage) {
    const invoicesForStage = [];
    
    // Use our tracked thread row views and invoice details
    for (const [threadId, threadData] of trackedThreadRowViews) {
      if (threadData.stage === stage) {
        const invoiceDetails = INVOICE_DETAILS[threadId];
        if (invoiceDetails && invoiceDetails.invoices) {
          for (const invoice of invoiceDetails.invoices) {
            invoicesForStage.push({
              threadId,
              ...invoice,
              stage: threadData.stage
            });
          }
        }
      }
    }
    
    return invoicesForStage;
  }

  // Function to get all stages with their counts and totals
  async function getStagesWithCounts() {
    const stages = Object.values(INVOICE_STAGES);
    const stageCounts = {};
    const stageTotals = {};
    
    // Initialize counts and totals
    stages.forEach(stage => {
      stageCounts[stage] = 0;
      stageTotals[stage] = 0;
    });
    
    // Count invoices and calculate totals for each stage
    for (const [threadId, threadData] of trackedThreadRowViews) {
      const stage = threadData.stage;
      const invoiceDetails = INVOICE_DETAILS[threadId];
      
      if (invoiceDetails && invoiceDetails.invoices) {
        stageCounts[stage] = (stageCounts[stage] || 0) + invoiceDetails.invoices.length;
        stageTotals[stage] = (stageTotals[stage] || 0) + invoiceDetails.invoices.reduce((sum, inv) => sum + inv.amount, 0);
      }
    }
    
    return stages.map(stage => ({
      name: stage,
      color: STAGE_COLORS[stage],
      count: stageCounts[stage] || 0,
      total: stageTotals[stage] || 0
    }));
  }

  // Function to get tracked threads info for debugging
  function getTrackedThreadsInfo() {
    const info = [];
    for (const [threadId, threadData] of trackedThreadRowViews) {
      info.push({
        threadId,
        stage: threadData.stage,
        timestamp: new Date(threadData.timestamp).toLocaleTimeString()
      });
    }
    return info;
  }

  // Make debugging functions available globally
  window.getTrackedThreadsInfo = getTrackedThreadsInfo;
  window.trackedThreadRowViews = trackedThreadRowViews;

  // Navigation functions for bidirectional navigation
  function getInvoiceDetailsForThread(threadId) {
    return INVOICE_DETAILS[threadId] || null;
  }

  function getThreadIdForInvoice(invoiceNumber) {
    for (const [threadId, invoiceData] of Object.entries(INVOICE_DETAILS)) {
      if (invoiceData.invoices && invoiceData.invoices.some(inv => inv.invoiceNumber === invoiceNumber)) {
        return threadId;
      }
    }
    return null;
  }

  function navigateToThread(threadId) {
    console.log(`[NAVIGATION] Navigating to thread: ${threadId}`);
    sdk.Router.goto(sdk.Router.NativeRouteIDs.THREAD, { threadID: threadId });
  }

  function takeActionOnInvoice(invoiceNumber) {
    console.log(`[ACTION] Taking action on invoice ${invoiceNumber}`);
    // Here you could implement specific actions
    alert(`Action button clicked for ${invoiceNumber}`);
  }

  // Make navigation functions available globally
  window.navigateToThread = navigateToThread;
  window.takeActionOnInvoice = takeActionOnInvoice;
  window.getInvoiceDetailsForThread = getInvoiceDetailsForThread;
  
  // Debug function to help identify threads
  window.debugInvoiceThreads = function() {
    console.log('[DEBUG] Available invoice threads:');
    for (const [threadId, invoiceData] of Object.entries(INVOICE_DETAILS)) {
      if (invoiceData.invoices && invoiceData.invoices.length > 0) {
        const invoice = invoiceData.invoices[0];
        console.log(`Thread ID: ${threadId} -> Invoice: ${invoice.invoiceNumber} (${invoice.vendor})`);
      }
    }
    console.log('[DEBUG] Sample threads:');
    console.log('sample-thread-INV-001, sample-thread-INV-002, sample-thread-INV-003, etc.');
  };
  
  // Function to navigate to a real thread for testing
  window.testSampleThread = function(invoiceNumber) {
    // Map invoice numbers to real thread IDs
    const threadIdMap = {
      'INV-001': '1985f8728a45ce6b',
      'INV-002': '197f8e706fbe9a78',
      'INV-003': '1980f4557688b088',
      'INV-004': '1985c5c28c8b93fc',
      'INV-005': '1985a8b7e2f1c9d8',
      'INV-006': '19858ad5e4f3g2b1',
      'INV-007': '19856cf3g6h5i4d3',
      'INV-008': '1985d4b9df0f880d',
      'INV-009': '1985ff48522d033e',
      'INV-010': '1985b51cce81485c',
      'INV-011': '198599c6d3e2f1a0',
      'INV-012': '19857be4f5g4h3c2',
      'INV-013': '19855dg2h7i6j5e4',
      'INV-014': '198610cb7f43f9d6',
      'INV-015': '1985df699de1d999'
    };
    
    const threadId = threadIdMap[invoiceNumber];
    if (threadId) {
      console.log(`[TEST] Navigating to real thread: ${threadId} for invoice ${invoiceNumber}`);
      navigateToThread(threadId);
    } else {
      console.error(`[TEST] No thread ID found for invoice ${invoiceNumber}`);
    }
  };

  // 1. Claim the "invoice-tracker-view" route to prevent Gmail from treating it as a search.
  // Use handleCustomRoute for simple custom views (not list views)
  sdk.Router.handleCustomRoute("invoice-tracker-view", (customRouteView) => {
    console.log('[UI DEBUG] "invoice-tracker-view" route loaded.');
    customRouteView.setFullWidth(true); // Use full width for the spreadsheet
    const container = document.createElement('div');
    container.style.padding = '20px';
    customRouteView.getElement().appendChild(container);

    // Temp data for now
    const sampleData = [
        { invoiceNumber: 'INV-001', vendor: 'Vendor A', amount: 100, dueDate: '2023-01-15', status: 'Approved', assignedTo: 'User 1', threadId: 'thread-1' },
        { invoiceNumber: 'INV-002', vendor: 'Vendor B', amount: 200, dueDate: '2023-02-20', status: 'Pending', assignedTo: 'User 2', threadId: 'thread-2' },
    ];

    buildSpreadsheet(container, sampleData);
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
  const apiClient = new ApiClient();

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