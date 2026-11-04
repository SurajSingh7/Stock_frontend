/* Inventory menu (Stock · Opening · Transfer), Allotment and Repairs. */

export const INVENTORY_API = {
  inventoryItems: {
    list: "/stock/inventory-items",
    cards: "/stock/inventory-items/cards",
    productSummary: "/stock/inventory-items/product-summary",
    history: (productDefinitionId) => `/stock/inventory-items/history/${productDefinitionId}`,
    // Product Inventory: stock against the alert threshold, per branch; and a product's history.
    productStock: "/stock/inventory-items/product-stock",
    // Stock Summary: everything received, and where it all is now.
    stockSummary: "/stock/inventory-items/stock-summary",
    productStockHistory: (productDefinitionId) => `/stock/inventory-items/product-stock/${productDefinitionId}/history`,
    timeline: (itemId) => `/stock/inventory-items/${itemId}/timeline`,
  },

  stockReports: {
    base: "/stock/stock-reports",
  },

  // Opening — one kind of entry, two modules (see openingKinds.js).
  opening: {
    STORE: "/stock/opening-stock",
    ISSUED: "/stock/opening-issued-stock",
  },

  transferRequests: {
    list: "/stock/transfer-requests",
    board: "/stock/transfer-requests/board",
    branches: "/stock/transfer-requests/branches",
    byId: (id) => `/stock/transfer-requests/${id}`,
    process: (id) => `/stock/transfer-requests/${id}/process`,
    reject: (id) => `/stock/transfer-requests/${id}/reject`,
  },

  repairs: {
    list: "/stock/repairs",
    counts: "/stock/repairs/counts",
    vendors: "/stock/repairs/vendors",
    // report-faulty | send-repair | repair-result | claim | claim-outcome | mark-ok | scrap
    step: (itemId, step) => `/stock/repairs/${itemId}/${step}`,
  },

  itemRequests: {
    list: "/stock/item-requests",
    statusCounts: "/stock/item-requests/status-counts",
    typeCounts: "/stock/item-requests/type-counts",
    byId: (id) => `/stock/item-requests/${id}`,
    units: (id) => `/stock/item-requests/${id}/units`,
    // issue | receive | swap | short-close | reject
    action: (id, action) => `/stock/item-requests/${id}/${action}`,
    closeLine: (id, lineId) => `/stock/item-requests/${id}/lines/${lineId}/close`,
    subscribers: "/stock/item-requests/subscribers",
    subscriber: (subscriberId) => `/stock/item-requests/subscribers/${subscriberId}`,
  },

  employeeItems: {
    base: "/stock/employee-items",
  },

  people: {
    base: "/stock/people",
    search: "/stock/people/search",
    select: "/stock/people/select",
  },
};
