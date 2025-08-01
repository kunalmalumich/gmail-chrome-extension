// Professional Finance Team Spreadsheet Configuration
// This file contains all spreadsheet-related configurations, styling, and features

// Import jspreadsheet - this will be available globally from content.js
// If not available globally, we'll use the window.jspreadsheet fallback

// Professional theme configuration
export const PROFESSIONAL_THEME = {
  headerStyle: {
    backgroundColor: '#1a237e',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  cellStyle: {
    borderBottom: '1px solid #e0e0e0',
    padding: '12px 8px',
    fontSize: '13px'
  },
  statusColors: {
    'Draft': '#9e9e9e',
    'Pending Approval': '#ff9800',
    'In Review': '#9c27b0', 
    'Approved': '#2196f3',
    'Payment Scheduled': '#4caf50',
    'Paid': '#4caf50',
    'Overdue': '#f44336',
    'Disputed': '#ff5722',
    'Rejected': '#607d8b'
  }
};

// Professional column configuration
export function getProfessionalSpreadsheetColumns() {
  return [
    { 
      type: 'text', 
      title: 'Invoice #', 
      width: 120, 
      name: 'invoiceNumber',
      allowInsertColumn: false,
      allowDeleteColumn: false
    },
    { 
      type: 'text', 
      title: 'Vendor', 
      width: 200,
      name: 'vendor',
      autocomplete: true,
      source: ['Vendor ABC', 'Vendor XYZ', 'Vendor DEF', 'Vendor GHI', 'Vendor JKL']
    },
    { 
      type: 'numeric', 
      title: 'Amount', 
      width: 120, 
      mask: '$ #,##0.00',
      name: 'amount',
      align: 'right',
      decimal: '.',
      min: 0,
      max: 1000000
    },
    { 
      type: 'calendar', 
      title: 'Due Date', 
      width: 120,
      name: 'dueDate',
      format: 'MM/DD/YYYY',
      min: new Date().toISOString().split('T')[0]
    },
    { 
      type: 'numeric', 
      title: 'Days Overdue', 
      width: 100,
      name: 'daysOverdue',
      align: 'center'
    },
    { 
      type: 'numeric', 
      title: 'Late Fees', 
      width: 100,
      name: 'lateFees',
      mask: '$ #,##0.00',
      align: 'right'
    },
    { 
      type: 'numeric', 
      title: 'Total Due', 
      width: 120,
      name: 'totalDue',
      mask: '$ #,##0.00',
      align: 'right'
    },
    { 
      type: 'dropdown', 
      title: 'Status', 
      width: 150,
      name: 'status',
      source: ['Draft', 'Pending Approval', 'In Review', 'Approved', 'Payment Scheduled', 'Paid', 'Overdue', 'Disputed', 'Rejected'],
      multiple: false
    },
    { 
      type: 'dropdown', 
      title: 'Assigned To', 
      width: 150,
      name: 'assignedTo',
      source: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Lisa Brown', 'Finance Team'],
      autocomplete: true
    },
    { 
      type: 'text', 
      title: 'Thread ID', 
      width: 0, 
      hidden: true,
      name: 'threadId'
    },
    { 
      type: 'text', 
      title: 'Actions', 
      width: 120,
      name: 'actions',
      render: (value, cell, x, y) => {
        return `<button class="view-thread-btn">View Thread</button>`;
      },
      readOnly: true // Prevent editing to avoid rich text editor
    }
  ];
}

// Professional header creation
export function createProfessionalHeader(totalInvoices, totalAmount, overdueCount) {
  return `
    <div style="
      background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); 
      color: white; 
      padding: 32px; 
      border-radius: 12px 12px 0 0; 
      margin-bottom: 0;
      box-shadow: 0 4px 20px rgba(26, 35, 126, 0.15);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="
            margin: 0; 
            font-size: 32px; 
            font-weight: 700; 
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            letter-spacing: -0.5px;
          ">Invoice Tracker</h1>
          <p style="
            margin: 8px 0 0 0; 
            opacity: 0.9; 
            font-size: 16px;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 400;
          ">Professional invoice management for finance teams</p>
        </div>
        <div style="display: flex; gap: 40px;">
          <div style="
            text-align: center; 
            background: rgba(255, 255, 255, 0.1); 
            padding: 16px 24px; 
            border-radius: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          ">
            <div style="
              font-size: 28px; 
              font-weight: 700;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            ">${totalInvoices}</div>
            <div style="
              font-size: 12px; 
              opacity: 0.8;
              font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 500;
            ">Total Invoices</div>
          </div>
          <div style="
            text-align: center; 
            background: rgba(255, 255, 255, 0.1); 
            padding: 16px 24px; 
            border-radius: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          ">
            <div style="
              font-size: 28px; 
              font-weight: 700;
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            ">$${(totalAmount/1000).toFixed(1)}k</div>
            <div style="
              font-size: 12px; 
              opacity: 0.8;
              font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 500;
            ">Total Value</div>
          </div>
          <div style="
            text-align: center; 
            background: rgba(255, 255, 255, 0.1); 
            padding: 16px 24px; 
            border-radius: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          ">
            <div style="
              font-size: 28px; 
              font-weight: 700; 
              color: ${overdueCount > 0 ? '#ff9800' : '#4caf50'};
              font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            ">${overdueCount}</div>
            <div style="
              font-size: 12px; 
              opacity: 0.8;
              font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 500;
            ">Overdue</div>
          </div>
        </div>
      </div>
    </div>
  `;
}



// Bulk operations
export function bulkApprove(worksheet) {
  const selectedRows = worksheet.getSelectedRows();
  if (selectedRows.length === 0) {
    showNotification('Please select invoices to approve', 'warning');
    return;
  }
  
  selectedRows.forEach(rowIndex => {
    worksheet.setData(rowIndex, 7, 'Approved'); // Status column
  });
  
  showNotification(`${selectedRows.length} invoices approved successfully`, 'success');
}

export function bulkSchedulePayment(worksheet) {
  const selectedRows = worksheet.getSelectedRows();
  if (selectedRows.length === 0) {
    showNotification('Please select invoices to schedule payment', 'warning');
    return;
  }
  
  selectedRows.forEach(rowIndex => {
    const dueDate = new Date(worksheet.getData()[rowIndex][3]); // Due date
    const paymentDate = new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days before due
    worksheet.setData(rowIndex, 7, 'Payment Scheduled'); // Status
  });
  
  showNotification(`Payment scheduled for ${selectedRows.length} invoices`, 'success');
}

// Export functions
export function exportToExcel(worksheet) {
  const data = worksheet.getData();
  const headers = ['Invoice #', 'Vendor', 'Amount', 'Due Date', 'Days Overdue', 'Late Fees', 'Total Due', 'Status', 'Assigned To'];
  
  // Create CSV content
  const csvContent = [headers, ...data].map(row => row.join(',')).join('\n');
  
  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_Report_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  showNotification('Invoice report exported successfully', 'success');
}

export function importFromCSV(worksheet) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target.result;
      const lines = csv.split('\n');
      const data = lines.slice(1).map(line => line.split(','));
      worksheet.setData(data);
      showNotification('CSV data imported successfully', 'success');
    };
    reader.readAsText(file);
  };
  input.click();
}

