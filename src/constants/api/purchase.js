/* Purchase menu (Tracking · Invoices · Quotation), Vendor, Approval, Accounts and Reports. */

export const PURCHASE_API = {
  vendors: {
    list: "/stock/vendors",
    byId: (id) => `/stock/vendors/${id}`,
    // The main vendor with its child firms.
    group: (id) => `/stock/vendors/${id}/group`,
    restore: (id) => `/stock/vendors/${id}/restore`,
  },

  quotations: {
    list: "/stock/quotations",
    byId: (id) => `/stock/quotations/${id}`,
    review: (id) => `/stock/quotations/${id}/review`,
    statusSummary: "/stock/quotations/status-summary",
    pendingOrders: "/stock/quotations/pending-orders",
    vendorsForCategory: (categoryId) => `/stock/quotations/vendors-for-category/${categoryId}`,
  },

  purchaseOrders: {
    list: "/stock/purchase-orders",
    board: "/stock/purchase-orders/board",
    byId: (id) => `/stock/purchase-orders/${id}`,
    pdf: (id) => `/stock/purchase-orders/${id}/pdf`,
    sendMail: (id) => `/stock/purchase-orders/${id}/send-mail`,
    // approve | reject | send … (one PATCH per step)
    action: (id, action) => `/stock/purchase-orders/${id}/${action}`,
  },

  trackingOrders: {
    board: "/stock/tracking-orders/board",
    byId: (id) => `/stock/tracking-orders/${id}`,
    entity: (id) => `/stock/tracking-orders/${id}/entity`,
    reset: (id) => `/stock/tracking-orders/${id}/reset`,
    required: (id) => `/stock/tracking-orders/${id}/required`,
    invoices: (id) => `/stock/tracking-orders/${id}/invoices`,
    readInvoice: (id) => `/stock/tracking-orders/${id}/invoices/read`,
    // short-close | reopen | not-required …
    action: (id, action) => `/stock/tracking-orders/${id}/${action}`,
  },

  invoices: {
    board: "/stock/invoices/board",
    byId: (id) => `/stock/invoices/${id}`,
    items: (id) => `/stock/invoices/${id}/items`,
    serialTemplate: (id, productId) => `/stock/invoices/${id}/serial-template/${productId}`,
    serialUpload: (id, productId) => `/stock/invoices/${id}/serial-upload/${productId}`,
    // approve | reject
    decide: (id, action) => `/stock/invoices/${id}/${action}`,
  },

  invoiceList: {
    list: "/stock/invoice-list",
    schedule: (id) => `/stock/invoice-list/${id}/schedule`,
    debitNoteItems: (id) => `/stock/invoice-list/${id}/debit-note-items`,
    resubmitDebitNote: (debitNoteId) => `/stock/invoice-list/debit-notes/${debitNoteId}/resubmit`,
    withdrawDebitNote: (debitNoteId) => `/stock/invoice-list/debit-notes/${debitNoteId}/withdraw`,
  },

  /*
    The same invoice is read through three screens — invoice-list, payments,
    payment-approval — each its own module, so the shared popups take the
    base the screen is allowed to use.
  */
  invoiceScoped: {
    adjustments: (base, id) => `/stock/${base}/${id}/adjustments`,
    debitNotes: (base, id) => `/stock/${base}/${id}/debit-notes`,
  },

  debitNoteQueues: {
    payments: {
      list: "/stock/payments-debit-notes",
      review: (id) => `/stock/payments/debit-notes/${id}/review`,
    },
    paymentApproval: {
      list: "/stock/payment-approval-debit-notes",
      decide: (id) => `/stock/payment-approval/debit-notes/${id}/decide`,
    },
  },

  debitNoteItems: {
    list: "/stock/debit-note-items",
    byVendor: "/stock/debit-note-items/by-vendor",
    units: (debitNoteId, lineIndex) => `/stock/debit-note-items/${debitNoteId}/lines/${lineIndex}/units`,
  },

  notRequired: {
    list: "/stock/not-required",
  },

  payments: {
    list: "/stock/payments",
    adjustment: (adjustmentId) => `/stock/payments/adjustments/${adjustmentId}`,
    sendForApproval: (id) => `/stock/payments/${id}/send-for-approval`,
    tds: (id) => `/stock/payments/${id}/tds`,
    misc: (id) => `/stock/payments/${id}/misc`,
    record: (id) => `/stock/payments/${id}/record`,
  },

  paymentApproval: {
    list: "/stock/payment-approval",
    decide: (id) => `/stock/payment-approval/${id}/decide`,
  },

  reports: {
    billing: "/stock/reports/billing",
    accountSummary: "/stock/reports/account-summary",
    paid: "/stock/reports/paid",
    transactions: "/stock/reports/transactions",
    invoiceBreakup: "/stock/reports/invoice-breakup",
    // base: billing | account-summary
    vendorInvoices: (base, vendorId) => `/stock/reports/${base}/${vendorId}/invoices`,
    vendorPayments: (vendorId) => `/stock/reports/paid/${vendorId}/payments`,
  },

  vendorLedger: {
    byVendor: (vendorId) => `/stock/vendor-ledger/${vendorId}`,
    month: (vendorId) => `/stock/vendor-ledger/${vendorId}/month`,
    invoices: (vendorId) => `/stock/vendor-ledger/${vendorId}/invoices`,
  },
};
