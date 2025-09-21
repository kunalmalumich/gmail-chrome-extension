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

  // Use mock data if no real data is provided
  if (!data || data.length === 0) {
    console.log('[MOCK DATA] No data provided, using mock data for demonstration');
    data = generateMockData();
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
      width: 120, 
      type: 'text',
      fieldName: 'entityName',
      editable: true,
      filter: true
    },
    { 
      title: 'Vendor Name', 
      width: 120, 
      type: 'text',
      fieldName: 'vendor.name',
      editable: true,
      filter: true
    },
    { 
      title: 'Invoice Description', 
      width: 100, 
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
      width: 80, 
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
      editable: true,
      allowInsertRow: true,
      allowDeleteRow: true,
      allowInsertColumn: true,
      allowDeleteColumn: true,
      allowRenameColumn: true,  // Enable column header editing
      columnSorting: true,
      columnResize: true,
      rowResize: true,
      filters: true
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
      
      // Check if field is in editableFields array
      if (!invoice.editableFields || !invoice.editableFields.includes(columnDef.fieldName)) {
        console.warn(`[EDIT] Field "${columnDef.fieldName}" is not editable for this invoice`);

        // Revert to original value
        const originalValue = getOriginalValue(invoice, columnDef.fieldName);
        instance.setValueFromCoords(x, y, originalValue);
        return;
      }
      
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
      }
      return overlayEl;
    };

    const openOverlayUrl = (url) => {
      const el = ensureOverlay();
      el.querySelector('#stamp-doc-frame').setAttribute('src', url);
      el.style.display = 'flex';
    };

    cleanContainer.addEventListener('mouseover', (e) => {
      const icon = e.target.closest('.doc-preview-icon');
      if (icon && icon.getAttribute('data-has-doc') === '1') showPreview(icon);
    });

    cleanContainer.addEventListener('mouseout', (e) => {
      const icon = e.target.closest('.doc-preview-icon');
      if (icon) hidePreview();
    });

    cleanContainer.addEventListener('click', async (e) => {
      const icon = e.target.closest('.doc-preview-icon');
      if (!icon) return;
      const hasDoc = icon.getAttribute('data-has-doc') === '1';
      if (!hasDoc) return;

      const threadId = icon.getAttribute('data-thread-id');
      const documentName = icon.getAttribute('data-doc-name');
      const cacheKey = `${threadId}|${documentName}`;

      // Try cache first
      let objectUrl = pdfCache.get(cacheKey);
      if (objectUrl) {
        console.log('[DOC] Cache hit for', cacheKey);
        openOverlayUrl(objectUrl);
        return;
      }

      // No cache: fetch via authenticated client hook
      try {
        console.log('[DOC] Cache miss. Fetching PDF via hook for', { threadId, documentName });
        if (!opts.fetchPdf) {
          console.warn('[DOC] No fetchPdf hook provided. Cannot stream PDF.');
          return;
        }
        const blob = await opts.fetchPdf({ threadId, documentName });
        objectUrl = URL.createObjectURL(blob);
        // Small LRU: cap at 25 items
        if (pdfCache.size > 25) {
          const firstKey = pdfCache.keys().next().value;
          const oldUrl = pdfCache.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          pdfCache.delete(firstKey);
        }
        pdfCache.set(cacheKey, objectUrl);
        openOverlayUrl(objectUrl);
      } catch (err) {
        console.error('[DOC] Failed to fetch PDF:', err);
      }
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
    const jsuitesJs = await jsuitesJsResponse.text();
    console.log('[SHADOW DOM] ✅ jsuites.js loaded, size:', jsuitesJs.length);

    // Create script element for jsuites (load first)
    const jsuitesScript = document.createElement('script');
    jsuitesScript.textContent = jsuitesJs;
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
      .jexcel thead th, .jspreadsheet thead th {
        background: linear-gradient(135deg, #10b981 0%, #059669 50%, #065f46 100%);
        color: white;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
    `;
    shadowRoot.appendChild(style);
  }

  // Create a clean container element for jspreadsheet
  const cleanContainer = document.createElement('div');
  cleanContainer.className = 'jspreadsheet-clean-container';
  cleanContainer.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
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

    // (b) Entity Name for receipts: combine units + property addresses
    let entityName = '';
    if (isReceipt) {
      const units = details.units || [];
      const propertyAddresses = details.property_addresses || [];
      const unitsText = units.length > 0 ? units.join(', ') : '';
      const addressText = propertyAddresses.length > 0 ? propertyAddresses.map(addr => {
        // Handle both string and object cases
        if (typeof addr === 'string') {
          return addr;
        } else if (typeof addr === 'object' && addr !== null) {
          return addr.name || addr.address || JSON.stringify(addr);
        }
        return '';
      }).filter(Boolean).join(', ') : '';
      entityName = [unitsText, addressText].filter(Boolean).join(' + ') || '';
    } else {
      entityName = details.entityName || '';
    }

    // (c) Description
    const description = isReceipt ? 
      (invoice.notes || '') : 
      (details.description || '');

    // (d) Issue Date
    const issueDate = isReceipt ? 
      (details.date || '') : 
      (details.issueDate || '');

    // (e) Status - always "paid" for receipts
    const status = isReceipt ? 'paid' : (invoice.status || 'unknown');

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

  addCorrection(messageId, contentHash, fieldName, newValue) {
    console.log(`[JS004] Queued correction: ${fieldName} = ${newValue}`);
    
    if (!this.pendingCorrections.has(messageId)) {
      this.pendingCorrections.set(messageId, {
        message_id: messageId,
        content_hash: contentHash || null,
        changes: {}
      });
    }
    
    const correction = this.pendingCorrections.get(messageId);
    correction.changes[fieldName] = newValue;
    
    console.log(`[BATCH] ${this.pendingCorrections.size} corrections queued`);
  }

  // Send via regular async API call
  async sendBatch() {
    if (this.sent || this.pendingCorrections.size === 0) return;
    this.sent = true;
    
    const edits = Array.from(this.pendingCorrections.values());
    console.log(`[BATCH] Sending ${edits.length} corrections`);
    
    try {
      const response = await this.apiClient.makeAuthenticatedRequest('/api/finops/invoices/corrections', {
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
    const success = navigator.sendBeacon('/api/finops/invoices/corrections', JSON.stringify({ 
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
  
  if (messageId && batcher) {
    batcher.addCorrection(messageId, contentHash, fieldName, newValue);
  } else if (!messageId) {
    console.warn(`[EDIT] No message_id for invoice ${invoiceIndex}`);
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

// === MOCK DATA GENERATOR ===
function generateMockData() {
  const mockInvoices = [
    {
      documentType: 'invoice',
      status: 'pending',
      statusThreadId: 'thread_001',
      statusMessageId: 'msg_001',
      document: {
        thread_id: 'thread_001',
        message_id: 'msg_001',
        document_name: 'invoice_001.pdf',
        content_hash: 'hash_001',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjNGNhZjUwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNhbXBsZSBJbnZvaWNlPC90ZXh0Pgo8L3N2Zz4K',
        details: {
          invoiceNumber: 'INV-2024-001',
          entityName: 'Acme Corporation',
          vendor: { name: 'Tech Solutions Inc.' },
          description: 'Software licensing and support services',
          period: 'Q1 2024',
          amount: 15000.00,
          currency: 'USD',
          issueDate: '2024-01-15',
          dueDate: '2024-02-15',
          paymentTerms: 'Net 30',
          approvalStatus: 'PENDING',
          notes: 'Annual software license renewal',
          documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjNGNhZjUwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNhbXBsZSBJbnZvaWNlPC90ZXh0Pgo8L3N2Zz4K'
        }
      },
      vendor: { name: 'Tech Solutions Inc.' },
      amount: 15000.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'John Smith', email: 'john@acme.com' },
          action_type: 'submitted',
          timestamp: '2024-01-15T10:30:00Z'
        },
        {
          actor: { name: 'Sarah Johnson', email: 'sarah@acme.com' },
          action_type: 'reviewed',
          timestamp: '2024-01-16T14:20:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'approved',
      statusThreadId: 'thread_002',
      statusMessageId: 'msg_002',
      document: {
        thread_id: 'thread_002',
        message_id: 'msg_002',
        document_name: 'invoice_002.pdf',
        content_hash: 'hash_002',
        details: {
          invoiceNumber: 'INV-2024-002',
          entityName: 'Global Enterprises Ltd.',
          vendor: { name: 'Office Supplies Co.' },
          description: 'Office furniture and equipment',
          period: 'January 2024',
          amount: 8750.50,
          currency: 'INR',
          issueDate: '2024-01-20',
          dueDate: '2024-02-20',
          paymentTerms: 'Net 30',
          approvalStatus: 'APPROVED',
          notes: 'Bulk office furniture purchase'
        }
      },
      vendor: { name: 'Office Supplies Co.' },
      amount: 8750.50,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Mike Wilson', email: 'mike@global.com' },
          action_type: 'submitted',
          timestamp: '2024-01-20T09:15:00Z'
        },
        {
          actor: { name: 'Lisa Chen', email: 'lisa@global.com' },
          action_type: 'approved',
          timestamp: '2024-01-21T16:45:00Z'
        }
      ]
    },
    {
      documentType: 'receipt',
      status: 'paid',
      statusThreadId: 'thread_003',
      statusMessageId: 'msg_003',
      document: {
        thread_id: 'thread_003',
        message_id: 'msg_003',
        document_name: 'receipt_003.pdf',
        content_hash: 'hash_003',
        details: {
          receiptNumber: 'RCP-2024-001',
          units: ['Unit 101', 'Unit 102'],
          property_addresses: [
            { name: 'Downtown Plaza', address: '123 Main St, City, State 12345' }
          ],
          date: '2024-01-25',
          amount: 2500.00,
          currency: 'EUR',
          approvalStatus: 'REJECTED'
        }
      },
      vendor: { name: 'Property Management LLC' },
      amount: 2500.00,
      currency: 'USD',
      notes: 'Monthly rent payment for commercial units',
      editableFields: ['receiptNumber', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'David Brown', email: 'david@acme.com' },
          action_type: 'paid',
          timestamp: '2024-01-25T11:30:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'requires_review',
      statusThreadId: 'thread_004',
      statusMessageId: 'msg_004',
      document: {
        thread_id: 'thread_004',
        message_id: 'msg_004',
        document_name: 'invoice_004.pdf',
        content_hash: 'hash_004',
        details: {
          invoiceNumber: 'INV-2024-003',
          entityName: 'StartupXYZ Inc.',
          vendor: { name: 'Cloud Services Provider' },
          description: 'AWS cloud infrastructure services',
          period: 'January 2024',
          amount: 3200.75,
          currency: 'GBP',
          issueDate: '2024-01-28',
          dueDate: '2024-02-28',
          paymentTerms: 'Net 30',
          approvalStatus: 'PENDING',
          notes: 'Monthly cloud hosting costs'
        }
      },
      vendor: { name: 'Cloud Services Provider' },
      amount: 3200.75,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Alex Rodriguez', email: 'alex@startupxyz.com' },
          action_type: 'submitted',
          timestamp: '2024-01-28T13:20:00Z'
        },
        {
          actor: { name: 'Emma Davis', email: 'emma@startupxyz.com' },
          action_type: 'flagged_for_review',
          timestamp: '2024-01-29T10:15:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'rejected',
      statusThreadId: 'thread_005',
      statusMessageId: 'msg_005',
      document: {
        thread_id: 'thread_005',
        message_id: 'msg_005',
        document_name: 'invoice_005.pdf',
        content_hash: 'hash_005',
        details: {
          invoiceNumber: 'INV-2024-004',
          entityName: 'Manufacturing Corp',
          vendor: { name: 'Marketing Agency Pro' },
          description: 'Digital marketing campaign',
          period: 'Q1 2024',
          amount: 25000.00,
          currency: 'USD',
          issueDate: '2024-01-30',
          dueDate: '2024-03-01',
          paymentTerms: 'Net 30',
          notes: 'Rejected due to budget constraints'
        }
      },
      vendor: { name: 'Marketing Agency Pro' },
      amount: 25000.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Robert Kim', email: 'robert@manufacturing.com' },
          action_type: 'submitted',
          timestamp: '2024-01-30T15:45:00Z'
        },
        {
          actor: { name: 'Jennifer Lee', email: 'jennifer@manufacturing.com' },
          action_type: 'rejected',
          timestamp: '2024-02-01T09:30:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'on_hold',
      statusThreadId: 'thread_006',
      statusMessageId: 'msg_006',
      document: {
        thread_id: 'thread_006',
        message_id: 'msg_006',
        document_name: 'invoice_006.pdf',
        content_hash: 'hash_006',
        details: {
          invoiceNumber: 'INV-2024-005',
          entityName: 'Retail Chain Inc.',
          vendor: { name: 'Logistics Solutions' },
          description: 'Warehouse management system',
          period: 'February 2024',
          amount: 18000.00,
          currency: 'USD',
          issueDate: '2024-02-05',
          dueDate: '2024-03-07',
          paymentTerms: 'Net 30',
          notes: 'On hold pending vendor contract review'
        }
      },
      vendor: { name: 'Logistics Solutions' },
      amount: 18000.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Tom Anderson', email: 'tom@retail.com' },
          action_type: 'submitted',
          timestamp: '2024-02-05T12:00:00Z'
        },
        {
          actor: { name: 'Maria Garcia', email: 'maria@retail.com' },
          action_type: 'placed_on_hold',
          timestamp: '2024-02-06T14:30:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'partially_approved',
      statusThreadId: 'thread_007',
      statusMessageId: 'msg_007',
      document: {
        thread_id: 'thread_007',
        message_id: 'msg_007',
        document_name: 'invoice_007.pdf',
        content_hash: 'hash_007',
        details: {
          invoiceNumber: 'INV-2024-006',
          entityName: 'Healthcare Systems',
          vendor: { name: 'IT Consulting Group' },
          description: 'System integration and training',
          period: 'Q1 2024',
          amount: 45000.00,
          currency: 'USD',
          issueDate: '2024-02-10',
          dueDate: '2024-03-12',
          paymentTerms: 'Net 30',
          notes: 'Partially approved - training portion pending'
        }
      },
      vendor: { name: 'IT Consulting Group' },
      amount: 45000.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Dr. Susan White', email: 'susan@healthcare.com' },
          action_type: 'submitted',
          timestamp: '2024-02-10T08:30:00Z'
        },
        {
          actor: { name: 'James Taylor', email: 'james@healthcare.com' },
          action_type: 'partially_approved',
          timestamp: '2024-02-12T16:20:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'ready_for_payment',
      statusThreadId: 'thread_008',
      statusMessageId: 'msg_008',
      document: {
        thread_id: 'thread_008',
        message_id: 'msg_008',
        document_name: 'invoice_008.pdf',
        content_hash: 'hash_008',
        details: {
          invoiceNumber: 'INV-2024-007',
          entityName: 'Financial Services Co.',
          vendor: { name: 'Legal Advisory Firm' },
          description: 'Legal consultation and contract review',
          period: 'January 2024',
          amount: 12500.00,
          currency: 'USD',
          issueDate: '2024-02-15',
          dueDate: '2024-03-17',
          paymentTerms: 'Net 30',
          notes: 'Ready for payment processing'
        }
      },
      vendor: { name: 'Legal Advisory Firm' },
      amount: 12500.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Patricia Moore', email: 'patricia@financial.com' },
          action_type: 'submitted',
          timestamp: '2024-02-15T11:45:00Z'
        },
        {
          actor: { name: 'Kevin Johnson', email: 'kevin@financial.com' },
          action_type: 'approved',
          timestamp: '2024-02-16T13:15:00Z'
        },
        {
          actor: { name: 'Rachel Green', email: 'rachel@financial.com' },
          action_type: 'ready_for_payment',
          timestamp: '2024-02-17T10:00:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'duplicate',
      statusThreadId: 'thread_009',
      statusMessageId: 'msg_009',
      document: {
        thread_id: 'thread_009',
        message_id: 'msg_009',
        document_name: 'invoice_009.pdf',
        content_hash: 'hash_009',
        details: {
          invoiceNumber: 'INV-2024-008',
          entityName: 'Tech Startup Inc.',
          vendor: { name: 'Design Studio Creative' },
          description: 'Brand identity and logo design',
          period: 'February 2024',
          amount: 8500.00,
          currency: 'USD',
          issueDate: '2024-02-20',
          dueDate: '2024-03-22',
          paymentTerms: 'Net 30',
          notes: 'Duplicate of previously processed invoice'
        }
      },
      vendor: { name: 'Design Studio Creative' },
      amount: 8500.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'Chris Wilson', email: 'chris@techstartup.com' },
          action_type: 'submitted',
          timestamp: '2024-02-20T14:30:00Z'
        },
        {
          actor: { name: 'Amanda Clark', email: 'amanda@techstartup.com' },
          action_type: 'marked_duplicate',
          timestamp: '2024-02-21T09:45:00Z'
        }
      ]
    },
    {
      documentType: 'invoice',
      status: 'unknown',
      statusThreadId: 'thread_010',
      statusMessageId: 'msg_010',
      document: {
        thread_id: 'thread_010',
        message_id: 'msg_010',
        document_name: 'invoice_010.pdf',
        content_hash: 'hash_010',
        details: {
          invoiceNumber: 'INV-2024-009',
          entityName: 'Consulting Firm LLC',
          vendor: { name: 'Unknown Vendor' },
          description: 'Consulting services - details unclear',
          period: 'February 2024',
          amount: 0.00,
          currency: 'USD',
          issueDate: '2024-02-25',
          dueDate: '2024-03-27',
          paymentTerms: 'TBD',
          notes: 'Status unknown - requires manual review'
        }
      },
      vendor: { name: 'Unknown Vendor' },
      amount: 0.00,
      currency: 'USD',
      editableFields: ['invoiceNumber', 'entityName', 'vendor.name', 'description', 'period', 'amount', 'currency', 'issueDate', 'dueDate', 'paymentTerms', 'approvalStatus', 'notes'],
      involvementHistory: [
        {
          actor: { name: 'System', email: 'system@company.com' },
          action_type: 'auto_imported',
          timestamp: '2024-02-25T00:00:00Z'
        }
      ]
    }
  ];

  console.log('[MOCK DATA] Generated', mockInvoices.length, 'mock invoices');
  return mockInvoices;
}

 