// Notification system
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : type === 'error' ? '#f44336' : '#2196f3'};
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}



// Professional footer data (simplified without calculations)
export function getProfessionalFooterData(data) {
  return [
    ['', '', 'Total Amount:', 'Calculated on demand', '', '', '', '', '', '', ''],
    ['', '', 'Overdue Amount:', 'Calculated on demand', '', '', '', '', '', '', ''],
    ['', '', 'Late Fees Total:', 'Calculated on demand', '', '', '', '', '', '', ''],
    ['', '', 'Average Amount:', 'Calculated on demand', '', '', '', '', '', '', '']
  ];
}

// Initialize professional spreadsheet
export function initializeProfessionalSpreadsheet(containerElement, invoiceData) {
  try {
    console.log('[PROFESSIONAL SPREADSHEET] Initializing with', invoiceData.length, 'invoices');
    
    const transformedData = transformInvoicesToSpreadsheetData(invoiceData);
    const columns = getProfessionalSpreadsheetColumns();
    
    console.log('[PROFESSIONAL SPREADSHEET] Transformed data:', transformedData.length, 'rows');
    console.log('[PROFESSIONAL SPREADSHEET] Column configuration:', columns.length, 'columns');
    
    // Get jspreadsheet function for V5
    const jspreadsheetFunc = window.jspreadsheet;
    
    if (!jspreadsheetFunc) {
      throw new Error('jspreadsheet is not available. Please ensure jspreadsheet-ce is properly imported.');
    }
    
    const worksheets = jspreadsheetFunc(containerElement, {
      // V5 configuration with enhanced column management
      toolbar: createJspreadsheetToolbar(), // Use proper jspreadsheet toolbar
      worksheets: [{
        data: transformedData,
        columns: columns,
        minDimensions: [transformedData.length + 5, columns.length],
        filters: true,
        search: true,
        pagination: 10,
        paginationOptions: [5, 10, 25, 50],
        freezeColumns: 1,
        columnSorting: true,
        columnResize: true,
        columnDrag: true,
        allowInsertColumn: true,
        allowDeleteColumn: true,
        allowRenameColumn: true,
        defaultColWidth: 120,
        defaultColAlign: 'left',
        minSpareCols: 0,
        // Disable rich text editor features
        allowComments: false,
        allowMerging: false,
        allowFormulas: false,
        // Column management events
        onbeforeinsertcolumn: (worksheet, columns) => {
          console.log('[COLUMN MANAGEMENT] Inserting columns:', columns);
          return true; // Allow insertion
        },
        oninsertcolumn: (worksheet, columns) => {
          console.log('[COLUMN MANAGEMENT] Columns inserted:', columns);
        },
        onbeforedeletecolumn: (worksheet, removedColumns) => {
          console.log('[COLUMN MANAGEMENT] Deleting columns:', removedColumns);
          // Prevent deletion of critical columns
          const criticalColumns = [0, 9]; // Invoice # and Thread ID
          if (criticalColumns.some(col => removedColumns.includes(col))) {
            console.warn('[COLUMN MANAGEMENT] Cannot delete critical columns');
            return false;
          }
          return true;
        },
        ondeletecolumn: (worksheet, removedColumns) => {
          console.log('[COLUMN MANAGEMENT] Columns deleted:', removedColumns);
        },
        onmovecolumn: (worksheet, columnNumber, newPositionNumber) => {
          console.log('[COLUMN MANAGEMENT] Column moved:', columnNumber, 'to', newPositionNumber);
        },
        // Data validation events
        onchange: (worksheet, cell, x, y, value) => {
          console.log('[DATA VALIDATION] Cell changed:', { x, y, value });
          
          // Validate the data
          const validation = validateCellData(worksheet, x, y, value);
          
          if (!validation.valid) {
            // Show error message
            showNotification(validation.message, 'error');
            // Mark cell as invalid
            cell.classList.add('invalid');
            cell.classList.remove('valid');
            return false;
          } else {
            // Mark cell as valid
            cell.classList.add('valid');
            cell.classList.remove('invalid');
            
            // Data validation complete
          }
        },
        onbeforechange: (worksheet, cell, x, y, value) => {
          console.log('[DATA VALIDATION] Before change:', { x, y, value });
          return true; // Allow change
        }
      }],
      onload: (spreadsheet) => {
        console.log('[PROFESSIONAL SPREADSHEET] Spreadsheet loaded successfully');
        console.log('[PROFESSIONAL SPREADSHEET] Spreadsheet instance:', spreadsheet);
        
        // Get the worksheets array from the spreadsheet instance
        const worksheets = spreadsheet.worksheets || [];
        console.log('[PROFESSIONAL SPREADSHEET] Worksheets array:', worksheets);
        
        if (worksheets && worksheets.length > 0) {
          const firstWorksheet = worksheets[0];
          console.log('[PROFESSIONAL SPREADSHEET] First worksheet:', firstWorksheet);
          
          // Show the toolbar explicitly using V5 API
          if (firstWorksheet.parent && firstWorksheet.parent.showToolbar) {
            firstWorksheet.parent.showToolbar();
            console.log('[PROFESSIONAL SPREADSHEET] Toolbar shown');
          }
          
          // Pass the container element directly to avoid API issues
          // Add a small delay to ensure spreadsheet is fully rendered
          setTimeout(() => {
            setupColumnManagement(firstWorksheet, worksheets, containerElement);
          }, 100);
          
          // Setup View Thread buttons with proper event delegation
          setTimeout(() => {
            setupViewThreadButtons(worksheets, containerElement);
          }, 500);
        } else {
          console.error('[PROFESSIONAL SPREADSHEET] No worksheets found in spreadsheet');
        }
      }
    });

    console.log('[PROFESSIONAL SPREADSHEET] Spreadsheet initialized successfully');
    return worksheets;
    
  } catch (error) {
    console.error('[PROFESSIONAL SPREADSHEET] Error initializing spreadsheet:', error);
    throw error;
  }
}

