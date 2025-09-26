// stamp-extension/spreadsheet-builder.js

/**
 * This file contains all the logic for building and configuring the jspreadsheet instance
 * for the finance team's invoice tracker with comprehensive scrolling support.
 */

// Core function to initialize the spreadsheet with clean Shadow DOM approach
export async function buildSpreadsheet(container, data, opts = {}) {
  console.log('[SHADOW DOM] Starting clean jspreadsheet integration...');
  
  // Setup clean container for jspreadsheet
  const { cleanContainer, mainWrapper } = await setupCleanContainer(container);
  
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
  // Compact Excel-like column widths to prevent overflow (total: ~1000px)
  // 25+70+90+100+120+50+70+50+70+70+40+70+25+70+100+50 = 1000px
  const columns = [
    {
      title: '📄', // Document icon column (preview/open)
      width: 25,
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    },
    { 
      title: 'Invoice #', 
      width: 70, // Compact width
      type: 'text',
      fieldName: 'invoiceNumber',
      editable: true,
      filter: true
    },
    { 
      title: 'Entity Name', 
      width: 90, // Compact width
      type: 'text',
      fieldName: 'entityName',
      editable: true,
      filter: true
    },
    { 
      title: 'Vendor Name', 
      width: 100, // Compact width
      type: 'text',
      fieldName: 'vendor.name',
      editable: true,
      filter: true
    },
    { 
      title: 'Description', 
      width: 120, // Compact width
      type: 'text',
      fieldName: 'description',
      editable: true,
      filter: true
    },
    { 
      title: 'Period', 
      width: 50, // Compact width
      type: 'text',
      fieldName: 'period',
      editable: true,
      filter: true
    },
    { 
      title: 'Amount', 
      width: 70, // Compact width
      type: 'numeric', 
      mask: '$ #,##.00',
      fieldName: 'amount',
      editable: true,
      filter: true
    },
    {
      title: 'Currency',
      width: 60, // Slightly wider for "Currency" header
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
      width: 80, // Slightly wider for "Issue Date" header
      type: 'calendar', 
      options: { format: 'YYYY-MM-DD' },
      fieldName: 'issueDate',
      editable: true,
      filter: true
    },
    { 
      title: 'Due Date', 
      width: 80, // Excel-like width
      type: 'calendar', 
      options: { format: 'YYYY-MM-DD' },
      fieldName: 'dueDate',
      editable: true,
      filter: true
    },
    {
      title: 'Terms',
      width: 50, // Excel-like width
      type: 'text',
      fieldName: 'paymentTerms',
      editable: true,
      filter: true
    },
    { 
      title: 'Status', 
      width: 80, // Excel-like width
      type: 'dropdown',
      source: [ 'pending', 'approved', 'rejected', 'paid', 'on_hold', 'requires_review', 'partially_approved', 'ready_for_payment', 'duplicate', 'unknown' ],
      fieldName: 'status',
      editable: true,
      filter: true
    },
    {
      title: '📤', // Gmail icon column (moved next to Status)
      width: 30, // Excel-like width
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    },
    {
      title: 'Approver',
      width: 80, // Excel-like width
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
      width: 120, // Excel-like width
      type: 'text',
      fieldName: 'notes',
      editable: true,
      filter: true
    },
    { 
      title: 'Actions', 
      width: 60, // Excel-like width
      type: 'html',
      readOnly: true,
      fieldName: null,
      editable: false
    }
  ];

  // Simple in-memory PDF cache for the session
  const pdfCache = new Map(); // key: `${threadId}|${documentName}` => blob

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
  
  // Ensure jspreadsheet is available
  if (typeof jspreadsheet === 'undefined') {
    console.error('[JS001] jspreadsheet library not loaded!');
    throw new Error('jspreadsheet library is not available');
  }
  
  console.log('[JS001] jspreadsheet library loaded:', typeof jspreadsheet);
  
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
      node.style.overflow = 'visible';
      node.style.position = 'fixed';
      // Let jspreadsheet handle positioning naturally - don't override with getBoundingClientRect
      console.log('[DROPDOWN FIX] Applied z-index fix to:', node.className, node);
      
      // Ensure dropdown is properly positioned and visible
      setTimeout(() => {
        if (node.style.display === 'none') {
          node.style.display = 'block';
        }
        if (node.style.visibility === 'hidden') {
          node.style.visibility = 'visible';
        }
      }, 10);
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
          node.style.overflow = 'visible';
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
    toolbar: true,     // Enable the toolbar with tools
    worksheets: [{
      data: spreadsheetData,
      columns: columns,
      meta: metaInformation,  // Hidden metadata for linking to Gmail threads/messages
      
      // === ROW HEIGHT CONFIGURATION ===
      defaultRowHeight: 12, // Excel-like compact row height
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
    console.log('[DROPDOWN] Worksheet created - initializing dropdown functionality');
    console.log('[DROPDOWN] Worksheet element:', worksheet.element);
    
    // Initialize dropdowns after worksheet is created
    setTimeout(() => {
      console.log('[DROPDOWN] Initializing dropdown cells...');
      
      // Check if jsuites is available
      if (typeof window.jsuites === 'undefined') {
        console.warn('[DROPDOWN] jsuites not available - dropdowns may not work properly');
        return;
      }
      
      // Find all dropdown cells
      const dropdownCells = worksheet.element.querySelectorAll('.jss_dropdown');
      console.log('[DROPDOWN] Found dropdown cells:', dropdownCells.length);
      
      dropdownCells.forEach((cell, index) => {
        console.log(`[DROPDOWN] Initializing cell ${index}:`, cell);
        
        // Ensure the cell has proper classes and attributes
        if (!cell.classList.contains('jss_dropdown')) {
          cell.classList.add('jss_dropdown');
        }
        
        // Add click handler to ensure dropdown opens
        cell.addEventListener('click', function(e) {
          console.log('[DROPDOWN] Cell clicked:', cell);
          e.stopPropagation();
          
          // Force dropdown to open if it's not already open
          if (cell.querySelector('.jdropdown-container') === null) {
            console.log('[DROPDOWN] Manually triggering dropdown for cell');
            // Trigger the dropdown programmatically
            const event = new Event('click', { bubbles: true });
            cell.dispatchEvent(event);
          }
        });
        
        // Add hover effect to indicate it's clickable
        cell.style.cursor = 'pointer';
        cell.title = 'Click to open dropdown';
      });
      
      // Also check for filter cells and ensure they work
      const filterCells = worksheet.element.querySelectorAll('.jss_column_filter');
      console.log('[DROPDOWN] Found filter cells:', filterCells.length);
      
      filterCells.forEach((cell, index) => {
        console.log(`[DROPDOWN] Initializing filter cell ${index}:`, cell);
        cell.style.cursor = 'pointer';
        cell.title = 'Click to filter';
        
        // Ensure filter cells have proper classes
        if (!cell.classList.contains('jss_column_filter')) {
          cell.classList.add('jss_column_filter');
        }
        
        // Add click handler for filter functionality
        cell.addEventListener('click', function(e) {
          console.log('[FILTER] Filter cell clicked:', cell);
          e.stopPropagation();
          
          // Check if this is a filterable column
          const columnIndex = Array.from(cell.parentNode.children).indexOf(cell);
          const columnDef = columns[columnIndex];
          
          if (columnDef && columnDef.filter) {
            console.log('[FILTER] Column is filterable:', columnDef.title);
            // The filter functionality should be handled by jspreadsheet
            // We just ensure the cell is properly configured
          }
        });
      });
      
      // Also ensure filter row is properly styled
      const filterRow = worksheet.element.querySelector('thead tr.jss_filter');
      if (filterRow) {
        console.log('[FILTER] Found filter row, ensuring proper styling');
        filterRow.style.background = '#10b981';
        filterRow.style.color = 'white';
        
        // Ensure all filter cells in the row are properly styled
        const filterCellsInRow = filterRow.querySelectorAll('td');
        filterCellsInRow.forEach((cell, index) => {
          cell.style.background = '#10b981';
          cell.style.color = 'white';
          cell.style.border = '1px solid #047857';
          
          // Add filter icon if not present
          if (!cell.querySelector('.jss_column_filter')) {
            cell.classList.add('jss_column_filter');
          }
        });
      }
      
    }, 1500); // Increased delay to ensure everything is rendered
    
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
          background: #059669;
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
  
  // Add fullscreen toggle functionality
  setTimeout(() => {
    const fullscreenButton = cleanContainer.querySelector('.jss_toolbar button[title*="fullscreen"], .jss_toolbar button[title*="Fullscreen"], .jss_toolbar button[aria-label*="fullscreen"]');
    if (fullscreenButton) {
      console.log('[FULLSCREEN] Found fullscreen button, adding click handler');
      fullscreenButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[FULLSCREEN] Toggle fullscreen clicked');
        
        const isFullscreen = mainWrapper.classList.contains('fullscreen');
        
        if (isFullscreen) {
          // Exit fullscreen
          mainWrapper.classList.remove('fullscreen');
          document.body.style.overflow = '';
          console.log('[FULLSCREEN] Exited fullscreen mode');
        } else {
          // Enter fullscreen
          mainWrapper.classList.add('fullscreen');
          document.body.style.overflow = 'hidden';
          console.log('[FULLSCREEN] Entered fullscreen mode');
        }
      });
    } else {
      console.log('[FULLSCREEN] Fullscreen button not found');
    }
  }, 1000);
  
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
        background: #059669;
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
    },
    
    // Debug method to check dropdown functionality
    debugDropdowns: () => {
      console.log('[DROPDOWN DEBUG] jsuites available:', typeof window.jsuites);
      console.log('[DROPDOWN DEBUG] jspreadsheet available:', typeof jspreadsheet);
      
      if (sheet && sheet.element) {
        const dropdownCells = sheet.element.querySelectorAll('.jss_dropdown');
        console.log('[DROPDOWN DEBUG] Dropdown cells found:', dropdownCells.length);
        
        dropdownCells.forEach((cell, index) => {
          console.log(`[DROPDOWN DEBUG] Cell ${index}:`, {
            element: cell,
            classes: cell.className,
            textContent: cell.textContent,
            hasDropdown: !!cell.querySelector('.jdropdown-container')
          });
        });
        
        const filterCells = sheet.element.querySelectorAll('.jss_column_filter');
        console.log('[DROPDOWN DEBUG] Filter cells found:', filterCells.length);
        
        const allDropdowns = document.querySelectorAll('.jdropdown-container');
        console.log('[DROPDOWN DEBUG] Active dropdowns:', allDropdowns.length);
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
           <div style="padding:16px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); border-top:1px solid #065f46; text-align:center; border-radius:0 0 12px 12px;">
             <button id="preview-open-doc-btn" data-doc-url="${docUrl}" style="background:linear-gradient(135deg, #1a73e8 0%, #1557b0 100%); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(26,115,232,0.3); min-width:140px;">Open Document</button>
           </div>
         </div>` :
        `<div style="display:flex; flex-direction:column; height:100%; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
           <div style="flex:1; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius:12px 12px 0 0; position:relative; min-height:160px;">
             <div style="text-align:center; color:#fff; font-size:16px; background:rgba(0,0,0,0.1); padding:20px; border-radius:12px; backdrop-filter:blur(4px); border:1px solid rgba(255,255,255,0.2);">
               <div style="font-size:32px; margin-bottom:12px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📄</div>
               <div style="font-weight:700; margin-bottom:6px; font-size:18px; text-shadow:0 1px 2px rgba(0,0,0,0.3);">Document Preview</div>
               <div style="font-size:13px; opacity:0.9; font-weight:500;">Click to open document</div>
               <div style="font-size:11px; opacity:0.8; margin-top:4px;">External documents open in new tab</div>
             </div>
           </div>
           <div style="padding:16px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); border-top:1px solid #065f46; text-align:center; border-radius:0 0 12px 12px;">
             <button id="preview-open-doc-btn" data-doc-url="${docUrl}" style="background:linear-gradient(135deg, #1a73e8 0%, #1557b0 100%); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; transition:all 0.2s ease; box-shadow:0 2px 8px rgba(26,115,232,0.3); min-width:140px;">Open Document</button>
           </div>
         </div>`;
      
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

    // Disabled hover preview to prevent iframe errors
    // cleanContainer.addEventListener('mouseover', (e) => {
    //   const icon = e.target.closest('.doc-preview-icon');
    //   if (icon && icon.getAttribute('data-has-doc') === '1') {
    //     const docUrl = icon.getAttribute('data-doc-url');
    //     if (docUrl) {
    //       const rect = icon.getBoundingClientRect();
    //       const previewEl = document.createElement('div');
    //       previewEl.style.cssText = 'position:fixed; z-index:2147483646; width:280px; height:210px; background:#fff; box-shadow:0 8px 24px rgba(60,64,67,0.3); border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;';
    //       previewEl.innerHTML = `<iframe src="${docUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1" style="width:100%;height:100%;border:0;" loading="eager"></iframe>`;
    //       previewEl.style.top = `${Math.round(rect.bottom + 8)}px`;
    //       previewEl.style.left = `${Math.round(rect.left - 40)}px`;
    //       previewEl.style.display = 'block';
    //       document.body.appendChild(previewEl);
    //     }
    //   }
    // });

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

    const showGreenModal = (iconEl) => {
      const docUrl = iconEl.getAttribute('data-doc-url');
      const thumbUrl = iconEl.getAttribute('data-thumb-url');
      const docName = iconEl.getAttribute('data-doc-name') || 'Document';
      
      console.log('[GREEN MODAL] Document data:', { docUrl, thumbUrl, docName });
      
      if (!docUrl) {
        console.warn('[GREEN MODAL] No document URL found');
        return;
      }
      
      // Create green modal overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      
      // Create the green modal content
      const modalContent = `
        <div style="
          width: 400px;
          max-width: 90vw;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          position: relative;
          overflow: hidden;
        ">
          <!-- Close button -->
          <button id="green-modal-close" style="
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            border: none;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1001;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
          
          <!-- Document icon -->
          <div style="
            text-align: center;
            padding: 40px 20px 20px 20px;
          ">
            <div style="
              font-size: 48px;
              margin-bottom: 16px;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            ">📄</div>
            <div style="
              font-weight: 700;
              margin-bottom: 8px;
              font-size: 20px;
              text-shadow: 0 1px 2px rgba(0,0,0,0.3);
              color: #ffffff;
            ">${docName.replace('.pdf', '').replace('.PDF', '')}</div>
            <div style="
              font-size: 14px;
              opacity: 0.9;
              font-weight: 500;
              color: #ffffff;
              margin-bottom: 4px;
            ">Sample Document Preview</div>
            <div style="
              font-size: 12px;
              opacity: 0.8;
              color: #ffffff;
            ">Click to open full document</div>
          </div>
          
          <!-- Action button -->
          <div style="
            padding: 20px;
            text-align: center;
            background: rgba(255,255,255,0.1);
            border-top: 1px solid rgba(255,255,255,0.2);
          ">
            <button id="green-modal-open-doc" data-doc-url="${docUrl}" style="
              background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s ease;
              box-shadow: 0 4px 12px rgba(26,115,232,0.3);
              min-width: 160px;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(26,115,232,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(26,115,232,0.3)'">Open Document</button>
          </div>
        </div>
      `;
      
      modalOverlay.innerHTML = modalContent;
      document.body.appendChild(modalOverlay);
      
      // Add event listeners
      const closeBtn = modalOverlay.querySelector('#green-modal-close');
      const openDocBtn = modalOverlay.querySelector('#green-modal-open-doc');
      
      const closeModal = () => {
        modalOverlay.remove();
      };
      
      closeBtn.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          closeModal();
        }
      });
      
      openDocBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close the green modal first
        closeModal();
        // Then show the right-side preview
        showRightPreview(iconEl);
      });
      
      // Add keyboard support
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);
      
      console.log('[GREEN MODAL] Modal should now be visible');
    };

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

      // Use sidebar preview instead of right panel
      if (window.stampUIManager && window.stampUIManager.showDocumentPreview) {
        console.log('[PREVIEW] Using sidebar preview');
        window.stampUIManager.showDocumentPreview({
          docUrl,
          docName,
          thumbUrl,
          fileType
        });
        return;
      }

      // No fallback - only use sidebar preview
      console.warn('[PREVIEW] Sidebar preview not available. Please ensure the sidebar is open.');
      return;
    };

    const hideRightPreview = () => {
      // Old preview functionality removed - only use sidebar preview
      console.log('[PREVIEW] hideRightPreview called - no action needed');
    };

    const showRightPreviewWithBlob = (iconEl, blob) => {
      // Old preview functionality removed - only use sidebar preview
      console.log('[PREVIEW] showRightPreviewWithBlob called - no action needed');
    };

    // Create a clean container for jspreadsheet with proper CSS loading and containment
          background: #10b981;
          border-left: 1px solid #059669;
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
          background: #059669;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          color: #ffffff;
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
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #ffffff;">Document Preview</h3>
            <p style="margin: 0; font-size: 14px; color: #ffffff;">${docName}</p>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; background: #059669; border-radius: 8px; overflow: hidden; margin-bottom: 20px; position: relative;">
            ${docUrl ? `
              <div style="flex: 1; min-height: 300px; position: relative; background: #059669; border-radius: 8px 8px 0 0; overflow: hidden;">
                ${isImage ? `
                  <!-- Image Viewer Container -->
                  <div id="image-viewer-container" style="width: 100%; height: 100%; position: relative; background: #10b981; display: flex; align-items: center; justify-content: center;">
                    <div id="image-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ffffff;">
                      <div style="font-size: 24px; margin-bottom: 12px;">🖼️</div>
                      <div style="font-size: 16px; font-weight: 500;">Loading Image...</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
                    </div>
                    <div id="image-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #fbbf24;">
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
                  <div id="pdf-viewer-container" style="width: 100%; height: 100%; position: relative; background: #10b981;">
                    <div id="pdf-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ffffff;">
                      <div style="font-size: 24px; margin-bottom: 12px;">📄</div>
                      <div style="font-size: 16px; font-weight: 500;">Loading PDF...</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
                    </div>
                    <div id="pdf-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #fbbf24;">
                      <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                      <div style="font-size: 16px; font-weight: 500;">Failed to load PDF</div>
                      <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View PDF" to open in new tab</div>
                    </div>
                    <iframe id="pdf-google-viewer" 
                      src="https://docs.google.com/gview?url=${encodeURIComponent(docUrl)}&embedded=true" 
                      style="width: 100%; height: 100%; border: none; display: none;">
                    </iframe>
                  </div>
                `}
                
                <!-- Document Info Card -->
                <div style="background: #059669; padding: 16px; border-top: 1px solid #065f46;">
                  <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #ffffff;">Document Details</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>File:</strong> ${docName}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>Type:</strong> ${fileType}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 8px;"><strong>Status:</strong> <span id="document-status">Loading...</span></div>
                  
                  <!-- Quick Actions -->
                  <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
                    <button id="preview-quick-view-btn" data-doc-url="${docUrl}" style="
                      padding: 6px 12px; 
                      background: #10b981; 
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
                      background: #059669; 
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
                      background: #047857; 
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
                <div style="text-align: center; color: #ffffff;">
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
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s ease;
              box-shadow: 0 2px 8px rgba(16,185,129,0.3);
            ">Open Document</button>
            <button id="preview-download-btn" data-doc-url="${docUrl}" data-doc-name="${docName}" style="
              padding: 12px 20px;
              background: #059669;
              color: #ffffff;
              border: 1px solid #047857;
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
      const pdfGoogleViewer = rightPreviewPanel.querySelector('#pdf-google-viewer');
      const pdfLoading = rightPreviewPanel.querySelector('#pdf-loading');
      const pdfError = rightPreviewPanel.querySelector('#pdf-error');
      
      if (pdfGoogleViewer) {
        const handlePdfLoad = () => {
          console.log('[PREVIEW] PDF loaded successfully via Google Docs viewer');
          if (pdfLoading) pdfLoading.style.display = 'none';
          if (pdfError) pdfError.style.display = 'none';
          if (pdfGoogleViewer) pdfGoogleViewer.style.display = 'block';
          if (documentStatus) documentStatus.textContent = 'Ready to View';
        };
        
        const handlePdfError = () => {
          console.log('[PREVIEW] PDF failed to load via Google Docs viewer');
          if (pdfLoading) pdfLoading.style.display = 'none';
          if (pdfError) pdfError.style.display = 'block';
          if (pdfGoogleViewer) pdfGoogleViewer.style.display = 'none';
          if (documentStatus) documentStatus.textContent = 'Cannot Embed - Click "View PDF"';
        };
        
        // Set up event listeners for Google Docs viewer iframe
        pdfGoogleViewer.addEventListener('load', handlePdfLoad);
        pdfGoogleViewer.addEventListener('error', handlePdfError);
        
        // Timeout fallback
        setTimeout(() => {
          if (pdfLoading && pdfLoading.style.display !== 'none') {
            console.log('[PREVIEW] PDF loading timeout - trying Google Docs viewer');
            handlePdfError();
          }
        }, 8000); // 8 second timeout for Google Docs viewer
        
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

    // Enhanced function to show preview with blob from backend (supports both images and PDFs)
    const showRightPreviewWithBlob = (iconEl, blob) => {
      const docName = iconEl.getAttribute('data-doc-name') || 'Document';
      const docUrl = iconEl.getAttribute('data-doc-url');
      
      // Detect file type from blob
      const isImage = blob.type.startsWith('image/');
      const isPdf = blob.type === 'application/pdf';
      const fileType = isImage ? 'Image' : (isPdf ? 'PDF Document' : 'Document');
      
      console.log('[PREVIEW] Showing preview with blob for:', docName, 'Type:', fileType);
      
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
          background: #10b981;
          border-left: 1px solid #059669;
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
          background: #059669;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          color: #ffffff;
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

      // Convert blob to data URL for more reliable display
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        console.log('[PREVIEW] Blob converted to data URL, length:', dataUrl.length);
        
        // Create object URL as fallback
      const objectUrl = URL.createObjectURL(blob);
      
        // Generate viewer content based on file type
        let viewerContent = '';
        if (isImage) {
          viewerContent = `
            <!-- Image Viewer Container -->
            <div id="image-viewer-container" style="width: 100%; height: 100%; position: relative; background: #10b981; display: flex; align-items: center; justify-content: center;">
              <div id="image-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ffffff;">
                <div style="font-size: 24px; margin-bottom: 12px;">🖼️</div>
                <div style="font-size: 16px; font-weight: 500;">Loading Image...</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
              </div>
              <div id="image-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #fbbf24;">
                <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 500;">Failed to load Image</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View Image" to open in new tab</div>
              </div>
              <img id="preview-image" 
                src="${dataUrl}" 
                style="max-width: 100%; max-height: 100%; object-fit: contain; display: none; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            </div>
          `;
        } else if (isPdf) {
          viewerContent = `
            <!-- PDF Viewer Container -->
            <div id="pdf-viewer-container" style="width: 100%; height: 100%; position: relative; background: #10b981;">
              <div id="pdf-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #ffffff;">
                <div style="font-size: 24px; margin-bottom: 12px;">📄</div>
                <div style="font-size: 16px; font-weight: 500;">Loading PDF...</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Please wait</div>
              </div>
              <div id="pdf-error" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #fbbf24;">
                <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 500;">Failed to load PDF</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View PDF" to open in new tab</div>
              </div>
              <iframe id="pdf-iframe" 
                src="${dataUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH" 
                style="width: 100%; height: 100%; border: none; display: none;">
              </iframe>
            </div>
          `;
        } else {
          // Fallback for other file types
          viewerContent = `
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; color: #ffffff;">
              <div>
                <div style="font-size: 24px; margin-bottom: 12px;">📄</div>
                <div style="font-size: 16px; font-weight: 500;">Unsupported File Type</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Click "View Document" to open in new tab</div>
              </div>
            </div>
          `;
        }
        
        // Update preview content with blob
        const previewContent = `
          <div style="flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto;">
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #ffffff;">Document Preview</h3>
              <p style="margin: 0; font-size: 14px; color: #ffffff;">${docName}</p>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; background: #059669; border-radius: 8px; overflow: hidden; margin-bottom: 20px; position: relative;">
              <div style="flex: 1; min-height: 300px; position: relative; background: #059669; border-radius: 8px 8px 0 0; overflow: hidden;">
                ${viewerContent}
                
                <!-- Document Info Card -->
                <div style="background: #059669; padding: 16px; border-top: 1px solid #065f46;">
                  <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #ffffff;">Document Details</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>File:</strong> ${docName}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>Type:</strong> ${fileType}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 8px;"><strong>Status:</strong> <span id="document-status">Loading...</span></div>
                  
                  <!-- Quick Actions -->
                  <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
                    <button id="preview-quick-view-btn" data-object-url="${objectUrl}" style="
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
                      View ${isImage ? 'Image' : (isPdf ? 'PDF' : 'Document')}
                    </button>
                    <button id="preview-quick-download-btn" data-object-url="${objectUrl}" data-doc-name="${docName}" style="
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
                    <button id="preview-quick-copy-btn" data-object-url="${objectUrl}" style="
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
            </div>
            
            <div style="display: flex; gap: 12px;">
              <button id="preview-open-doc-btn" data-object-url="${objectUrl}" style="
                flex: 1;
                padding: 12px 20px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(16,185,129,0.3);
              ">Open Document</button>
              <button id="preview-download-btn" data-object-url="${objectUrl}" data-doc-name="${docName}" style="
                padding: 12px 20px;
                background: #059669;
                color: #ffffff;
                border: 1px solid #047857;
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
      
        // Add loading handlers based on file type
        const documentStatus = rightPreviewPanel.querySelector('#document-status');
        
        if (isImage) {
          const previewImage = rightPreviewPanel.querySelector('#preview-image');
          const imageLoading = rightPreviewPanel.querySelector('#image-loading');
          const imageError = rightPreviewPanel.querySelector('#image-error');
          
          if (previewImage) {
            const handleImageLoad = () => {
              console.log('[PREVIEW] Image data URL loaded successfully');
              if (imageLoading) imageLoading.style.display = 'none';
              if (imageError) imageError.style.display = 'none';
              if (previewImage) previewImage.style.display = 'block';
              if (documentStatus) documentStatus.textContent = 'Ready to View';
            };
            
            const handleImageError = () => {
              console.log('[PREVIEW] Image data URL failed to load');
              if (imageLoading) imageLoading.style.display = 'none';
              if (imageError) imageError.style.display = 'block';
              if (previewImage) previewImage.style.display = 'none';
              if (documentStatus) documentStatus.textContent = 'Failed to Load';
            };
            
            // Set up event listeners for image
            previewImage.addEventListener('load', handleImageLoad);
            previewImage.addEventListener('error', handleImageError);
            
            // Timeout fallback
            setTimeout(() => {
              if (imageLoading && imageLoading.style.display !== 'none') {
                console.log('[PREVIEW] Image loading timeout, showing error');
                handleImageError();
              }
            }, 10000);
          }
        } else if (isPdf) {
          const pdfIframe = rightPreviewPanel.querySelector('#pdf-iframe');
          const pdfLoading = rightPreviewPanel.querySelector('#pdf-loading');
          const pdfError = rightPreviewPanel.querySelector('#pdf-error');
          
          if (pdfIframe) {
            const handlePdfLoad = () => {
              console.log('[PREVIEW] PDF data URL loaded successfully via iframe');
              if (pdfLoading) pdfLoading.style.display = 'none';
              if (pdfError) pdfError.style.display = 'none';
              if (pdfIframe) pdfIframe.style.display = 'block';
              if (documentStatus) documentStatus.textContent = 'Ready to View';
            };
            
            const handlePdfError = () => {
              console.log('[PREVIEW] PDF data URL failed to load via iframe');
              if (pdfLoading) pdfLoading.style.display = 'none';
              if (pdfError) pdfError.style.display = 'block';
              if (pdfIframe) pdfIframe.style.display = 'none';
              if (documentStatus) documentStatus.textContent = 'Failed to Load';
            };
            
            // Set up event listeners for iframe
            pdfIframe.addEventListener('load', handlePdfLoad);
            pdfIframe.addEventListener('error', handlePdfError);
            
            // Timeout fallback
            setTimeout(() => {
              if (pdfLoading && pdfLoading.style.display !== 'none') {
                console.log('[PREVIEW] PDF loading timeout, showing error');
                handlePdfError();
              }
            }, 10000);
          }
        } else {
          // For other file types, just show ready status
          if (documentStatus) documentStatus.textContent = 'Ready to View';
        }
      
      // Add event listeners for buttons (using object URL instead of doc URL)
      const openDocBtn = rightPreviewPanel.querySelector('#preview-open-doc-btn');
      const downloadBtn = rightPreviewPanel.querySelector('#preview-download-btn');
      
      if (openDocBtn) {
        openDocBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const objectUrl = openDocBtn.getAttribute('data-object-url');
          if (objectUrl) {
            window.open(objectUrl, '_blank');
          }
        });
      }
      
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const objectUrl = downloadBtn.getAttribute('data-object-url');
          const docName = downloadBtn.getAttribute('data-doc-name');
          if (objectUrl) {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = docName || 'document.pdf';
            link.click();
          }
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
          const objectUrl = quickViewBtn.getAttribute('data-object-url');
          if (objectUrl) {
            window.open(objectUrl, '_blank');
          }
        });
      }
      
      if (quickDownloadBtn) {
        quickDownloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const objectUrl = quickDownloadBtn.getAttribute('data-object-url');
          const docName = quickDownloadBtn.getAttribute('data-doc-name');
          if (objectUrl) {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = docName || 'document.pdf';
            link.click();
          }
        });
      }
      
      if (quickCopyBtn) {
        quickCopyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const objectUrl = quickCopyBtn.getAttribute('data-object-url');
          if (objectUrl) {
            navigator.clipboard.writeText(objectUrl).then(() => {
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
            }).catch(() => {
              alert('Failed to copy link. Please copy manually: ' + objectUrl);
            });
          }
        });
      }
      
      // Show the panel with animation
      console.log('[PREVIEW] Showing right preview panel with blob');
      rightPreviewPanel.style.display = 'flex';
      rightPreviewPanel.offsetHeight; // Force reflow
      rightPreviewPanel.style.transform = 'translateX(0)';
      
      // Clean up object URL when panel is closed
      const originalHideRightPreview = hideRightPreview;
      const hideRightPreviewWithCleanup = () => {
        URL.revokeObjectURL(objectUrl);
        originalHideRightPreview();
      };
      
      // Override the close button to use the cleanup version
      const closeBtn = rightPreviewPanel.querySelector('button');
      if (closeBtn) {
        closeBtn.onclick = hideRightPreviewWithCleanup;
      }
      };
      
      reader.onerror = () => {
        console.error('[PREVIEW] Failed to convert blob to data URL');
        // Show error state
        const previewContent = `
          <div style="flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto;">
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #ffffff;">Document Preview</h3>
              <p style="margin: 0; font-size: 14px; color: #ffffff;">${docName}</p>
            </div>
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 8px;">
              <div style="text-align: center; color: #fbbf24;">
                <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 500;">Failed to load Document</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.8;">Unable to convert blob to data URL</div>
              </div>
            </div>
          </div>
        `;
        rightPreviewPanel.innerHTML = previewContent;
      };
      
      reader.readAsDataURL(blob);
    };

    cleanContainer.addEventListener('click', async (e) => {
      console.log('[DOC] Click detected on:', e.target);
      const icon = e.target.closest('.doc-preview-icon');
      console.log('[DOC] Found doc icon:', icon);
      
      if (!icon) return;
      
      const hasDoc = icon.getAttribute('data-has-doc') === '1';
      console.log('[DOC] Has document:', hasDoc);
      
      if (!hasDoc) return;

      const threadId = icon.getAttribute('data-thread-id');
      const documentName = icon.getAttribute('data-doc-name');
      
      // Use blob preview functionality
      console.log('[DOC] Using blob preview functionality');
      
      if (threadId && documentName && opts.fetchPdf) {
        const cacheKey = `${threadId}|${documentName}`;
        
        // Try cache first
        let cachedBlob = pdfCache.get(cacheKey);
        if (cachedBlob) {
          console.log('[DOC] Using cached PDF blob');
          showRightPreviewWithBlob(icon, cachedBlob);
          return;
        }
        
        // No cache: fetch via backend
        try {
          console.log('[DOC] Fetching PDF from backend:', { threadId, documentName });
          const blob = await opts.fetchPdf({ threadId, documentName });
          
          // Small LRU: cap at 25 items
          if (pdfCache.size > 25) {
            const firstKey = pdfCache.keys().next().value;
            pdfCache.delete(firstKey);
          }
          pdfCache.set(cacheKey, blob);
          
          console.log('[DOC] PDF fetched successfully, showing blob preview');
          showRightPreviewWithBlob(icon, blob);
        } catch (err) {
          console.error('[DOC] Failed to fetch PDF from backend:', err);
          // Show error message instead of fallback
          alert(`Failed to load PDF from backend: ${err.message}`);
        }
      } else {
        // No backend fetch available
        console.log('[DOC] No backend fetch available');
        alert('No PDF fetch function available. Please ensure the backend is properly configured.');
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

// Create a clean container for jspreadsheet with proper CSS loading and containment
async function setupCleanContainer(container) {
  console.log('[CONTAINER] Creating clean container for jspreadsheet...');
  
  // Load necessary CSS and JS files
  await loadJspreadsheetAssets();
  
  // Create a main wrapper container with proper containment
  const mainWrapper = document.createElement('div');
  mainWrapper.className = 'jspreadsheet-main-wrapper';
  mainWrapper.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 100px);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  `;
  
  // Create a clean container element for jspreadsheet
  const cleanContainer = document.createElement('div');
  cleanContainer.className = 'jspreadsheet-clean-container jspreadsheet-container';
  cleanContainer.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    overflow-x: auto;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    max-width: 100%;
    box-sizing: border-box;
  `;

  // Clear the container and add our wrapper
  container.innerHTML = '';
  container.appendChild(mainWrapper);
  mainWrapper.appendChild(cleanContainer);

  return { cleanContainer, mainWrapper };
}

// Load jspreadsheet CSS and JS assets
async function loadJspreadsheetAssets() {
    try {
      // Context Guard: If the extension context is invalidated, stop immediately.
      if (!chrome.runtime?.id) {
      console.warn('[ASSETS] Extension context invalidated. Halting asset load.');
        return false;
      }

    console.log('[ASSETS] Loading jspreadsheet assets...');
      
    // Get CSS and JS file URLs with cache busting
    const jspreadsheetUrl = chrome.runtime.getURL('jspreadsheet.css?v=' + Date.now());
    const jsuitesUrl = chrome.runtime.getURL('jsuites.css?v=' + Date.now());
    const jsuitesJsUrl = chrome.runtime.getURL('jsuites.js?v=' + Date.now());
    const stampThemeUrl = chrome.runtime.getURL('stamp-spreadsheet-theme.css?v=' + Date.now());
      
    console.log('[ASSETS] Asset URLs:', {
        jspreadsheet: jspreadsheetUrl,
        jsuites: jsuitesUrl,
        jsuitesJs: jsuitesJsUrl,
        stampTheme: stampThemeUrl
      });
      
  // Load jsuites.js first (required for dropdowns)
  if (!document.querySelector(`script[src="${jsuitesJsUrl}"]`)) {
    const jsuitesScript = document.createElement('script');
    jsuitesScript.src = jsuitesJsUrl;
    jsuitesScript.type = 'text/javascript';
    document.head.appendChild(jsuitesScript);
    
    // Wait for jsuites to load with proper error handling
    await new Promise((resolve, reject) => {
      jsuitesScript.onload = () => {
        console.log('[ASSETS] ✅ jsuites.js loaded successfully');
        // Ensure jsuites is available globally
        if (typeof window.jsuites === 'undefined' && typeof jsuites !== 'undefined') {
          window.jsuites = jsuites;
        }
        resolve();
      };
      jsuitesScript.onerror = (error) => {
        console.error('[ASSETS] ❌ Failed to load jsuites.js:', error);
        reject(error);
      };
      // Increased timeout for slower connections
      setTimeout(() => {
        if (typeof window.jsuites !== 'undefined' || typeof jsuites !== 'undefined') {
          console.log('[ASSETS] ✅ jsuites.js loaded (timeout fallback)');
          resolve();
        } else {
          console.warn('[ASSETS] ⚠️ jsuites.js loading timeout - dropdowns may not work');
          resolve(); // Don't fail completely, just warn
        }
      }, 3000);
    });
  } else {
    console.log('[ASSETS] ✅ jsuites.js already loaded');
  }
    
    // Load CSS files
    const cssFiles = [
      { url: jspreadsheetUrl, name: 'jspreadsheet.css' },
      { url: jsuitesUrl, name: 'jsuites.css' },
      { url: stampThemeUrl, name: 'stamp-spreadsheet-theme.css' }
    ];
    
    for (const cssFile of cssFiles) {
      if (!document.querySelector(`link[href*="${cssFile.name}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssFile.url;
        document.head.appendChild(link);
        console.log(`[ASSETS] ✅ ${cssFile.name} loaded with URL: ${cssFile.url}`);
        
        // Add debugging to check if styles are applied
        link.onload = () => {
          console.log(`[ASSETS] ✅ ${cssFile.name} CSS loaded and applied`);
          // Check if our styles are present
          if (cssFile.name === 'jspreadsheet.css') {
            setTimeout(() => {
              const testElement = document.querySelector('.jss_worksheet');
              if (testElement) {
                const computedStyle = window.getComputedStyle(testElement);
                console.log('[DEBUG] jss_worksheet min-width:', computedStyle.minWidth);
                console.log('[DEBUG] jss_worksheet overflow-x:', computedStyle.overflowX);
              }
            }, 1000);
          }
        };
      }
    }
    
    // Load Material Icons font
    if (!document.querySelector('link[href*="Material+Icons"]')) {
      const materialIconsLink = document.createElement('link');
      materialIconsLink.href = 'https://fonts.googleapis.com/css?family=Material+Icons';
      materialIconsLink.rel = 'stylesheet';
      document.head.appendChild(materialIconsLink);
      console.log('[ASSETS] ✅ Material Icons font loaded');
    }
    
    // Add fullscreen CSS styles
    if (!document.querySelector('#jspreadsheet-fullscreen-styles')) {
      const fullscreenStyles = document.createElement('style');
      fullscreenStyles.id = 'jspreadsheet-fullscreen-styles';
      fullscreenStyles.textContent = `
        /* Fullscreen mode styling */
        .jspreadsheet-main-wrapper.fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: #ffffff !important;
          display: flex !important;
          flex-direction: column !important;
          max-height: none !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .jspreadsheet-main-wrapper.fullscreen .jss_toolbar {
          flex-shrink: 0 !important;
        }

        .jspreadsheet-main-wrapper.fullscreen .jss_filter {
          flex-shrink: 0 !important;
        }

        .jspreadsheet-main-wrapper.fullscreen .jspreadsheet-clean-container {
          flex: 1 !important;
          max-height: none !important;
          height: auto !important;
        }
        
        /* Ensure proper scrolling within the container - NO bottom scrollbar */
        .jspreadsheet-main-wrapper {
          overflow: hidden !important;
          max-height: 100vh !important;
          height: 100% !important;
        }
        
        .jspreadsheet-clean-container {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          max-height: calc(100vh - 200px) !important;
        }
        
        /* Fix dropdown z-index issues */
        .jdropdown-container,
        .jdropdown-menu,
        .jdropdown-content,
        .jdropdown-backdrop {
        z-index: 999999 !important;
        }
        
        /* Ensure spreadsheet table has proper width constraints */
        .jexcel table, .jspreadsheet table {
          width: 100% !important;
          min-width: 1200px !important; /* Minimum width to ensure all columns are visible */
          table-layout: fixed !important;
        }
        
        /* Force horizontal scrolling for table overflow - override jspreadsheet defaults */
        .jexcel, .jspreadsheet, .jss_container, .jss_worksheet {
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          max-width: 100% !important;
        }
        
        
        /* Ensure the spreadsheet container forces horizontal scroll */
      .jspreadsheet-clean-container {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Ensure the spreadsheet container handles overflow properly */
        .jspreadsheet-clean-container {
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        
        /* Remove any bottom scrollbars from the main wrapper */
        .jspreadsheet-main-wrapper {
          overflow: hidden !important;
        }
        
        /* Ensure body and html don't have scrollbars */
        body, html {
          overflow-x: hidden !important;
          max-width: 100% !important;
        }
        
        /* Ensure the main container doesn't cause page overflow */
        .jspreadsheet-main-wrapper {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Excel-like cell styling */
      .jexcel td, .jspreadsheet td, .jexcel th, .jspreadsheet th {
          padding: 2px 3px !important;
          height: 20px !important;
          font-size: 11px !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          box-sizing: border-box !important;
          border: 1px solid #ccc !important;
        }
        
        /* Header styling */
      .jexcel thead th, .jspreadsheet thead th,
      .jexcel thead td, .jspreadsheet thead td,
      .jss_worksheet thead td {
        background: #10b981 !important;
        color: white !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3px !important;
          font-size: 10px !important;
          text-align: center !important;
          padding: 4px 3px !important;
          height: 24px !important;
        }
        
        /* Excel-like row styling */
        .jexcel tbody tr, .jspreadsheet tbody tr {
          height: 20px !important;
        }
        
        .jexcel tbody tr:nth-child(even) td, .jspreadsheet tbody tr:nth-child(even) td {
          background-color: #f8f9fa !important;
        }
        
        .jexcel tbody tr:hover td, .jspreadsheet tbody tr:hover td {
          background-color: #e3f2fd !important;
        }
        
        /* Selection styling */
        .jexcel .selected, .jspreadsheet .selected {
          background-color: #1976d2 !important;
        color: white !important;
        }
        
        /* Responsive column adjustments */
        @media (max-width: 1400px) {
          .jexcel td, .jspreadsheet td, .jexcel th, .jspreadsheet th {
        font-size: 9px !important;
            padding: 1px 2px !important;
          }
        }
        
        @media (max-width: 1200px) {
          .jexcel td, .jspreadsheet td, .jexcel th, .jspreadsheet th {
            font-size: 8px !important;
            padding: 1px !important;
          }
        }
        
        /* Remove all custom scrollbar styling - use browser default */
        
        
        /* Additional table container styling for proper horizontal scrolling */
        .jspreadsheet-clean-container .jexcel,
        .jspreadsheet-clean-container .jspreadsheet,
        .jspreadsheet-clean-container .jss_container,
        .jspreadsheet-clean-container .jss_worksheet {
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          max-width: 100% !important;
        }
        
        /* Force the table to be contained within the container */
        .jspreadsheet-clean-container .jexcel table,
        .jspreadsheet-clean-container .jspreadsheet table {
          width: 100% !important;
          min-width: 1200px !important;
          max-width: none !important;
        }
        
        /* Ensure the table itself can scroll horizontally */
        .jspreadsheet-clean-container table {
          min-width: 1200px !important;
          width: 100% !important;
        }
        
        
        /* Make sure the spreadsheet container is properly sized */
        .jspreadsheet-clean-container {
          width: 100% !important;
          height: 100% !important;
        position: relative !important;
        }
        
        /* Ensure no overflow on the main page */
        .jspreadsheet-main-wrapper {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Excel-like table borders */
        .jexcel, .jspreadsheet, .jss_container, .jss_worksheet {
          border: 1px solid #d0d7de !important;
          border-radius: 6px !important;
        }
        
        /* Excel-like cell focus */
        .jexcel td:focus, .jspreadsheet td:focus {
          outline: 2px solid #1976d2 !important;
          outline-offset: -2px !important;
        }
        
        /* Excel-like dropdown styling */
        .jss_worksheet > tbody > tr > td.jss_dropdown {
          background-repeat: no-repeat !important;
          background-position: top 50% right 5px !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5H7z' fill='%23666'/%3E%3C/svg%3E") !important;
        }
        
        /* Fix dropdown visibility by allowing overflow for dropdown containers */
        .jss_container {
          overflow: visible !important;
        }
        
        .jss_worksheet {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          overflow: visible !important;
        }
        
        .jss_overflow > tbody > tr > td {
          overflow: visible !important;
        }
        
        .jss_worksheet > tbody > tr > td:last-child {
          overflow: visible !important;
        }
        
        /* Allow dropdowns to overflow the container */
        .jspreadsheet-clean-container {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Ensure dropdown content can overflow */
        .jspreadsheet-clean-container .jss_content {
          overflow: visible !important;
          width: 100% !important;
        }
        
        /* Critical: Allow dropdowns to escape container bounds */
        .jss_worksheet > tbody > tr > td.jss_dropdown {
          overflow: visible !important;
          position: relative !important;
        }
        
        /* Ensure dropdown containers can appear outside their parent */
        .jdropdown-container {
          position: fixed !important;
          z-index: 999999 !important;
        }
        
        /* Constrain all jspreadsheet elements to prevent overflow */
        .jspreadsheet-main-wrapper * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Ensure toolbar doesn't cause overflow */
        .jspreadsheet-main-wrapper .jss_toolbar {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          max-width: 100% !important;
        }
        
        /* Ensure filter bar doesn't cause overflow */
        .jspreadsheet-main-wrapper .jss_filter {
          overflow-x: auto !important;
          max-width: 100% !important;
        }
        
        /* Ensure pagination doesn't cause overflow */
        .jspreadsheet-main-wrapper .jss_pagination {
          overflow-x: auto !important;
          max-width: 100% !important;
        }
      `;
      document.head.appendChild(fullscreenStyles);
      console.log('[ASSETS] ✅ Fullscreen styles added');
    }
    
    console.log('[ASSETS] ✅ All jspreadsheet assets loaded successfully');
    return true;
  } catch (err) {
    console.error('[ASSETS] Failed to load jspreadsheet assets:', err);
    return false;
  }
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

 