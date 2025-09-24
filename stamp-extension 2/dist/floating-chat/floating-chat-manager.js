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

// Make FloatingChatManager globally available
window.FloatingChatManager = FloatingChatManager; 