// Transform invoice data for professional spreadsheet (simplified)
export function transformInvoicesToSpreadsheetData(invoices) {
  return invoices.map(invoice => [
    invoice.invoiceNumber,           // Invoice #
    invoice.vendor,                  // Vendor
    invoice.amount,                  // Amount
    invoice.dueDate,                 // Due Date
    '',                              // Days Overdue (empty for now)
    '',                              // Late Fees (empty for now)
    '',                              // Total Due (empty for now)
    invoice.status || invoice.stage, // Status
    invoice.assignedTo,              // Assigned To
    invoice.threadId,                // Thread ID (hidden)
    `View Thread`                    // Action Button
  ]);
}

// Column management setup function
function setupColumnManagement(worksheet, worksheets, containerElement) {
  console.log('[COLUMN MANAGEMENT] Setting up column management UI');
  console.log('[COLUMN MANAGEMENT] Worksheet:', worksheet);
  console.log('[COLUMN MANAGEMENT] Worksheets:', worksheets);
  console.log('[COLUMN MANAGEMENT] Container element:', containerElement);
  
  // Use the container element directly
  const container = containerElement;
  console.log('[COLUMN MANAGEMENT] Using container:', container);
  
  if (!container) {
    console.error('[COLUMN MANAGEMENT] Could not find container element');
    return;
  }
  
  if (!worksheet) {
    console.error('[COLUMN MANAGEMENT] Worksheet is undefined, cannot setup column management');
    return;
  }
  
  // Create column management panel
  const managementPanel = document.createElement('div');
  managementPanel.className = 'column-management-panel';
  managementPanel.style.cssText = `
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 8px 16px;
    background: #f1f3f4;
    border-bottom: 1px solid #dee2e6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    width: 100%;
    justify-content: flex-start;
    align-items: center;
  `;

  // Management buttons
  const buttons = [
    { label: 'Add Column', action: () => addNewColumn(worksheet) },
    { label: 'Hide Column', action: () => hideSelectedColumn(worksheet) },
    { label: 'Show Column', action: () => showHiddenColumns(worksheet) },
    { label: 'Reset Layout', action: () => resetColumnLayout(worksheet) }
  ];

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.textContent = btn.label;
    button.className = 'mgmt-btn';
    button.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #dee2e6;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e9ecef';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
    });
    
    button.addEventListener('click', btn.action);
    managementPanel.appendChild(button);
  });

  // Insert management panel safely
  try {
    // Try to find the spreadsheet content first
    const spreadsheetContent = container.querySelector('.jss_content');
    if (spreadsheetContent && spreadsheetContent.parentNode === container) {
      container.insertBefore(managementPanel, spreadsheetContent);
      console.log('[COLUMN MANAGEMENT] Management panel inserted before content');
    } else {
      // Fallback: append to the end of the container
      container.appendChild(managementPanel);
      console.log('[COLUMN MANAGEMENT] Management panel appended to container');
    }
  } catch (error) {
    console.error('[COLUMN MANAGEMENT] Error inserting management panel:', error);
    // Last resort: append to container
    try {
      container.appendChild(managementPanel);
      console.log('[COLUMN MANAGEMENT] Management panel appended as fallback');
    } catch (fallbackError) {
      console.error('[COLUMN MANAGEMENT] Failed to insert management panel:', fallbackError);
    }
  }
}

