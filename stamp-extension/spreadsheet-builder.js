// stamp-extension/spreadsheet-builder.js

/**
 * This file contains all the logic for building and configuring the jspreadsheet instance
 * for the finance team's invoice tracker with comprehensive scrolling support.
 */

// Core function to initialize the spreadsheet with clean Shadow DOM approach
export async function buildSpreadsheet(container, data, opts = {}) {
  console.log('[SHADOW DOM] Starting clean jspreadsheet integration...');
  
  // Setup clean Shadow DOM container instead of CSS isolation
  const { cleanContainer, shadowRoot } = await setupShadowDOMContainer(container);
  
  // Initialize corrections batcher (requires apiClient from opts)
  const correctionsBatcher = opts.apiClient ? new CorrectionsBatcher(opts.apiClient) : null;
  if (!correctionsBatcher) {
    console.warn('[CORRECTIONS] No API client provided - corrections will not be sent');
  }

  // Handle empty data gracefully - show empty spreadsheet instead of mock data
  if (!data || data.length === 0) {
    console.log('[SPREADSHEET] No data provided, showing empty spreadsheet');
    data = [];
  }
  
  // Define columns with field mapping metadata for edit tracking
  const columns = [
    {
      title: '📄', // Document icon column (preview/open)
      width: 40,
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    },
    { 
      title: 'Invoice #', 
      width: 100, 
      type: 'text',
      fieldName: 'invoiceNumber',
      editable: true,
      filter: true
    },
    { 
      title: 'Entity Name', 
      width: 150, 
      type: 'text',
      fieldName: 'entityName',
      editable: true,
      filter: true
    },
    { 
      title: 'Vendor Name', 
      width: 150, 
      type: 'text',
      fieldName: 'vendor.name',
      editable: true,
      filter: true
    },
    { 
      title: 'Description', 
      width: 200, 
      type: 'text',
      fieldName: 'description',
      editable: true,
      filter: true
    },
    { 
      title: 'Period', 
      width: 80, 
      type: 'text',
      fieldName: 'period',
      editable: true,
      filter: true
    },
    { 
      title: 'Amount', 
      width: 120, 
      type: 'numeric', 
      mask: '$ #,##.00',
      fieldName: 'amount',
      editable: true,
      filter: true
    },
    {
      title: 'Currency',
      width: 80,
      type: 'dropdown',
      source: ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'OTHER'],
      fieldName: 'currency',
      editable: true,
      filter: true,
      options: {
        type: 'default',
        placeholder: 'Select Currency'
      }
    },
    { 
      title: 'Issue Date', 
      width: 90, 
      type: 'calendar', 
      options: { format: 'YYYY-MM-DD' },
      fieldName: 'issueDate',
      editable: true,
      filter: true
    },
    { 
      title: 'Due Date', 
      width: 90, 
      type: 'calendar', 
      options: { format: 'YYYY-MM-DD' },
      fieldName: 'dueDate',
      editable: true,
      filter: true
    },
    {
      title: 'Terms',
      width: 70,
      type: 'text',
      fieldName: 'paymentTerms',
      editable: true,
      filter: true
    },
    { 
      title: 'Status', 
      width: 90, 
      type: 'dropdown',
      source: [ 'pending', 'approved', 'rejected', 'paid', 'on_hold', 'requires_review', 'partially_approved', 'ready_for_payment', 'duplicate', 'unknown' ],
      fieldName: 'status',
      editable: true,
      filter: true
    },
    {
      title: '📤', // Gmail icon column (moved next to Status)
      width: 60,
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    },
    {
      title: 'Approver',
      width: 120,
      type: 'dropdown',
      source: ['PENDING', 'APPROVED', 'REJECTED'],
      fieldName: 'approvalStatus',
      editable: true,
      filter: true,
      options: {
        type: 'default',
        placeholder: 'Select Status'
      }
    },
    {
      title: 'Notes',
      width: 250,
      type: 'text',
      fieldName: 'notes',
      editable: true,
      filter: true
    },
    { 
      title: 'Actions', 
      width: 120, 
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    }
  ];

  // Simple in-memory PDF cache for the session
  const pdfCache = new Map(); // key: `${messageId}|${documentName}` => objectUrl

  // Transform the raw invoice data to fit the spreadsheet structure
  const spreadsheetData = transformDataForSpreadsheet(data);
  console.log('[SPREADSHEET] 📊 Transformed data for jspreadsheet:', spreadsheetData);
  console.log('[SPREADSHEET] 📋 Number of rows to display:', spreadsheetData.length);
  
  // Generate meta information for Invoice Number and Status cells
  const metaInformation = generateMetaInformation(data);
  
  // Calculate container dimensions for optimal scrolling
  const containerDimensions = calculateOptimalDimensions(container);
  const isLargeDataset = spreadsheetData.length > 50;

  // Create the spreadsheet with clean default configuration and field edit handling
  console.log('[JS001] Creating jspreadsheet, data rows:', spreadsheetData.length);
  console.log('[JS001] Column configuration:', columns);
  
  // Fix dropdown z-index issues by intercepting dropdown creation
  const originalAppendChild = document.body.appendChild;
  const originalInsertBefore = document.body.insertBefore;
  
  const applyDropdownFix = (node) => {
    if (node && node.classList && (
      node.classList.contains('jdropdown-container') ||
      node.classList.contains('jdropdown-backdrop') ||
      node.classList.contains('jcontextmenu') ||
      node.classList.contains('jdropdown-menu') ||
      node.classList.contains('jdropdown-content') ||
      node.classList.contains('jdropdown-item') ||
      node.classList.contains('jdropdown-header') ||
      node.classList.contains('jdropdown-searchbar') ||
      node.className.includes('jdropdown')
    )) {
      // Force maximum z-index for dropdowns and ensure they're not clipped
      node.style.zIndex = '999999';
      node.style.position = 'fixed';
      node.style.overflow = 'visible';
      // Ensure dropdown is positioned relative to viewport, not parent container
      if (node.classList.contains('jdropdown-container')) {
        const rect = node.getBoundingClientRect();
        node.style.top = rect.top + 'px';
        node.style.left = rect.left + 'px';
      }
      console.log('[DROPDOWN FIX] Applied z-index fix to:', node.className);
    }
  };
  
  document.body.appendChild = function(node) {
    applyDropdownFix(node);
    return originalAppendChild.call(this, node);
  };
  
  document.body.insertBefore = function(node, referenceNode) {
    applyDropdownFix(node);
    return originalInsertBefore.call(this, node, referenceNode);
  };
  
  // Also use MutationObserver to catch any dropdowns created later
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList && (
          node.classList.contains('jdropdown-container') ||
          node.classList.contains('jdropdown-backdrop') ||
          node.classList.contains('jcontextmenu')
        )) {
          // Force maximum z-index for dropdowns
          node.style.zIndex = '999999';
          node.style.position = 'fixed';
          console.log('[DROPDOWN FIX] MutationObserver applied z-index fix to:', node.className);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  const spreadsheet = jspreadsheet(cleanContainer, {
    root: shadowRoot,  // Critical parameter for Shadow DOM event handling
    toolbar: true,     // Enable the toolbar with tools
    worksheets: [{
      data: spreadsheetData,
      columns: columns,
      meta: metaInformation,  // Hidden metadata for linking to Gmail threads/messages
      
      // === ROW HEIGHT CONFIGURATION ===
      defaultRowHeight: 16, // Further reduced row height for more compact view
      minDimensions: [15, 100], // [columns, rows] - ensure we have enough space
      
      // === PAGINATION CONFIGURATION ===
      pagination: 10, // Show 10 rows per page
      paginationOptions: [10, 25, 50, 100], // Available page size options
      showPagination: true, // Ensure pagination controls are visible
      
      // === SEARCH CONFIGURATION ===
      search: true, // Enable search functionality
      
      // === USE JSPREADSHEET DEFAULTS ===
      allowComments: true,
      tableOverflow: true,  // Built-in scrolling
      tableWidth: '100%',
      tableHeight: 'auto',
      editable: true,
      allowInsertRow: true,
      allowDeleteRow: true,
      allowInsertColumn: true,
      allowDeleteColumn: true,
      allowRenameColumn: true,  // Enable column header editing
      columnSorting: true,
      columnResize: true,
      rowResize: true,
      filters: true,
      // Enhanced scrolling options
      scrollbars: true,
      horizontalScroll: true,
      verticalScroll: true
    }],
    
  // === SEARCH EVENT HANDLERS ===
  // Let jspreadsheet handle search natively
  
  // === ENHANCE EXISTING SEARCH WITH REAL-TIME FUNCTIONALITY ===
  oncreateworksheet: function(worksheet) {
    console.log('[DROPDOWN] Worksheet created - using jspreadsheet native dropdown handling');
    
    // Search functionality (keeping existing search logic)
    console.log('[SEARCH] oncreateworksheet event fired!');
    console.log('[SEARCH] Worksheet element:', worksheet.element);
    
    // Wait for jspreadsheet to create its search input
    setTimeout(() => {
      // Find the existing jspreadsheet search input
      const existingSearchInput = worksheet.element.querySelector('input[type="text"]') ||
                                 worksheet.element.querySelector('.jss_search') ||
                                 worksheet.element.querySelector('input[placeholder*="Search"]') ||
                                 worksheet.element.querySelector('input[placeholder*="search"]');
      
      console.log('[SEARCH] Found existing search input:', !!existingSearchInput);
      
      if (existingSearchInput) {
        // Add real-time search on input change
        existingSearchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value;
          console.log('[SEARCH] Real-time input change:', searchTerm);
          
          if (worksheet.search) {
            worksheet.search(searchTerm);
          }
        });
        
        // Add Enter key support
        existingSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const searchTerm = e.target.value;
            console.log('[SEARCH] Enter pressed, searching for:', searchTerm);
            
            if (worksheet.search) {
              worksheet.search(searchTerm);
            }
          }
        });
        
        console.log('[SEARCH] Real-time search functionality added to existing input');
      } else {
        console.log('[SEARCH] No existing search input found, creating custom one');
        
        // Fallback: Create custom search if jspreadsheet search not found
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 4px;
        `;
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search invoices...';
        searchInput.style.cssText = `
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        `;
        
        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.style.cssText = `
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        `;
        
        const performSearch = () => {
          const searchTerm = searchInput.value;
          console.log('[SEARCH] Custom search for:', searchTerm);
          
          if (worksheet.search) {
            worksheet.search(searchTerm);
          }
        };
        
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value;
          console.log('[SEARCH] Custom real-time search:', searchTerm);
          if (worksheet.search) {
            worksheet.search(searchTerm);
          }
        });
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            performSearch();
          }
        });
        
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(searchButton);
        worksheet.element.insertBefore(searchContainer, worksheet.element.firstChild);
        
        console.log('[SEARCH] Custom search container created');
      }
    }, 1000);
  },
  
  // === FIELD EDIT HANDLER (v5 top-level) ===
    onchange: function(instance, cell, x, y, value) {
      console.log('[JS002] Cell edit triggered, x:', x, 'y:', y, 'value:', value);
      const columnIndex = parseInt(x);
      const rowIndex = parseInt(y);
        
      // Get column definition and field mapping
      const columnDef = columns[columnIndex];
      if (!columnDef || !columnDef.fieldName || !columnDef.editable) {
        return; // Not an editable field
      }
      
      // Get the invoice data
      const invoice = data[rowIndex]; // No header row adjustment needed
      if (!invoice) return;
      
      // Skip editableFields validation - allow all edits
      // TODO: Implement proper validation using onbeforechange to prevent infinite loops
      
      console.log(`[JS003] Processing field: ${columnDef.fieldName} = ${value}`);
      handleFieldEdit(invoice, columnDef.fieldName, value, rowIndex, correctionsBatcher);
    }
  });
  const sheet = Array.isArray(spreadsheet) ? spreadsheet[0] : spreadsheet;
  console.log('[JS005] sheets:', Array.isArray(spreadsheet) ? spreadsheet.length : 1);
  
  // Debug: Check if search methods are available
  console.log('[SEARCH DEBUG] Sheet object:', sheet);
  console.log('[SEARCH DEBUG] Search method available:', typeof sheet?.search);
  console.log('[SEARCH DEBUG] ResetSearch method available:', typeof sheet?.resetSearch);
  console.log('[SEARCH DEBUG] ShowSearch method available:', typeof sheet?.showSearch);
  
  // FALLBACK: Enhance existing search or create custom one
  setTimeout(() => {
    console.log('[SEARCH FALLBACK] Looking for existing search input');
    
    // Try to find existing jspreadsheet search input
    const existingSearchInput = cleanContainer.querySelector('input[type="text"]') ||
                               cleanContainer.querySelector('.jss_search') ||
                               cleanContainer.querySelector('input[placeholder*="Search"]') ||
                               cleanContainer.querySelector('input[placeholder*="search"]');
    
    if (existingSearchInput) {
      console.log('[SEARCH FALLBACK] Found existing search input, adding real-time functionality');
      
      // Real-time search on input change
      existingSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        console.log('[SEARCH FALLBACK] Real-time input change:', searchTerm);
        if (sheet && sheet.search) {
          sheet.search(searchTerm);
        }
      });
      
      existingSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const searchTerm = e.target.value;
          console.log('[SEARCH FALLBACK] Enter pressed, searching for:', searchTerm);
          if (sheet && sheet.search) {
            sheet.search(searchTerm);
          }
        }
      });
      
      console.log('[SEARCH FALLBACK] Real-time search added to existing input');
    } else {
      console.log('[SEARCH FALLBACK] No existing search found, creating custom one');
      
      // Create custom search container
      const searchContainer = document.createElement('div');
      searchContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 4px;
      `;
      
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search invoices...';
      searchInput.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      `;
      
      const searchButton = document.createElement('button');
      searchButton.textContent = 'Search';
      searchButton.style.cssText = `
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `;
      
      const performSearch = () => {
        const searchTerm = searchInput.value;
        console.log('[SEARCH FALLBACK] Custom search for:', searchTerm);
        if (sheet && sheet.search) {
          sheet.search(searchTerm);
        }
      };
      
      searchButton.addEventListener('click', performSearch);
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        console.log('[SEARCH FALLBACK] Custom real-time search:', searchTerm);
        if (sheet && sheet.search) {
          sheet.search(searchTerm);
        }
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          performSearch();
        }
      });
      
      searchContainer.appendChild(searchInput);
      searchContainer.appendChild(searchButton);
      cleanContainer.insertBefore(searchContainer, cleanContainer.firstChild);
      
      console.log('[SEARCH FALLBACK] Custom search container created');
    }
  }, 2000);

  // === SEARCH CONTROL METHODS ===
  const searchControls = {
    // Search for specific terms
    search: (terms) => {
      console.log('[SEARCH] Searching for:', terms);
      if (sheet && sheet.search) {
        sheet.search(terms);
      } else {
        console.warn('[SEARCH] Sheet or search method not available');
      }
    },
    
    // Reset search and show all rows
    resetSearch: () => {
      console.log('[SEARCH] Resetting search');
      if (sheet && sheet.resetSearch) {
        sheet.resetSearch();
      } else {
        console.warn('[SEARCH] Sheet or resetSearch method not available');
      }
    },
    
    // Show search input box
    showSearch: () => {
      console.log('[SEARCH] Showing search input');
      if (sheet && sheet.showSearch) {
        sheet.showSearch();
      } else {
        console.warn('[SEARCH] Sheet or showSearch method not available');
      }
    },
    
    // Hide search input box
    hideSearch: () => {
      console.log('[SEARCH] Hiding search input');
      if (sheet && sheet.hideSearch) {
        sheet.hideSearch();
      } else {
        console.warn('[SEARCH] Sheet or hideSearch method not available');
      }
    },
    
    // Update search results
    updateSearch: () => {
      console.log('[SEARCH] Updating search results');
      if (sheet && sheet.updateSearch) {
        sheet.updateSearch();
      } else {
        console.warn('[SEARCH] Sheet or updateSearch method not available');
      }
    },
    
    // Debug method to check search functionality
    debugSearch: () => {
      console.log('[SEARCH DEBUG] Sheet available:', !!sheet);
      console.log('[SEARCH DEBUG] Sheet methods:', sheet ? Object.getOwnPropertyNames(sheet) : 'N/A');
      console.log('[SEARCH DEBUG] Search input element:', document.querySelector('.jss_search'));
      console.log('[SEARCH DEBUG] Search container:', document.querySelector('.jspreadsheet-search'));
      console.log('[SEARCH DEBUG] All search inputs:', document.querySelectorAll('.jss_search'));
      console.log('[SEARCH DEBUG] All filter containers:', document.querySelectorAll('.jss_filter'));
      console.log('[SEARCH DEBUG] Sheet element:', sheet ? sheet.element : 'N/A');
      console.log('[SEARCH DEBUG] Sheet search method:', sheet ? typeof sheet.search : 'N/A');
      
      // Try to find search input in sheet element
      if (sheet && sheet.element) {
        const searchInSheet = sheet.element.querySelector('.jss_search');
        console.log('[SEARCH DEBUG] Search input in sheet element:', !!searchInSheet);
        if (searchInSheet) {
          console.log('[SEARCH DEBUG] Search input value:', searchInSheet.value);
          console.log('[SEARCH DEBUG] Search input events:', searchInSheet.oninput, searchInSheet.onkeydown);
        }
      }
    }
  };

  // Add delegated handlers for Gmail icon, document preview, and inline PDF overlay
  console.log('[POPOUT] Setting up click event delegation on spreadsheet container');

  // Use the global getCurrentGmailAccount function from content.js

  // Wait a bit for jspreadsheet to fully render
  setTimeout(() => {
    // Gmail popout click
    cleanContainer.addEventListener('click', function(e) {
      const clickedElement = e.target.closest('.gmail-popout-icon');

      if (clickedElement) {
        console.log('[POPOUT] Clicked on Gmail popout icon');
        const threadId = clickedElement.getAttribute('data-thread-id');
        const messageId = clickedElement.getAttribute('data-message-id');

        console.log('[POPOUT] Retrieved data from icon:', { threadId, messageId });

        // Get current Gmail account to ensure we open in the correct account
        const accountPath = window.getCurrentGmailAccount ? window.getCurrentGmailAccount() : '/u/0';
        console.log('[POPOUT] Current Gmail account detected:', accountPath);

        if (messageId && messageId !== 'undefined') {
          const gmailMessageUrl = `https://mail.google.com/mail${accountPath}/#inbox/${messageId}`;
          console.log('[POPOUT] Opening Gmail message with sidebar action:', gmailMessageUrl);
          window.location.href = `${gmailMessageUrl}?stamp_action=open_sidebar`;
        } else if (threadId && threadId !== 'undefined') {
          const gmailThreadUrl = `https://mail.google.com/mail${accountPath}/#inbox/${threadId}`;
          console.log('[POPOUT] Opening Gmail thread with sidebar action:', gmailThreadUrl);
          window.location.href = `${gmailThreadUrl}?stamp_action=open_sidebar`;
        } else {
          console.warn('[POPOUT] No valid threadId or messageId found on the icon.');
        }
      }
    });

    // Document hover preview (thumbnail) and click to open inline overlay
    let previewEl = null;
    let overlayEl = null;

    let previewTimeout = null;
    let isPreviewHovered = false;

    const showPreview = (iconEl) => {
      // Clear any existing timeout
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
      }

      // Preview remains optional; we use thumbnail url if present
      const docUrl = iconEl.getAttribute('data-doc-url');
      const thumbUrl = iconEl.getAttribute('data-thumb-url');
      if (!docUrl) return;
      const rect = iconEl.getBoundingClientRect();
      if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.style.cssText = 'position:fixed; z-index:2147483646; width:360px; height:280px; background:#fff; box-shadow:0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05); border:none; border-radius:16px; overflow:hidden; backdrop-filter:blur(12px); transform:scale(1); transition:all 0.2s ease;';
        
        document.body.appendChild(previewEl);
        
        // Add hover events to the preview element itself
        previewEl.addEventListener('mouseenter', () => {
          isPreviewHovered = true;
          if (previewTimeout) {
            clearTimeout(previewTimeout);
            previewTimeout = null;
          }
        });
        
        previewEl.addEventListener('mouseleave', () => {
          isPreviewHovered = false;
          // Add a small delay before hiding to allow moving between icon and preview
          previewTimeout = setTimeout(() => {
            if (!isPreviewHovered) {
              previewEl.style.display = 'none';
            }
          }, 100);
        });
      }
      
      // Enhanced preview with thumbnail fallback
      const previewContent = thumbUrl ? 
        `<div style="display:flex; flex-direction:column; height:100%; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
           <div style="flex:1; background:url('${thumbUrl}') center/cover; display:flex; align-items:center; justify-content:center; background-color:#4CAF50; border-radius:12px 12px 0 0; position:relative; min-height:160px;">
             <div style="text-align:center; color:#fff; font-size:16px; background:rgba(0,0,0,0.1); padding:20px; border-radius:12px; backdrop-filter:blur(4px); border:1px solid rgba(255,255,255,0.2);">
               <div style="font-size:32px; margin-bottom:12px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📄</div>
               <div style="font-weight:700; margin-bottom:6px; font-size:18px; text-shadow:0 1px 2px rgba(0,0,0,0.3);">Sample Invoice</div>
               <div style="font-size:13px; opacity:0.9; font-weight:500;">Sample Document Preview</div>
               <div style="font-size:11px; opacity:0.8; margin-top:4px;">Click to open full document</div>
             </div>
           </div>
           <div style="padding:16px; background:#f8f9fa; border-top:1px solid #e0e0e0; text-align:center; border-radius:0 0 12px 12px;">
             <button id="preview-open-doc-btn" data-doc-url="${docUrl}" style="background:linear-gradient(135deg, #1a73e8 0%, #1557b0 100%); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(26,115,232,0.3); min-width:140px;">Open Document</button>
           </div>
         </div>` :
        `<iframe src="${docUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1" style="width:100%;height:100%;border:0;" loading="eager"></iframe>`;
      
      previewEl.innerHTML = previewContent;
      
      // Add event listener for the open document button
      const openDocBtn = previewEl.querySelector('#preview-open-doc-btn');
      if (openDocBtn) {
        openDocBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = openDocBtn.getAttribute('data-doc-url');
          if (docUrl) {
            window.open(docUrl, '_blank');
          }
        });
        
        // Add hover effects
        openDocBtn.addEventListener('mouseenter', () => {
          openDocBtn.style.background = 'linear-gradient(135deg, #1557b0 0%, #0d47a1 100%)';
          openDocBtn.style.transform = 'translateY(-2px) scale(1.02)';
          openDocBtn.style.boxShadow = '0 4px 12px rgba(26,115,232,0.4)';
        });
        
        openDocBtn.addEventListener('mouseleave', () => {
          openDocBtn.style.background = 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)';
          openDocBtn.style.transform = 'translateY(0) scale(1)';
          openDocBtn.style.boxShadow = '0 2px 8px rgba(26,115,232,0.3)';
        });
      }
      
      // Add a small invisible bridge to make it easier to move mouse between icon and preview
      const bridge = document.createElement('div');
      bridge.style.cssText = 'position:absolute; z-index:2147483645; width:20px; height:8px; background:transparent; top:-8px; left:10px;';
      previewEl.appendChild(bridge);
      
      // Add hover events to the bridge as well
      bridge.addEventListener('mouseenter', () => {
        isPreviewHovered = true;
        if (previewTimeout) {
          clearTimeout(previewTimeout);
          previewTimeout = null;
        }
      });
      
      // Position the preview closer to the icon with a small gap
      const rectLeft = Math.max(8, rect.left - 20);
      previewEl.style.top = `${Math.round(rect.bottom + 4)}px`;
      previewEl.style.left = `${Math.round(rectLeft)}px`;
      previewEl.style.display = 'block';
      
      // Add entrance animation
      previewEl.style.opacity = '0';
      previewEl.style.transform = 'scale(0.9) translateY(10px)';
      requestAnimationFrame(() => {
        previewEl.style.transition = 'all 0.2s ease';
        previewEl.style.opacity = '1';
        previewEl.style.transform = 'scale(1) translateY(0)';
      });
    };

    const hidePreview = () => {
      // Add a small delay to allow moving between icon and preview
      previewTimeout = setTimeout(() => {
        if (!isPreviewHovered && previewEl) {
          previewEl.style.display = 'none';
        }
      }, 150);
    };

    const ensureOverlay = () => {
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.style.cssText = 'position:fixed; inset:0; background:rgba(32,33,36,0.6); z-index:2147483647; display:flex; align-items:center; justify-content:center;';
        overlayEl.innerHTML = `
          <div style="width:80vw; height:80vh; background:#fff; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:10px; border-bottom:1px solid #e0e0e0; display:flex; align-items:center; justify-content:space-between;">
              <div style="font-weight:600; color:#202124;">Document Preview</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <button id="stamp-doc-zoom-out" style="border:none; background:#f3f4f6; color:#374151; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; font-size:14px;">−</button>
                <span id="stamp-doc-zoom-level" style="font-size:14px; color:#374151; min-width:50px; text-align:center;">100%</span>
                <button id="stamp-doc-zoom-in" style="border:none; background:#f3f4f6; color:#374151; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; font-size:14px;">+</button>
                <button id="stamp-doc-fit-width" style="border:none; background:#e5e7eb; color:#374151; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Fit Width</button>
                <button id="stamp-doc-close" style="border:none; background:#eef2f7; color:#1f2937; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:600;">Close</button>
              </div>
            </div>
            <div id="stamp-doc-container" style="flex:1; overflow:auto; position:relative;">
              <iframe id="stamp-doc-frame" src="" style="width:100%; height:100%; border:0; transform-origin:top left;" loading="eager"></iframe>
            </div>
          </div>`;
        document.body.appendChild(overlayEl);
        
        // Add zoom functionality
        let currentZoom = 1;
        const zoomLevel = overlayEl.querySelector('#stamp-doc-zoom-level');
        const iframe = overlayEl.querySelector('#stamp-doc-frame');
        const container = overlayEl.querySelector('#stamp-doc-container');
        
        const updateZoom = (newZoom) => {
          currentZoom = Math.max(0.25, Math.min(3, newZoom)); // Limit zoom between 25% and 300%
          iframe.style.transform = `scale(${currentZoom})`;
          iframe.style.width = `${100 / currentZoom}%`;
          iframe.style.height = `${100 / currentZoom}%`;
          zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
        };
        
        const fitToWidth = () => {
          // Reset zoom and let the PDF fit naturally
          currentZoom = 1;
          iframe.style.transform = 'scale(1)';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          zoomLevel.textContent = '100%';
        };
        
        // Add event listeners for zoom controls
        overlayEl.querySelector('#stamp-doc-zoom-out').addEventListener('click', (e) => {
          e.stopPropagation();
          updateZoom(currentZoom - 0.25);
        });
        
        overlayEl.querySelector('#stamp-doc-zoom-in').addEventListener('click', (e) => {
          e.stopPropagation();
          updateZoom(currentZoom + 0.25);
        });
        
        overlayEl.querySelector('#stamp-doc-fit-width').addEventListener('click', (e) => {
          e.stopPropagation();
          fitToWidth();
        });
        
        // Add keyboard shortcuts
        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            overlayEl.style.display = 'none';
          } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            updateZoom(currentZoom + 0.25);
          } else if (e.key === '-') {
            e.preventDefault();
            updateZoom(currentZoom - 0.25);
          } else if (e.key === '0') {
            e.preventDefault();
            fitToWidth();
          }
        };
        
        overlayEl.addEventListener('keydown', handleKeydown);
        
        // Make the overlay focusable for keyboard events
        overlayEl.setAttribute('tabindex', '0');
        overlayEl.focus();
        
        overlayEl.addEventListener('click', (evt) => {
          if (evt.target && (evt.target.id === 'stamp-doc-close' || evt.target === overlayEl)) {
            overlayEl.style.display = 'none';
            document.removeEventListener('keydown', handleKeydown);
          }
        });
      };
      reader.readAsDataURL(blob);
    };

    cleanContainer.addEventListener('mouseover', (e) => {
      const icon = e.target.closest('.doc-preview-icon');
      if (icon && icon.getAttribute('data-has-doc') === '1') {
        const docUrl = icon.getAttribute('data-doc-url');
        if (docUrl) {
          const rect = icon.getBoundingClientRect();
          const previewEl = document.createElement('div');
          previewEl.style.cssText = 'position:fixed; z-index:2147483646; width:280px; height:210px; background:#fff; box-shadow:0 8px 24px rgba(60,64,67,0.3); border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;';
          previewEl.innerHTML = `<iframe src="${docUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1" style="width:100%;height:100%;border:0;" loading="eager"></iframe>`;
          previewEl.style.top = `${Math.round(rect.bottom + 8)}px`;
          previewEl.style.left = `${Math.round(rect.left - 40)}px`;
          previewEl.style.display = 'block';
          document.body.appendChild(previewEl);
        }
      }
    });

    cleanContainer.addEventListener('mouseout', (e) => {
      const icon = e.target.closest('.doc-preview-icon');
      if (icon) {
        const previewEl = document.querySelector('.doc-preview-icon-iframe');
        if (previewEl) previewEl.style.display = 'none';
      }
    });

    // Right-side preview panel
    let rightPreviewPanel = null;
    let currentPreviewData = null;

    const showRightPreview = (iconEl) => {
      const docUrl = iconEl.getAttribute('data-doc-url');
      const thumbUrl = iconEl.getAttribute('data-thumb-url');
      const docName = iconEl.getAttribute('data-doc-name') || 'Document';
      
      console.log('[PREVIEW] Document data:', { docUrl, thumbUrl, docName });
      
      if (!docUrl) {
        console.warn('[PREVIEW] No document URL found');
        return;
      }
      
      // Detect file type
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(docUrl);
      const isPdf = /\.pdf$/i.test(docUrl);
      const fileType = isImage ? 'Image' : (isPdf ? 'PDF Document' : 'Document');
      
      console.log('[PREVIEW] Document URL is:', docUrl);
      console.log('[PREVIEW] Document name is:', docName);
      console.log('[PREVIEW] File type detected:', fileType);

      // Create or update the right preview panel
      if (!rightPreviewPanel) {
        rightPreviewPanel = document.createElement('div');
        rightPreviewPanel.id = 'stamp-right-preview-panel';
        rightPreviewPanel.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100vh;
          background: #ffffff;
          border-left: 1px solid #e0e0e0;
          box-shadow: -4px 0 12px rgba(0,0,0,0.1);
          z-index: 2147483647;
          display: none;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border: none;
          background: #f5f5f5;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        `;
        
        closeBtn.addEventListener('click', () => {
          hideRightPreview();
        });
        
        rightPreviewPanel.appendChild(closeBtn);
        document.body.appendChild(rightPreviewPanel);
      }

      // Update preview content
      const previewContent = `
        <div style="flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto;">
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">Document Preview</h3>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${docName}</p>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; background: #f8f9fa; border-radius: 8px; overflow: hidden; margin-bottom: 20px; position: relative;">
            ${docUrl ? `
              <div style="flex: 1; min-height: 300px; position: relative; background: #f8f9fa; border-radius: 8px 8px 0 0; overflow: hidden;">
                ${isImage ? `
                  <!-- Image Viewer Container -->
                  <div id="image-viewer-container" style="width: 100%; height: 100%; position: relative; background: #fff; display: flex; align-items: center; justify-content: center;">
                    <div id="image-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #666;">
                      <div style="font-size: 24px; margin-bottom: 12px;">🖼️</div>
                      <div style="font-size: 16px; font-weight: 500;">Loading Image...</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
                    </div>
                    <div id="image-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #dc2626;">
                      <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                      <div style="font-size: 16px; font-weight: 500;">Failed to load Image</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View Image" to open in new tab</div>
                    </div>
                    <img id="preview-image" 
                      src="${docUrl}" 
                      style="max-width: 100%; max-height: 100%; object-fit: contain; display: none; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  </div>
                ` : `
                  <!-- PDF Viewer Container -->
                  <div id="pdf-viewer-container" style="width: 100%; height: 100%; position: relative; background: #fff;">
                    <div id="pdf-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #666;">
                      <div style="font-size: 24px; margin-bottom: 12px;">📄</div>
                      <div style="font-size: 16px; font-weight: 500;">Loading PDF...</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
                    </div>
                    <div id="pdf-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #dc2626;">
                      <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                      <div style="font-size: 16px; font-weight: 500;">Failed to load PDF</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View PDF" to open in new tab</div>
                    </div>
                    <iframe id="pdf-iframe" 
                      src="${docUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH" 
                      style="width: 100%; height: 100%; border: none; display: none;">
                    </iframe>
                  </div>
                `}
                
                <!-- Document Info Card -->
                <div style="background: #f8f9fa; padding: 16px; border-top: 1px solid #e5e7eb;">
                  <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #374151;">Document Details</div>
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;"><strong>File:</strong> ${docName}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;"><strong>Type:</strong> ${fileType}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;"><strong>Status:</strong> <span id="document-status">Loading...</span></div>
                  
                  <!-- Quick Actions -->
                  <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
                    <button id="preview-quick-view-btn" data-doc-url="${docUrl}" style="
                      padding: 6px 12px; 
                      background: #1a73e8; 
                      color: white; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer; 
                      font-size: 11px; 
                      font-weight: 500;
                      transition: all 0.2s ease;
                    ">
                      View ${isImage ? 'Image' : 'PDF'}
                    </button>
                    <button id="preview-quick-download-btn" data-doc-url="${docUrl}" data-doc-name="${docName}" style="
                      padding: 6px 12px; 
                      background: #34a853; 
                      color: white; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer; 
                      font-size: 11px; 
                      font-weight: 500;
                      transition: all 0.2s ease;
                    ">
                      Download
                    </button>
                    <button id="preview-quick-copy-btn" data-doc-url="${docUrl}" style="
                      padding: 6px 12px; 
                      background: #ea4335; 
                      color: white; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer; 
                      font-size: 11px; 
                      font-weight: 500;
                      transition: all 0.2s ease;
                    ">
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            ` : `
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #f5f5f5; min-height: 200px;">
                <div style="text-align: center; color: #666;">
                  <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
                  <div style="font-size: 16px; font-weight: 500;">Document Preview</div>
                  <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">No document available</div>
                </div>
              </div>
            `}
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button id="preview-open-doc-btn" data-doc-url="${docUrl}" style="
              flex: 1;
              padding: 12px 20px;
              background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s ease;
              box-shadow: 0 2px 8px rgba(26,115,232,0.3);
            ">Open Document</button>
            <button id="preview-download-btn" data-doc-url="${docUrl}" data-doc-name="${docName}" style="
              padding: 12px 20px;
              background: #f8f9fa;
              color: #374151;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s ease;
            ">Download</button>
          </div>
        </div>
      `;
      
      rightPreviewPanel.innerHTML = previewContent;
      
      // Add image loading handlers
      const previewImage = rightPreviewPanel.querySelector('#preview-image');
      const imageLoading = rightPreviewPanel.querySelector('#image-loading');
      const imageError = rightPreviewPanel.querySelector('#image-error');
      const documentStatus = rightPreviewPanel.querySelector('#document-status');
      
      if (previewImage) {
        const handleImageLoad = () => {
          console.log('[PREVIEW] Image loaded successfully');
          if (imageLoading) imageLoading.style.display = 'none';
          if (imageError) imageError.style.display = 'none';
          if (previewImage) previewImage.style.display = 'block';
          if (documentStatus) documentStatus.textContent = 'Ready to View';
        };
        
        const handleImageError = () => {
          console.log('[PREVIEW] Image failed to load');
          if (imageLoading) imageLoading.style.display = 'none';
          if (imageError) imageError.style.display = 'block';
          if (previewImage) previewImage.style.display = 'none';
          if (documentStatus) documentStatus.textContent = 'Failed to Load';
        };
        
        // Set up event listeners
        previewImage.addEventListener('load', handleImageLoad);
        previewImage.addEventListener('error', handleImageError);
        
        // Timeout fallback
        setTimeout(() => {
          if (imageLoading && imageLoading.style.display !== 'none') {
            console.log('[PREVIEW] Image loading timeout');
            handleImageError();
          }
        }, 5000); // 5 second timeout
      }
      
      // Add PDF loading handlers
      const pdfIframe = rightPreviewPanel.querySelector('#pdf-iframe');
      const pdfLoading = rightPreviewPanel.querySelector('#pdf-loading');
      const pdfError = rightPreviewPanel.querySelector('#pdf-error');
      
      if (pdfIframe) {
        const handlePdfLoad = () => {
          console.log('[PREVIEW] PDF loaded successfully');
          if (pdfLoading) pdfLoading.style.display = 'none';
          if (pdfError) pdfError.style.display = 'none';
          if (pdfIframe) pdfIframe.style.display = 'block';
          if (documentStatus) documentStatus.textContent = 'Ready to View';
        };
        
        const handlePdfError = () => {
          console.log('[PREVIEW] PDF failed to load - likely due to CSP restrictions');
          if (pdfLoading) pdfLoading.style.display = 'none';
          if (pdfError) pdfError.style.display = 'block';
          if (pdfIframe) pdfIframe.style.display = 'none';
          if (documentStatus) documentStatus.textContent = 'Cannot Embed - Click "View PDF"';
        };
        
        // Set up event listeners
        pdfIframe.addEventListener('load', handlePdfLoad);
        pdfIframe.addEventListener('error', handlePdfError);
        
        // Timeout fallback
        setTimeout(() => {
          if (pdfLoading && pdfLoading.style.display !== 'none') {
            console.log('[PREVIEW] PDF loading timeout - likely CSP issue');
            handlePdfError();
          }
        }, 5000); // 5 second timeout for CSP issues
        
        // Check for CSP errors in console
        const originalError = console.error;
        console.error = function(...args) {
          if (args[0] && args[0].includes && args[0].includes('Refused to frame')) {
            console.log('[PREVIEW] Detected CSP frame error');
            setTimeout(() => handlePdfError(), 1000);
          }
          originalError.apply(console, args);
        };
      }
      
      // Add event listeners for main buttons
      const openDocBtn = rightPreviewPanel.querySelector('#preview-open-doc-btn');
      const downloadBtn = rightPreviewPanel.querySelector('#preview-download-btn');
      
      if (openDocBtn) {
        openDocBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = openDocBtn.getAttribute('data-doc-url');
          if (docUrl) {
            window.open(docUrl, '_blank');
          }
        });
        
        // Add hover effects
        openDocBtn.addEventListener('mouseenter', () => {
          openDocBtn.style.background = 'linear-gradient(135deg, #1557b0 0%, #0d47a1 100%)';
          openDocBtn.style.transform = 'translateY(-1px)';
          openDocBtn.style.boxShadow = '0 4px 12px rgba(26,115,232,0.4)';
        });
        
        openDocBtn.addEventListener('mouseleave', () => {
          openDocBtn.style.background = 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)';
          openDocBtn.style.transform = 'translateY(0)';
          openDocBtn.style.boxShadow = '0 2px 8px rgba(26,115,232,0.3)';
        });
      }
      
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = downloadBtn.getAttribute('data-doc-url');
          if (docUrl) {
            const link = document.createElement('a');
            link.href = docUrl;
            link.download = docName;
            link.click();
          }
        });
        
        // Add hover effects
        downloadBtn.addEventListener('mouseenter', () => {
          downloadBtn.style.background = '#e5e7eb';
          downloadBtn.style.borderColor = '#9ca3af';
        });
        
        downloadBtn.addEventListener('mouseleave', () => {
          downloadBtn.style.background = '#f8f9fa';
          downloadBtn.style.borderColor = '#d1d5db';
        });
      }
      
      // Add event listeners for quick action buttons
      const quickViewBtn = rightPreviewPanel.querySelector('#preview-quick-view-btn');
      const quickDownloadBtn = rightPreviewPanel.querySelector('#preview-quick-download-btn');
      const quickCopyBtn = rightPreviewPanel.querySelector('#preview-quick-copy-btn');
      
      if (quickViewBtn) {
        quickViewBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = quickViewBtn.getAttribute('data-doc-url');
          if (docUrl) {
            window.open(docUrl, '_blank');
          }
        });
        
        // Add hover effects
        quickViewBtn.addEventListener('mouseenter', () => {
          quickViewBtn.style.background = 'rgba(255,255,255,0.3)';
        });
        
        quickViewBtn.addEventListener('mouseleave', () => {
          quickViewBtn.style.background = 'rgba(255,255,255,0.2)';
        });
      }
      
      if (quickDownloadBtn) {
        quickDownloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = quickDownloadBtn.getAttribute('data-doc-url');
          const docName = quickDownloadBtn.getAttribute('data-doc-name');
          if (docUrl) {
            const link = document.createElement('a');
            link.href = docUrl;
            link.download = docName || 'document.pdf';
            link.click();
          }
        });
        
        // Add hover effects
        quickDownloadBtn.addEventListener('mouseenter', () => {
          quickDownloadBtn.style.background = 'rgba(255,255,255,0.3)';
        });
        
        quickDownloadBtn.addEventListener('mouseleave', () => {
          quickDownloadBtn.style.background = 'rgba(255,255,255,0.2)';
        });
      }
      
      if (quickCopyBtn) {
        quickCopyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docUrl = quickCopyBtn.getAttribute('data-doc-url');
          if (docUrl) {
            window.copyDocumentLink(docUrl);
          }
        });
        
        // Add hover effects
        quickCopyBtn.addEventListener('mouseenter', () => {
          quickCopyBtn.style.background = 'rgba(255,255,255,0.3)';
        });
        
        quickCopyBtn.addEventListener('mouseleave', () => {
          quickCopyBtn.style.background = 'rgba(255,255,255,0.2)';
        });
      }
      
      // Add global download function
      window.downloadDocument = function(url, filename) {
        console.log('[PREVIEW] Downloading document:', { url, filename });
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename || 'document';
          link.click();
        } catch (error) {
          console.error('[PREVIEW] Download failed:', error);
        }
      };
      
      // Add global copy function
      window.copyDocumentLink = function(url) {
        console.log('[PREVIEW] Copying document link:', url);
        try {
          navigator.clipboard.writeText(url).then(() => {
            // Show temporary success message
            const notification = document.createElement('div');
            notification.textContent = 'Link copied to clipboard!';
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #10b981;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              z-index: 10000;
              box-shadow: 0 4px 12px rgba(16,185,129,0.3);
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 3000);
          });
        } catch (error) {
          console.error('[PREVIEW] Copy failed:', error);
          alert('Failed to copy link. Please copy manually: ' + url);
        }
      };
      
      // Show the panel with animation
      console.log('[PREVIEW] Showing right preview panel');
      console.log('[PREVIEW] Panel element:', rightPreviewPanel);
      console.log('[PREVIEW] Panel computed style before:', window.getComputedStyle(rightPreviewPanel).display);
      
      rightPreviewPanel.style.display = 'flex';
      
      // Force a reflow to ensure the display change takes effect
      rightPreviewPanel.offsetHeight;
      
      console.log('[PREVIEW] Panel computed style after:', window.getComputedStyle(rightPreviewPanel).display);
      console.log('[PREVIEW] Panel position:', rightPreviewPanel.getBoundingClientRect());
      
      // Then animate the transform
      rightPreviewPanel.style.transform = 'translateX(0)';
      currentPreviewData = { docUrl, thumbUrl, docName };
      console.log('[PREVIEW] Panel should now be visible');
    };

    const hideRightPreview = () => {
      if (rightPreviewPanel) {
        rightPreviewPanel.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (rightPreviewPanel) {
            rightPreviewPanel.style.display = 'none';
          }
        }, 300);
      }
    };

    cleanContainer.addEventListener('click', async (e) => {
      console.log('[DOC] Click detected on:', e.target);
      const icon = e.target.closest('.doc-preview-icon');
      console.log('[DOC] Found doc icon:', icon);
      
      if (!icon) return;
      
      const hasDoc = icon.getAttribute('data-has-doc') === '1';
      console.log('[DOC] Has document:', hasDoc);
      
      if (!hasDoc) return;

      console.log('[DOC] Document icon clicked, showing right preview panel');
      
      // Show the right-side preview panel
      showRightPreview(icon);
    });
  }, 500);

  // Return spreadsheet, corrections batcher, and search controls
  return { 
    spreadsheet, 
    correctionsBatcher,
    searchControls,
    cleanup: () => {
      console.log('[CLEANUP] Spreadsheet cleanup called');
    }
  };
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
      // Context Guard: If the extension context is invalidated, stop immediately.
      if (!chrome.runtime?.id) {
        console.warn('[SHADOW DOM] Extension context invalidated. Halting CSS load.');
        return false;
      }

      console.log('[SHADOW DOM] Loading local CSS files...');
      
    // Get CSS and JS file URLs
    const jspreadsheetUrl = chrome.runtime.getURL('jspreadsheet.css');
    const jsuitesUrl = chrome.runtime.getURL('jsuites.css');
    const jsuitesJsUrl = chrome.runtime.getURL('jsuites.js');
    const stampThemeUrl = chrome.runtime.getURL('stamp-spreadsheet-theme.css');
      
      console.log('[SHADOW DOM] CSS and JS URLs:', {
        jspreadsheet: jspreadsheetUrl,
        jsuites: jsuitesUrl,
        jsuitesJs: jsuitesJsUrl,
        stampTheme: stampThemeUrl
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
      
      // Read stamp theme CSS content with better error handling
      const stampThemeResponse = await fetch(stampThemeUrl);
      if (!stampThemeResponse.ok) {
        throw new Error(`Failed to fetch stamp-spreadsheet-theme.css: ${stampThemeResponse.status} ${stampThemeResponse.statusText}`);
      }
      const stampThemeCss = await stampThemeResponse.text();
    console.log('[SHADOW DOM] ✅ stamp-spreadsheet-theme.css loaded, size:', stampThemeCss.length);
    console.log('[SHADOW DOM] Theme CSS preview:', stampThemeCss.substring(0, 200) + '...');

    // Load jsuites.js library for dropdown functionality
    const jsuitesJsResponse = await fetch(jsuitesJsUrl);
    if (!jsuitesJsResponse.ok) {
      throw new Error(`Failed to fetch jsuites.js: ${jsuitesJsResponse.status} ${jsuitesJsResponse.statusText}`);
    }
    console.log('[SHADOW DOM] ✅ jsuites.js available at:', jsuitesJsUrl);

    // Create script element for jsuites (load as external script to avoid CSP issues)
    const jsuitesScript = document.createElement('script');
    jsuitesScript.src = jsuitesJsUrl;
    jsuitesScript.type = 'text/javascript';
    shadowRoot.appendChild(jsuitesScript);
    
    // Wait for jsuites to load before proceeding
    await new Promise(resolve => {
      jsuitesScript.onload = resolve;
      setTimeout(resolve, 100); // Fallback timeout
    });

    // Create style element with combined CSS content
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        /* Material Icons - Required for toolbar */
        @import url("https://fonts.googleapis.com/css?family=Material+Icons");
        
        /* jspreadsheet.css */
        ${jspreadsheetCss}
        
        /* jsuites.css */
        ${jsuitesCss}
        
        /* stamp-spreadsheet-theme.css - Custom green theme (loaded last for override) */
        ${stampThemeCss}
      `;
      styleElement.setAttribute('data-theme', 'stamp-green');
      shadowRoot.appendChild(styleElement);
      
      console.log('[SHADOW DOM] ✅ Local CSS files loaded successfully');
      return true;
    } catch (err) {
      console.error('[SHADOW DOM] Failed to load local CSS files:', err);
      return false;
    }
  };

  // Minimal inline CSS fallback injected into the Shadow DOM if local CSS fails
  function injectMinimalCSSFallback() {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .jspreadsheet-clean-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #111827;
        background: #ffffff;
      }
      /* Basic table appearance so jspreadsheet remains readable without full CSS */
      .jexcel, .jspreadsheet, .jss_container, .jss_worksheet {
        font-size: 12px;
        line-height: 1.2;
      }
      .jexcel td, .jspreadsheet td, .jexcel th, .jspreadsheet th {
        border: 1px solid #e5e7eb;
        padding: 2px 6px;
        height: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: #fff;
      }
      .jexcel tr, .jspreadsheet tr { height: 16px; }
      .jexcel thead th, .jspreadsheet thead th,
      .jexcel thead td, .jspreadsheet thead td,
      .jss_worksheet thead td {
        background: #10b981 !important;
        color: white !important;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      /* Keep filter row green but ensure filter icons are visible */
      .jexcel thead tr.jss_filter td, .jspreadsheet thead tr.jss_filter td,
      .jss_worksheet thead tr.jss_filter td {
        background: #10b981 !important;
        color: white !important;
        font-weight: normal !important;
        text-transform: none !important;
        letter-spacing: normal !important;
        font-size: 12px !important;
        text-align: left !important;
        border: 1px solid #047857 !important;
      }
      /* Ensure filter icons are visible on green background */
      .jss_worksheet .jss_column_filter {
        background-repeat: no-repeat !important;
        background-position: top 50% right 5px !important;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='18px' height='18px'%3E%3Cpath d='M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z'/%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3C/svg%3E") !important;
        text-overflow: ellipsis !important;
        overflow: hidden !important;
        padding: 0px !important;
        padding-left: 6px !important;
        padding-right: 20px !important;
      }
      .jexcel .selected, .jspreadsheet .selected { outline: 2px solid #10b981; }
      .jexcel .highlight, .jspreadsheet .highlight { background: #f3f4f6; }
      .jss_highlight { background: #fef3c7 !important; border: 1px solid #f59e0b !important; }
      
      /* Minimal Pagination and Search Controls Styling */
      .jss_filter, .jss_pagination {
        margin: 8px 0;
      }
      .jss_filter input, .jss_pagination select {
        border: 1px solid #d1d5db;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 14px;
      }
      .jss_pagination > div > div {
        border: 1px solid #d1d5db;
        border-radius: 4px;
        cursor: pointer;
      }
      .jss_page_selected {
        background: #10b981;
        color: white;
        border-color: #10b981;
      }
      
      /* Fix dropdown z-index issues - Much higher values */
      .jdropdown-container {
        z-index: 999999 !important;
        position: relative !important;
      }
      .jdropdown-backdrop {
        z-index: 999998 !important;
      }
      .jcontextmenu {
        z-index: 999997 !important;
      }
      .jtoolbar-container {
        z-index: 999996 !important;
      }
      .jdropdown-focus .jdropdown-container {
        z-index: 999999 !important;
      }
      .jdropdown-searchbar.jdropdown-focus {
        z-index: 999998 !important;
      }
      .jdropdown-searchbar.jdropdown-focus .jdropdown-container-header {
        z-index: 999999 !important;
      }
      .jtoolbar .jdropdown {
        position: relative !important;
        z-index: 999995 !important;
      }
      .jtoolbar .jdropdown-focus {
        z-index: 999999 !important;
      }
      .jss_toolbar .jdropdown-container,
      .jss_toolbar .jdropdown-backdrop,
      .jss_toolbar .jcontextmenu {
        z-index: 999999 !important;
      }
      .jdropdown,
      .jdropdown-menu,
      .jdropdown-content,
      .jdropdown-item {
        z-index: 999999 !important;
      }
      .jss_toolbar {
        z-index: 999990 !important;
        position: relative !important;
      }
    `;
    shadowRoot.appendChild(style);
  }

  // Create a clean container element for jspreadsheet
  const cleanContainer = document.createElement('div');
  cleanContainer.className = 'jspreadsheet-clean-container jspreadsheet-container';
  cleanContainer.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 80vh;
    max-width: 100%;
  `;

  // Attach the shadow host to the provided container
  container.innerHTML = '';
  container.appendChild(shadowHost);
  shadowRoot.appendChild(cleanContainer);

  // Attempt to load local CSS, and if not available, fall back to a minimal inline style
  const loaded = await loadLocalCSS();
  if (!loaded) {
    console.warn('[SHADOW DOM] Falling back to minimal inline CSS due to load failure');
    injectMinimalCSSFallback();
  }

  return { cleanContainer, shadowRoot };
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




// Helper function to transform raw invoice data into the format jspreadsheet expects
function transformDataForSpreadsheet(invoices) {
    if (!invoices) {
        return [];
    }
  return invoices.map(invoice => {
    // Handle new document structure with different document types
    const details = invoice.document?.details || {};
    const documentType = invoice.documentType;
    const isReceipt = documentType === 'receipt';

    const statusThreadId = invoice.statusThreadId || '';
    const statusMessageId = invoice.statusMessageId || '';

    // Document identity (for preview icon)
    const docThreadId = invoice.document?.thread_id || '';
    const docName = invoice.document?.document_name || '';

    // Optional document/thumbnail URLs (best-effort)
    const docUrl = details.documentUrl || details.document_url || invoice.document?.url || '';
    const thumbUrl = details.thumbnailUrl || details.thumbnail_url || invoice.document?.thumbnailUrl || invoice.document?.thumbnail_url || '';

    // Document icon with click-to-open behavior (always render; disabled if missing identifiers)
    const hasDoc = !!(docThreadId && docName);
    const hasSampleDoc = !!(docUrl && docUrl.includes('w3.org')); // Check if it's our sample document
    const docIcon = `
      <span class="doc-preview-icon" 
            data-doc-url="${docUrl}"
            data-thumb-url="${thumbUrl}"
            data-has-doc="${hasDoc ? '1' : '0'}"
            data-thread-id="${docThreadId}"
            data-doc-name="${docName}"
            title="${hasDoc ? (hasSampleDoc ? 'Sample Document - Preview available' : 'Preview document') : 'No document available'}"
            style="${hasDoc ? 
              (hasSampleDoc ? 
                'cursor: pointer; color: #1a73e8; background: #e8f0fe; border: 1px solid #dadce0; border-radius: 4px;' : 
                'cursor: pointer; color: #5f6368;'
              ) : 
              'cursor: not-allowed; color: #c0c0c0;'
            } font-size: 14px; padding: 4px; margin: 0; line-height: 1; height: 24px; width: 24px; display: flex; align-items: center; justify-content: center; user-select: none; transition: all 0.2s ease;">${hasSampleDoc ? '📋' : '📄'}</span>
    `;

    // Gmail popout icon should use document IDs (thread_id/message_id)
    const popoutIcon = invoice.document?.thread_id || invoice.document?.message_id ?
      `<span class="gmail-popout-icon" 
            data-thread-id="${invoice.document?.thread_id || ''}" 
            data-message-id="${invoice.document?.message_id || ''}"
            title="Open in Gmail"
            style="cursor: pointer; font-size: 14px; color: #1a73e8; padding: 2px; margin: 0; line-height: 1; height: 20px; width: 20px; display: flex; align-items: center; justify-content: center; user-select: none;">📤</span>` :
      '<span style="color: #ccc; font-size: 12px;">-</span>';

    // Process involvementHistory to get the latest action for each person
    const latestActions = new Map();
    if (Array.isArray(invoice.involvementHistory)) {
      invoice.involvementHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      invoice.involvementHistory.forEach(entry => {
        const person = entry.actor?.name || entry.actor?.email;
        if (person && !latestActions.has(person)) {
          latestActions.set(person, entry.action_type || 'No action specified');
        }
      });
    }
    
    // Format the latest actions for display
    const involvementText = Array.from(latestActions)
      .map(([person, action]) => `${person} | ${action}`)
      .join('\n');

    // Document type-specific field mappings
    // (a) Invoice/Receipt Number
    const invoiceNumber = isReceipt ? 
      (invoice.receiptNumber || 'N/A') : 
      (details.invoiceNumber || 'N/A');

    // (b) Entity Name for both receipts and invoices
    const entityName = details.entityName || null;

    // (c) Description
    const description = isReceipt ? 
      (details.notes || invoice.notes || '') : 
      (details.description || '');

    // (d) Issue Date
    const issueDate = isReceipt ? 
      (details.date || '') : 
      (details.issueDate || '');

    // Debug invoice structure before status extraction
    console.log(`[STATUS DEBUG] Invoice structure:`, {
      'invoice.status': invoice.status,
      'invoice.document?.details?.status': invoice.document?.details?.status,
      'topLevelFields': Object.keys(invoice),
      'fullInvoice': invoice
    });

    // (e) Status - use API status from document details, fallback to processed status
    const status = invoice.document?.details?.status || invoice.status || 'unknown';
    
    console.log(`[STATUS DEBUG] Final status for invoice ${invoice.document?.details?.invoiceNumber || 'unknown'}: "${status}"`);
    if (invoice.status !== status) {
      console.warn(`[STATUS MISMATCH] Expected "${invoice.status}" but got "${status}"`);
    }

    return [
      docIcon, // New first column
      invoiceNumber,        // Updated for receipts
      entityName,           // Updated for receipts
      details.vendor?.name || invoice.vendor?.name || 'N/A',
      description,          // Updated for receipts
      details.period || '',
      details.amount || invoice.amount || null,
      details.currency || invoice.currency || 'USD',
      issueDate,           // Updated for receipts
      details.dueDate || '',
      details.paymentTerms || '',
      status,              // Updated for receipts
      popoutIcon,
      involvementText || '',
      details.notes || invoice.notes || '',
      statusThreadId ? `<button class="view-thread-btn" data-thread-id="${statusThreadId}">View Thread</button>` : ''
    ];
  });
}

// Helper function to generate meta information for spreadsheet cells
function generateMetaInformation(invoices) {
  if (!invoices || invoices.length === 0) {
    return {};
  }
  
  const metaInfo = {};
  
  invoices.forEach((invoice, rowIndex) => {
    // Row mapping: 
    // - Row 1 (A1, B1, etc.) = Header row (no metadata)
    // - Row 2 (A2, B2, etc.) = Invoice 0 (first invoice)
    // - Row 3 (A3, B3, etc.) = Invoice 1 (second invoice)
    const row = rowIndex + 2; // rowIndex 0 -> row 2, rowIndex 1 -> row 3, etc.
    
    // Debug: Show what fields are available in the invoice
    console.log(`[META DEBUG] Invoice ${rowIndex} raw data:`, {
      statusThreadId: invoice.statusThreadId,
      statusMessageId: invoice.statusMessageId,
      doc_thread_id: invoice.document?.thread_id,
      doc_message_id: invoice.document?.message_id,
      invoiceNumber: invoice.document?.details?.invoiceNumber
    });
    
    // Only create metadata if we have valid status thread/message IDs
    const threadId = invoice.statusThreadId;
    const messageId = invoice.statusMessageId;

    if (threadId || messageId) {
      // Meta information for Invoice Number cells (Column B - shifted from A)
      const invoiceCell = `B${row}`;
      metaInfo[invoiceCell] = {
        threadId: threadId,
        invoiceNumber: invoice.document?.details?.invoiceNumber,
        type: 'invoice_identifier'
      };

      // Meta information for Status cells (Column L before Gmail icon) remains same
      const statusCell = `L${row}`; // Column 12 (1-indexed) -> Status
      metaInfo[statusCell] = {
        threadId: threadId,
        messageId: messageId,
        type: 'status_cell'
      };
    }
  });

  return metaInfo;
}

// === SIMPLIFIED CORRECTIONS BATCHER ===
class CorrectionsBatcher {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.pendingCorrections = new Map();
    this.sent = false; // Prevent duplicate sends
  }

  addCorrection(messageId, contentHash, documentId, documentType, fieldName, newValue) {
    console.log(`[JS004] Queued correction: ${fieldName} = ${newValue}`);
    
    // Create a unique key for this specific field correction
    const correctionKey = `${documentId}_${fieldName}_${Date.now()}`;
    
    // Each field change gets its own correction object matching backend API
    this.pendingCorrections.set(correctionKey, {
      document_id: documentId || null,
      document_type: documentType || 'invoice',
      field_name: fieldName,
      new_value: newValue
    });
    
    console.log(`[BATCH] ${this.pendingCorrections.size} corrections queued`);
  }

  // Send via regular async API call
  async sendBatch() {
    if (this.sent || this.pendingCorrections.size === 0) return;
    this.sent = true;
    
    const edits = Array.from(this.pendingCorrections.values());
    console.log(`[BATCH] Sending ${edits.length} corrections`);
    
    try {
      const response = await this.apiClient.makeAuthenticatedRequest('/api/finops/documents/corrections', {
        method: 'POST',
        body: JSON.stringify({ 
          edits: edits,
          propagate: true 
        })
      });
      
      if (response.ok) {
        console.log('[BATCH] ✅ Corrections sent successfully');
        this.pendingCorrections.clear();
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('[BATCH] ❌ Failed to send corrections:', error);
      this.sent = false; // Allow retry
    }
  }

  // Send via sendBeacon for guaranteed delivery during page unload
  sendBeaconBatch() {
    if (this.sent || this.pendingCorrections.size === 0) return;
    this.sent = true;

    const edits = Array.from(this.pendingCorrections.values());
    const success = navigator.sendBeacon('/api/finops/documents/corrections', JSON.stringify({ 
      edits: edits,
      propagate: true 
    }));

    if (success) {
      console.log(`[BATCH] ✅ Sent ${edits.length} corrections via sendBeacon`);
      this.pendingCorrections.clear();
    } else {
      console.error('[BATCH] ❌ sendBeacon failed');
      this.sent = false;
    }
  }

  hasPendingCorrections() {
    return this.pendingCorrections.size > 0;
  }
}

// === FIELD EDITING HELPER FUNCTIONS ===

function handleFieldEdit(invoice, fieldName, newValue, invoiceIndex, batcher) {
  console.log(`[EDIT] Invoice ${invoiceIndex}: ${fieldName} = ${newValue}`);
  
  // Update local data
  if (fieldName.includes('.')) {
    const [parent, child] = fieldName.split('.');
    if (!invoice[parent]) invoice[parent] = {};
    invoice[parent][child] = newValue;
  } else {
    invoice[fieldName] = newValue;
  }
  
  // Queue correction (don't send immediately)
  const messageId = invoice.document?.message_id;
  const contentHash = invoice.document?.content_hash;
  const documentId = invoice.document?.details?.id;
  const documentType = invoice.documentType || 'invoice';
  
  console.log(`[EDIT] ✅ Extracted document ID: ${documentId} for field: ${fieldName}`);
  
  if (documentId && batcher) {
    batcher.addCorrection(messageId, contentHash, documentId, documentType, fieldName, newValue);
  } else if (!documentId) {
    console.warn(`[EDIT] ❌ No document_id found at invoice.document.details.id for invoice ${invoiceIndex}`);
  }
}

/**
 * Gets the original value for a field from the invoice data
 * @param {Object} invoice - The invoice object
 * @param {string} fieldName - The field name to get
 * @returns {*} The original value
 */
function getOriginalValue(invoice, fieldName) {
  if (fieldName.includes('.')) {
    const [parent, child] = fieldName.split('.');
    return invoice[parent] ? invoice[parent][child] : '';
  } else {
    return invoice[fieldName] || '';
  }
}

/**
 * USAGE EXAMPLE:
 * 
 * // Build the spreadsheet with search and pagination
 * const { spreadsheet, searchControls } = await buildSpreadsheet(container, data, opts);
 * 
 * // Use search controls programmatically
 * searchControls.search('invoice'); // Search for "invoice" in all cells
 * searchControls.resetSearch(); // Clear search and show all rows
 * searchControls.showSearch(); // Show the search input box
 * searchControls.hideSearch(); // Hide the search input box
 * 
 * // The spreadsheet now includes:
 * // - Pagination controls (10, 25, 50, 100 rows per page)
 * // - Search input box with highlighting
 * // - Custom search events for cell highlighting
 * // - All standard jspreadsheet functionality
 */

// Mock data generator removed - now using production backend data only

 