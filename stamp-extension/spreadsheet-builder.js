// stamp-extension/spreadsheet-builder.js

/**
 * This file contains all the logic for building and configuring the jspreadsheet instance
 * for the finance team's invoice tracker with comprehensive scrolling support.
 */

// Core function to initialize the spreadsheet with clean Shadow DOM approach
export async function buildSpreadsheet(container, data) {
  console.log('[SHADOW DOM] Starting clean jspreadsheet integration...');
  
  // Setup clean Shadow DOM container instead of CSS isolation
  const { cleanContainer, shadowRoot } = await setupShadowDOMContainer(container);
  
  // Define columns with enhanced Phase 1 interactive features
  const columns = [
    { 
      title: 'Invoice #', 
      width: 150, 
      type: 'text',
      align: 'left'
    },
    { 
      title: 'Vendor', 
      width: 200, 
      type: 'text',
      align: 'left'
    },
    { 
      title: 'Amount', 
      width: 100, 
      type: 'numeric', 
      mask: '$ #,##.00',
      align: 'right'
    },
    { 
      title: 'Due Date', 
      width: 120, 
      type: 'calendar', 
      options: { format: 'YYYY-MM-DD' } 
    },
    { 
      title: 'Status', 
      width: 150, 
      type: 'dropdown',
      source: Object.values(INVOICE_STAGES)
    },
    { 
      title: 'Assigned To', 
      width: 150, 
      type: 'text' 
    },
    // The 'Thread ID' column is now removed
    { 
      title: 'Actions', 
      width: 120, 
      type: 'html',
      readOnly: true
    }
  ];

  // Transform the raw invoice data to fit the spreadsheet structure
  const spreadsheetData = transformDataForSpreadsheet(data);
  
  // Generate meta information for Invoice Number and Status cells
  const metaInformation = generateMetaInformation(data);
  
  // Calculate container dimensions for optimal scrolling
  const containerDimensions = calculateOptimalDimensions(container);
  const isLargeDataset = spreadsheetData.length > 50;

  // Create the spreadsheet with clean default configuration
  const spreadsheet = jspreadsheet(cleanContainer, {
    root: shadowRoot,  // Critical parameter for Shadow DOM event handling
    worksheets: [{
      data: spreadsheetData,
      columns: columns,
      meta: metaInformation,  // Hidden metadata for linking to Gmail threads/messages
      
      // === USE JSPREADSHEET DEFAULTS ===
      allowComments: true,
      tableOverflow: true,  // Built-in scrolling
      toolbar: true,        // Built-in toolbar 
      editable: true,
      allowInsertRow: true,
      allowDeleteRow: true,
      allowInsertColumn: true,
      allowDeleteColumn: true,
      allowRenameColumn: true,  // Enable column header editing
      columnSorting: true,
      columnResize: true,
      rowResize: true,
      search: true,
      filters: true,
      
      // === MINIMAL EVENT HANDLING ===
      onload: function(element, instance) {
        console.log('[SHADOW DOM] Spreadsheet loaded with default jspreadsheet behavior');
        console.log('[SHADOW DOM] All native features should work: editing, selection, navigation, toolbar');
        
        // The `worksheet` is the second argument in the v5 onload event
        const worksheet = instance;
        if (!worksheet) {
          console.error('[META INFO] 💥 CRITICAL: jspreadsheet instance not received in onload event.');
          return;
        }

        // Set the worksheet reference for utility functions in content.js scope
        if (typeof window !== 'undefined' && window.setCurrentWorksheet) {
          window.setCurrentWorksheet(worksheet);
        } else {
          // Fallback: use window to pass the worksheet directly
          window.currentWorksheet = worksheet;
          console.log('[META INFO] ✅ SpreadsheetMetaUtils now ready for use');
        }
        
        // DEBUG: Test the utility functions with actual data
        setTimeout(() => {
          console.log('\n=== SPREADSHEET LOADED - META DATA TEST ===');
          console.log('[DEBUG] getThreadIdFromInvoiceCell("A2"):', window.SpreadsheetMetaUtils.getThreadIdFromInvoiceCell('A2')); // First data row
          console.log('[DEBUG] getThreadIdFromInvoiceCell("A3"):', window.SpreadsheetMetaUtils.getThreadIdFromInvoiceCell('A3')); // Second data row
          console.log('[DEBUG] getIdsFromStatusCell("E2"):', window.SpreadsheetMetaUtils.getIdsFromStatusCell('E2')); // First data row
          console.log('[DEBUG] getIdsFromStatusCell("E3"):', window.SpreadsheetMetaUtils.getIdsFromStatusCell('E3')); // Second data row
          console.log('[DEBUG] getGmailUrlFromCell("A2"):', window.SpreadsheetMetaUtils.getGmailUrlFromCell('A2'));
          console.log('[DEBUG] getGmailUrlFromCell("G2"):', window.SpreadsheetMetaUtils.getGmailUrlFromCell('G2'));
          
          // Show raw meta data from worksheet
          console.log('[DEBUG] Raw meta A1 (header):', worksheet.getMeta('A1')); // Should be undefined/null
          console.log('[DEBUG] Raw meta A2 (first data):', worksheet.getMeta('A2')); // Should have meta data
          console.log('[DEBUG] Raw meta E2 (first status):', worksheet.getMeta('E2')); // Should have meta data
          console.log('[DEBUG] Raw meta G2 (first thread):', worksheet.getMeta('G2')); // Should have meta data
          console.log('==========================================\n');
        }, 500);
      }
    }]
  });

  return spreadsheet;
}