function addNewColumn(worksheet) {
  try {
    if (!worksheet) {
      console.error('[COLUMN MANAGEMENT] Worksheet is undefined');
      showNotification('Worksheet not available', 'error');
      return;
    }
    
    const newColumn = {
      type: 'text',
      title: `Column ${worksheet.options.columns.length + 1}`,
      width: 120,
      name: `column_${worksheet.options.columns.length + 1}`
    };
    
    worksheet.insertColumn(1, worksheet.options.columns.length, false, [newColumn]);
    showNotification('New column added', 'success');
  } catch (error) {
    console.error('Error adding column:', error);
    showNotification('Error adding column', 'error');
  }
}

function hideSelectedColumn(worksheet) {
  try {
    if (!worksheet) {
      console.error('[COLUMN MANAGEMENT] Worksheet is undefined');
      showNotification('Worksheet not available', 'error');
      return;
    }
    
    const selectedCell = worksheet.getSelectedCell();
    if (selectedCell) {
      const columnIndex = selectedCell.x;
      worksheet.hideColumn(columnIndex);
      showNotification('Column hidden', 'info');
    } else {
      showNotification('Please select a cell in the column to hide', 'warning');
    }
  } catch (error) {
    console.error('Error hiding column:', error);
    showNotification('Error hiding column', 'error');
  }
}

