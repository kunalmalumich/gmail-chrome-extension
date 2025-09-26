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
  
  // Function to save spreadsheet to Google Drive
  async function saveToGoogleDrive(spreadsheet) {
    try {
      console.log('[GOOGLE_DRIVE] Starting save to Google Drive...');
      
      // Check if user is authenticated
      if (!window.uiManager || !window.uiManager.apiClient) {
        console.error('[GOOGLE_DRIVE] UIManager or apiClient not available');
        alert('Please ensure you are signed in to use this feature.');
        return;
      }
      
      // Get the spreadsheet data as CSV
      const csvData = spreadsheet.getData('csv');
      console.log('[GOOGLE_DRIVE] CSV data generated:', csvData.substring(0, 100) + '...');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `stamp-spreadsheet-${timestamp}.csv`;
      
      // Create a document card data structure similar to what the business rules expect
      const documentCardData = {
        title: filename,
        type: 'spreadsheet_export',
        content: csvData,
        mimeType: 'text/csv',
        timestamp: new Date().toISOString(),
        source: 'stamp_spreadsheet_export'
      };
      
      // Check if we have a document storage rule
      const storageRule = await window.uiManager.apiClient.getDocumentStorageRule();
      
      if (!storageRule) {
        console.log('[GOOGLE_DRIVE] No document storage rule found, using direct storage');
        // Fallback: try to use a generic storage approach
        alert('Google Drive storage is not configured. Please contact your administrator to set up document storage rules.');
        return;
      }
      
      // Prepare the payload for the business rule
      const payload = {
        ruleId: storageRule.id,
        cardData: documentCardData,
        timestamp: new Date().toISOString()
      };
      
      console.log('[GOOGLE_DRIVE] Executing business rule with payload:', payload);
      
      // Execute the business rule to store the document
      const result = await window.uiManager.apiClient.executeBusinessRule(payload);
      
      if (result && result.success) {
        console.log('[GOOGLE_DRIVE] Document stored successfully:', result);
        alert(`Spreadsheet saved to Google Drive successfully!\nFile: ${filename}`);
      } else {
        throw new Error(result?.error || 'Storage failed');
      }
      
    } catch (error) {
      console.error('[GOOGLE_DRIVE] Error saving to Google Drive:', error);
      alert(`Error saving to Google Drive: ${error.message}\n\nPlease ensure you are signed in and have the necessary permissions.`);
    }
  }
  
  const spreadsheet = jspreadsheet(cleanContainer, {
    toolbar: true,     // Enable the toolbar with tools
    allowExport: true, // Enable export functionality
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
      search: false, // Disable default search since we have custom toolbar search
      
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
        filterRow.style.background = '#1A8A76';
        filterRow.style.color = 'white';
        
        // Ensure all filter cells in the row are properly styled
        const filterCellsInRow = filterRow.querySelectorAll('td');
        filterCellsInRow.forEach((cell, index) => {
          cell.style.background = '#1A8A76';
          cell.style.color = 'white';
          cell.style.border = '1px solid #3BAE9A';
          
          // Add filter icon if not present
          if (!cell.querySelector('.jss_column_filter')) {
            cell.classList.add('jss_column_filter');
          }
        });
      }
      
    }, 1500); // Increased delay to ensure everything is rendered
    
    // Search functionality is now integrated into the toolbar
    // No need for separate search containers since we have toolbar integration
    console.log('[SEARCH] oncreateworksheet event fired - search integrated in toolbar!');
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
  
  // Add fullscreen toggle functionality and integrate search/entries into toolbar
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

    // === INTEGRATE SEARCH INTO TOOLBAR (FAR RIGHT) ===
    const toolbar = cleanContainer.querySelector('.jss_toolbar');
    if (toolbar) {
      console.log('[TOOLBAR] Found toolbar, adding search control to far right');
      
      // Create search container for far right position
      const searchContainer = document.createElement('div');
      searchContainer.className = 'jss_toolbar_search';
      searchContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 4px 8px;
        min-width: 200px;
        margin-left: auto;
        margin-right: 10px;
      `;

      // Create search icon
      const searchIcon = document.createElement('div');
      searchIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      `;
      searchIcon.style.cssText = `
        color: #6c757d;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      `;

      // Create search input
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search invoices...';
      searchInput.className = 'jss_toolbar_search_input';
      searchInput.style.cssText = `
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        color: #495057;
        flex: 1;
        min-width: 0;
      `;

      // Assemble search container
      searchContainer.appendChild(searchIcon);
      searchContainer.appendChild(searchInput);

      // Add to toolbar (far right)
      toolbar.appendChild(searchContainer);

      // Add search functionality
      const performSearch = (searchTerm) => {
        console.log('[TOOLBAR SEARCH] Searching for:', searchTerm);
        if (sheet && sheet.search) {
          sheet.search(searchTerm);
        }
      };

      // Add real-time search
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        performSearch(searchTerm);
      });

      // Add Enter key support
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const searchTerm = e.target.value;
          performSearch(searchTerm);
        }
      });

      console.log('[TOOLBAR] Search control added to far right of toolbar');
    }

    // === REMOVE ANY DEFAULT JSPREADSHEET SEARCH ELEMENTS ===
    setTimeout(() => {
      // Remove any default jspreadsheet search elements that might have been created
      const defaultSearchElements = cleanContainer.querySelectorAll('.jss_search, .jspreadsheet-search, input[placeholder*="Search"], input[placeholder*="search"]');
      defaultSearchElements.forEach(element => {
        // Only remove if it's not our custom toolbar search
        if (!element.closest('.jss_toolbar_search')) {
          console.log('[TOOLBAR] Removing default search element:', element);
          element.remove();
        }
      });

      // Also remove any search labels or containers
      const searchLabels = cleanContainer.querySelectorAll('label:contains("Search"), span:contains("Search:")');
      searchLabels.forEach(label => {
        if (!label.closest('.jss_toolbar_search')) {
          console.log('[TOOLBAR] Removing search label:', label);
          label.remove();
        }
      });

      // Remove any filter/search containers that might contain duplicate search
      const filterContainers = cleanContainer.querySelectorAll('.jss_filter');
      filterContainers.forEach(container => {
        const searchInputs = container.querySelectorAll('input[type="text"]');
        searchInputs.forEach(input => {
          if (!input.closest('.jss_toolbar_search') && (input.placeholder?.toLowerCase().includes('search') || input.previousElementSibling?.textContent?.includes('Search'))) {
            console.log('[TOOLBAR] Removing duplicate search from filter container:', input);
            input.remove();
            // Also remove the label if it exists
            const label = input.previousElementSibling;
            if (label && label.textContent?.includes('Search')) {
              label.remove();
            }
          }
        });
      });
    }, 2000);

    // === ADD ENTRIES DROPDOWN ABOVE PAGINATION ===
    setTimeout(() => {
      // Wait for pagination to be rendered
      const paginationContainer = cleanContainer.querySelector('.jss_pagination');
      if (paginationContainer) {
        console.log('[ENTRIES] Found pagination, adding entries dropdown above it');
        
        // Create entries container
        const entriesContainer = document.createElement('div');
        entriesContainer.className = 'jss_entries_control';
        entriesContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding: 8px 0;
          font-size: 14px;
          color: #495057;
        `;

        // Create entries label
        const entriesLabel = document.createElement('span');
        entriesLabel.textContent = 'Show';
        entriesLabel.style.cssText = `
          white-space: nowrap;
          color: #6c757d;
        `;

        // Create entries dropdown
        const entriesSelect = document.createElement('select');
        entriesSelect.className = 'jss_entries_select';
        entriesSelect.style.cssText = `
          border: 1px solid #dee2e6;
          outline: none;
          background: #ffffff;
          font-size: 14px;
          color: #495057;
          cursor: pointer;
          min-width: 60px;
          padding: 4px 8px;
          border-radius: 4px;
        `;

        // Add options to entries dropdown
        const entriesOptions = [10, 25, 50, 100];
        entriesOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option;
          optionElement.textContent = option;
          if (option === 10) optionElement.selected = true; // Default to 10
          entriesSelect.appendChild(optionElement);
        });

        // Create entries suffix
        const entriesSuffix = document.createElement('span');
        entriesSuffix.textContent = 'entries';
        entriesSuffix.style.cssText = `
          white-space: nowrap;
          color: #6c757d;
        `;

        // Assemble entries container
        entriesContainer.appendChild(entriesLabel);
        entriesContainer.appendChild(entriesSelect);
        entriesContainer.appendChild(entriesSuffix);

        // Insert above pagination
        paginationContainer.parentNode.insertBefore(entriesContainer, paginationContainer);

        // Add entries change functionality
        entriesSelect.addEventListener('change', (e) => {
          const newPageSize = parseInt(e.target.value);
          console.log('[ENTRIES] Changing page size to:', newPageSize);
          if (sheet && sheet.setPagination) {
            sheet.setPagination(newPageSize);
          }
        });

        console.log('[ENTRIES] Entries dropdown added above pagination');
      } else {
        console.log('[ENTRIES] Pagination container not found, will retry');
      }
    }, 1500);
  }, 1000);
  
  // Debug: Check if search methods are available
  console.log('[SEARCH DEBUG] Sheet object:', sheet);
  console.log('[SEARCH DEBUG] Search method available:', typeof sheet?.search);
  console.log('[SEARCH DEBUG] ResetSearch method available:', typeof sheet?.resetSearch);
  console.log('[SEARCH DEBUG] ShowSearch method available:', typeof sheet?.showSearch);
  
  // Search functionality is now integrated into the toolbar above
  // No need for fallback search containers since we have toolbar integration

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

    // Document preview icon click handler - connect to new PDF preview functionality
    cleanContainer.addEventListener('click', function(e) {
      const clickedElement = e.target.closest('.doc-preview-icon');

      if (clickedElement) {
        console.log('[DOC_PREVIEW] Document preview icon clicked in spreadsheet');
        const hasDoc = clickedElement.getAttribute('data-has-doc');
        const threadId = clickedElement.getAttribute('data-thread-id');
        const docName = clickedElement.getAttribute('data-doc-name');
        const docUrl = clickedElement.getAttribute('data-doc-url');

        console.log('[DOC_PREVIEW] Retrieved data from icon:', { hasDoc, threadId, docName, docUrl });

        if (hasDoc === '1' && threadId && docName) {
          console.log('[DOC_PREVIEW] Valid document data found, triggering PDF preview');
          
          // Get the UIManager instance from the global scope
          const uiManager = window.stampUIManager;
          if (uiManager && uiManager.apiClient) {
            console.log('[DOC_PREVIEW] UIManager and apiClient found, calling fetchGmailAttachmentPdf');
            
            // Use the same workflow as the sidebar preview - call apiClient.fetchGmailAttachmentPdf
            uiManager.apiClient.fetchGmailAttachmentPdf({ threadId, documentName: docName })
              .then(blob => {
                console.log('[DOC_PREVIEW] PDF blob received, showing preview');
                uiManager.showRightPreviewWithBlob(clickedElement, blob);
              })
              .catch(error => {
                console.error('[DOC_PREVIEW] Error fetching PDF:', error);
                console.log('[DOC_PREVIEW] Falling back to test PDF');
                
                // Fallback to test PDF
                const testBlob = uiManager.createTestPdfBlob();
                uiManager.showRightPreviewWithBlob(clickedElement, testBlob);
              });
          } else {
            console.error('[DOC_PREVIEW] UIManager or apiClient not found in global scope');
            console.log('[DOC_PREVIEW] UIManager:', uiManager);
            console.log('[DOC_PREVIEW] apiClient:', uiManager?.apiClient);
          }
        } else {
          console.log('[DOC_PREVIEW] No valid document data found on icon');
        }
      }
    });

    // Old preview functionality removed - now handled by content.js UIManager

    // Old green modal functionality removed - now handled by content.js UIManager

    // Old showRightPreview function removed - now handled by content.js UIManager
    const showRightPreviewOld = (iconEl) => {
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
          background: #1A8A76;
          border-left: 1px solid #167866;
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
          background: #167866;
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
          
          <div style="flex: 1; display: flex; flex-direction: column; background: #167866; border-radius: 8px; overflow: hidden; margin-bottom: 20px; position: relative;">
            ${docUrl ? `
              <div style="flex: 1; min-height: 300px; position: relative; background: #167866; border-radius: 8px 8px 0 0; overflow: hidden;">
                ${isImage ? `
                  <!-- Image Viewer Container -->
                  <div id="image-viewer-container" style="width: 100%; height: 100%; position: relative; background: #1A8A76; display: flex; align-items: center; justify-content: center;">
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
                  <div id="pdf-viewer-container" style="width: 100%; height: 100%; position: relative; background: #1A8A76;">
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
                <div style="background: #167866; padding: 16px; border-top: 1px solid #065f46;">
                  <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #ffffff;">Document Details</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>File:</strong> ${docName}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 4px;"><strong>Type:</strong> ${fileType}</div>
                  <div style="font-size: 12px; color: #ffffff; margin-bottom: 8px;"><strong>Status:</strong> <span id="document-status">Loading...</span></div>
                  
                  <!-- Quick Actions -->
                  <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
                    <button id="preview-quick-view-btn" data-doc-url="${docUrl}" style="
                      padding: 6px 12px; 
                      background: #1A8A76; 
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
                      background: #167866; 
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
                      background: #3BAE9A; 
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
          
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="preview-open-doc-btn" data-doc-url="${docUrl}" style="
              flex: 1;
              min-width: 120px;
              padding: 12px 20px;
              background: linear-gradient(135deg, #1A8A76 0%, #167866 100%);
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
              flex: 1;
              min-width: 120px;
              padding: 12px 20px;
              background: #167866;
              color: #ffffff;
              border: 1px solid #3BAE9A;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s ease;
            ">Download</button>
            <button id="preview-save-to-drive-btn" data-doc-url="${docUrl}" data-doc-name="${docName}" style="
              flex: 1;
              min-width: 120px;
              padding: 12px 20px;
              background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%);
              border: none;
              border-radius: 8px;
              color: white;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Save to Drive
            </button>
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
      const saveToDriveBtn = rightPreviewPanel.querySelector('#preview-save-to-drive-btn');
      
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
      
      if (saveToDriveBtn) {
        saveToDriveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const docUrl = saveToDriveBtn.getAttribute('data-doc-url');
          const docName = saveToDriveBtn.getAttribute('data-doc-name');
          
          console.log('[SAVE_TO_DRIVE] Save to Drive button clicked:', { docUrl, docName });
          
          try {
            // Check if user is authenticated
            if (!window.uiManager || !window.uiManager.apiClient) {
              console.error('[SAVE_TO_DRIVE] UIManager or apiClient not available');
              alert('Please ensure you are signed in to use this feature.');
              return;
            }
            
            // Create a document card data structure for the PDF
            const documentCardData = {
              title: docName || 'Document',
              type: 'pdf_document',
              content: docUrl, // Store the URL as content
              mimeType: 'application/pdf',
              timestamp: new Date().toISOString(),
              source: 'document_preview_export',
              url: docUrl
            };
            
            // Check if we have a document storage rule
            const storageRule = await window.uiManager.apiClient.getDocumentStorageRule();
            
            if (!storageRule) {
              console.log('[SAVE_TO_DRIVE] No document storage rule found');
              alert('Google Drive storage is not configured. Please contact your administrator to set up document storage rules.');
              return;
            }
            
            // Prepare the payload for the business rule
            const payload = {
              ruleId: storageRule.id,
              cardData: documentCardData,
              timestamp: new Date().toISOString()
            };
            
            console.log('[SAVE_TO_DRIVE] Executing business rule with payload:', payload);
            
            // Execute the business rule to store the document
            const result = await window.uiManager.apiClient.executeBusinessRule(payload);
            
            if (result && result.success) {
              console.log('[SAVE_TO_DRIVE] Document stored successfully:', result);
              alert(`Document saved to Google Drive successfully!\nFile: ${docName || 'Document'}`);
            } else {
              throw new Error(result?.error || 'Storage failed');
            }
            
          } catch (error) {
            console.error('[SAVE_TO_DRIVE] Error saving to Google Drive:', error);
            alert(`Error saving to Google Drive: ${error.message}\n\nPlease ensure you are signed in and have the necessary permissions.`);
          }
        });
        
        saveToDriveBtn.addEventListener('mouseenter', () => {
          saveToDriveBtn.style.background = 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)';
          saveToDriveBtn.style.transform = 'translateY(-1px)';
          saveToDriveBtn.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.4)';
        });
        
        saveToDriveBtn.addEventListener('mouseleave', () => {
          saveToDriveBtn.style.background = 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)';
          saveToDriveBtn.style.transform = 'translateY(0)';
          saveToDriveBtn.style.boxShadow = 'none';
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
              background: #1A8A76;
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

    // Old showRightPreviewWithBlob function removed - now handled by content.js UIManager
    const showRightPreviewWithBlobOld = (iconEl, blob) => {
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
          background: #1A8A76;
          border-left: 1px solid #167866;
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
          background: #167866;
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
            <div id="image-viewer-container" style="width: 100%; height: 100%; position: relative; background: #1A8A76; display: flex; align-items: center; justify-content: center;">
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
            <div id="pdf-viewer-container" style="width: 100%; height: 100%; position: relative; background: #1A8A76;">
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
            
            <div style="flex: 1; display: flex; flex-direction: column; background: #167866; border-radius: 8px; overflow: hidden; margin-bottom: 20px; position: relative;">
              <div style="flex: 1; min-height: 300px; position: relative; background: #167866; border-radius: 8px 8px 0 0; overflow: hidden;">
                ${viewerContent}
                
                <!-- Document Info Card -->
                <div style="background: #167866; padding: 16px; border-top: 1px solid #065f46;">
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
            
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button id="preview-open-doc-btn" data-object-url="${objectUrl}" style="
                flex: 1;
                min-width: 120px;
                padding: 12px 20px;
                background: linear-gradient(135deg, #1A8A76 0%, #167866 100%);
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
                flex: 1;
                min-width: 120px;
                padding: 12px 20px;
                background: #167866;
                color: #ffffff;
                border: 1px solid #3BAE9A;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
              ">Download</button>
              <button id="preview-save-to-drive-btn" data-object-url="${objectUrl}" data-doc-name="${docName}" style="
                flex: 1;
                min-width: 120px;
                padding: 12px 20px;
                background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%);
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                Save to Drive
              </button>
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
      const saveToDriveBtn = rightPreviewPanel.querySelector('#preview-save-to-drive-btn');
      
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
                background: #1A8A76;
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

    // All old preview functionality removed - now handled by content.js UIManager
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
        background: #1A8A76 !important;
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
        
        /* Ensure toolbar doesn't cause overflow and remove gaps */
        .jspreadsheet-main-wrapper .jss_toolbar {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          max-width: 100% !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          border-bottom: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          min-height: 40px !important;
          padding: 8px 12px !important;
        }

        /* Style toolbar search (far right) */
        .jspreadsheet-main-wrapper .jss_toolbar_search {
          margin-left: auto !important;
          margin-right: 0 !important;
          align-self: center !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
        }

        /* Style search container in toolbar */
        .jspreadsheet-main-wrapper .jss_toolbar_search {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          background: #f8f9fa !important;
          border: 1px solid #dee2e6 !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          min-width: 200px !important;
          transition: all 0.2s ease !important;
        }

        .jspreadsheet-main-wrapper .jss_toolbar_search:hover {
          border-color: #007bff !important;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1) !important;
        }

        .jspreadsheet-main-wrapper .jss_toolbar_search:focus-within {
          border-color: #007bff !important;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2) !important;
        }

        /* Style search input in toolbar */
        .jspreadsheet-main-wrapper .jss_toolbar_search_input {
          border: none !important;
          outline: none !important;
          background: transparent !important;
          font-size: 14px !important;
          color: #495057 !important;
          flex: 1 !important;
          min-width: 0 !important;
        }

        .jspreadsheet-main-wrapper .jss_toolbar_search_input::placeholder {
          color: #6c757d !important;
        }

        /* Hide any default jspreadsheet search elements */
        .jspreadsheet-main-wrapper .jss_search:not(.jss_toolbar_search_input),
        .jspreadsheet-main-wrapper .jspreadsheet-search:not(.jss_toolbar_search),
        .jspreadsheet-main-wrapper input[placeholder*="Search"]:not(.jss_toolbar_search_input),
        .jspreadsheet-main-wrapper input[placeholder*="search"]:not(.jss_toolbar_search_input) {
          display: none !important;
        }

        /* Hide search labels that are not part of our toolbar */
        .jspreadsheet-main-wrapper label:contains("Search"),
        .jspreadsheet-main-wrapper span:contains("Search:") {
          display: none !important;
        }

        /* Style entries control at bottom */
        .jspreadsheet-main-wrapper .jss_entries_control {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          margin-bottom: 10px !important;
          padding: 8px 0 !important;
          font-size: 14px !important;
          color: #495057 !important;
        }

        .jspreadsheet-main-wrapper .jss_entries_select {
          border: 1px solid #dee2e6 !important;
          outline: none !important;
          background: #ffffff !important;
          font-size: 14px !important;
          color: #495057 !important;
          cursor: pointer !important;
          min-width: 60px !important;
          padding: 4px 8px !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }

        .jspreadsheet-main-wrapper .jss_entries_select:hover {
          border-color: #007bff !important;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1) !important;
        }

        .jspreadsheet-main-wrapper .jss_entries_select:focus {
          border-color: #007bff !important;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2) !important;
        }

        /* Remove gap between toolbar and spreadsheet - AGGRESSIVE OVERRIDE */
        .jspreadsheet-main-wrapper .jss_filter {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        .jspreadsheet-main-wrapper .jspreadsheet-clean-container {
          margin-top: 0 !important;
          padding-top: 0 !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        /* Override any jspreadsheet default spacing */
        .jspreadsheet-main-wrapper .jspreadsheet {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }

        .jspreadsheet-main-wrapper .jspreadsheet table {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }

        /* Ensure no gaps between toolbar and any following elements */
        .jspreadsheet-main-wrapper .jss_toolbar + * {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }

        /* Override any potential jspreadsheet internal spacing */
        .jspreadsheet-main-wrapper .jss_toolbar ~ .jss_filter,
        .jspreadsheet-main-wrapper .jss_toolbar ~ .jspreadsheet,
        .jspreadsheet-main-wrapper .jss_toolbar ~ .jspreadsheet-clean-container {
          margin-top: 0 !important;
          padding-top: 0 !important;
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
    
    // Debug: Log document structure to understand available fields
    if (invoice.document) {
      console.log('[DOC_DEBUG] Document structure for invoice', invoice.invoiceNumber, ':', invoice.document);
      console.log('[DOC_DEBUG] Available document fields:', Object.keys(invoice.document));
    }
    
    // Try multiple possible fields for document name
    const docName = invoice.document?.document_name || 
                   invoice.document?.filename || 
                   invoice.document?.name || 
                   invoice.document?.title ||
                   details.documentName ||
                   details.filename ||
                   `Invoice_${invoice.invoiceNumber || 'Unknown'}`;
                   
    console.log('[DOC_DEBUG] Final docName for invoice', invoice.invoiceNumber, ':', docName);

    // Optional document/thumbnail URLs (best-effort)
    const docUrl = details.documentUrl || details.document_url || invoice.document?.url || '';
    const thumbUrl = details.thumbnailUrl || details.thumbnail_url || invoice.document?.thumbnailUrl || invoice.document?.thumbnail_url || '';

    // Document icon with click-to-open behavior (always render; disabled if missing identifiers)
    // For testing: always enable document preview functionality
    const hasDoc = true; // Always true for testing - was: !!(docThreadId && docName);
    const hasSampleDoc = !!(docUrl && docUrl.includes('w3.org')); // Check if it's our sample document
    const docIcon = `
      <span class="doc-preview-icon" 
            data-doc-url="${docUrl}"
            data-thumb-url="${thumbUrl}"
            data-has-doc="${hasDoc ? '1' : '0'}"
            data-thread-id="${docThreadId}"
            data-doc-name="${docName}"
            title="${hasDoc ? (hasSampleDoc ? 'Sample Document - Preview available' : 'Click to test PDF preview functionality') : 'No document available'}"
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

 