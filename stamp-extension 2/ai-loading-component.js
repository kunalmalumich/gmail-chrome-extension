// stamp-extension/ai-loading-component.js

/**
 * AI-Style Loading Component for Invoice Tracker
 * This component provides a modern, step-by-step loading experience
 * while fetching invoice data from the backend.
 */

// CSS styles for the AI loading component
const AI_LOADING_CSS = `
  .ai-loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    background: #f8f9fa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 400px;
  }

  .ai-loading-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .ai-loading-icon {
    font-size: 48px;
    margin-bottom: 16px;
    animation: pulse 2s infinite;
  }

  .ai-loading-header h3 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .ai-loading-header p {
    margin: 0;
    color: #666;
    font-size: 16px;
  }

  .ai-loading-steps {
    width: 100%;
    max-width: 400px;
  }

  .ai-step {
    display: flex;
    align-items: center;
    padding: 16px;
    margin-bottom: 12px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .ai-step.active {
    border-color: #4285f4;
    background: #f8f9ff;
    box-shadow: 0 2px 8px rgba(66, 133, 244, 0.2);
  }

  .ai-step.completed {
    border-color: #34a853;
    background: #f8fff8;
    box-shadow: 0 2px 8px rgba(52, 168, 83, 0.2);
  }

  .ai-step-icon {
    font-size: 20px;
    margin-right: 12px;
    transition: all 0.3s ease;
    width: 24px;
    text-align: center;
  }

  .ai-step.completed .ai-step-icon {
    color: #34a853;
  }

  .ai-step.active .ai-step-icon {
    color: #4285f4;
  }

  .ai-step-content {
    flex: 1;
  }

  .ai-step-title {
    font-weight: 500;
    margin-bottom: 4px;
    color: #1a1a1a;
  }

  .ai-step-description {
    font-size: 14px;
    color: #666;
  }

  .ai-error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    text-align: center;
  }

  .ai-error-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: #dc3545;
  }

  .ai-error-container h3 {
    margin: 0 0 8px 0;
    color: #dc3545;
  }

  .ai-error-container p {
    margin: 0 0 16px 0;
    color: #666;
  }

  .ai-retry-button {
    padding: 8px 16px;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }

  .ai-retry-button:hover {
    background: #3367d6;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ai-step {
    animation: slideIn 0.3s ease;
  }
`;

/**
 * Shows the AI-style loading interface
 * @param {HTMLElement} container - The container to show the loading in
 * @returns {Object} - Object with methods to control the loading state
 */
export function showAIStyleLoading(container) {
  console.log('[AI LOADING] 🚀 Initializing AI-style loading component');
  
  // Inject CSS into the container's shadow DOM or document
  const styleElement = document.createElement('style');
  styleElement.textContent = AI_LOADING_CSS;
  
  // Add CSS to the document head
  if (!document.querySelector('#ai-loading-styles')) {
    styleElement.id = 'ai-loading-styles';
    document.head.appendChild(styleElement);
  }

  const loadingHTML = `
    <div class="ai-loading-container">
      <div class="ai-loading-header">
        <div class="ai-loading-icon">🤖</div>
        <h3>Invoice Tracker</h3>
        <p>Processing your financial data...</p>
      </div>
      
      <div class="ai-loading-steps">
        <div class="ai-step" data-step="fetching">
          <div class="ai-step-icon">⏳</div>
          <div class="ai-step-content">
            <div class="ai-step-title">Getting all invoices</div>
            <div class="ai-step-description">Connecting to your backend...</div>
          </div>
        </div>
        
        <div class="ai-step" data-step="details">
          <div class="ai-step-icon">📋</div>
          <div class="ai-step-content">
            <div class="ai-step-title">Getting invoice details</div>
            <div class="ai-step-description">Extracting vendor, amounts, dates...</div>
          </div>
        </div>
        
        <div class="ai-step" data-step="status">
          <div class="ai-step-icon">📊</div>
          <div class="ai-step-content">
            <div class="ai-step-title">Getting invoice status</div>
            <div class="ai-step-description">Checking approval status...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = loadingHTML;
  
  // Return control object
  return {
    updateStep: (stepName, status) => updateStep(container, stepName, status),
    showError: (error) => showErrorState(container, error),
    hide: () => hideLoading(container)
  };
}

/**
 * Updates the status of a specific step
 * @param {HTMLElement} container - The container element
 * @param {string} stepName - Name of the step to update
 * @param {string} status - Status: 'active', 'completed', or 'error'
 */
function updateStep(container, stepName, status) {
  console.log(`[AI LOADING] 📝 Updating step '${stepName}' to '${status}'`);
  
  const stepElement = container.querySelector(`[data-step="${stepName}"]`);
  if (!stepElement) {
    console.warn(`[AI LOADING] ⚠️ Step '${stepName}' not found`);
    return;
  }
  
  // Remove all status classes
  stepElement.classList.remove('active', 'completed', 'error');
  
  // Add new status class
  stepElement.classList.add(status);
  
  // Update icon based on status
  const iconElement = stepElement.querySelector('.ai-step-icon');
  if (iconElement) {
    switch (status) {
      case 'completed':
        iconElement.textContent = '✅';
        break;
      case 'active':
        iconElement.textContent = '⏳';
        break;
      case 'error':
        iconElement.textContent = '❌';
        break;
      default:
        iconElement.textContent = '⏳';
    }
  }
  
  console.log(`[AI LOADING] ✅ Step '${stepName}' updated to '${status}'`);
}

/**
 * Shows an error state
 * @param {HTMLElement} container - The container element
 * @param {Error} error - The error object
 */
function showErrorState(container, error) {
  console.error('[AI LOADING] ❌ Showing error state:', error);
  
  container.innerHTML = `
    <div class="ai-error-container">
      <div class="ai-error-icon">❌</div>
      <h3>Failed to load invoices</h3>
      <p>${error.message || 'An unexpected error occurred'}</p>
      <button class="ai-retry-button" onclick="location.reload()">Try Again</button>
    </div>
  `;
}

/**
 * Hides the loading component
 * @param {HTMLElement} container - The container element
 */
function hideLoading(container) {
  console.log('[AI LOADING] 🎯 Hiding loading component');
  container.innerHTML = '';
}

/**
 * Creates a loading controller that can be used to manage the loading state
 * @param {HTMLElement} container - The container element
 * @returns {Object} - Loading controller object
 */
export function createLoadingController(container) {
  const controller = showAIStyleLoading(container);
  
  return {
    ...controller,
    // Convenience methods for common flows
    startFetching: () => controller.updateStep('fetching', 'active'),
    completeFetching: () => controller.updateStep('fetching', 'completed'),
    startDetails: () => controller.updateStep('details', 'active'),
    completeDetails: () => controller.updateStep('details', 'completed'),
    startStatus: () => controller.updateStep('status', 'active'),
    completeStatus: () => controller.updateStep('status', 'completed'),
    completeAll: () => {
      controller.updateStep('fetching', 'completed');
      controller.updateStep('details', 'completed');
      controller.updateStep('status', 'completed');
    }
  };
} 