function showHiddenColumns(worksheet) {
  try {
    if (!worksheet) {
      console.error('[COLUMN MANAGEMENT] Worksheet is undefined');
      showNotification('Worksheet not available', 'error');
      return;
    }
    
    // Show all hidden columns
    for (let i = 0; i < worksheet.options.columns.length; i++) {
      worksheet.showColumn(i);
    }
    showNotification('All hidden columns shown', 'success');
  } catch (error) {
    console.error('Error showing columns:', error);
    showNotification('Error showing columns', 'error');
  }
}

function resetColumnLayout(worksheet) {
  try {
    if (!worksheet) {
      console.error('[COLUMN MANAGEMENT] Worksheet is undefined');
      showNotification('Worksheet not available', 'error');
      return;
    }
    
    // Reset column widths to default
    worksheet.options.columns.forEach((col, index) => {
      worksheet.setWidth(index, 120);
    });
    showNotification('Column layout reset', 'success');
  } catch (error) {
    console.error('Error resetting layout:', error);
    showNotification('Error resetting layout', 'error');
  }
}

// Enhanced data validation function
function validateCellData(worksheet, x, y, value) {
  const column = worksheet.getColumns()[x];
  
  // Amount validation
  if (column.name === 'amount') {
    const amount = parseFloat(value.replace(/[$,]/g, ''));
    if (isNaN(amount) || amount < 0 || amount > 1000000) {
      return { valid: false, message: 'Amount must be between $0 and $1,000,000' };
    }
  }
  
  // Due date validation
  if (column.name === 'dueDate') {
    const dueDate = new Date(value);
    const today = new Date();
    if (dueDate < today) {
      return { valid: false, message: 'Due date cannot be in the past' };
    }
  }
  
  // Status validation
  if (column.name === 'status') {
    const validStatuses = ['Draft', 'Pending Approval', 'In Review', 'Approved', 'Payment Scheduled', 'Paid', 'Overdue', 'Disputed', 'Rejected'];
    if (!validStatuses.includes(value)) {
      return { valid: false, message: 'Invalid status value' };
    }
  }
  
  return { valid: true };
}



// Helper function to navigate to thread (will be available globally from content.js)
function navigateToThread(threadId) {
  if (window.navigateToThread) {
    window.navigateToThread(threadId);
  } else {
    console.error('[PROFESSIONAL SPREADSHEET] navigateToThread function not available');
  }
} 

