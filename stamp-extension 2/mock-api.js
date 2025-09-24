/**
 * Mock API for Stamp Extension
 * 
 * This file simulates the responses from the backend API. It allows for frontend development
 * and testing without needing a live backend. The data structures defined here serve as the
 * "contract" that the real backend should adhere to.
 */

// Simulates the different invoice stages that would be defined in the backend.
export const INVOICE_STAGES = {
    PENDING_APPROVAL: 'Pending Approval',
    IN_REVIEW: 'In Review',
    APPROVED: 'Approved',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
    REJECTED: 'Rejected'
};

/**
 * Mock response for the `GET /api/invoices/all` endpoint.
 * This function simulates fetching all invoices for the user to populate the Invoice Tracker.
 */
export function getMockAllInvoices() {
  return [
    { 
      threadId: '1985f8728a45ce6b',
      messageId: 'msg-f:178912345',
      invoiceNumber: 'INV-001', 
      vendor: 'Vendor ABC', 
      amount: 1500, 
      dueDate: '2024-08-30', 
      status: INVOICE_STAGES.PENDING_APPROVAL, 
      assignedTo: 'john@company.com' 
    },
    { 
      threadId: '197f8e706fbe9a78',
      messageId: 'msg-f:178865432',
      invoiceNumber: 'INV-002', 
      vendor: 'Vendor XYZ', 
      amount: 2300, 
      dueDate: '2024-07-25', 
      status: INVOICE_STAGES.PAID, 
      assignedTo: 'sarah@company.com' 
    },
    { 
      threadId: '1985d4b9df0f880d',
      messageId: 'msg-f:178798765',
      invoiceNumber: 'INV-008', 
      vendor: 'Tech Solutions Inc', 
      amount: 4500, 
      dueDate: '2024-09-10', 
      status: INVOICE_STAGES.IN_REVIEW, 
      assignedTo: 'tech@company.com' 
    },
    { 
      threadId: '1985a8b7e2f1c9d8',
      messageId: 'msg-f:178612345',
      invoiceNumber: 'INV-005', 
      vendor: 'Vendor JKL', 
      amount: 950, 
      dueDate: '2024-08-10', 
      status: INVOICE_STAGES.APPROVED, 
      assignedTo: 'finance@company.com' 
    },
    { 
      threadId: '19858ad5e4f3g2b1',
      messageId: 'msg-f:178598765',
      invoiceNumber: 'INV-006', 
      vendor: 'Vendor MNO', 
      amount: 1800, 
      dueDate: '2024-06-05', 
      status: INVOICE_STAGES.OVERDUE, 
      assignedTo: 'legal@company.com' 
    },
    { 
        threadId: '19856cf3g6h5i4d3',
        messageId: 'msg-f:178412378',
        invoiceNumber: 'INV-007', 
        vendor: 'Vendor PQR', 
        amount: 1200, 
        dueDate: '2024-07-15', 
        status: INVOICE_STAGES.REJECTED, 
        assignedTo: 'hr@company.com' 
    }
  ];
} 