// Create a Shadow DOM container for complete CSS isolation
async function setupShadowDOMContainer(container) {
  console.log('[SHADOW DOM] Creating shadow DOM container for CSS isolation...');
  
  // Create shadow host element
  const shadowHost = document.createElement('div');
  shadowHost.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
  `;
  
  // Attach shadow DOM for complete isolation
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  // Load CSS content from local files and inject into shadow DOM
  const loadLocalCSS = async () => {
    try {
      console.log('[SHADOW DOM] Loading local CSS files...');
      
      // Get CSS file URLs
      const jspreadsheetUrl = chrome.runtime.getURL('jspreadsheet.css');
      const jsuitesUrl = chrome.runtime.getURL('jsuites.css');
      
      console.log('[SHADOW DOM] CSS URLs:', {
        jspreadsheet: jspreadsheetUrl,
        jsuites: jsuitesUrl
      });
      
      // Read jspreadsheet CSS content with better error handling
      const jspreadsheetResponse = await fetch(jspreadsheetUrl);
      if (!jspreadsheetResponse.ok) {
        throw new Error(`Failed to fetch jspreadsheet.css: ${jspreadsheetResponse.status} ${jspreadsheetResponse.statusText}`);
      }
      const jspreadsheetCss = await jspreadsheetResponse.text();
      console.log('[SHADOW DOM] ✅ jspreadsheet.css loaded, size:', jspreadsheetCss.length);
      
      // Read jsuites CSS content with better error handling
      const jsuitesResponse = await fetch(jsuitesUrl);
      if (!jsuitesResponse.ok) {
        throw new Error(`Failed to fetch jsuites.css: ${jsuitesResponse.status} ${jsuitesResponse.statusText}`);
      }
      const jsuitesCss = await jsuitesResponse.text();
      console.log('[SHADOW DOM] ✅ jsuites.css loaded, size:', jsuitesCss.length);
      
      // Create style element with combined CSS content
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        /* Material Icons - Required for toolbar */
        @import url("https://fonts.googleapis.com/css?family=Material+Icons");
        
        /* jspreadsheet.css */
        ${jspreadsheetCss}
        
        /* jsuites.css */
        ${jsuitesCss}
      `;
      shadowRoot.appendChild(styleElement);
      
      console.log('[SHADOW DOM] ✅ Local CSS files loaded successfully');
      return true;
    } catch (error) {
      console.error('[SHADOW DOM] ❌ Error loading local CSS files:', error);
      console.error('[SHADOW DOM] ❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      // No fallback possible due to CORS restrictions
      console.error('[SHADOW DOM] ❌ CSS loading failed - ensure jspreadsheet.css and jsuites.css are in dist/ directory');
      return false;
    }
  };
  
  // Load CSS first, then create container
  await loadLocalCSS();
  
  // Create clean container inside shadow DOM
  const cleanContainer = document.createElement('div');
  cleanContainer.style.cssText = `
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `;
  shadowRoot.appendChild(cleanContainer);
  
  // Replace container content with shadow host
  container.innerHTML = '';
  container.appendChild(shadowHost);
  
  console.log('[SHADOW DOM] ✅ Shadow DOM container created with isolated CSS');
  return { cleanContainer, shadowRoot };
}

