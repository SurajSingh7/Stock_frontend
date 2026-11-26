/* Inventory menu (Stock · Opening · Transfer), Allotment and Repairs. */

export const INVENTORY_API = {
  inventoryItems: {
    // Available Item: the units in the store, a batch product's receipts, a unit's history.
    cards: "/stock/inventory-items/cards",
    history: (productDefinitionId) => `/stock/inventory-items/history/${productDefinitionId}`,
    // Available Product: stock against the alert threshold, per branch; and a product's history.
    productStock: "/stock/inventory-items/product-stock",
    // Product Summary: everything received, and where it all is now.
    stockSummary: "/stock/inventory-items/stock-summary",
    productStockHistory: (productDefinitionId) => `/stock/inventory-items/product-stock/${productDefinitionId}/history`,
    timeline: (itemId) => `/stock/inventory-items/${itemId}/timeline`,
    // Item Summary: every unit wherever it is, and a unit's history under its own module.
    itemSummary: "/stock/inventory-items/item-summary",
    itemSummaryTimeline: (itemId) => `/stock/inventory-items/item-summary/${itemId}/timeline`,
  },

  // Lost Items: report units lost / found; the approval side reads and decides.
  lostEntries: {
    list: "/stock/lost-entries",
    create: "/stock/lost-entries",
    byId: (id) => `/stock/lost-entries/${id}`,
    unitOptions: "/stock/lost-entries/unit-options",
    batchSources: "/stock/lost-entries/batch-sources",
    approvalList: "/stock/lost-entries/approval",
    approvalById: (id) => `/stock/lost-entries/approval/${id}`,
    approve: (id) => `/stock/lost-entries/approval/${id}/approve`,
    reject: (id) => `/stock/lost-entries/approval/${id}/reject`,
  },
  // Dead Items: the same flow, its own routes and modules.
  deadEntries: {
    list: "/stock/dead-entries",
    create: "/stock/dead-entries",
    byId: (id) => `/stock/dead-entries/${id}`,
    unitOptions: "/stock/dead-entries/unit-options",
    batchSources: "/stock/dead-entries/batch-sources",
    approvalList: "/stock/dead-entries/approval",
    approvalById: (id) => `/stock/dead-entries/approval/${id}`,
    approve: (id) => `/stock/dead-entries/approval/${id}/approve`,
    reject: (id) => `/stock/dead-entries/approval/${id}/reject`,
  },

  // Opening — one kind of entry, two modules (see openingKinds.js).
  opening: {
    STORE: "/stock/opening-stock",
    ISSUED: "/stock/opening-issued-stock",
  },

  // Stock Transfer — every transfer starts as a request (SR-…).
  // Every transfer screen's branch pickers, scoped to ?module=.
  transferBranches: "/stock/stock-transfer-branches",
  stockRequests: {
    create: "/stock/stock-requests",
    // Leaf categories that can be asked for (same list as Item Requests).
    categories: "/stock/stock-requests/categories",
    // side: "mine" | "to-us" | "history" — one module each.
    list: (side) => `/stock/stock-requests/${side}`,
    byId: (side, id) => `/stock/stock-requests/${side}/${id}`,
    // The Send page: products with free stock, and one product's free units.
    sendOptions: (id) => `/stock/stock-requests/to-us/${id}/send-options`,
    sendUnits: (id) => `/stock/stock-requests/to-us/${id}/send-units`,
    send: (id) => `/stock/stock-requests/${id}/send`,
    decline: (id) => `/stock/stock-requests/${id}/decline`,
    receive: (id) => `/stock/stock-requests/${id}/receive`,
    reportProblem: (id) => `/stock/stock-requests/${id}/report-problem`,
    correct: (id) => `/stock/stock-requests/${id}/correct`,
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
