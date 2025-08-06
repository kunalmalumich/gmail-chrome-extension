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
      
      // Escape: Minimize floating chat
      if (e.key === 'Escape' && this.floatingChat && !this.floatingChat.isMinimized) {
        e.preventDefault();
        this.floatingChat.minimize();
      }
    });
  }

  enableFloatingChat() {
    console.log('[FLOATING CHAT MANAGER] enableFloatingChat called, isEnabled:', this.isEnabled);
    if (this.isEnabled) {
      console.log('[FLOATING CHAT MANAGER] Already enabled, returning');
      return;
    }
    
    try {
      console.log('[FLOATING CHAT MANAGER] Creating FloatingChat instance...');
      console.log('[FLOATING CHAT MANAGER] apiClient:', this.uiManager.apiClient);
      console.log('[FLOATING CHAT MANAGER] authService:', this.uiManager.authService);
      
      this.floatingChat = new FloatingChat(
        this.uiManager.apiClient,
        this.uiManager.authService
      );
      this.isEnabled = true;
      
      console.log('[FLOATING CHAT MANAGER] FloatingChat created successfully:', this.floatingChat);
      
      // Add welcome message
      setTimeout(() => {
        if (this.floatingChat) {
          console.log('[FLOATING CHAT MANAGER] Adding welcome message...');
          this.floatingChat.addMessage(
            'Hello! I\'m Stamp, your AI assistant for invoice and payment queries. How can I help you today?',
            'assistant'
          );
        }
      }, 1000);
      
    } catch (error) {
      console.error('[FLOATING CHAT MANAGER] Failed to enable floating chat:', error);
      console.error('[FLOATING CHAT MANAGER] Error stack:', error.stack);
    }
  }

  disableFloatingChat() {
    if (!this.isEnabled) return;
    
    if (this.floatingChat) {
      this.floatingChat.destroy();
      this.floatingChat = null;
    }
    
    this.isEnabled = false;
    console.log('[FLOATING CHAT] Disabled floating chat');
  }

  toggleFloatingChat() {
    if (!this.floatingChat) {
      this.enableFloatingChat();
      return;
    }

    if (this.floatingChat.isMinimized) {
      this.floatingChat.expand();
    } else {
      this.floatingChat.minimize();
    }
  }

  showFloatingChat() {
    if (this.floatingChat) {
      this.floatingChat.expand();
    } else {
      this.enableFloatingChat();
    }
  }

  hideFloatingChat() {
    if (this.floatingChat) {
      this.floatingChat.minimize();
    }
  }

  // Method to add a message programmatically (for testing)
  addMessage(content, type = 'assistant') {
    if (this.floatingChat) {
      this.floatingChat.addMessage(content, type);
    }
  }

  // Method to get current state
  getState() {
    if (!this.floatingChat) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      isMinimized: this.floatingChat.isMinimized,
      isExpanded: this.floatingChat.isExpanded,
      position: this.floatingChat.position,
      messageCount: this.floatingChat.messages.length
    };
  }

  // Method to reset floating chat
  reset() {
    if (this.floatingChat) {
      this.floatingChat.destroy();
      this.floatingChat = null;
    }
    
    // Clear stored state
    chrome.storage.local.remove(['floatingChatState'], () => {
      console.log('[FLOATING CHAT] State cleared');
    });
    
    this.isEnabled = false;
  }
}

// Make FloatingChatManager globally available
window.FloatingChatManager = FloatingChatManager; 