// OLD FUNCTION - Inject comprehensive CSS overrides for jspreadsheet styling
function injectJspreadsheetStyleOverrides_OLD() {
  const styleId = 'jspreadsheet-style-overrides';
  console.log('[STYLE DEBUG] Starting CSS injection process...');
  
  if (document.getElementById(styleId)) {
    console.log('[STYLE DEBUG] CSS overrides already exist, skipping injection');
    return;
  }

  console.log('[STYLE DEBUG] Creating new style element...');

  const style = document.createElement('style');
  style.id = styleId;
  style.setAttribute('data-source', 'jspreadsheet-stamp-extension');
  style.textContent = `
    /* STAMP EXTENSION - Force jspreadsheet styling with maximum specificity */
    html body div.jspreadsheet-isolation-wrapper,
    html body div.jspreadsheet-isolation-wrapper * {
      box-sizing: border-box !important;
    }
    
    html body div.jspreadsheet-isolation-wrapper .jexcel,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet,
    html body div.jspreadsheet-isolation-wrapper .jss_worksheet {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      background: #fff !important;
      color: #000 !important;
    }
    
    /* Table cells with maximum specificity */
    html body div.jspreadsheet-isolation-wrapper .jexcel td,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet td,
    html body div.jspreadsheet-isolation-wrapper .jss_worksheet td,
    html body div.jspreadsheet-isolation-wrapper table td {
      border: 1px solid #e0e0e0 !important;
      padding: 8px !important;
      font-size: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      background: #fff !important;
      color: #000 !important;
      line-height: 1.4 !important;
    }
    
    /* Headers with maximum specificity */
    html body div.jspreadsheet-isolation-wrapper .jexcel th,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet th,
    html body div.jspreadsheet-isolation-wrapper table th {
      background: #f5f5f5 !important;
      border: 1px solid #e0e0e0 !important;
      padding: 8px !important;
      font-weight: 500 !important;
      font-size: 14px !important;
      color: #333 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    /* Input fields with forced styling */
    html body div.jspreadsheet-isolation-wrapper .jexcel input,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet input,
    html body div.jspreadsheet-isolation-wrapper input {
      border: none !important;
      background: transparent !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      color: #000 !important;
      outline: none !important;
      width: 100% !important;
      padding: 4px !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    
    /* Additional comprehensive styling for all jspreadsheet elements */
    html body div.jspreadsheet-isolation-wrapper .jexcel-toolbar,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet-toolbar {
      background: #f8f9fa !important;
      border-bottom: 1px solid #e0e0e0 !important;
      padding: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
    }
    
    /* Row numbers - first cell in each row (jspreadsheet v5 structure) */
    html body div.jspreadsheet-isolation-wrapper .jss_worksheet tr td:first-child {
      background: #f5f5f5 !important;
      font-weight: 500 !important;
      text-align: center !important;
      color: #666 !important;
      border: 1px solid #e0e0e0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      padding: 8px !important;
    }
    
    /* Column headers - first row cells (jspreadsheet v5 structure) */
    html body div.jspreadsheet-isolation-wrapper .jss_worksheet tr:first-child td {
      background: #f5f5f5 !important;
      font-weight: 500 !important;
      text-align: center !important;
      color: #666 !important;
      border: 1px solid #e0e0e0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      padding: 8px !important;
    }
    
    /* Select-all corner cell */
    html body div.jspreadsheet-isolation-wrapper .jss_selectall {
      background: #f5f5f5 !important;
      border: 1px solid #e0e0e0 !important;
    }
    
    /* Dropdowns and context menus */
    html body div.jspreadsheet-isolation-wrapper .jdropdown,
    html body div.jspreadsheet-isolation-wrapper .jsuites-dropdown {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      border: 1px solid #ccc !important;
      background: #fff !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
    }
    
    html body div.jspreadsheet-isolation-wrapper .jdropdown-item,
    html body div.jspreadsheet-isolation-wrapper .jsuites-dropdown-item {
      padding: 8px 12px !important;
      font-size: 14px !important;
      color: #333 !important;
      background: #fff !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    html body div.jspreadsheet-isolation-wrapper .jdropdown-item:hover,
    html body div.jspreadsheet-isolation-wrapper .jsuites-dropdown-item:hover {
      background: #f0f0f0 !important;
    }
    
    /* Selection and editing states */
    html body div.jspreadsheet-isolation-wrapper .jexcel-selection,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet-selection {
      background: rgba(66, 133, 244, 0.15) !important;
      border: 2px solid #4285f4 !important;
    }
    
    /* Editor input when editing cell */
    html body div.jspreadsheet-isolation-wrapper .jexcel-editor,
    html body div.jspreadsheet-isolation-wrapper .jspreadsheet-editor {
      border: 2px solid #4285f4 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      padding: 4px !important;
      background: #fff !important;
      outline: none !important;
    }
    
    /* Context menu styling */
    html body div.jspreadsheet-isolation-wrapper .jcontextmenu,
    html body div.jspreadsheet-isolation-wrapper .jsuites-contextmenu {
      background: #fff !important;
      border: 1px solid #ccc !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
    }
    
    /* Calendar and date picker */
    html body div.jspreadsheet-isolation-wrapper .jcalendar,
    html body div.jspreadsheet-isolation-wrapper .jsuites-calendar {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      background: #fff !important;
      border: 1px solid #ccc !important;
    }
    
    /* Force clean table appearance */
    html body div.jspreadsheet-isolation-wrapper table {
      border-spacing: 0 !important;
      border-collapse: separate !important;
      background: #fff !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
    }
    
    /* Phase 1: Enhanced interactive styling */
    html body div.jspreadsheet-isolation-wrapper .jcalendar {
      border: 1px solid #dadce0 !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    html body div.jspreadsheet-isolation-wrapper .jdropdown-container {
      border: 1px solid #dadce0 !important;
      border-radius: 4px !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
    }
    
    html body div.jspreadsheet-isolation-wrapper .jdropdown-item:hover {
      background: #f0f0f0 !important;
      transition: background-color 0.2s !important;
    }
    
    /* Loading spinner animation for Phase 3 */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Force jspreadsheet styling - High specificity overrides */
    .jspreadsheet-isolation-wrapper * {
      box-sizing: border-box !important;
    }
    
    .jspreadsheet-isolation-wrapper .jexcel,
    .jspreadsheet-isolation-wrapper .jspreadsheet {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      background: #fff !important;
    }
    
    /* Table cells */
    .jspreadsheet-isolation-wrapper .jexcel td,
    .jspreadsheet-isolation-wrapper .jspreadsheet td {
      border: 1px solid #e0e0e0 !important;
      padding: 8px !important;
      font-size: 14px !important;
      font-family: inherit !important;
      background: #fff !important;
      color: #000 !important;
    }
    
    /* Headers */
    .jspreadsheet-isolation-wrapper .jexcel th,
    .jspreadsheet-isolation-wrapper .jspreadsheet th {
      background: #f5f5f5 !important;
      border: 1px solid #e0e0e0 !important;
      padding: 8px !important;
      font-weight: 500 !important;
      font-size: 14px !important;
      color: #333 !important;
    }
    
    /* Input fields in cells */
    .jspreadsheet-isolation-wrapper .jexcel input,
    .jspreadsheet-isolation-wrapper .jspreadsheet input {
      border: none !important;
      background: transparent !important;
      font-family: inherit !important;
      font-size: 14px !important;
      color: #000 !important;
      outline: none !important;
      width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* Dropdowns */
    .jspreadsheet-isolation-wrapper .jdropdown,
    .jspreadsheet-isolation-wrapper .jsuites-dropdown {
      font-family: inherit !important;
      font-size: 14px !important;
      border: 1px solid #ccc !important;
      background: #fff !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
    }
    
    /* Dropdown items */
    .jspreadsheet-isolation-wrapper .jdropdown-item,
    .jspreadsheet-isolation-wrapper .jsuites-dropdown-item {
      padding: 8px 12px !important;
      font-size: 14px !important;
      color: #333 !important;
      background: #fff !important;
    }
    
    .jspreadsheet-isolation-wrapper .jdropdown-item:hover,
    .jspreadsheet-isolation-wrapper .jsuites-dropdown-item:hover {
      background: #f0f0f0 !important;
    }
    
    /* Toolbar */
    .jspreadsheet-isolation-wrapper .jexcel-toolbar,
    .jspreadsheet-isolation-wrapper .jspreadsheet-toolbar {
      background: #fafafa !important;
      border-bottom: 1px solid #e0e0e0 !important;
      padding: 8px !important;
    }
    
    /* Selection styling */
    .jspreadsheet-isolation-wrapper .jexcel-selection,
    .jspreadsheet-isolation-wrapper .jspreadsheet-selection {
      background: rgba(66, 133, 244, 0.15) !important;
      border: 2px solid #4285f4 !important;
    }
    
    /* Context menu */
    .jspreadsheet-isolation-wrapper .jcontextmenu,
    .jspreadsheet-isolation-wrapper .jsuites-contextmenu {
      background: #fff !important;
      border: 1px solid #ccc !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
      font-family: inherit !important;
    }
  `;
  
  document.head.appendChild(style);
  console.log('[STYLE DEBUG] ✅ CSS overrides injected successfully. Style element ID:', styleId);
  
  // Verify injection
  setTimeout(() => {
    const injectedStyle = document.getElementById(styleId);
    console.log('[STYLE DEBUG] Verification - Style element exists:', !!injectedStyle);
    if (injectedStyle) {
      console.log('[STYLE DEBUG] Style content length:', injectedStyle.textContent.length);
      console.log('[STYLE DEBUG] Style attributes:', {
        id: injectedStyle.id,
        dataSource: injectedStyle.getAttribute('data-source')
      });
    }
  }, 100);
}

