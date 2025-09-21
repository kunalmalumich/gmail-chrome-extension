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
      filter: false, // Data editing dropdown - no filter functionality
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
      filter: false // Data editing dropdown - no filter functionality
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
      filter: false, // Data editing dropdown - no filter functionality
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
    
    // === TWO-PANE FILTER FUNCTIONALITY ===
    console.log('[FILTER] Setting up two-pane filter functionality');
    console.log('[FILTER] Worksheet object:', worksheet);
    console.log('[FILTER] Worksheet element:', worksheet.element);
    
    // Call the filter setup function
    if (typeof setupTwoPaneFilters === 'function') {
      console.log('[FILTER] setupTwoPaneFilters function exists, calling it');
      setupTwoPaneFilters(worksheet);
    } else {
      console.error('[FILTER] setupTwoPaneFilters function not found!');
    }
    
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
  
  // === IMMEDIATE FILTER SETUP DEBUG ===
  console.log('[FILTER] Immediate setup - checking if oncreateworksheet fired');
  console.log('[FILTER] Sheet element:', sheet.element);
  console.log('[FILTER] Sheet element HTML:', sheet.element.outerHTML.substring(0, 200) + '...');
  
  // Try to set up filters immediately
  setTimeout(() => {
    console.log('[FILTER] Immediate setup - attempting direct filter setup');
    setupTwoPaneFilters(sheet);
  }, 1000);
  
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
          z-index: 1000;
          display: flex;
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
            <button id="preview-download-btn" data-doc-url="${docUrl}" style="
              padding: 12px 16px;
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
          link.download = filename || 'document.pdf';
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (error) {
          console.error('[PREVIEW] Download failed:', error);
          // Fallback: open in new tab
          window.open(url, '_blank');
        }
      };
      
      // Add global copy link function
      window.copyDocumentLink = function(url) {
        console.log('[PREVIEW] Copying document link:', url);
        try {
          navigator.clipboard.writeText(url).then(() => {
            // Show a temporary success message
            const notification = document.createElement('div');
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
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            notification.textContent = 'Link copied to clipboard!';
            document.body.appendChild(notification);
            
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 3000);
          }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            alert('Link copied to clipboard!');
          });
        } catch (error) {
          console.error('[PREVIEW] Copy failed:', error);
          alert('Failed to copy link. Please copy manually: ' + url);
        }
      };
      
      // Show the panel with animation
      console.log('[PREVIEW] Showing right preview panel');
      rightPreviewPanel.style.display = 'flex';
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
        currentPreviewData = null;
      }
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
      // Hide the right preview panel when cleaning up
      if (rightPreviewPanel) {
        hideRightPreview();
      }
    }
  };
  
  // === FALLBACK FILTER SETUP ===
  // Also try to set up filters directly after spreadsheet creation
  console.log('[FILTER] Setting up filters as fallback after spreadsheet creation');
  setTimeout(() => {
    if (spreadsheet && spreadsheet.sheets && spreadsheet.sheets[0]) {
      console.log('[FILTER] Fallback: Setting up filters on first sheet');
      setupTwoPaneFilters(spreadsheet.sheets[0]);
    } else if (Array.isArray(spreadsheet) && spreadsheet[0]) {
      console.log('[FILTER] Fallback: Setting up filters on array spreadsheet');
      setupTwoPaneFilters(spreadsheet[0]);
    } else {
      console.log('[FILTER] Fallback: No valid spreadsheet found for filter setup');
    }
  }, 2000);
  
  // === CUSTOMIZE DEFAULT DROPDOWN ===
  // Transform jspreadsheet's default filter dropdown into two-pane design
  setTimeout(() => {
    console.log('[FILTER] Setting up default dropdown customization');
    
    // Function to customize existing jspreadsheet filter dropdowns
    function customizeFilterDropdowns() {
      // Don't automatically create dropdowns - only customize when they appear
      console.log('[FILTER] Checking for existing filter dropdowns to customize');
      
      const existingDropdowns = document.querySelectorAll('.jdropdown-content:not(.jss_customized), .jdropdown-picker:not(.jss_customized)');
      console.log('[FILTER] Found uncustomized dropdowns:', existingDropdowns.length);
      
      existingDropdowns.forEach(dropdown => {
        // Check if this is a filter-related dropdown by looking for filter-specific content
        const isFilterDropdown = dropdown.closest('.jss_filter, .jexcel_filter') || 
                                dropdown.querySelector('.jdropdown-option') ||
                                dropdown.textContent.includes('Search') ||
                                dropdown.textContent.includes('Contains') ||
                                dropdown.textContent.includes('Acme Corporation') ||
                                dropdown.textContent.includes('Global Enterprises');
        
        if (isFilterDropdown) {
          console.log('[FILTER] Customizing filter dropdown:', dropdown);
          console.log('[FILTER] Dropdown content:', dropdown.innerHTML);
          
          // Find the associated input field
          const input = findAssociatedInput(dropdown);
          if (input) {
            console.log('[FILTER] Found associated input:', input);
            customizeDropdownToTwoPane(dropdown, input);
          } else {
            console.log('[FILTER] No associated input found, customizing dropdown directly');
            customizeDropdownToTwoPane(dropdown);
          }
          
          dropdown.classList.add('jss_customized');
        }
      });
    }
    
    // Function to find the input field associated with a dropdown
    function findAssociatedInput(dropdown) {
      // Try to find input in the same td
      const parentTd = dropdown.closest('td');
      if (parentTd) {
        const input = parentTd.querySelector('input[type="text"]');
        if (input) return input;
      }
      
      // Try to find input in the filter row
      const filterRow = dropdown.closest('.jss_filter, .jexcel_filter');
      if (filterRow) {
        const inputs = filterRow.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) {
          // Find the input that's closest to this dropdown
          let closestInput = inputs[0];
          let minDistance = Infinity;
          
          inputs.forEach(input => {
            const inputRect = input.getBoundingClientRect();
            const dropdownRect = dropdown.getBoundingClientRect();
            const distance = Math.abs(inputRect.left - dropdownRect.left);
            if (distance < minDistance) {
              minDistance = distance;
              closestInput = input;
            }
          });
          
          return closestInput;
        }
      }
      
      return null;
    }
    
    
    // Function to transform a dropdown into two-pane design
    function customizeDropdownToTwoPane(dropdown, input = null) {
      // Store original content
      const originalContent = dropdown.innerHTML;
      
      // If we have an input, position the dropdown relative to it
      if (input) {
        const inputRect = input.getBoundingClientRect();
        const inputParent = input.closest('td');
        
        if (inputParent) {
          inputParent.style.position = 'relative';
          console.log('[FILTER] Set input parent td position to relative:', inputParent);
          
          // Position dropdown relative to the input's parent td
          dropdown.style.position = 'absolute';
          dropdown.style.top = '100%';
          dropdown.style.left = '0';
          dropdown.style.zIndex = '1002';
          dropdown.style.transform = 'none';
          dropdown.style.margin = '0';
          
          // Move the dropdown to be a child of the input's parent td
          inputParent.appendChild(dropdown);
          console.log('[FILTER] Moved dropdown to input parent td');
        }
      } else {
        // Fallback positioning
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.zIndex = '1002';
        dropdown.style.transform = 'none';
        dropdown.style.margin = '0';
        
        // Find the parent td to ensure relative positioning
        const parentTd = dropdown.closest('td');
        if (parentTd) {
          parentTd.style.position = 'relative';
          console.log('[FILTER] Set parent td position to relative:', parentTd);
        }
      }
      
      // Create two-pane structure
      dropdown.innerHTML = `
        <div class="jss_filter_panel" style="display: flex; flex-direction: row; min-width: 400px; max-width: 500px;">
          <!-- Left Panel - Value Selection -->
          <div class="jss_filter_values" style="flex: 1; padding: 16px; border-right: 1px solid #e5e7eb; min-width: 200px;">
            <input type="text" class="jss_filter_search" placeholder="Search" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; background: #ffffff; color: #1f2937; margin-bottom: 12px;">
            <div class="jss_filter_options" style="max-height: 200px; overflow-y: auto; margin-bottom: 0;">
              <div class="jss_filter_option" style="display: flex; align-items: center; padding: 8px 0; font-size: 14px; color: #1f2937; cursor: pointer; border-bottom: 1px solid #f3f4f6;">
                <input type="checkbox" style="margin-right: 12px; width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer;" checked>
                <span>(Select all)</span>
              </div>
            </div>
          </div>
          
          <!-- Right Panel - Condition Selection -->
          <div class="jss_filter_conditions" style="flex: 1; padding: 16px; min-width: 200px;">
            <select class="jss_filter_condition" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; background: #ffffff; color: #1f2937; margin-bottom: 12px; cursor: pointer;">
              <option value="contains">Contains</option>
              <option value="does_not_contain">Does not contain</option>
              <option value="begins_with">Begins with</option>
              <option value="ends_with">Ends with</option>
              <option value="equal">Equal</option>
              <option value="not_equal">Not equal</option>
              <option value="greater_than">Greater than</option>
              <option value="lower_than">Lower than</option>
            </select>
            
            <div class="jss_filter_actions" style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 0; border-top: 1px solid #e5e7eb; background: #f8fafc; border-radius: 0 0 6px 6px; margin-top: 12px;">
              <button class="jss_filter_button primary" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Ok</button>
              <button class="jss_filter_button" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners for the customized dropdown
      setupCustomizedDropdownEvents(dropdown);
    }
    
    // Function to set up events for customized dropdown
    function setupCustomizedDropdownEvents(dropdown) {
      const searchInput = dropdown.querySelector('.jss_filter_search');
      const valueOptions = dropdown.querySelector('.jss_filter_options');
      const conditionSelect = dropdown.querySelector('.jss_filter_condition');
      const okButton = dropdown.querySelector('.jss_filter_button.primary');
      const cancelButton = dropdown.querySelector('.jss_filter_button:not(.primary)');
      
      // Search functionality
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          const options = valueOptions.querySelectorAll('.jss_filter_option');
          options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
          });
        });
      }
      
      // Cancel button
      if (cancelButton) {
        cancelButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropdown.style.display = 'none';
        });
      }
      
      // Ok button
      if (okButton) {
        okButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Apply filter logic here
          console.log('[FILTER] Applying filter with selected values and condition');
          dropdown.style.display = 'none';
        });
      }
    }
    
    // Don't automatically create dropdowns - only customize when they appear
    console.log('[FILTER] Ready to customize filter dropdowns when they appear');
    
    // Set up mutation observer to catch dynamically created dropdowns
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              if (node.matches && (node.matches('.jdropdown-content, .jdropdown-picker, [class*="dropdown"]') ||
                  node.querySelector('.jdropdown-content, .jdropdown-picker, [class*="dropdown"]'))) {
                console.log('[FILTER] New dropdown detected, customizing:', node);
                setTimeout(() => {
                  customizeFilterDropdowns();
                }, 100);
              }
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also add a click listener to catch when dropdowns are opened
    document.addEventListener('click', (e) => {
      if (e.target.matches('input[type="text"]') && 
          e.target.closest('.jss_filter, .jexcel_filter')) {
        console.log('[FILTER] Filter input clicked, checking for dropdowns');
        setTimeout(() => {
          customizeFilterDropdowns();
        }, 200);
      }
    });
    
    // Add a more aggressive approach - check every 500ms for new dropdowns
    setInterval(() => {
      const newDropdowns = document.querySelectorAll('.jdropdown-content:not(.jss_customized), .jdropdown-picker:not(.jss_customized)');
      if (newDropdowns.length > 0) {
        console.log('[FILTER] Found new uncustomized dropdowns:', newDropdowns.length);
        customizeFilterDropdowns();
      }
    }, 500);
    
    // Override jspreadsheet's filter functionality to intercept dropdown creation
    const worksheet = spreadsheet.sheets ? spreadsheet.sheets[0] : spreadsheet;
    if (worksheet && worksheet.openFilter) {
      const originalOpenFilter = worksheet.openFilter;
      worksheet.openFilter = function(columnNumber, getAsSets) {
        console.log('[FILTER] Intercepted openFilter call for column:', columnNumber);
        
        // Call the original function
        const result = originalOpenFilter.call(this, columnNumber, getAsSets);
        
        // Wait a bit for the dropdown to be created, then customize it
        setTimeout(() => {
          console.log('[FILTER] Customizing dropdown after openFilter');
          customizeFilterDropdowns();
        }, 100);
        
        return result;
      };
      console.log('[FILTER] Overrode openFilter method');
    }
  }, 3000);
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
    const hasSampleDoc = !!(docUrl && (docUrl.includes('w3.org') || docUrl.includes('mozilla.github.io') || docUrl.includes('picsum.photos'))); // Check if it's our sample document
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
        url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
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
          documentUrl: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
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
        document_name: 'invoice_002.jpg',
        content_hash: 'hash_002',
        url: 'https://picsum.photos/800/600',
        thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjZTM0YTQwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNhbXBsZSBJbWFnZTwvdGV4dD4KPC9zdmc+Cg==',
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
          notes: 'Bulk office furniture purchase',
          documentUrl: 'https://picsum.photos/800/600',
          thumbnailUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjZTM0YTQwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNhbXBsZSBJbWFnZTwvdGV4dD4KPC9zdmc+Cg=='
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

// === TWO-PANE FILTER FUNCTIONALITY ===
function setupTwoPaneFilters(worksheet) {
  console.log('[FILTER] Setting up two-pane filters for worksheet');
  console.log('[FILTER] Worksheet element:', worksheet.element);
  
  // Don't automatically create filter panels - only intercept when dropdowns appear
  console.log('[FILTER] Ready to intercept filter dropdowns when they appear');
}

function setupFiltersOnRow(filterRow, worksheet) {
  console.log('[FILTER] Setting up filters on row:', filterRow);
  
  // Get all filter input fields - try multiple selectors
  const filterInputs = filterRow.querySelectorAll('td > input, input[type="text"], input');
  console.log('[FILTER] Found filter inputs:', filterInputs.length);
  
  // Also try to find inputs in all td elements
  const allTds = filterRow.querySelectorAll('td');
  console.log('[FILTER] Found td elements:', allTds.length);
  
  allTds.forEach((td, index) => {
    console.log(`[FILTER] TD ${index}:`, td);
    console.log(`[FILTER] TD ${index} innerHTML:`, td.innerHTML);
    
    // Look for any input in this td
    const input = td.querySelector('input');
    if (input) {
      console.log(`[FILTER] Found input in TD ${index}:`, input);
      setupFilterPanel(input, index, worksheet);
    } else {
      // If no input found, maybe we need to create one or the structure is different
      console.log(`[FILTER] No input found in TD ${index}, checking if it's a filter column`);
      
      // Check if this column has filter enabled
      const column = worksheet.options.columns[index];
      if (column && column.filter === true) {
        console.log(`[FILTER] Column ${index} (${column.title}) has filter enabled, creating input`);
        
        // Create an input if none exists
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Filter ${column.title}`;
        input.style.cssText = `
          width: 100%;
          height: 100%;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 4px 24px 4px 8px;
          font-size: 12px;
          background: #ffffff;
          color: #1f2937;
          position: relative;
        `;
        
        td.appendChild(input);
        setupFilterPanel(input, index, worksheet);
      }
    }
  });
  
  filterInputs.forEach((input, index) => {
    console.log(`[FILTER] Setting up filter panel for input ${index}:`, input);
    if (input && input.parentElement) {
      setupFilterPanel(input, index, worksheet);
    }
  });
}

function setupFilterPanel(input, columnIndex, worksheet) {
  console.log(`[FILTER] Setting up filter panel for column ${columnIndex}`);
  
  // Create the filter panel container
  const filterPanel = document.createElement('div');
  filterPanel.className = 'jss_custom_filter_panel';
  filterPanel.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0;
    min-width: 400px;
    max-width: 500px;
    z-index: 1002;
    display: none;
    flex-direction: row;
  `;
  
  // Left Panel - Value Selection
  const leftPanel = document.createElement('div');
  leftPanel.className = 'jss_filter_values';
  leftPanel.style.cssText = `
    flex: 1;
    padding: 16px;
    border-right: 1px solid #e5e7eb;
    min-width: 200px;
  `;
  
  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search';
  searchInput.className = 'jss_filter_search';
  searchInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    background: #ffffff;
    color: #1f2937;
    margin-bottom: 12px;
  `;
  
  // Value list container
  const valueList = document.createElement('div');
  valueList.className = 'jss_filter_options';
  valueList.style.cssText = `
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 0;
  `;
  
  // Right Panel - Condition Selection
  const rightPanel = document.createElement('div');
  rightPanel.className = 'jss_filter_conditions';
  rightPanel.style.cssText = `
    flex: 1;
    padding: 16px;
    min-width: 200px;
  `;
  
  // Condition dropdown
  const conditionSelect = document.createElement('select');
  conditionSelect.className = 'jss_filter_condition';
  conditionSelect.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    background: #ffffff;
    color: #1f2937;
    margin-bottom: 12px;
    cursor: pointer;
  `;
  
  // Add condition options
  const conditions = [
    'Contains',
    'Does not contain', 
    'Begins with',
    'Ends with',
    'Equal',
    'Not equal',
    'Greater than',
    'Lower than'
  ];
  
  conditions.forEach(condition => {
    const option = document.createElement('option');
    option.value = condition.toLowerCase().replace(/\s+/g, '_');
    option.textContent = condition;
    conditionSelect.appendChild(option);
  });
  
  // Action buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 12px;
  `;
  
  const okButton = document.createElement('button');
  okButton.textContent = 'Ok';
  okButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  // Assemble the panels
  leftPanel.appendChild(searchInput);
  leftPanel.appendChild(valueList);
  rightPanel.appendChild(conditionSelect);
  rightPanel.appendChild(buttonContainer);
  buttonContainer.appendChild(okButton);
  buttonContainer.appendChild(cancelButton);
  
  filterPanel.appendChild(leftPanel);
  filterPanel.appendChild(rightPanel);
  
  // Position the panel relative to the input
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(filterPanel);
  
  // Get unique values for this column
  const uniqueValues = getUniqueValuesForColumn(columnIndex, worksheet);
  populateValueList(valueList, uniqueValues);
  
  // Event handlers
  input.addEventListener('click', (e) => {
    console.log('[FILTER] Input clicked, toggling panel');
    e.preventDefault();
    e.stopPropagation();
    toggleFilterPanel(filterPanel);
  });
  
  // Also add click handler to the filter icon area
  input.addEventListener('focus', (e) => {
    console.log('[FILTER] Input focused, showing panel');
    e.preventDefault();
    e.stopPropagation();
    filterPanel.style.display = 'flex';
  });
  
  searchInput.addEventListener('input', (e) => {
    filterValueList(valueList, e.target.value);
  });
  
  okButton.addEventListener('click', () => {
    applyFilter(columnIndex, valueList, conditionSelect.value, worksheet);
    filterPanel.style.display = 'none';
  });
  
  cancelButton.addEventListener('click', () => {
    filterPanel.style.display = 'none';
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!filterPanel.contains(e.target) && !input.contains(e.target)) {
      filterPanel.style.display = 'none';
    }
  });
}

function toggleFilterPanel(panel) {
  const isVisible = panel.style.display === 'flex';
  console.log('[FILTER] Toggling panel, currently visible:', isVisible);
  panel.style.display = isVisible ? 'none' : 'flex';
  console.log('[FILTER] Panel display set to:', panel.style.display);
}

function getUniqueValuesForColumn(columnIndex, worksheet) {
  const values = new Set();
  const dataRows = worksheet.element.querySelectorAll('.jss_worksheet > tbody > tr');
  
  dataRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells[columnIndex]) {
      const value = cells[columnIndex].textContent.trim();
      if (value) {
        values.add(value);
      }
    }
  });
  
  return Array.from(values).sort();
}

function populateValueList(container, values) {
  container.innerHTML = '';
  
  // Add "Select all" option
  const selectAllItem = document.createElement('div');
  selectAllItem.className = 'jss_filter_option';
  selectAllItem.style.cssText = `
    display: flex;
    align-items: center;
    padding: 8px 0;
    font-size: 14px;
    color: #1f2937;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
  `;
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.checked = true;
  selectAllCheckbox.style.cssText = `
    margin-right: 12px;
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
  `;
  
  const selectAllLabel = document.createElement('label');
  selectAllLabel.textContent = '(Select all)';
  selectAllLabel.style.cssText = 'cursor: pointer; flex: 1;';
  
  selectAllItem.appendChild(selectAllCheckbox);
  selectAllItem.appendChild(selectAllLabel);
  container.appendChild(selectAllItem);
  
  // Add individual value options
  values.forEach(value => {
    const item = document.createElement('div');
    item.className = 'jss_filter_option';
    item.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
      color: #1f2937;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.value = value;
    checkbox.style.cssText = `
      margin-right: 12px;
      width: 16px;
      height: 16px;
      accent-color: #3b82f6;
      cursor: pointer;
    `;
    
    const label = document.createElement('label');
    label.textContent = value;
    label.style.cssText = 'cursor: pointer; flex: 1;';
    
    item.appendChild(checkbox);
    item.appendChild(label);
    container.appendChild(item);
  });
  
  // Handle select all functionality
  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([value=""])');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
    });
  });
}

function filterValueList(container, searchTerm) {
  const options = container.querySelectorAll('.jss_filter_option');
  const term = searchTerm.toLowerCase();
  
  options.forEach(option => {
    const label = option.querySelector('label');
    const text = label ? label.textContent.toLowerCase() : '';
    const shouldShow = text.includes(term);
    option.style.display = shouldShow ? 'flex' : 'none';
  });
}

function applyFilter(columnIndex, valueList, condition, worksheet) {
  console.log(`[FILTER] Applying filter to column ${columnIndex} with condition: ${condition}`);
  
  const selectedValues = Array.from(valueList.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .filter(value => value); // Remove empty values
  
  console.log('[FILTER] Selected values:', selectedValues);
  
  // Apply the filter using jspreadsheet's API
  if (selectedValues.length > 0) {
    worksheet.setFilter(columnIndex, selectedValues);
  } else {
    worksheet.resetFilters(columnIndex);
  }
}

function replaceExistingDropdown(dropdown, worksheet) {
  console.log('[FILTER] Replacing existing dropdown:', dropdown);
  
  // Hide the original dropdown
  dropdown.style.display = 'none';
  
  // Find the input that triggered this dropdown
  const input = dropdown.previousElementSibling || dropdown.parentElement.querySelector('input');
  if (input) {
    console.log('[FILTER] Found input for dropdown:', input);
    
    // Create our custom two-pane filter panel
    const customPanel = createTwoPaneFilterPanel(input, worksheet);
    
    // Replace the dropdown with our custom panel
    dropdown.parentNode.replaceChild(customPanel, dropdown);
  }
}

function createTwoPaneFilterPanel(input, worksheet) {
  console.log('[FILTER] Creating two-pane filter panel for input:', input);
  
  // Create the filter panel container
  const filterPanel = document.createElement('div');
  filterPanel.className = 'jss_custom_filter_panel';
  filterPanel.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0;
    min-width: 400px;
    max-width: 500px;
    z-index: 1002;
    display: none;
    flex-direction: row;
  `;
  
  // Left Panel - Value Selection
  const leftPanel = document.createElement('div');
  leftPanel.className = 'jss_filter_values';
  leftPanel.style.cssText = `
    flex: 1;
    padding: 16px;
    border-right: 1px solid #e5e7eb;
    min-width: 200px;
  `;
  
  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search';
  searchInput.className = 'jss_filter_search';
  searchInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    background: #ffffff;
    color: #1f2937;
    margin-bottom: 12px;
  `;
  
  // Value list container
  const valueList = document.createElement('div');
  valueList.className = 'jss_filter_options';
  valueList.style.cssText = `
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 0;
  `;
  
  // Right Panel - Condition Selection
  const rightPanel = document.createElement('div');
  rightPanel.className = 'jss_filter_conditions';
  rightPanel.style.cssText = `
    flex: 1;
    padding: 16px;
    min-width: 200px;
  `;
  
  // Condition dropdown
  const conditionSelect = document.createElement('select');
  conditionSelect.className = 'jss_filter_condition';
  conditionSelect.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    background: #ffffff;
    color: #1f2937;
    margin-bottom: 12px;
    cursor: pointer;
  `;
  
  // Add condition options
  const conditions = [
    'Contains',
    'Does not contain', 
    'Begins with',
    'Ends with',
    'Equal',
    'Not equal',
    'Greater than',
    'Lower than'
  ];
  
  conditions.forEach(condition => {
    const option = document.createElement('option');
    option.value = condition.toLowerCase().replace(/\s+/g, '_');
    option.textContent = condition;
    conditionSelect.appendChild(option);
  });
  
  // Action buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 12px;
  `;
  
  const okButton = document.createElement('button');
  okButton.textContent = 'Ok';
  okButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  // Assemble the panels
  leftPanel.appendChild(searchInput);
  leftPanel.appendChild(valueList);
  rightPanel.appendChild(conditionSelect);
  rightPanel.appendChild(buttonContainer);
  buttonContainer.appendChild(okButton);
  buttonContainer.appendChild(cancelButton);
  
  filterPanel.appendChild(leftPanel);
  filterPanel.appendChild(rightPanel);
  
  // Position the panel relative to the input
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(filterPanel);
  
  // Get unique values for this column (try to determine column index)
  const columnIndex = Array.from(input.parentElement.parentElement.children).indexOf(input.parentElement);
  const uniqueValues = getUniqueValuesForColumn(columnIndex, worksheet);
  populateValueList(valueList, uniqueValues);
  
  // Event handlers
  input.addEventListener('click', (e) => {
    console.log('[FILTER] Input clicked, showing custom panel');
    e.preventDefault();
    e.stopPropagation();
    filterPanel.style.display = 'flex';
  });
  
  searchInput.addEventListener('input', (e) => {
    filterValueList(valueList, e.target.value);
  });
  
  okButton.addEventListener('click', () => {
    applyFilter(columnIndex, valueList, conditionSelect.value, worksheet);
    filterPanel.style.display = 'none';
  });
  
  cancelButton.addEventListener('click', () => {
    filterPanel.style.display = 'none';
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!filterPanel.contains(e.target) && !input.contains(e.target)) {
      filterPanel.style.display = 'none';
    }
  });
  
  return filterPanel;
}

 