export function createJspreadsheetToolbar() {
  return {
    responsive: false,
    container: true,
    items: [
      // File Operations
      {
        type: 'i',
        content: 'save',
        tooltip: 'Save Data',
        onclick: function(worksheet) {
          const data = worksheet.getData();
          const jsonData = JSON.stringify(data, null, 2);
          
          // Create download link
          const blob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-data-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          
          showNotification('Data saved successfully!', 'success');
        }
      },
      {
        type: 'i',
        content: 'file_download',
        tooltip: 'Export Excel',
        onclick: function(worksheet) {
          exportToExcel(worksheet);
        }
      },
      {
        type: 'i',
        content: 'file_upload',
        tooltip: 'Import CSV',
        onclick: function(worksheet) {
          importFromCSV(worksheet);
        }
      },
      {
        type: 'divisor'
      },
      // Edit Operations
      {
        type: 'i',
        content: 'undo',
        tooltip: 'Undo',
        onclick: function(worksheet) {
          worksheet.undo();
        }
      },
      {
        type: 'i',
        content: 'redo',
        tooltip: 'Redo',
        onclick: function(worksheet) {
          worksheet.redo();
        }
      },
      {
        type: 'i',
        content: 'add',
        tooltip: 'Add Row',
        onclick: function(worksheet) {
          worksheet.insertRow();
        }
      },
      {
        type: 'i',
        content: 'remove',
        tooltip: 'Delete Row',
        onclick: function(worksheet) {
          const selectedRows = worksheet.getSelectedRows();
          if (selectedRows.length === 0) {
            showNotification('Please select rows to delete', 'warning');
            return;
          }
          
          if (confirm(`Delete ${selectedRows.length} selected row(s)?`)) {
            selectedRows.forEach(rowIndex => {
              worksheet.deleteRow(rowIndex);
            });
            showNotification(`${selectedRows.length} row(s) deleted`, 'success');
          }
        }
      },
      {
        type: 'divisor'
      },
      // Finance Operations
      {
        type: 'i',
        content: 'check_circle',
        tooltip: 'Bulk Approve',
        onclick: function(worksheet) {
          bulkApprove(worksheet);
        }
      },
      {
        type: 'i',
        content: 'payment',
        tooltip: 'Schedule Payment',
        onclick: function(worksheet) {
          bulkSchedulePayment(worksheet);
        }
      },
      {
        type: 'i',
        content: 'warning',
        tooltip: 'Mark Overdue',
        onclick: function(worksheet) {
          const data = worksheet.getData();
          const today = new Date();
          
          data.forEach((row, index) => {
            const dueDate = new Date(row[4]); // Due Date column
            if (dueDate < today && row[3] !== 'Paid') { // Status column
              worksheet.setValueFromCoords(3, index, 'Overdue');
            }
          });
          
          showNotification('Overdue invoices marked', 'success');
        }
      },
      {
        type: 'divisor'
      },
      // View Operations
      {
        type: 'i',
        content: 'filter_list',
        tooltip: 'Toggle Filters',
        onclick: function(worksheet) {
          const currentState = worksheet.options.filters;
          worksheet.options.filters = !currentState;
          worksheet.refresh();
          showNotification(`Filters ${currentState ? 'disabled' : 'enabled'}`, 'info');
        }
      },
      {
        type: 'i',
        content: 'sort',
        tooltip: 'Toggle Sorting',
        onclick: function(worksheet) {
          const currentState = worksheet.options.columnSorting;
          worksheet.options.columnSorting = !currentState;
          worksheet.refresh();
          showNotification(`Sorting ${currentState ? 'disabled' : 'enabled'}`, 'info');
        }
      },
      {
        type: 'i',
        content: 'print',
        tooltip: 'Print',
        onclick: function(worksheet) {
          const printWindow = window.open('', '_blank');
          const data = worksheet.getData();
          const columns = worksheet.options.columns;
          
          let html = `
            <html>
              <head>
                <title>Invoice Report</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  table { border-collapse: collapse; width: 100%; }
                  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                  th { background-color: #f2f2f2; }
                  .header { text-align: center; margin-bottom: 20px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>Invoice Report</h1>
                  <p>Generated on ${new Date().toLocaleDateString()}</p>
                </div>
                <table>
                  <thead>
                    <tr>
                      ${columns.map(col => `<th>${col.title}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${data.map(row => `
                      <tr>
                        ${row.map(cell => `<td>${cell || ''}</td>`).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </body>
            </html>
          `;
          
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
          
          showNotification('Print dialog opened', 'info');
        }
      }
    ]
  };
}

// Setup View Thread buttons with proper event delegation
function setupViewThreadButtons(worksheets, containerElement) {
  try {
    // Find buttons in the spreadsheet content
    const spreadsheetContent = containerElement.querySelector('.jss_content');
    if (spreadsheetContent) {
      const viewThreadButtons = spreadsheetContent.querySelectorAll('.view-thread-btn');
      console.log('[PROFESSIONAL SPREADSHEET] Found', viewThreadButtons.length, 'View Thread buttons');
      
      viewThreadButtons.forEach((button, index) => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          try {
            const worksheet = worksheets[0];
            if (!worksheet) {
              console.error('[PROFESSIONAL SPREADSHEET] Worksheet not found');
              return;
            }
            
            const rowData = worksheet.getData()[index];
            if (!rowData) {
              console.error('[PROFESSIONAL SPREADSHEET] Row data not found for index:', index);
              return;
            }
            
            const threadId = rowData[9]; // Thread ID is in column 9 (hidden)
            console.log(`[PROFESSIONAL SPREADSHEET] View Thread clicked for row ${index}, thread ${threadId}`);
            navigateToThread(threadId);
          } catch (error) {
            console.error('[PROFESSIONAL SPREADSHEET] Error handling View Thread click:', error);
          }
        });
      });
    }
  } catch (error) {
    console.error('[PROFESSIONAL SPREADSHEET] Error setting up View Thread buttons:', error);
  }
}