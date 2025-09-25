// Test script for PDF preview functionality
// Run this in the browser console on Gmail to test the blob PDF preview

console.log('🧪 Testing PDF Preview Functionality...');

// Check if the extension is loaded
if (!window.trackedThreadRowViews) {
  console.error('❌ Extension not loaded. Make sure the extension is active.');
  return;
}

// Function to test PDF preview with test data
function testPdfPreview() {
  console.log('🎯 Testing PDF preview functionality...');
  
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
  
  // Simulate click on the test icon
  console.log('🖱️ Simulating click on test PDF icon...');
  testIcon.click();
  
  console.log('✅ Test click triggered. Check the console for fetch logs and look for the right preview panel.');
}

// Function to check if preview panel is visible
function checkPreviewPanel() {
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
      }
    } else {
      console.log('❌ Preview panel is not visible');
    }
  } else {
    console.log('❌ Preview panel not found');
  }
}

// Function to monitor fetch requests
function monitorFetches() {
  console.log('🔍 Monitoring fetch requests...');
  
  // Override fetch to log requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    console.log('🌐 Fetch request:', args[0]);
    return originalFetch.apply(this, args)
      .then(response => {
        console.log('📥 Fetch response:', {
          url: args[0],
          status: response.status,
          ok: response.ok,
          type: response.type
        });
        return response;
      })
      .catch(error => {
        console.error('❌ Fetch error:', error);
        throw error;
      });
  };
  
  console.log('✅ Fetch monitoring enabled');
}

// Function to clear cache and test fresh fetch
function clearCacheAndTest() {
  console.log('🗑️ Clearing PDF cache...');
  
  // Try to access the cache (if available in global scope)
  if (window.pdfCache) {
    window.pdfCache.clear();
    console.log('✅ PDF cache cleared');
  } else {
    console.log('ℹ️ PDF cache not accessible (may be in module scope)');
  }
  
  // Test again
  setTimeout(() => {
    console.log('🔄 Testing with cleared cache...');
    testPdfPreview();
  }, 1000);
}

// Make functions available globally
window.testPdfPreview = testPdfPreview;
window.checkPreviewPanel = checkPreviewPanel;
window.monitorFetches = monitorFetches;
window.clearCacheAndTest = clearCacheAndTest;

console.log('📋 Available test functions:');
console.log('- testPdfPreview() - Test the PDF preview functionality');
console.log('- checkPreviewPanel() - Check if preview panel is visible');
console.log('- monitorFetches() - Monitor fetch requests');
console.log('- clearCacheAndTest() - Clear cache and test again');

console.log('🚀 Run testPdfPreview() to start testing!');
console.log('💡 Make sure you\'re on the Invoice Tracker view first.');