// Verify CSS injection and diagnose styling issues
function verifyCSSInjection() {
  console.log('[STYLE VERIFY] Starting CSS verification...');
  
  // Check if our style element exists
  const styleElement = document.getElementById('jspreadsheet-style-overrides');
  console.log('[STYLE VERIFY] Style element found:', !!styleElement);
  
  // Check if jspreadsheet CSS is loaded
  const jspreadsheetStyles = Array.from(document.querySelectorAll('style, link')).filter(el => 
    el.textContent?.includes('jspreadsheet') || el.href?.includes('jspreadsheet')
  );
  console.log('[STYLE VERIFY] Jspreadsheet CSS files found:', jspreadsheetStyles.length);
  
  // Check if isolation wrapper exists
  const isolationWrapper = document.querySelector('.jspreadsheet-isolation-wrapper');
  console.log('[STYLE VERIFY] Isolation wrapper found:', !!isolationWrapper);
  
  // Check computed styles on a test element
  if (isolationWrapper) {
    const computedStyle = window.getComputedStyle(isolationWrapper);
    console.log('[STYLE VERIFY] Isolation wrapper styles:', {
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      background: computedStyle.background,
      isolation: computedStyle.isolation
    });
    
    // Check table styles if present
    const table = isolationWrapper.querySelector('table');
    if (table) {
      const tableStyle = window.getComputedStyle(table);
      console.log('[STYLE VERIFY] Table styles:', {
        fontFamily: tableStyle.fontFamily,
        fontSize: tableStyle.fontSize,
        borderCollapse: tableStyle.borderCollapse
      });
    }
    
    // Check cell styles
    const cell = isolationWrapper.querySelector('td');
    if (cell) {
      const cellStyle = window.getComputedStyle(cell);
      console.log('[STYLE VERIFY] Cell styles:', {
        fontFamily: cellStyle.fontFamily,
        fontSize: cellStyle.fontSize,
        border: cellStyle.border,
        padding: cellStyle.padding
      });
    }
    
    // Check header styles (first row td elements in jspreadsheet v5)
    const header = isolationWrapper.querySelector('.jss_worksheet tr:first-child td:nth-child(2)'); // Skip corner cell
    if (header) {
      const headerStyle = window.getComputedStyle(header);
      console.log('[STYLE VERIFY] Header styles:', {
        fontFamily: headerStyle.fontFamily,
        fontSize: headerStyle.fontSize,
        background: headerStyle.background,
        fontWeight: headerStyle.fontWeight,
        textContent: header.textContent
      });
    }
    
    // Check row number column (first td in each data row)
    const rowNumber = isolationWrapper.querySelector('.jss_worksheet tr:nth-child(2) td:first-child'); // Second row, first cell
    if (rowNumber) {
      const rowNumberStyle = window.getComputedStyle(rowNumber);
      console.log('[STYLE VERIFY] Row number styles:', {
        fontFamily: rowNumberStyle.fontFamily,
        fontSize: rowNumberStyle.fontSize,
        background: rowNumberStyle.background,
        textAlign: rowNumberStyle.textAlign,
        textContent: rowNumber.textContent
      });
    }
  }
  
  // List all style elements for debugging
  const allStyles = Array.from(document.querySelectorAll('style')).map(style => ({
    id: style.id || 'no-id',
    source: style.getAttribute('data-source') || 'unknown',
    length: style.textContent.length
  }));
  console.log('[STYLE VERIFY] All style elements:', allStyles);
}

