// Test script for backend headers and PDF preview functionality
// Run this in the browser console on Gmail to test the complete flow

console.log('🧪 Testing Backend Headers and PDF Preview...');

// Function to test the complete PDF preview flow
function testCompletePdfFlow() {
  console.log('🎯 Testing complete PDF preview flow with realistic backend headers...');
  
  // Find the test row (should be the first row with 🧪 icon)
  const testIcon = document.querySelector('.doc-preview-icon[title*="TEST"]');
  
  if (!testIcon) {
    console.error('❌ Test PDF icon not found. Make sure the spreadsheet is loaded.');
    console.log('💡 Try navigating to the Invoice Tracker view first.');
    return;
  }
  
  console.log('✅ Found test PDF icon:', testIcon);
  console.log('📋 Test icon attributes:', {
    threadId: testIcon.getAttribute('data-thread-id'),
    documentName: testIcon.getAttribute('data-doc-name'),
    hasDoc: testIcon.getAttribute('data-has-doc')
  });
  
  // Clear any existing preview panels
  const existingPanel = document.getElementById('stamp-right-preview-panel');
  if (existingPanel) {
    existingPanel.remove();
    console.log('🗑️ Cleared existing preview panel');
  }
  
  // Monitor console for specific log patterns
  console.log('🔍 Monitoring for these log patterns:');
  console.log('  - [API] 🧪 TESTING MODE: Using test PDF URL via background script');
  console.log('  - [Background] Fetching file for preview');
  console.log('  - [Background] Fetch response status: 200');
  console.log('  - [Background] File details: {contentType: "application/pdf", contentLength: "XKB"}');
  console.log('  - [Background] Blob created: {type: "application/pdf", size: X, sizeKB: X}');
  console.log('  - [API] ✅ Background script response received');
  console.log('  - [DOC] PDF fetched successfully, showing blob preview');
  
  // Simulate click on the test icon
  console.log('🖱️ Simulating click on test PDF icon...');
  testIcon.click();
  
  console.log('✅ Test click triggered. Watch the console for detailed logs!');
}

// Function to check background script communication
function testBackgroundCommunication() {
  console.log('🔗 Testing background script communication...');
  
  // Test if we can send a message to background script
  chrome.runtime.sendMessage({
    type: 'fetchFileForPreview',
    url: 'https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-file.pdf'
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Background script communication failed:', chrome.runtime.lastError);
    } else if (response.success) {
      console.log('✅ Background script communication successful!');
      console.log('📊 Response details:', {
        hasDataUrl: !!response.dataUrl,
        mimeType: response.mimeType,
        fileSize: response.fileSize,
        originalUrl: response.originalUrl
      });
    } else {
      console.error('❌ Background script returned error:', response.error);
    }
  });
}

// Function to verify headers are being sent correctly
function verifyHeaders() {
  console.log('📋 Expected headers that should be sent to backend:');
  console.log(`
    Accept: application/pdf, image/*, */*
    Accept-Encoding: gzip, deflate, br
    Accept-Language: en-US,en;q=0.9
    Cache-Control: no-cache
    Pragma: no-cache
    User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
    Sec-Fetch-Dest: document
    Sec-Fetch-Mode: navigate
    Sec-Fetch-Site: cross-site
    Sec-Fetch-User: ?1
    Upgrade-Insecure-Requests: 1
  `);
  
  console.log('💡 These headers simulate a real browser request to your backend');
  console.log('💡 Your backend should respond with:');
  console.log(`
    Content-Type: application/pdf
    Content-Disposition: inline; filename="document.pdf"
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Content-Type
  `);
}

// Function to check preview panel status
function checkPreviewPanelStatus() {
  const previewPanel = document.getElementById('stamp-right-preview-panel');
  
  if (previewPanel) {
    const isVisible = previewPanel.style.display !== 'none' && 
                     previewPanel.style.transform !== 'translateX(100%)';
    
    console.log('📊 Preview Panel Status:', {
      exists: !!previewPanel,
      visible: isVisible,
      display: previewPanel.style.display,
      transform: previewPanel.style.transform
    });
    
    if (isVisible) {
      console.log('✅ Preview panel is visible!');
      
      // Check for PDF content
      const pdfObject = previewPanel.querySelector('object');
      const pdfIframe = previewPanel.querySelector('iframe');
      
      console.log('📄 PDF Content Elements:', {
        hasObject: !!pdfObject,
        hasIframe: !!pdfIframe,
        objectSrc: pdfObject?.src || 'N/A',
        iframeSrc: pdfIframe?.src || 'N/A'
      });
      
      if (pdfObject && pdfObject.src) {
        console.log('✅ PDF object found with src:', pdfObject.src);
        console.log('🔗 Blob URL detected:', pdfObject.src.startsWith('blob:'));
        
        if (pdfObject.src.startsWith('blob:')) {
          console.log('🎉 SUCCESS: Blob URL preview is working perfectly!');
        }
      }
    } else {
      console.log('❌ Preview panel is not visible');
    }
  } else {
    console.log('❌ Preview panel not found');
  }
}

// Function to run all tests
function runAllTests() {
  console.log('🚀 Running comprehensive PDF preview tests...');
  
  verifyHeaders();
  console.log('\n--- Testing Background Communication ---');
  testBackgroundCommunication();
  
  setTimeout(() => {
    console.log('\n--- Testing Complete PDF Flow ---');
    testCompletePdfFlow();
    
    setTimeout(() => {
      console.log('\n--- Checking Preview Panel Status ---');
      checkPreviewPanelStatus();
    }, 3000);
  }, 1000);
}

// Make functions available globally
window.testCompletePdfFlow = testCompletePdfFlow;
window.testBackgroundCommunication = testBackgroundCommunication;
window.verifyHeaders = verifyHeaders;
window.checkPreviewPanelStatus = checkPreviewPanelStatus;
window.runAllTests = runAllTests;

console.log('📋 Available test functions:');
console.log('- runAllTests() - Run all tests in sequence');
console.log('- testCompletePdfFlow() - Test the complete PDF preview flow');
console.log('- testBackgroundCommunication() - Test background script communication');
console.log('- verifyHeaders() - Show expected headers');
console.log('- checkPreviewPanelStatus() - Check preview panel status');

console.log('🚀 Run runAllTests() to test everything!');
console.log('💡 Make sure you\'re on the Invoice Tracker view first.');
