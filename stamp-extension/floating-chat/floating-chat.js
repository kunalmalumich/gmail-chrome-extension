class FloatingChat {
  constructor(apiClient, authService) {
    console.log('[FLOATING CHAT] Constructor called');
    console.log('[FLOATING CHAT] apiClient:', apiClient);
    console.log('[FLOATING CHAT] authService:', authService);
    
    this.apiClient = apiClient;
    this.authService = authService;
    this.isMinimized = false;
    this.isExpanded = false;
    this.isDragging = false;
    this.position = { x: 20, y: 20 };
    this.dragOffset = { x: 0, y: 0 };
    this.messages = [];
    this.isTyping = false;
    
    console.log('[FLOATING CHAT] Creating floating element...');
    this.createFloatingElement();
    console.log('[FLOATING CHAT] Loading state...');
    this.loadState();
    console.log('[FLOATING CHAT] Setting up event listeners...');
    this.setupEventListeners();
    console.log('[FLOATING CHAT] Constructor completed');
  }

  createFloatingElement() {
    console.log('[FLOATING CHAT] createFloatingElement called');
    
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'floating-chat-container minimized';
    this.container.style.left = `${this.position.x}px`;
    this.container.style.top = `${this.position.y}px`;
    console.log('[FLOATING CHAT] Container created:', this.container);

    // Create header
    const header = document.createElement('div');
    header.className = 'floating-chat-header';
    
    const title = document.createElement('div');
    title.className = 'floating-chat-title';
    title.innerHTML = `
      <div class="stamp-icon">S</div>
      <span>Stamp Chat</span>
    `;
    
    const controls = document.createElement('div');
    controls.className = 'floating-chat-controls';
    
    this.minimizeBtn = document.createElement('button');
    this.minimizeBtn.className = 'floating-chat-btn';
    this.minimizeBtn.innerHTML = '−';
    this.minimizeBtn.title = 'Minimize';
    
    this.maximizeBtn = document.createElement('button');
    this.maximizeBtn.className = 'floating-chat-btn';
    this.maximizeBtn.innerHTML = '□';
    this.maximizeBtn.title = 'Maximize';
    
    controls.appendChild(this.minimizeBtn);
    controls.appendChild(this.maximizeBtn);
    
    header.appendChild(title);
    header.appendChild(controls);

    // Create content area
    this.content = document.createElement('div');
    this.content.className = 'floating-chat-content';
    this.content.style.display = 'none';

    // Create messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'floating-chat-messages';

    // Create input container
    this.inputContainer = document.createElement('div');
    this.inputContainer.className = 'floating-chat-input-container';
    
    this.input = document.createElement('input');
    this.input.className = 'floating-chat-input';
    this.input.placeholder = 'Ask about invoices, payments, or anything...';
    this.input.type = 'text';
    
    this.inputContainer.appendChild(this.input);

    // Create minimized content
    this.minimizedContent = document.createElement('div');
    this.minimizedContent.className = 'floating-chat-minimized-content';
    this.minimizedContent.textContent = 'Click to chat with Stamp';

    // Assemble the component
    this.content.appendChild(this.messagesContainer);
    this.content.appendChild(this.inputContainer);
    
    this.container.appendChild(header);
    this.container.appendChild(this.content);
    this.container.appendChild(this.minimizedContent);

    // Add to DOM
    console.log('[FLOATING CHAT] Adding container to DOM...');
    document.body.appendChild(this.container);
    console.log('[FLOATING CHAT] Container added to DOM. Container:', this.container);
    console.log('[FLOATING CHAT] Container visible:', this.container.offsetWidth > 0 && this.container.offsetHeight > 0);
    console.log('[FLOATING CHAT] Container position:', this.container.style.left, this.container.style.top);
  }

  setupEventListeners() {
    // Header drag events
    const header = this.container.querySelector('.floating-chat-header');
    
    header.addEventListener('mousedown', (e) => {
      this.startDragging(e);
    });

    header.addEventListener('touchstart', (e) => {
      this.startDragging(e);
    });

    // Minimize/Maximize buttons
    this.minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    this.maximizeBtn.addEventListener('click', () => this.toggleMaximize());

    // Minimized content click
    this.minimizedContent.addEventListener('click', () => {
      if (this.isMinimized) {
        this.expand();
      }
    });

    // Input events
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Global mouse/touch events for dragging
    document.addEventListener('mousemove', (e) => this.onDrag(e));
    document.addEventListener('mouseup', () => this.stopDragging());
    document.addEventListener('touchmove', (e) => this.onDrag(e));
    document.addEventListener('touchend', () => this.stopDragging());
  }

  startDragging(e) {
    this.isDragging = true;
    const rect = this.container.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    this.dragOffset.x = clientX - rect.left;
    this.dragOffset.y = clientY - rect.top;
    
    this.container.style.cursor = 'grabbing';
  }

  onDrag(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    const newX = clientX - this.dragOffset.x;
    const newY = clientY - this.dragOffset.y;
    
    // Boundary checking
    const maxX = window.innerWidth - this.container.offsetWidth;
    const maxY = window.innerHeight - this.container.offsetHeight;
    
    this.position.x = Math.max(0, Math.min(newX, maxX));
    this.position.y = Math.max(0, Math.min(newY, maxY));
    
    this.container.style.left = `${this.position.x}px`;
    this.container.style.top = `${this.position.y}px`;
  }

  stopDragging() {
    if (this.isDragging) {
      this.isDragging = false;
      this.container.style.cursor = 'move';
      this.saveState();
    }
  }

  toggleMinimize() {
    if (this.isMinimized) {
      this.expand();
    } else {
      this.minimize();
    }
  }

  toggleMaximize() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  minimize() {
    this.isMinimized = true;
    this.isExpanded = false;
    this.container.className = 'floating-chat-container minimized';
    this.content.style.display = 'none';
    this.minimizedContent.style.display = 'flex';
    this.maximizeBtn.innerHTML = '□';
    this.maximizeBtn.title = 'Maximize';
    this.saveState();
  }

  expand() {
    this.isMinimized = false;
    this.isExpanded = true;
    this.container.className = 'floating-chat-container expanded';
    this.content.style.display = 'flex';
    this.minimizedContent.style.display = 'none';
    this.maximizeBtn.innerHTML = '□';
    this.maximizeBtn.title = 'Collapse';
    this.input.focus();
    this.saveState();
  }

  collapse() {
    this.isMinimized = false;
    this.isExpanded = false;
    this.container.className = 'floating-chat-container';
    this.content.style.display = 'flex';
    this.minimizedContent.style.display = 'none';
    this.maximizeBtn.innerHTML = '□';
    this.maximizeBtn.title = 'Maximize';
    this.saveState();
  }

  addMessage(content, type = 'assistant') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-chat-message ${type}`;
    messageDiv.textContent = content;
    
    this.messagesContainer.appendChild(messageDiv);
    this.messages.push({ content, type });
    
    // Auto-scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
    // Auto-expand if minimized
    if (this.isMinimized) {
      this.expand();
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
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
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

      // Check if response is streaming
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        console.log('[FLOATING CHAT] Handling streaming response');
        
        // Create a temporary div for the shared handler
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
          <div id="main-content" style="color: #374151; line-height: 1.6; font-size: 15px;"></div>
        `;
        
        // Use the shared handler from content.js
        await window.sharedHandleStreamingResponse(response, tempDiv);
        
        // Extract the final content and add to floating chat
        const mainContent = tempDiv.querySelector('#main-content');
        const contentDisplay = mainContent.querySelector('#content-display');
        const reasoningDisplay = mainContent.querySelector('#reasoning-display');
        
        // Add reasoning if present
        if (reasoningDisplay && reasoningDisplay.textContent.trim()) {
          this.addMessage(reasoningDisplay.textContent, 'assistant');
        }
        
        // Add content if present
        if (contentDisplay && contentDisplay.textContent.trim()) {
          this.addMessage(contentDisplay.textContent, 'assistant');
        }
      } else {
        console.log('[FLOATING CHAT] Handling JSON response');
        const data = await response.json();
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

    } catch (error) {
      console.error('[FLOATING CHAT] Error sending message:', error);
      this.hideTypingIndicator();
      this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
  }

  saveState() {
    const state = {
      position: this.position,
      isMinimized: this.isMinimized,
      isExpanded: this.isExpanded,
      messages: this.messages
    };
    
    chrome.storage.local.set({ floatingChatState: state }, () => {
      console.log('[FLOATING CHAT] State saved');
    });
  }

  loadState() {
    chrome.storage.local.get(['floatingChatState'], (result) => {
      if (result.floatingChatState) {
        const state = result.floatingChatState;
        this.position = state.position || this.position;
        this.messages = state.messages || [];
        
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        
        // Restore messages
        this.messages.forEach(msg => {
          this.addMessage(msg.content, msg.type);
        });
        
        // Restore minimized state
        if (state.isMinimized) {
          this.minimize();
        } else if (state.isExpanded) {
          this.expand();
        }
      }
    });
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Make FloatingChat globally available
window.FloatingChat = FloatingChat; 