// Setup container for proper scrolling behavior and CSS isolation
function setupScrollableContainer(container) {
  // Create CSS isolation wrapper
  const isolationWrapper = document.createElement('div');
  isolationWrapper.className = 'jspreadsheet-isolation-wrapper';
  
  // Apply isolation and reset styles
  isolationWrapper.style.cssText = `
    /* CSS Isolation and Reset */
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    color: #000 !important;
    background: #fff !important;
    
    /* Container sizing */
    position: relative !important;
    width: 100% !important;
    height: calc(100vh - 80px) !important;
    min-height: 600px !important;
    overflow: hidden !important;
    border: 1px solid #dadce0 !important;
    border-radius: 8px !important;
    box-sizing: border-box !important;
    
    /* Ensure proper stacking */
    z-index: 1 !important;
    isolation: isolate !important;
  `;
  
  // Replace container content with our isolation wrapper
  container.innerHTML = '';
  container.appendChild(isolationWrapper);
  
  // Return the isolated container for jspreadsheet
  return isolationWrapper;
}

// Calculate optimal dimensions based on available space
function calculateOptimalDimensions(container) {
  const containerRect = container.getBoundingClientRect();
  const availableWidth = containerRect.width || window.innerWidth - 100;
  const availableHeight = Math.min(
    window.innerHeight - 250, // Account for Gmail UI
    800 // Maximum height
  );
  
  return {
    width: Math.max(availableWidth, 1000), // Minimum width for horizontal scroll
    height: Math.max(availableHeight, 400) // Minimum height
  };
}

