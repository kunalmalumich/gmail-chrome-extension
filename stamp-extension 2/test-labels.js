// Test script for the InboxSDK label system
// Run this in the browser console on Gmail to test label assignments

console.log('🧪 Testing InboxSDK Label System...');

// Check if the tracking system is available
if (!window.trackedThreadRowViews) {
  console.error('❌ Thread tracking system not available. Make sure the extension is loaded.');
  console.log('💡 Try refreshing the page and running this script again.');
  return;
}

// Display available stages
console.log('Available stages:', window.INVOICE_STAGES);

// Function to show current tracked threads
function showTrackedThreads() {
  const trackedInfo = window.getTrackedThreadsInfo();
  console.log(`📊 Currently tracking ${trackedInfo.length} threads:`);
  
  if (trackedInfo.length === 0) {
    console.log('No threads are currently tracked. Try navigating to different Gmail views to trigger thread loading.');
    return;
  }
  
  trackedInfo.forEach((info, index) => {
    console.log(`${index + 1}. ${info.threadId} - Stage: ${info.stage} (Tracked at: ${info.timestamp})`);
  });
}

// Function to assign stages to tracked threads for testing
function testLabelAssignment() {
  const stages = Object.values(window.INVOICE_STAGES);
  const trackedInfo = window.getTrackedThreadsInfo();
  
  if (trackedInfo.length === 0) {
    console.log('❌ No threads are currently tracked.');
    console.log('💡 Try navigating to different Gmail views (Inbox, Sent, etc.) to load more threads.');
    return;
  }
  
  console.log(`🎯 Assigning test stages to ${Math.min(trackedInfo.length, 5)} tracked threads...`);
  
  for (let i = 0; i < Math.min(trackedInfo.length, 5); i++) {
    const threadInfo = trackedInfo[i];
    const stage = stages[i % stages.length]; // Cycle through stages
    
    console.log(`Assigning "${stage}" to thread ${threadInfo.threadId}`);
    window.assignInvoiceStage(threadInfo.threadId, stage);
  }
  
  console.log('✅ Test label assignment complete!');
  console.log('Navigate to "Invoice Tracker" to see the results.');
}

// Function to show current thread assignments
function showCurrentAssignments() {
  const trackedInfo = window.getTrackedThreadsInfo();
  console.log('Current thread assignments:');
  
  if (trackedInfo.length === 0) {
    console.log('No threads are currently tracked.');
    return;
  }
  
  trackedInfo.forEach((info, index) => {
    console.log(`${index + 1}. ${info.threadId} - Stage: ${info.stage}`);
  });
}

// Function to clear all assignments
function clearAllAssignments() {
  console.log('🗑️ Clearing all thread stage assignments...');
  
  // Clear the THREAD_STAGE_ASSIGNMENTS object
  // Note: This requires access to the internal object, so we'll just log instructions
  console.log('To clear assignments, you would need to modify the THREAD_STAGE_ASSIGNMENTS object in the content script.');
  console.log('For now, you can manually assign "Noise" stage to specific threads to effectively "clear" them.');
  
  // Alternative: Assign all to "Noise" stage
  const trackedInfo = window.getTrackedThreadsInfo();
  if (trackedInfo.length > 0) {
    console.log('Assigning all tracked threads to "Noise" stage...');
    trackedInfo.forEach(info => {
      window.assignInvoiceStage(info.threadId, window.INVOICE_STAGES.NOISE);
    });
    console.log('✅ All threads assigned to "Noise" stage.');
  }
}

// Function to refresh the invoice tracker view
function refreshInvoiceTracker() {
  console.log('🔄 Refreshing Invoice Tracker view...');
  const currentRoute = window._sdk.Router.getCurrentRouteView();
  if (currentRoute && currentRoute.getRouteID() === 'invoice-tracker-view') {
    window._sdk.Router.goto('invoice-tracker-view');
    console.log('✅ Invoice Tracker view refreshed.');
  } else {
    console.log('ℹ️ Invoice Tracker view is not currently open.');
  }
}

// Make functions available globally
window.testLabelAssignment = testLabelAssignment;
window.showTrackedThreads = showTrackedThreads;
window.showCurrentAssignments = showCurrentAssignments;
window.clearAllAssignments = clearAllAssignments;
window.refreshInvoiceTracker = refreshInvoiceTracker;

console.log('📋 Available test functions:');
console.log('- showTrackedThreads() - Show currently tracked threads');
console.log('- testLabelAssignment() - Assign test stages to tracked threads');
console.log('- showCurrentAssignments() - Show current thread assignments');
console.log('- clearAllAssignments() - Clear all assignments (assign to Noise)');
console.log('- refreshInvoiceTracker() - Refresh the Invoice Tracker view');
console.log('- window.assignInvoiceStage(threadId, stage) - Assign specific stage to thread');

console.log('🚀 Run showTrackedThreads() to see what threads are available for testing!'); 