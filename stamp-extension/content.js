import * as InboxSDK from '@inboxsdk/core';
import jspreadsheet from 'jspreadsheet-ce';
import jsuites from 'jsuites';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import { buildSpreadsheet } from './spreadsheet-builder.js';
import { ThreadDataManager } from './thread-data-manager.js';
import { createLoadingController } from './ai-loading-component.js';

// ===== FLOATING CHAT FUNCTIONALITY (COMMENTED OUT) =====
// Uncomment the following imports when you want to enable floating chat:
// import { FloatingChat } from './floating-chat/floating-chat.js';
// import { FloatingChatManager } from './floating-chat/floating-chat-manager.js';
// import 'floating-chat/floating-chat.css';

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

// ===== FLOATING CHAT CLASSES (COMMENTED OUT) =====
// Uncomment the following classes when you want to enable floating chat:

/*
class FloatingChat {
  constructor(apiClient, authService) {
    console.log('[FLOATING CHAT UI] Constructor called');
    
    this.apiClient = apiClient;
    this.authService = authService;
    this.messages = [];
    this.isTyping = false;
    
    // This class now acts as a UI builder.
    // The main container will be created by the render() method.
    this.container = null;
  }

  render() {
    // Create the main container for our chat UI
    this.container = document.createElement('div');
    this.container.className = 'stamp-chat-mole-content';
    
    // Create messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'floating-chat-messages';

    // Create input container
    this.inputContainer = document.createElement('div');
    this.inputContainer.className = 'floating-chat-input-container';
    
    this.input = document.createElement('input');
    this.input.className = 'floating-chat-input';
    this.input.placeholder = 'Ask a question...';
    this.input.type = 'text';
    
    this.inputContainer.appendChild(this.input);

    // Assemble the component
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(this.inputContainer);

    // Set up event listeners now that elements are created
    this.setupEventListeners();

    console.log('[FLOATING CHAT UI] Chat UI element rendered and ready.');
    return this.container;
  }

  setupEventListeners() {
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Add focus listeners to help with event propagation
    this.input.addEventListener('focus', (e) => e.stopPropagation());
    this.container.addEventListener('keydown', (e) => e.stopPropagation());
  }

  addMessage(content, type = 'assistant') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-chat-message ${type}`;
    // Basic markdown for bolding and newlines
    messageDiv.innerHTML = content
        .replace(new RegExp('\\*\\*(.*?)\\*\\*', 'g'), '<b>$1</b>')
        .replace(/\n/g, '<br>');

    this.messagesContainer.appendChild(messageDiv);
    this.messages.push({ content, type });
    
    // Auto-scroll to bottom
    this.scrollToBottom();
  }

  scrollToBottom() {
    // Only auto-scroll if the user is near the bottom
    const isScrolledNearBottom = this.messagesContainer.scrollHeight - this.messagesContainer.clientHeight <= this.messagesContainer.scrollTop + 100;

    if (isScrolledNearBottom) {
      requestAnimationFrame(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      });
    }
  }

  showTypingIndicator() {
    this.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'floating-chat-typing-indicator';
    typingDiv.innerHTML = `
      <span>Stamp is thinking</span>
      <div class="floating-chat-typing-dots">
        <div class="floating-chat-typing-dot"></div>
        <div class="floating-chat-typing-dot"></div>
        <div class="floating-chat-typing-dot"></div>
      </div>
    `;
    typingDiv.id = 'typing-indicator';
    this.messagesContainer.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingIndicator = this.messagesContainer.querySelector('#typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;

    // Add user message
    this.addMessage(message, 'user');
    this.input.value = '';

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Make API call
      const response = await this.apiClient.makeAuthenticatedRequest('/api/finops/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: message,
          userEmail: await this.authService.getUserEmail(),
          installationId: await this.authService.getInstallationId(),
        }),
      });

      // Hide typing indicator
      this.hideTypingIndicator();

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        await this.handleStreamingResponse(response);
      } else {
        const data = await response.json();
        this.handleJsonResponse(data);
      }
    } catch (error) {
      console.error('[FLOATING CHAT] Error sending message:', error);
      this.hideTypingIndicator();
      this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
  }

  handleJsonResponse(data) {
    console.log('[FLOATING CHAT] Handling JSON response');
    console.log('[FLOATING CHAT] Parsed response data:', data);

    if (data.response) {
      this.addMessage(data.response, 'assistant');
    } else if (data.AGENT_OUTPUT) {
      this.addMessage(data.AGENT_OUTPUT, 'assistant');
    } else if (data.answer) {
      this.addMessage(data.answer, 'assistant');
    } else {
      console.warn('[FLOATING CHAT] No recognized response format found in:', data);
      this.addMessage('I received your question but no response was provided.', 'assistant');
    }
  }

  async handleStreamingResponse(response) {
    console.log('[FLOATING CHAT] Handling streaming response');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let assistantMessageDiv = null;
    let fullResponse = '';

    const processLine = (line) => {
        if (!line.startsWith('data: ')) {
            return;
        }
        const jsonString = line.substring(6).trim();
        if (!jsonString) {
            return;
        }

        try {
            const event = JSON.parse(jsonString);
            const { type, data } = event;

            if (type === 'reasoning') {
                const reasoningDiv = document.createElement('div');
                reasoningDiv.className = 'floating-chat-message assistant reasoning';
                reasoningDiv.innerHTML = data.content
                    .replace(new RegExp('\\*\\*(.*?)\\*\\*', 'g'), '<b>$1</b>')
                    .replace(/\n/g, '<br>');
                this.messagesContainer.appendChild(reasoningDiv);
                this.scrollToBottom();
            } else if (type === 'content') {
                if (!assistantMessageDiv) {
                    assistantMessageDiv = document.createElement('div');
                    assistantMessageDiv.className = 'floating-chat-message assistant';
                    this.messagesContainer.appendChild(assistantMessageDiv);
                }

                if (data.is_final) {
                    fullResponse = data.content;
                } else {
                    fullResponse += data.content;
                }

                assistantMessageDiv.innerHTML = fullResponse
                    .replace(new RegExp('\\*\\*(.*?)\\*\\*', 'g'), '<b>$1</b>')
                    .replace(/\n/g, '<br>');

                this.scrollToBottom();
            }
            // All other event types are ignored.
        } catch (e) {
            console.error('Error parsing streaming event:', e, `"${jsonString}"`);
        }
    };

    const processText = async () => {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                if (buffer) processLine(buffer);
                // Add the final message to history
                if (fullResponse) {
                    this.messages.push({ content: fullResponse, type: 'assistant' });
                }
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep last partial line
            for (const line of lines) {
                if (line.trim()) {
                    processLine(line);
                }
            }
        }
    };

    await processText();
  }

  destroy() {
    // The MoleView's destroy method handles removing the element from the DOM.
    // We just need to null out our references.
    console.log('[FLOATING CHAT UI] Destroying chat UI instance.');
    this.messagesContainer = null;
    this.inputContainer = null;
    this.input = null;
    this.container = null;
  }
}

class FloatingChatManager {
  constructor(uiManager) {
    console.log('[FLOATING CHAT MANAGER] Constructor called with uiManager:', uiManager);
    this.uiManager = uiManager;
    this.floatingChat = null;
    this.isEnabled = false;
    
    this.init();
  }

  init() {
    console.log('[FLOATING CHAT MANAGER] Initializing...');
    // Load CSS
    this.loadCSS();
    
    // Initialize floating chat when user is authenticated
    this.uiManager.authService.getAuthState().then(authState => {
      console.log('[FLOATING CHAT MANAGER] Auth state:', authState);
      if (authState.isLoggedIn) {
        console.log('[FLOATING CHAT MANAGER] User is logged in, enabling floating chat');
        this.enableFloatingChat();
      } else {
        console.log('[FLOATING CHAT MANAGER] User is not logged in, skipping floating chat');
      }
    }).catch(error => {
      console.error('[FLOATING CHAT MANAGER] Failed to get auth state:', error);
    });

    // Listen for auth state changes
    this.setupAuthListener();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  loadCSS() {
    console.log('[FLOATING CHAT MANAGER] Loading CSS...');
    // Inject CSS if not already loaded
    if (!document.querySelector('#floating-chat-css')) {
      const link = document.createElement('link');
      link.id = 'floating-chat-css';
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('floating-chat/floating-chat.css');
      console.log('[FLOATING CHAT MANAGER] CSS URL:', link.href);
      document.head.appendChild(link);
      console.log('[FLOATING CHAT MANAGER] CSS loaded');
    } else {
      console.log('[FLOATING CHAT MANAGER] CSS already loaded');
    }
  }

  setupAuthListener() {
    // Listen for auth state changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.installationId) {
        const newValue = changes.installationId.newValue;
        if (newValue && !this.isEnabled) {
          this.enableFloatingChat();
        } else if (!newValue && this.isEnabled) {
          this.disableFloatingChat();
        }
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + C: Toggle floating chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        this.toggleFloatingChat();
      }
      
      // Escape: Minimize floating chat (MoleView handles this natively)
    });
  }

  enableFloatingChat() {
    console.log('[FLOATING CHAT MANAGER] enableFloatingChat called, isEnabled:', this.isEnabled);
    if (this.isEnabled) {
      console.log('[FLOATING CHAT MANAGER] Already enabled, returning');
      return;
    }
    
    try {
      // Step 1: Create an instance of our chat UI builder.
      this.chatUI = new FloatingChat(
        this.uiManager.apiClient,
        this.uiManager.authService
      );

      // Step 2: Render the chat UI to get the complete HTML element.
      const chatElement = this.chatUI.render();
      
      console.log('[FLOATING CHAT MANAGER] Creating MoleView with pre-built chat element...');
      
      // Step 3: Show the MoleView and pass the fully constructed element to it.
      // This is the correct pattern.
      this.moleView = this.uiManager.sdk.Widgets.showMoleView({
        title: 'Stamp Chat',
        el: chatElement,
        minimized: false, // Start un-minimized to be visible
      });

      // Keep a reference for toggling, but don't interact with its elements.
      this.floatingChat = this.moleView;
      this.isEnabled = true;
      
      console.log('[FLOATING CHAT MANAGER] MoleView created successfully.');
      
      // Add a welcome message after a short delay.
      setTimeout(() => {
        if (this.chatUI) {
          console.log('[FLOATING CHAT MANAGER] Adding welcome message...');
          this.chatUI.addMessage(
            "Hello! I'm Stamp, your AI assistant. How can I help?",
            'assistant'
          );
        }
      }, 500);
      
    } catch (error) {
      console.error('[FLOATING CHAT MANAGER] Failed to enable floating chat:', error);
      console.error('[FLOATING CHAT MANAGER] Error stack:', error.stack);
    }
  }

  disableFloatingChat() {
    if (!this.isEnabled) return;
    
    if (this.moleView) {
      this.moleView.destroy();
      this.moleView = null;
    }
    
    // Also clean up the chat UI instance if it exists
    if (this.chatUI) {
        this.chatUI = null;
    }

    this.floatingChat = null;
    this.isEnabled = false;
    console.log('[FLOATING CHAT] Disabled floating chat');
  }

  toggleFloatingChat() {
    if (!this.moleView) {
      this.enableFloatingChat();
      return;
    }

    if (this.moleView.isMinimized()) {
      this.moleView.setMinimized(false);
    } else {
      this.moleView.setMinimized(true);
    }
  }

  showFloatingChat() {
    if (this.moleView) {
      this.moleView.setMinimized(false);
    } else {
      this.enableFloatingChat();
    }
  }

  hideFloatingChat() {
    if (this.moleView) {
      this.moleView.setMinimized(true);
    }
  }

  // Method to add a message programmatically (for testing)
  addMessage(content, type = 'assistant') {
    if (this.chatUI) {
      this.chatUI.addMessage(content, type);
    }
  }

  // Method to get current state
  getState() {
    if (!this.moleView) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      isMinimized: this.moleView.isMinimized(),
      messageCount: this.chatUI ? this.chatUI.messages.length : 0
      // Position is now handled by MoleView, so we don't track it
    };
  }

  // Method to reset floating chat
  reset() {
    this.disableFloatingChat();
    
    // Clear stored state (if any was used for the old chat)
    chrome.storage.local.remove(['floatingChatState'], () => {
      console.log('[FLOATING CHAT] State cleared');
    });
  }
}
*/

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
// Define CONFIG object if not injected by build script
if (typeof CONFIG === 'undefined') {
  globalThis.CONFIG = {
    API_ENDPOINT: 'https://nmuo25f2da.execute-api.us-east-2.amazonaws.com/prod',
    AUTH_ENDPOINT: 'https://70h4jbuv95.execute-api.us-east-2.amazonaws.com/prod/email-poller',
    CLIENT_ID: '759225635526-gs69pgupgap87o4ul9ud9pv8pjrupcgc.apps.googleusercontent.com',
    CLIENT_SECRET: null,
    CHROME_CLIENT_ID: '759225635526-gs69pgupgap87o4ul9ud9pv8pjrupcgc.apps.googleusercontent.com'
  };
}

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
      // Build the backend endpoint
      const endpoint = `/api/finops/files/gmail/attachment?thread_id=${encodeURIComponent(threadId)}&filename=${encodeURIComponent(documentName)}`;
      const backendUrl = `${this.baseUrl}${endpoint}`;
      
      console.log('[API] 📄 Fetching PDF from backend:', backendUrl);
      
      // Use background script to bypass CORS restrictions
      console.log('[API] 🔄 Sending fetch request to background script...');
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'fetchFileForPreview',
          url: backendUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[API] ❌ Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.success) {
            console.log('[API] ✅ Background script response received:', {
              hasDataUrl: !!response.dataUrl,
              mimeType: response.mimeType,
              fileSize: response.fileSize,
              originalUrl: response.originalUrl
            });
            
            // Convert data URL back to blob
            const byteCharacters = atob(response.dataUrl.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.mimeType || 'application/pdf' });
            
            console.log('[API] 🔄 Data URL converted back to blob:', {
              type: blob.type,
              size: blob.size,
              sizeKB: Math.round(blob.size / 1024)
            });
            
            resolve(blob);
          } else {
            console.error('[API] ❌ Background script error:', response.error);
            reject(new Error(response.error || 'Failed to fetch file'));
          }
        });
      });

      console.log('[API] ✅ Successfully received PDF from backend.');
      console.log('[API] 📊 PDF blob details:', {
        type: response.type,
        size: response.size,
        sizeKB: Math.round(response.size / 1024)
      });
      return response;
    } catch (error) {
      console.error('[API] ❌ Error fetching PDF from backend:', error);
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
  console.log('[CREATE_CARD] Creating entity card for:', cardData.title);
  console.log('[CREATE_CARD] Card data filename:', cardData.filename);
  console.log('[CREATE_CARD] Thread ID:', threadId);
  
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
        <div style="display: flex; align-items: center; gap: 8px;">
        ${statusConfig ? `
        <span class="status-tag" title="${statusConfig.description || ''}" style="display:inline-flex; align-items:center; gap:6px; background-color: ${statusConfig.backgroundColor}; color: ${statusConfig.textColor}; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; white-space:nowrap;">
          <span style=\"display:inline-block; width:8px; height:8px; border-radius:50%; background:${statusConfig.textColor === '#000000' ? '#111827' : '#ffffff'}; opacity:0.6;\"></span>
          ${cardData.status.replace(/_/g, ' ')}
        </span>
        ` : ''}
          ${cardData.filename ? (() => {
            console.log('[CREATE_CARD] Creating TEST IMAGE button for filename:', cardData.filename);
            console.log('[CREATE_CARD] Button will have data-doc-name:', cardData.filename);
            console.log('[CREATE_CARD] Button will have data-thread-id:', threadId);
            console.log('[CREATE_CARD] ✅ TEST IMAGE button HTML will be created');
            return `
          <button class="doc-preview-icon" 
                  data-doc-name="${cardData.filename}" 
                  data-thread-id="${threadId}"
                  data-doc-url=""
                  data-has-doc="1"
                  style="
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    border: 2px solid #fbbf24;
                    border-radius: 8px;
                    padding: 8px 12px;
                    cursor: pointer;
                    color: white;
                    font-size: 13px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  "
                  title="Preview Image - Click to test image preview functionality"
                  onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(245, 158, 11, 0.6)';"
                  onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(245, 158, 11, 0.4)';"
                  onclick="console.log('[DIRECT_CLICK] TEST IMAGE button clicked directly!', this);">
            🔥 TEST IMAGE
          </button>
          `;
          })() : ''}
        </div>
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
    this.pdfCache = new Map(); // PDF cache for preview functionality
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
      background: ${type === 'success' ? '#1A8A76' : type === 'error' ? '#ef4444' : '#3b82f6'};
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

  // ===== FLOATING CHAT METHODS (COMMENTED OUT) =====
  // Uncomment the following methods when you want to enable floating chat:

  /*
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
  */

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
        // this.initializeFloatingChat(); // COMMENTED OUT - Uncomment to enable floating chat
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
    console.log('[ThreadView] ===== HANDLE THREAD VIEW CALLED =====');
    const threadId = await threadView.getThreadIDAsync();
    console.log('[ThreadView] Thread ID:', threadId);
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
    let cardDataArray = threadInfo && threadInfo.processedEntities 
      ? transformProcessedEntitiesForSidebar(threadInfo.processedEntities)
      : [];

    // Always add test document for image preview testing
    console.log('[PREVIEW] Adding test document for image preview testing');
    console.log('[PREVIEW] Current threadId:', threadId);
    console.log('[PREVIEW] Current cardDataArray length before adding test:', cardDataArray.length);
    
    // Create test entity for image preview testing
    const testEntity = {
      type: 'inv',
      value: 'INV-2024-IMG-001',
      document: {
        message_id: 'test-message-456',
        thread_id: threadId,
        final_status: 'pending_approval',
        details: {
          vendor: { name: 'Test Image Vendor Inc.' },
          amount: 2500.00,
          currency: 'USD',
          filename: 'test-invoice-image.png', // This is important for image preview
          issue_date: '2024-01-20',
          due_date: '2024-02-20',
          description: 'Test invoice image for software services'
        }
      }
    };
    
    console.log('[PREVIEW] Created test entity:', testEntity);
    
    const testCardData = transformProcessedEntitiesForSidebar([testEntity]);
    console.log('[PREVIEW] Transformed test card data:', testCardData);
    console.log('[PREVIEW] Test card data filename:', testCardData[0]?.filename);
    
    cardDataArray.unshift(...testCardData); // Add test document at the beginning
    console.log('[PREVIEW] Total documents for preview (including test):', cardDataArray.length);
    console.log('[PREVIEW] Final cardDataArray:', cardDataArray);

    console.log('[ThreadView] Checking if sidebar element exists:', !!this.sidebarElement);
    if (this.sidebarElement) {
      console.log('[ThreadView] Sidebar element found, looking for preview-content');
      // Update the preview content with document data
      const previewContent = this.sidebarElement.querySelector('#preview-content');
      console.log('[ThreadView] Preview content element found:', !!previewContent);
      if (previewContent) {
        if (cardDataArray && cardDataArray.length > 0) {
          // Show document previews
          previewContent.innerHTML = this.createSidebarContent(threadId, cardDataArray);
          
          // Debug: Check if buttons were created
          setTimeout(() => {
            const testButtons = previewContent.querySelectorAll('.doc-preview-icon');
            console.log('[DEBUG] Found', testButtons.length, 'doc-preview-icon buttons in DOM');
            testButtons.forEach((btn, index) => {
              console.log(`[DEBUG] Button ${index}:`, btn);
              console.log(`[DEBUG] Button ${index} attributes:`, {
                hasDoc: btn.getAttribute('data-has-doc'),
                threadId: btn.getAttribute('data-thread-id'),
                docName: btn.getAttribute('data-doc-name')
              });
              
          // Test if button is clickable by adding a direct click test
          btn.addEventListener('click', async (e) => {
            console.log('[DIRECT_BUTTON_CLICK] Button clicked directly!', e.target);
            console.log('[DIRECT_BUTTON_CLICK] Button attributes:', {
              hasDoc: btn.getAttribute('data-has-doc'),
              threadId: btn.getAttribute('data-thread-id'),
              docName: btn.getAttribute('data-doc-name')
            });
            e.stopPropagation();
            
            // Test the preview functionality directly
            console.log('[DIRECT_BUTTON_CLICK] Testing preview functionality directly...');
            const documentName = btn.getAttribute('data-doc-name');
            const testBlob = await this.createTestBlobForFilename(documentName);
            this.showRightPreviewWithBlob(btn, testBlob);
          });
            });
            
            // Also check if the button is visible and has the right text
            const testButton = previewContent.querySelector('.doc-preview-icon');
            if (testButton) {
              console.log('[DEBUG] Test button text content:', testButton.textContent);
              console.log('[DEBUG] Test button is visible:', testButton.offsetWidth > 0 && testButton.offsetHeight > 0);
              console.log('[DEBUG] Test button computed style:', window.getComputedStyle(testButton).display);
            }
          }, 100);
          
          // Attach new event listeners for the cards
          this.attachCardClickListeners(previewContent);
        } else {
          // Show no documents message
          previewContent.innerHTML = `
            <div style="padding: 16px;">
              <div style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                <h4 style="margin: 0 0 8px 0; color: #333;">No Documents Found</h4>
                <p style="margin: 0; color: #666; font-size: 14px;">This email thread doesn't contain any recognized documents.</p>
              </div>
            </div>
          `;
        }
      } else {
        // Fallback: replace entire sidebar content (for backward compatibility)
      this.sidebarElement.innerHTML = this.createSidebarContent(threadId, cardDataArray);
      
      // Debug: Check if buttons were created (fallback case)
      setTimeout(() => {
        const testButtons = this.sidebarElement.querySelectorAll('.doc-preview-icon');
        console.log('[DEBUG_FALLBACK] Found', testButtons.length, 'doc-preview-icon buttons in DOM');
        testButtons.forEach((btn, index) => {
          console.log(`[DEBUG_FALLBACK] Button ${index}:`, btn);
          console.log(`[DEBUG_FALLBACK] Button ${index} attributes:`, {
            hasDoc: btn.getAttribute('data-has-doc'),
            threadId: btn.getAttribute('data-thread-id'),
            docName: btn.getAttribute('data-doc-name')
          });
          
          // Test if button is clickable by adding a direct click test
          btn.addEventListener('click', async (e) => {
            console.log('[DIRECT_BUTTON_CLICK_FALLBACK] Button clicked directly!', e.target);
            console.log('[DIRECT_BUTTON_CLICK_FALLBACK] Button attributes:', {
              hasDoc: btn.getAttribute('data-has-doc'),
              threadId: btn.getAttribute('data-thread-id'),
              docName: btn.getAttribute('data-doc-name')
            });
            e.stopPropagation();
            
            // Test the preview functionality directly
            console.log('[DIRECT_BUTTON_CLICK_FALLBACK] Testing preview functionality directly...');
            const documentName = btn.getAttribute('data-doc-name');
            const testBlob = await this.createTestBlobForFilename(documentName);
            this.showRightPreviewWithBlob(btn, testBlob);
          });
        });
        
        // Also check if the button is visible and has the right text
        const testButton = this.sidebarElement.querySelector('.doc-preview-icon');
        if (testButton) {
          console.log('[DEBUG_FALLBACK] Test button text content:', testButton.textContent);
          console.log('[DEBUG_FALLBACK] Test button is visible:', testButton.offsetWidth > 0 && testButton.offsetHeight > 0);
          console.log('[DEBUG_FALLBACK] Test button computed style:', window.getComputedStyle(testButton).display);
        }
      }, 100);
      
      // Attach new event listeners for the cards
      this.attachCardClickListeners(this.sidebarElement);
      }
      
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



  // Method to restore the preview interface in the sidebar
  restoreChatInterface() {
      if (this.sidebarElement) {
      console.log('[DEBUG] Restoring preview interface using this.sidebarElement');
      this.sidebarElement.innerHTML = this.createMainAppContent();
      
      // Re-attach event listeners for the preview interface
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
      <div style="color: #1A8A76; font-size: 48px; margin-bottom: 16px;">✅</div>
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
    console.log('[SIDEBAR_CONTENT] Creating sidebar content for threadId:', threadId);
    console.log('[SIDEBAR_CONTENT] Card data array length:', cardDataArray?.length);
    console.log('[SIDEBAR_CONTENT] Card data array:', cardDataArray);
    
    // Store the current card data for later use
    this._currentCardData = cardDataArray;
    
    if (cardDataArray && cardDataArray.length > 0) {
      const cardsHtml = cardDataArray.map((cardData, index) => {
        console.log(`[SIDEBAR_CONTENT] Processing card ${index}:`, cardData.title, 'filename:', cardData.filename);
        const cardHtml = createEntityCard(cardData, threadId);
        const cardWithThreadId = cardHtml.replace('class="entity-card"', `class="entity-card" data-thread-id="${threadId}"`);
        console.log(`[SIDEBAR_CONTENT] Generated HTML for card ${index} (first 200 chars):`, cardWithThreadId.substring(0, 200) + '...');
        
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
    console.log('[CARD_CLICKS] Container has doc-preview-icon elements:', container.querySelectorAll('.doc-preview-icon').length);
    console.log('[CARD_CLICKS] Container innerHTML preview:', container.innerHTML.substring(0, 200) + '...');
    
    // Remove any existing click listeners
    container.removeEventListener('click', this._cardClickHandler);
    
    // Create a bound version of the click handler
    this._cardClickHandler = async (event) => {
        console.log('[CARD_CLICKS] Click handler triggered! Event target:', event.target);
        console.log('[CARD_CLICKS] Event type:', event.type);
        console.log('[CARD_CLICKS] Event currentTarget:', event.currentTarget);
        console.log('[CARD_CLICKS] Click event detected on:', event.target);
        
        // Check for PDF preview icon click first
        const icon = event.target.closest('.doc-preview-icon');
        if (icon) {
            console.log('[DOC] Found doc icon:', icon);
            console.log('[DOC] Icon attributes:', {
                hasDoc: icon.getAttribute('data-has-doc'),
                threadId: icon.getAttribute('data-thread-id'),
                docName: icon.getAttribute('data-doc-name')
            });
            
            const hasDoc = icon.getAttribute('data-has-doc') === '1';
            console.log('[DOC] Has document:', hasDoc);
            
            if (!hasDoc) return;

            const threadId = icon.getAttribute('data-thread-id');
            const documentName = icon.getAttribute('data-doc-name');
            
            // Use blob preview functionality
            console.log('[DOC] Using blob preview functionality');
            
            if (threadId && documentName && this.apiClient) {
                const cacheKey = `${threadId}|${documentName}`;
                
                // Try cache first
                let cachedBlob = this.pdfCache.get(cacheKey);
                if (cachedBlob) {
                    console.log('[DOC] Using cached PDF blob');
                    this.showRightPreviewWithBlob(icon, cachedBlob);
                    return;
                }
                
                // No cache: fetch via backend
                try {
                    console.log('[DOC] Fetching PDF from backend:', { threadId, documentName });
                    const blob = await this.apiClient.fetchGmailAttachmentPdf({ threadId, documentName });
                    
                    // Small LRU: cap at 25 items
                    if (this.pdfCache.size > 25) {
                        const firstKey = this.pdfCache.keys().next().value;
                        this.pdfCache.delete(firstKey);
                    }
                    this.pdfCache.set(cacheKey, blob);
                    
                    console.log('[DOC] PDF fetched successfully, showing blob preview');
                    this.showRightPreviewWithBlob(icon, blob);
                } catch (err) {
                    console.error('[DOC] Failed to fetch PDF from backend:', err);
                    console.log('[TEST] Using test blob for preview functionality testing');
                    
                    // Use appropriate test blob based on file type
                    const testBlob = await this.createTestBlobForFilename(documentName);
                    
                    // Cache the test PDF
                    if (this.pdfCache.size > 25) {
                        const firstKey = this.pdfCache.keys().next().value;
                        this.pdfCache.delete(firstKey);
                    }
                    this.pdfCache.set(cacheKey, testBlob);
                    
                    console.log('[TEST] Showing test PDF preview');
                    this.showRightPreviewWithBlob(icon, testBlob);
                }
            } else {
                // No backend fetch available - use appropriate test blob for testing
                console.log('[DOC] No backend fetch available, using test blob for testing');
                const testBlob = await this.createTestBlobForFilename(documentName);
                console.log('[TEST] Showing test blob preview (no backend)');
                this.showRightPreviewWithBlob(icon, testBlob);
            }
            return; // Exit early for PDF preview clicks
        }
        
        // Handle regular card clicks
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
    console.log('[CARD_CLICKS] Click listeners attached successfully');
    console.log('[CARD_CLICKS] Event listener attached to container:', container);
    console.log('[CARD_CLICKS] Handler function:', this._cardClickHandler);
  }

  // Method to attach preview event listeners
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

    // PDF Preview functionality moved to attachCardClickListeners for proper re-attachment

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

    // Preview functionality - no additional event listeners needed for now
    // The preview content will be updated when threads are opened

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

  // PDF Preview functionality - display in sidebar panel instead of modal
  showRightPreviewWithBlob(iconEl, blob) {
    console.log('[PREVIEW] showRightPreviewWithBlob called with iconEl:', iconEl);
    console.log('[PREVIEW] showRightPreviewWithBlob called with blob:', blob);
    console.log('[PREVIEW] Blob type:', blob?.type, 'size:', blob?.size);
    
    const docName = iconEl.getAttribute('data-doc-name') || 'Document';
    
    console.log('[PREVIEW] Document name:', docName);
    console.log('[PREVIEW] Displaying preview in sidebar panel instead of modal');
    
    // Check if sidebar element exists
    if (!this.sidebarElement) {
      console.error('[PREVIEW] Sidebar element not available. Trying to find it...');
      
      // Try to find the sidebar element in the DOM
      const sidebarEl = document.querySelector('#stamp-sidebar-panel');
      if (sidebarEl) {
        console.log('[PREVIEW] Found sidebar element in DOM, using it');
        this.sidebarElement = sidebarEl;
      } else {
        console.error('[PREVIEW] Sidebar element not found in DOM. Cannot display preview.');
        return;
      }
    }

    // Use FileReader to convert blob to data URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      
      console.log('[PREVIEW] ✅ Blob converted to data URL, updating sidebar content');
      
      // Create appropriate element based on file type
      let displayEl;
      if (blob.type === 'application/pdf') {
        // For PDFs, use iframe (correct approach) - full size
        console.log('[PREVIEW] Creating iframe for PDF display in sidebar');
        displayEl = document.createElement('iframe');
        displayEl.src = dataUrl;
        displayEl.style.cssText = 'width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0; z-index: 1;';
        displayEl.setAttribute('type', 'application/pdf');
      } else if (blob.type.startsWith('image/')) {
        // For images, use img element - full size
        console.log('[PREVIEW] Creating image element for image display in sidebar');
        displayEl = document.createElement('img');
        displayEl.src = dataUrl;
        displayEl.style.cssText = 'width: 100%; height: 100%; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 1;';
      } else {
        // For other file types, show a message - full size
        console.log('[PREVIEW] Creating fallback element for unsupported file type in sidebar');
        displayEl = document.createElement('div');
        displayEl.style.cssText = 'padding: 20px; text-align: center; color: #666; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; position: absolute; top: 0; left: 0; z-index: 1;';
        displayEl.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">${docName}</div>
          <div style="font-size: 14px;">File type: ${blob.type}</div>
          <div style="font-size: 12px; margin-top: 8px; color: #999;">Preview not available for this file type</div>
        `;
      }
      
      // Create the preview content with header and close button - FULL PANEL
      const previewContent = `
        <div style="display: flex; flex-direction: column; height: 100vh; width: 100%;">
          <!-- Header with title and close button -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e0e0e0; background: #f8f9fa; flex-shrink: 0;">
            <div style="font-weight: 600; color: #333;">${docName}</div>
            <button id="close-preview-btn" style="
              background: none; 
              border: none; 
              font-size: 18px; 
              cursor: pointer; 
              color: #666; 
              padding: 4px 8px;
              border-radius: 4px;
              transition: background-color 0.2s;
            " onmouseover="this.style.backgroundColor='#e0e0e0'" onmouseout="this.style.backgroundColor='transparent'">
              ✕
            </button>
          </div>
          
          <!-- Preview content area - FULL HEIGHT -->
          <div id="preview-content-area" style="flex: 1; width: 100%; height: calc(100vh - 60px); overflow: hidden; position: relative; background: #fff;">
          </div>
        </div>
      `;
      
      // Update the sidebar content
      this.sidebarElement.innerHTML = previewContent;
      
      // Insert the display element into the preview area
      const previewArea = this.sidebarElement.querySelector('#preview-content-area');
      if (previewArea) {
        previewArea.appendChild(displayEl);
        console.log('[PREVIEW] ✅ Display element inserted into full preview area');
      } else {
        console.error('[PREVIEW] Could not find preview content area to insert display element');
      }
      
      // Add close button functionality
      const closeBtn = this.sidebarElement.querySelector('#close-preview-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          console.log('[PREVIEW] Close button clicked, resetting sidebar to default');
          this.resetSidebarToDefault();
        });
      }
      
      console.log('[PREVIEW] ✅ Sidebar content updated with preview');
    };
    
    console.log('[PREVIEW] Converting blob to data URL...');
    reader.readAsDataURL(blob);
  }

  // Reset sidebar to default state
  resetSidebarToDefault() {
    if (!this.sidebarElement) {
      // Try to find the sidebar element in the DOM
      const sidebarEl = document.querySelector('#stamp-sidebar-panel');
      if (sidebarEl) {
        this.sidebarElement = sidebarEl;
      } else {
        return;
      }
    }
    
    console.log('[PREVIEW] Resetting sidebar to default state');
    
    this.sidebarElement.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: center; align-items: center; text-align: center; padding: 20px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #333;">Document Preview</div>
        <div style="font-size: 14px;">Open an email thread to view document previews and details.</div>
      </div>
    `;
  }

  // hideRightPreview function removed - using InboxSDK modal instead

  // Create a test PDF blob for testing purposes
  createTestPdfBlob() {
    console.log('[TEST_PDF] Creating test PDF blob...');
    // Create a simple PDF content as a string
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
100 700 Td
(Test Invoice Document) Tj
0 -50 Td
/F1 12 Tf
(Invoice #: INV-2024-001) Tj
0 -20 Td
(Vendor: Test Vendor Inc.) Tj
0 -20 Td
(Amount: $1,250.75) Tj
0 -20 Td
(Date: 2024-01-15) Tj
0 -20 Td
(Description: Test invoice for software services) Tj
0 -20 Td
(This is a test PDF created for preview functionality testing.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000525 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
610
%%EOF`;

    // Convert PDF string to blob
    const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
    console.log('[TEST] Created test PDF blob:', {
      type: pdfBlob.type,
      size: pdfBlob.size,
      sizeKB: Math.round(pdfBlob.size / 1024)
    });
    
    return pdfBlob;
  }

  // Create a test image blob for testing image preview functionality
  createTestImageBlob() {
    console.log('[TEST_IMAGE] Creating test image blob...');
    
    // Create a simple test image using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, '#4F46E5');
    gradient.addColorStop(1, '#7C3AED');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);
    
    // Add some text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Test Image Document', 200, 80);
    
    ctx.font = '16px Arial';
    ctx.fillText('Invoice #: INV-2024-IMG-001', 200, 120);
    ctx.fillText('Vendor: Test Image Vendor Inc.', 200, 150);
    ctx.fillText('Amount: $2,500.00', 200, 180);
    ctx.fillText('Date: 2024-01-20', 200, 210);
    ctx.fillText('This is a test image for preview functionality', 200, 250);
    
    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        console.log('[TEST_IMAGE] Created test image blob:', {
          type: blob.type,
          size: blob.size,
          sizeKB: Math.round(blob.size / 1024)
        });
        resolve(blob);
      }, 'image/png');
    });
  }

  // Helper function to create image test blob (replacing PDF test)
  async createTestBlobForFilename(filename) {
    console.log('[TEST_BLOB] Creating image test blob for filename:', filename);
    console.log('[TEST_BLOB] Using image test blob (replaced PDF test)');
    return await this.createTestImageBlob();
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
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuMDAwMDEgMTcuOTk5OEMxMy45NzQ0IDE3Ljk5OTggMTcuOTk5OSAxMy45NzQ0IDE3Ljk5OTkgOS4wMDAwMUMxNy45OTk5IDQuMDI1NTcgMTMuOTc0NCAwIDkuMDAwMDEgMEM0LjAyNTU3IDAgMCA0LjAyNTU3IDAgOS4wMDAwMUMwIDEzLjk3NDQgNC4wMjU1NyAxNy45OTk4IDkuMDAwMDEgMTcuOTk5OFoiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTkuMDAwMDEgMTcuOTk5OEMxMy45NzQ0IDE3Ljk5OTggMTcuOTk5OSAxMy45NzQ0IDE3Ljk5OTkgOS4wMDAwMUMxNy45OTk5IDQuMDI1NTcgMTMuOTc0NCAwIDkuMDAwMDEgMEM0LjAyNTU3IDAgMCA0LjAyNTU3IDAgOS4wMDAwMUMwIDEzLjk3NDQgNC4yNTU3IDE3Ljk5OTggOS4wMDAwMSAxNy45OTk4WiIgZmlsbD0iIzQyODVGNCIvPgo8L3N2Zz4K" alt="Google Logo" style="width: 18px; height: 18px; margin-right: 12px;">
            Sign in with Google
          </button>
        </div>
      `;
  }

  createMainAppContent() {
        console.log('[MAIN_APP] ===== CREATING MAIN APP CONTENT =====');
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
                                background: linear-gradient(135deg, #1A8A76 0%, #167866 100%);
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
                                ">Document Preview</p>
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

                <!-- Main Content - Preview Interface -->
                        <div style="
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 80px);
                    padding: 0;
                ">
                    <!-- Preview Content Area -->
                    <div id="preview-content" style="
                        flex: 1;
                        padding: 0;
                                overflow-y: auto;
                                background: #ffffff;
                            ">
                        <div style="padding: 16px;">
                            <div style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                                <h4 style="margin: 0 0 8px 0; color: #333;">Document Preview</h4>
                                <p style="margin: 0; color: #666; font-size: 14px;">Open an email thread to view document previews and details.</p>
                                    </div>
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
                        border-color: #1A8A76;
                        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                        outline: none;
                    }
                    
                    #send-question-btn:hover {
                        background: linear-gradient(135deg, #167866 0%, #3BAE9A 100%);
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
    console.log('[UI DEBUG] ===== RENDER MAIN VIEW CALLED =====');
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

InboxSDK.load(2, 'sdk_stamp-extension_0b8df882e1').then((sdk) => {
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

    // Check authentication first
    try {
      const authState = await uiManager.authService.getAuthState();
      if (!authState.isLoggedIn) {
        console.log('[UI DEBUG] User not authenticated, showing login view in route');
        // Show login content in the route
        container.innerHTML = uiManager.createLoginContent();
        
        // Set up login button event listener
        const signInBtn = container.querySelector('#google-signin-btn');
        if (signInBtn) {
          signInBtn.addEventListener('click', async () => {
            console.log('[UI] "Sign in with Google" button clicked from route');
            const loadingIndicator = container.querySelector('#loading-indicator');
            const errorIndicator = container.querySelector('#error-indicator');
            
            if (loadingIndicator) loadingIndicator.style.display = 'block';
            if (errorIndicator) errorIndicator.style.display = 'none';
            
            try {
              await uiManager.authService.signInWithGoogle();
              // After successful login, reload the route
              console.log('[UI] Login successful, reloading route');
              sdk.Router.goto('invoice-tracker-view');
            } catch (error) {
              console.error('[UI] Sign-in failed:', error);
              if (loadingIndicator) loadingIndicator.style.display = 'none';
              if (errorIndicator) {
                errorIndicator.style.display = 'block';
                errorIndicator.textContent = `Sign-in failed: ${error.message}. Please try again.`;
              }
            }
          });
        }
        return; // Exit early, don't try to load invoices
      }
    } catch (error) {
      console.error('[UI] Failed to check auth state:', error);
      // Show login view as fallback
      container.innerHTML = uiManager.createLoginContent();
      return;
    }

    // User is authenticated, proceed with invoice loading
    console.log('[UI DEBUG] User is authenticated, loading invoice data');

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

  // ===== FLOATING CHAT GLOBAL FUNCTIONS (COMMENTED OUT) =====
  // Uncomment the following functions when you want to enable floating chat:

  /*
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
  */

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