// Setup responsive scrolling with resize observers
function setupResponsiveScrolling(container, spreadsheet) {
  // Handle window resize
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      updateScrollingDimensions(container, spreadsheet);
    }
  });
  
  resizeObserver.observe(container);
  
  // Handle orientation change on mobile
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateScrollingDimensions(container, spreadsheet);
    }, 100);
  });
  
  // Store observer for cleanup
  container._resizeObserver = resizeObserver;
  
  console.log('Responsive scrolling setup complete');
}

// Update scrolling dimensions when container resizes
function updateScrollingDimensions(container, spreadsheet) {
  if (!spreadsheet.worksheets || !spreadsheet.worksheets[0]) return;
  
  try {
    const newDimensions = calculateOptimalDimensions(container);
    const worksheet = spreadsheet.worksheets[0];
    
    // Update worksheet dimensions
    if (worksheet.options) {
      worksheet.options.tableHeight = `${newDimensions.height - 60}px`;
      worksheet.options.tableWidth = `${newDimensions.width}px`;
      
      // Refresh the table layout if refresh method exists
      if (typeof worksheet.refresh === 'function') {
        worksheet.refresh();
      }
    }
    
    console.log('Updated scrolling dimensions:', newDimensions);
  } catch (error) {
    console.error('Error updating scrolling dimensions:', error);
  }
}

