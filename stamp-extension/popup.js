/* global chrome */

/**
 * Popup JavaScript for Stamp Chrome Extension
 * Manages the installation process and UI state
 */

class PopupManager {
  constructor() {
    this.isInstalling = false;
    this.currentError = null;
    this.initializeElements();
    this.bindEvents();
    this.checkInstallationState();
  }

  initializeElements() {
    // State containers
    this.states = {
      notInstalled: document.getElementById('not-installed-state'),
      installing: document.getElementById('installing-state'),
      installed: document.getElementById('installed-state'),
      error: document.getElementById('error-state')
    };

    // Buttons
    this.buttons = {
      install: document.getElementById('install-btn'),
      learnMore: document.getElementById('learn-more-btn'),
      cancelInstall: document.getElementById('cancel-install-btn'),
      openGmail: document.getElementById('open-gmail-btn'),
      signOut: document.getElementById('sign-out-btn'),
      retryInstall: document.getElementById('retry-install-btn'),
      showError: document.getElementById('show-error-btn')
    };

    // Progress indicators
    this.stepIndicators = {
      step1: document.getElementById('step1-indicator'),
      step2: document.getElementById('step2-indicator'),
      step3: document.getElementById('step3-indicator')
    };

    // Info elements
    this.userEmail = document.getElementById('user-email');
    this.installDate = document.getElementById('install-date');
    this.errorMessage = document.getElementById('error-message');
    this.errorDetails = document.getElementById('error-details');
  }

  bindEvents() {
    this.buttons.install.addEventListener('click', () => this.startInstallation());
    this.buttons.learnMore.addEventListener('click', () => this.openLearnMore());
    this.buttons.cancelInstall.addEventListener('click', () => this.cancelInstallation());
    this.buttons.openGmail.addEventListener('click', () => this.openGmail());
    this.buttons.signOut.addEventListener('click', () => this.signOut());
    this.buttons.retryInstall.addEventListener('click', () => this.startInstallation());
    this.buttons.showError.addEventListener('click', () => this.toggleErrorDetails());
  }

  async checkInstallationState() {
    try {
      console.log('[Popup] Checking installation state...');
      
      const response = await this.sendMessage({ type: 'GET_INSTALLATION_STATE' });
      
      if (response.error) {
        console.error('[Popup] Error checking installation state:', response.error);
        this.showError('Failed to check installation state: ' + response.error);
        return;
      }

      console.log('[Popup] Installation state:', response);

      if (response.isInstalled && response.userEmail) {
        this.showInstalledState(response);
      } else {
        this.showNotInstalledState();
      }
      
    } catch (error) {
      console.error('[Popup] Failed to check installation state:', error);
      this.showError('Failed to check installation state: ' + error.message);
    }
  }

  async startInstallation() {
    if (this.isInstalling) return;

    console.log('[Popup] Starting installation...');
    this.isInstalling = true;
    this.showInstallingState();

    try {
      // Step 1: Web OAuth for backend tokens
      this.updateStep(1, 'active');
      await this.delay(500);

      // Simulate the dual OAuth flow by communicating with content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab || !activeTab.url.includes('mail.google.com')) {
        throw new Error('Please open Gmail first, then try installing Stamp again.');
      }

      // Send installation command to content script
      console.log('[Popup] Sending installation command to content script...');
      const result = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'START_INSTALLATION'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Step 2: Chrome extension authentication
      this.updateStep(1, 'complete');
      this.updateStep(2, 'active');
      await this.delay(1000);

      // Step 3: Finalizing installation
      this.updateStep(2, 'complete');
      this.updateStep(3, 'active');
      await this.delay(1000);

      this.updateStep(3, 'complete');

      // Check final installation state
      const finalState = await this.sendMessage({ type: 'GET_INSTALLATION_STATE' });
      
      if (finalState.isInstalled) {
        console.log('[Popup] Installation completed successfully');
        this.showInstalledState(finalState);
      } else {
        throw new Error('Installation did not complete successfully');
      }

    } catch (error) {
      console.error('[Popup] Installation failed:', error);
      this.showError(error.message);
    } finally {
      this.isInstalling = false;
    }
  }

  async cancelInstallation() {
    if (!this.isInstalling) return;

    console.log('[Popup] Cancelling installation...');
    this.isInstalling = false;
    
    try {
      // Clean up any partial installation state
      await this.sendMessage({ type: 'CLEANUP_INSTALLATION' });
    } catch (error) {
      console.error('[Popup] Error during installation cleanup:', error);
    }
    
    this.showNotInstalledState();
  }

  async signOut() {
    try {
      console.log('[Popup] Starting sign out...');
      
      // Get active Gmail tab
      const tabs = await chrome.tabs.query({ 
        url: ['https://mail.google.com/*', 'https://mail.google.com/*'] 
      });
      
      if (tabs.length === 0) {
        throw new Error('No Gmail tabs found. Please open Gmail and try again.');
      }

      // Send sign out command to content script
      const result = await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SIGN_OUT'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      console.log('[Popup] Sign out completed');
      this.showNotInstalledState();
      
    } catch (error) {
      console.error('[Popup] Sign out failed:', error);
      this.showError('Sign out failed: ' + error.message);
    }
  }

  openGmail() {
    chrome.tabs.create({ url: 'https://mail.google.com' });
    window.close();
  }

  openLearnMore() {
    chrome.tabs.create({ url: 'https://trystamp.ai/chrome-extension' });
  }

  showNotInstalledState() {
    this.hideAllStates();
    this.states.notInstalled.classList.remove('hidden');
  }

  showInstallingState() {
    this.hideAllStates();
    this.states.installing.classList.remove('hidden');
    this.resetSteps();
  }

  showInstalledState(data) {
    this.hideAllStates();
    this.states.installed.classList.remove('hidden');
    
    if (data.userEmail) {
      this.userEmail.textContent = data.userEmail;
    }
    
    if (data.installationDate) {
      const date = new Date(data.installationDate).toLocaleDateString();
      this.installDate.textContent = `Installed: ${date}`;
    }
  }

  showError(message) {
    this.hideAllStates();
    this.states.error.classList.remove('hidden');
    this.currentError = message;
    this.errorMessage.textContent = message;
  }

  hideAllStates() {
    Object.values(this.states).forEach(state => {
      state.classList.add('hidden');
    });
  }

  resetSteps() {
    Object.values(this.stepIndicators).forEach(indicator => {
      indicator.className = 'step-indicator pending';
    });
  }

  updateStep(stepNumber, status) {
    const indicator = this.stepIndicators[`step${stepNumber}`];
    if (indicator) {
      indicator.className = `step-indicator ${status}`;
      if (status === 'complete') {
        indicator.textContent = '✓';
      } else {
        indicator.textContent = stepNumber.toString();
      }
    }
  }

  toggleErrorDetails() {
    const isHidden = this.errorDetails.classList.contains('hidden');
    if (isHidden) {
      this.errorDetails.classList.remove('hidden');
      this.buttons.showError.textContent = 'Hide Error Details';
    } else {
      this.errorDetails.classList.add('hidden');
      this.buttons.showError.textContent = 'Show Error Details';
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || {});
      });
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
  });
} else {
  new PopupManager();
} 