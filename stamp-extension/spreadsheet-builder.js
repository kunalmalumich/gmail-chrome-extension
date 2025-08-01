// stamp-extension/spreadsheet-builder.js

/**
 * This file contains all the logic for building and configuring the jspreadsheet instance
 * for the finance team's invoice tracker.
 */

// Core function to initialize the spreadsheet
export function buildSpreadsheet(container, data) {
  // Define columns with finance-specific features
  const columns = [
    { 
      type: 'text', 
      title: 'Invoice #', 
      width: 120, 
      readOnly: true 
    },
    { 
      type: 'text', 
      title: 'Vendor', 
      width: 200,
      autocomplete: true,
      source: getVendorList(data) // Dynamically populate vendors
    },
    { 
      type: 'numeric', 
      title: 'Amount', 
      width: 120, 
      mask: '$ #,##0.00',
      align: 'right'
    },
    { 
      type: 'calendar', 
      title: 'Due Date', 
      width: 120,
      options: { format: 'MM/DD/YYYY' }
    },
    { 
      type: 'dropdown', 
      title: 'Status', 
      width: 150,
      source: ['Pending Approval', 'Approved', 'Paid', 'Overdue', 'Rejected']
    },
    { 
      type: 'text', 
      title: 'Assigned To', 
      width: 150 
    },
    {
      type: 'text',
      title: 'Thread ID',
      width: 150,
      readOnly: true
    },
    {
      type: 'html',
      title: 'Actions',
      width: 120,
      readOnly: true,
    }
  ];

  // Transform the raw invoice data to fit the spreadsheet structure
  const spreadsheetData = transformDataForSpreadsheet(data);

  // Create the spreadsheet
  const spreadsheet = jspreadsheet(container, {
    worksheets: [{
      data: spreadsheetData,
      columns: columns,
      allowComments: true,
    }],
    toolbar: false, // Disable the problematic default toolbar
    // Event handlers
    onchange: (worksheet, cell, x, y, value) => {
      console.log(`Cell changed at (${x},${y}) to: ${value}`);
      // Add data validation logic here
    },
    onload: (spreadsheet) => {
        console.log('Spreadsheet loaded');
        // Create our custom toolbar that works with InboxSDK
        createCustomToolbar(container, spreadsheet);
    }
  });

  return spreadsheet;
}

// Create a Gmail-compatible custom toolbar
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
  `;

  // Add toolbar buttons that work well in Gmail
  const buttons = [
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
            // Get the data from the worksheet
            const data = spreadsheet.worksheets[0].getData();
            if (data && data.length > 0) {
              // Convert data to CSV format
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
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#f1f3f4';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'white';
    });
    
    button.addEventListener('click', btn.action);
    toolbar.appendChild(button);
  });

  // Use a safer approach: move existing content into a wrapper and add toolbar
  const existingContent = Array.from(container.children);
  const contentWrapper = document.createElement('div');
  
  // Move all existing content to the wrapper
  existingContent.forEach(child => {
    contentWrapper.appendChild(child);
  });
  
  // Now add toolbar first, then the wrapper with content
  container.appendChild(toolbar);
  container.appendChild(contentWrapper);
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
  const headers = ['Invoice #', 'Vendor', 'Amount', 'Due Date', 'Status', 'Assigned To', 'Thread ID', 'Actions'];
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
    invoice.threadId,
    `<button class="view-thread-btn" data-thread-id="${invoice.threadId}">View Thread</button>`
  ]);
} 