// Create a Gmail-compatible custom toolbar with scroll controls
function createCustomToolbar(container, spreadsheet) {
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #dadce0;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    font-size: 14px;
    flex-wrap: wrap;
    margin-bottom: 0;
    min-height: 50px;
  `;

  // Enhanced toolbar buttons with scroll controls
  const buttons = [
    // Data manipulation buttons
    {
      label: '➕ Insert Row',
      action: () => {
        try {
          if (spreadsheet.worksheets && spreadsheet.worksheets[0]) {
            spreadsheet.worksheets[0].insertRow();
          } else {
            alert('Spreadsheet not available');
          }
        } catch (error) {
          console.error('Insert Row error:', error);
          alert('Failed to insert row: ' + error.message);
        }
      }
    },
    {
      label: '📋 Insert Column', 
      action: () => {
        try {
          if (spreadsheet.worksheets && spreadsheet.worksheets[0]) {
            spreadsheet.worksheets[0].insertColumn();
          } else {
            alert('Spreadsheet not available');
          }
        } catch (error) {
          console.error('Insert Column error:', error);
          alert('Failed to insert column: ' + error.message);
        }
      }
    },
    
    // Separator
    { type: 'separator' },
    
    // Scroll control buttons
    {
      label: '⬅️ Scroll Left',
      action: () => {
        scrollSpreadsheet(spreadsheet, 'left');
      }
    },
    {
      label: '➡️ Scroll Right',
      action: () => {
        scrollSpreadsheet(spreadsheet, 'right');
      }
    },
    {
      label: '🔝 Scroll Top',
      action: () => {
        scrollSpreadsheet(spreadsheet, 'top');
      }
    },
    {
      label: '🔽 Scroll Bottom',
      action: () => {
        scrollSpreadsheet(spreadsheet, 'bottom');
      }
    },
    
    // Separator
    { type: 'separator' },
    
    // Action buttons
    {
      label: '✅ Approve Selected',
      action: () => {
        alert('Approve selected functionality - to be implemented');
      }
    },
    {
      label: '💾 Export CSV',
      action: () => {
        if (spreadsheet.worksheets && spreadsheet.worksheets[0]) {
          try {
            const data = spreadsheet.worksheets[0].getData();
            if (data && data.length > 0) {
              const csvData = convertDataToCSV(data);
              downloadCSV(csvData, 'invoice-tracker.csv');
            } else {
              alert('No data to export');
            }
          } catch (error) {
            console.error('Export CSV error:', error);
            alert('Failed to export CSV: ' + error.message);
          }
        } else {
          alert('Spreadsheet not available for export');
        }
      }
    }
  ];

  buttons.forEach(btn => {
    if (btn.type === 'separator') {
      const separator = document.createElement('div');
      separator.style.cssText = `
        width: 1px;
        height: 24px;
        background: #dadce0;
        margin: 0 4px;
      `;
      toolbar.appendChild(separator);
      return;
    }
    
    const button = document.createElement('button');
    button.textContent = btn.label;
    button.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
      white-space: nowrap;
      min-height: 32px;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#f1f3f4';
      button.style.transform = 'translateY(-1px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'white';
      button.style.transform = 'translateY(0)';
    });
    
    button.addEventListener('click', btn.action);
    toolbar.appendChild(button);
  });

  // Use a safer approach: move existing content into a wrapper and add toolbar
  const existingContent = Array.from(container.children);
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText = `
    flex: 1;
    overflow: hidden;
    position: relative;
  `;
  
  // Move all existing content to the wrapper
  existingContent.forEach(child => {
    contentWrapper.appendChild(child);
  });
  
  // Set container as flex to accommodate toolbar and content
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  
  // Add toolbar first, then the wrapper with content
  container.appendChild(toolbar);
  container.appendChild(contentWrapper);
}

// Enhanced scroll control function
function scrollSpreadsheet(spreadsheet, direction) {
  try {
    const worksheet = spreadsheet.worksheets[0];
    if (!worksheet || !worksheet.element) {
      console.warn('Worksheet element not found for scrolling');
      return;
    }
    
    // Find the scrollable container
    const scrollContainer = worksheet.element.querySelector('.jss_content') || 
                           worksheet.element.querySelector('table')?.parentElement ||
                           worksheet.element;
    
    if (!scrollContainer) {
      console.warn('Scroll container not found');
      return;
    }
    
    const scrollStep = 200;
    
    switch (direction) {
      case 'left':
        scrollContainer.scrollLeft = Math.max(0, scrollContainer.scrollLeft - scrollStep);
        break;
      case 'right':
        scrollContainer.scrollLeft += scrollStep;
        break;
      case 'top':
        scrollContainer.scrollTop = 0;
        break;
      case 'bottom':
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        break;
    }
    
    console.log(`Scrolled ${direction}`);
  } catch (error) {
    console.error('Error scrolling spreadsheet:', error);
  }
}

// Helper function to download CSV
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Helper function to convert spreadsheet data to CSV format
function convertDataToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Create CSV with headers
  const headers = ['Invoice #', 'Vendor', 'Amount', 'Due Date', 'Status', 'Assigned To', 'Actions'];
  const csvRows = [headers];
  
  // Add data rows, excluding HTML content in Actions column
  data.forEach(row => {
    const csvRow = row.map((cell, index) => {
      // For the Actions column (index 7), return a simple text instead of HTML
      if (index === 7) {
        return 'View Thread';
      }
      
      // Handle values that might contain commas or quotes
      const cellValue = String(cell || '');
      if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
        return `"${cellValue.replace(/"/g, '""')}"`;
      }
      return cellValue;
    });
    csvRows.push(csvRow);
  });
  
  // Convert to CSV string
  return csvRows.map(row => row.join(',')).join('\n');
}

