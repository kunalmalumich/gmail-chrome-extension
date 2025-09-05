  async getDocumentStorageRule() {
    try {
      console.log('[API] Checking for document storage business rules...');
      console.log('[API] Calling endpoint: /api/business-rules/rules');
      console.log('[API] Base URL:', this.baseUrl);
      
      // Get Chrome extension token for authentication (similar to validateChromeToken)
      const tokenResult = await this._getChromeExtensionToken();
      if (!tokenResult.accessToken) {
        console.log('[API] Could not obtain Chrome extension access token for business rules');
        return null;
      }
      
      // Get installation data for headers
      const { installationId, userEmail } = await chrome.storage.local.get(['installationId', 'userEmail']);
      
      if (!installationId) {
        console.log('[API] User not authenticated for business rules');
        return null;
      }

      // Call business rules endpoint with Chrome token (similar to validateChromeToken pattern)
      const url = `${this.baseUrl}/api/business-rules/rules`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-ID': installationId,
          'X-User-Email': userEmail,
          'X-Chrome-Token': tokenResult.accessToken,
          'Origin': "chrome-extension://" + chrome.runtime.id,
          'User-Agent': "Chrome Extension Stamp v1.0",
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Business rules request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return null;
      }
      
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
