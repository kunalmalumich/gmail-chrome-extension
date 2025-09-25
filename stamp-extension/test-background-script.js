// Test script to verify background script is working
// Run this in the browser console on Gmail

console.log('🧪 Testing Background Script Communication...');

// Function to test background script directly
function testBackgroundScript() {
  console.log('🔗 Testing background script communication...');
  
  // Test with a simple URL first
  const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  
  console.log('📡 Sending message to background script...');
  console.log('🎯 Test URL:', testUrl);
  
  chrome.runtime.sendMessage({
    type: 'fetchFileForPreview',
    url: testUrl
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
      console.log('💡 This usually means the background script is not loaded or has an error');
    } else if (response && response.success) {
      console.log('✅ Background script communication successful!');
      console.log('📊 Response details:', {
        hasDataUrl: !!response.dataUrl,
        mimeType: response.mimeType,
        fileSize: response.fileSize,
        originalUrl: response.originalUrl,
        dataUrlLength: response.dataUrl ? response.dataUrl.length : 0
      });
      
      // Test if we can create a blob from the data URL
      try {
        const byteCharacters = atob(response.dataUrl.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.mimeType || 'application/pdf' });
        
        console.log('✅ Blob creation successful:', {
          type: blob.type,
          size: blob.size,
          sizeKB: Math.round(blob.size / 1024)
        });
        
        // Test blob URL creation
        const blobUrl = URL.createObjectURL(blob);
        console.log('✅ Blob URL created:', blobUrl);
        
        // Clean up
        URL.revokeObjectURL(blobUrl);
        console.log('✅ Blob URL cleaned up');
        
      } catch (error) {
        console.error('❌ Blob creation failed:', error);
      }
      
    } else {
      console.error('❌ Background script returned error:', response);
    }
  });
}

// Function to check if background script is loaded
function checkBackgroundScript() {
  console.log('🔍 Checking if background script is loaded...');
  
  // Try to get the extension info
  chrome.runtime.getManifest((manifest) => {
    console.log('📋 Extension manifest loaded:', {
      name: manifest.name,
      version: manifest.version,
      hasBackground: !!manifest.background
    });
  });
  
  // Check if we can send a simple message
  chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('⚠️ Background script may not be responding to ping');
    } else {
      console.log('✅ Background script is responding');
    }
  });
}

// Function to test with different URLs
function testMultipleUrls() {
  const testUrls = [
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    'https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-file.pdf'
  ];
  
  console.log('🔄 Testing multiple URLs...');
  
  testUrls.forEach((url, index) => {
    setTimeout(() => {
      console.log(`\n--- Testing URL ${index + 1}: ${url} ---`);
      
      chrome.runtime.sendMessage({
        type: 'fetchFileForPreview',
        url: url
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`❌ URL ${index + 1} failed:`, chrome.runtime.lastError.message);
        } else if (response && response.success) {
          console.log(`✅ URL ${index + 1} successful:`, {
            mimeType: response.mimeType,
            fileSize: response.fileSize
          });
        } else {
          console.error(`❌ URL ${index + 1} error:`, response);
        }
      });
    }, index * 2000);
  });
}

// Make functions available globally
window.testBackgroundScript = testBackgroundScript;
window.checkBackgroundScript = checkBackgroundScript;
window.testMultipleUrls = testMultipleUrls;

console.log('📋 Available test functions:');
console.log('- testBackgroundScript() - Test background script communication');
console.log('- checkBackgroundScript() - Check if background script is loaded');
console.log('- testMultipleUrls() - Test multiple PDF URLs');

console.log('🚀 Run testBackgroundScript() to start testing!');