// Helper function to extract a unique list of vendors for autocomplete
function getVendorList(data) {
  const vendors = data.map(invoice => invoice.vendor);
  return [...new Set(vendors)]; // Return unique vendors
}

// Helper function to transform raw invoice data into the format jspreadsheet expects
function transformDataForSpreadsheet(invoices) {
    if (!invoices) {
        return [];
    }
  return invoices.map(invoice => [
    invoice.invoiceNumber,
    invoice.vendor,
    invoice.amount,
    invoice.dueDate,
    invoice.status,
    invoice.assignedTo,
    // The threadId for the removed column is no longer here
    `<button class="view-thread-btn" data-thread-id="${invoice.threadId}">View Thread</button>`
  ]);
}

// Helper function to generate meta information for spreadsheet cells
function generateMetaInformation(invoices) {
  if (!invoices || invoices.length === 0) {
    return {};
  }
  
  const metaInfo = {};
  
  invoices.forEach((invoice, rowIndex) => {
    const row = rowIndex + 2; // jspreadsheet rows are 1-indexed + 1 for header row
    
    // Meta information for Invoice Number cells (Column A)
    // Store threadId for linking back to Gmail thread
    const invoiceCell = `A${row}`;
    metaInfo[invoiceCell] = {
      threadId: invoice.threadId,
      invoiceNumber: invoice.invoiceNumber,
      type: 'invoice_identifier'
    };
    
    // Meta information for Status cells (Column E) 
    // Store both threadId and messageId for precise message linking
    const statusCell = `E${row}`;
    metaInfo[statusCell] = {
      threadId: invoice.threadId,
      messageId: invoice.messageId || invoice.threadId, // Fallback to threadId if messageId not available
      status: invoice.status,
      type: 'status_tracker',
      lastUpdated: new Date().toISOString()
    };
    
    // The meta information for the 'Thread ID' column is now removed
  });
  
  console.log('[META INFO] Generated metadata for', Object.keys(metaInfo).length, 'cells');
  console.log('[META INFO] Sample meta data:', metaInfo);
  
  return metaInfo;
}

 