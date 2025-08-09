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

  // REMOVED: startDragging, onDrag, stopDragging
  // REMOVED: toggleMinimize, toggleMaximize, minimize, expand, collapse
  // The MoleView handles all of this UI logic natively.

  addMessage(content, type = 'assistant') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-chat-message ${type}`;
    // Basic markdown for bolding and newlines
    messageDiv.innerHTML = content
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
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
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
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
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
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
  // REMOVED: saveState and loadState
  // The MoleView's state is not something we should manage manually.
  // We can re-introduce message history persistence later if needed.

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

// Make FloatingChat globally available
window.FloatingChat = FloatingChat; 