
// FOR FRONTEND MAPPING PART: "DSR", path: "/dsr?form=create",
// FOR BACKEND MAPPING PART:
// moduleKey must equal the backend Module's `key` exactly — see
// stock-backend/seeders/stock.module.seeder.js for the canonical list.

import { SHOW_DEV } from "@/config/getEnvVariables";

/* Every item asks for VIEW_MENU, never READ.
 *
 * VIEW_MENU is what decides whether a module appears here, and it is granted
 * separately from the actions that let a user DO anything. That separation is
 * the point: someone can hold categories:READ — so category filters and
 * dropdowns work for them on every other screen — while the Category
 * management page stays out of their menu. Swapping READ for CREATE/UPDATE
 * would not achieve this; it would just move the problem to a different
 * permission.
 *
 * The nav builder additionally requires at least one non-menu action, so a
 * VIEW_MENU granted on its own can never produce a menu entry that 403s.
 */
export const navCategories = [
  {
    category: "Tracking",
    // group: one "Purchase" mega menu — Tracking, Invoices, Quotation columns.
    group: "Purchase",
    icon: "tracking",
    items: [
      {
        name: "Track Orders",
        path: "/stock/purchase/tracking-orders",
        moduleKey: "tracking-orders",
        action: ["VIEW_MENU"],
      },
      // Read-only register of what was decided against. Its own moduleKey so
      // seeing that history is granted apart from the right to create it.
      {
        name: "Skipped Orders",
        path: "/stock/purchase/not-required",
        moduleKey: "not-required",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Invoices",
    group: "Purchase",
    icon: "invoices",
    items: [
      {
        name: "Invoice List",
        path: "/stock/purchase/invoices",
        moduleKey: "invoice-list",
        action: ["VIEW_MENU"],
      },
      // Everything debit notes claimed as faulty — its own module, so it can be
      // given to someone who does not get the Invoice List.
      {
        name: "Faulty Items",
        path: "/stock/purchase/faulty-items",
        moduleKey: "faulty-items",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Quotation",
    group: "Purchase",
    icon: "quotation",
    items: [
      {
        name: "Quotations",
        path: "/stock/purchase/quotations",
        moduleKey: "quotations",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Approval",
    items: [
      {
        name: "Quotations",
        path: "/stock/approval/quotations",
        moduleKey: "quotations",
        action: ["VIEW_MENU"],
      },
      {
        name: "Payments & Debit Notes",
        path: "/stock/approval/payments",
        moduleKey: "payment-approval",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Approval",
    // group: one "Accounts" mega menu, Approval + Payables as its columns.
    group: "Accounts",
    icon: "approval",
    items: [
      {
        name: "PO Approval",
        path: "/stock/accounts/po-approval",
        moduleKey: "purchase-orders",
        action: ["VIEW_MENU"],
      },
      {
        name: "Invoice Approval",
        path: "/stock/accounts/invoice-approval",
        moduleKey: "invoices",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Payables",
    group: "Accounts",
    icon: "payables",
    items: [
      {
        name: "Payment Processing",
        path: "/stock/accounts/payments",
        moduleKey: "payments",
        action: ["VIEW_MENU"],
      },
    ],
  },

  /*
    Reports — read-only views of the vendor money side.

    Vendor Ledger moved in here from the Invoice list group. It belongs with
    these rather than beside the action pages: Billing and Outstanding are
    literally its own summary read with different columns, so having it in a
    separate menu group made one number look like it lived in two places.

    Each page carries its own moduleKey so access can be granted per report —
    "show them Outstanding but not the unit prices in Invoice Breakup" is a
    real request. One shared key would make all five appear or vanish
    together.
  */
  {
    category: "Reports",
    items: [
      {
        name: "Billing",
        path: "/stock/reports/billing",
        moduleKey: "billing-report",
        action: ["VIEW_MENU"],
      },
      /*
        Billing to balance due in one row — the page to open when someone asks
        "where do we stand with this vendor". It replaced the Outstanding and
        Vendor Ledger entries; a vendor's month-wise ledger opens from its ⋮.
      */
      {
        name: "Outstanding Overview",
        path: "/stock/reports/vendor-outstanding",
        moduleKey: "account-summary",
        action: ["VIEW_MENU"],
      },
      /*
        The third of the vendor-money set: Billing asks what was billed,
        the overview what is still owed, Paid what actually left. Reading as one
        set in the menu is the point — those are the three questions.

        Not "Payments": that name belongs to the Account group, where accounts
        RECORD a payment. This one only reports what they recorded.
      */
      {
        name: "Paid",
        path: "/stock/reports/paid",
        moduleKey: "paid-report",
        action: ["VIEW_MENU"],
      },
      /*
        Payments, debit notes and misc charges on one page with tabs. They are
        the same kind of row — a dated event with an amount that changed what
        we owe — and split across three menu entries nobody could ever see the
        order things happened in.

        Not "Payment Report": Payments elsewhere is where accounts RECORD a
        payment, and two menu entries a word apart read as the same screen.
      */
      {
        name: "Transaction Register",
        path: "/stock/reports/transactions",
        moduleKey: "transaction-register",
        action: ["VIEW_MENU"],
      },
      // Named after the invoice, not "Billing Breakup": the three above are
      // per-vendor aggregates, this one is per invoice and per line.
      {
        name: "Invoice Breakup",
        path: "/stock/reports/invoice-breakup",
        moduleKey: "invoice-breakup",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Stock",
    // group: shown as one column of the "Inventory" mega menu (with
    // Opening and Transfer). Section names may change later — only here.
    group: "Inventory",
    icon: "stock",
    items: [
      // Each product's stock in the store, against its alert threshold.
      {
        name: "Available Product",
        path: "/stock/inventory/products",
        moduleKey: "available-products",
        action: ["VIEW_MENU"],
      },
      // Each unit in the store right now.
      {
        name: "Available Item",
        path: "/stock/inventory/items",
        moduleKey: "available-items",
        action: ["VIEW_MENU"],
      },
      // Everything received, and where it all is now. ("Item Summary" joins
      // here once it is built.)
      {
        name: "Product Summary",
        path: "/stock/inventory/summary",
        moduleKey: "product-summary",
        action: ["VIEW_MENU"],
      },
      // Inventory reports (the Reports menu is billing).
      {
        name: "Stock Reports",
        path: "/stock/inventory/reports",
        moduleKey: "stock-reports",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // One-time entry of what existed before this system — its own column so the
  // day-to-day Stock list stays short.
  {
    category: "Opening",
    group: "Inventory",
    icon: "opening",
    items: [
      // Stock that was already on hand before this system.
      {
        name: "In Store",
        path: "/stock/inventory/opening/in-store",
        moduleKey: "opening-stock",
        action: ["VIEW_MENU"],
      },
      // …and stock that was already with someone (employee / subscriber).
      {
        name: "With People",
        path: "/stock/inventory/opening/with-people",
        moduleKey: "opening-issued-stock",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // 🧪 TEST ONLY — remove when the real website is connected.
  // section "settings": shown under the ⚙ menu, not in the main bar.
  {
    category: "Testing",
    section: "settings",
    icon: "test",
    items: [
      {
        name: "Request Simulator (Test)",
        path: "/stock/admin/test/request-simulator",
        moduleKey: "test-simulator",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // Stock Transfer — every transfer starts as a request: what we asked for,
  // what others asked us for (both open, every step done from the row), and
  // everything finished.
  {
    category: "Stock Transfer",
    group: "Inventory",
    icon: "transfer",
    items: [
      {
        name: "My Requests",
        path: "/stock/inventory/transfers/my-requests",
        moduleKey: "my-stock-requests",
        action: ["VIEW_MENU"],
      },
      {
        name: "Requests to Us",
        path: "/stock/inventory/transfers/requests-to-us",
        moduleKey: "stock-requests-to-us",
        action: ["VIEW_MENU"],
      },
      {
        name: "Transfer History",
        path: "/stock/inventory/transfers/history",
        moduleKey: "stock-transfer-history",
        action: ["VIEW_MENU"],
      },
    ],
  },


  // Allotment — who our stock went to, or who asked for it: subscribers and
  // our own employees, one column each.
  // Subscribers' requests for stock, from the NOC / broadband website.
  {
    category: "Subscribers",
    group: "Allotment",
    icon: "subscribers",
    items: [
      {
        name: "Item Requests",
        path: "/stock/allotment/requests",
        moduleKey: "item-requests",
        action: ["VIEW_MENU"],
      },
      {
        name: "Subscriber Items",
        path: "/stock/allotment/subscribers",
        moduleKey: "item-requests",
        action: ["VIEW_MENU"],
      },
    ],
  },
  // Stock with our own people.
  {
    category: "Employees",
    group: "Allotment",
    icon: "employees",
    items: [
      {
        name: "Employee Items",
        path: "/stock/allotment/employees",
        moduleKey: "employee-items",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // Our broken units — repair, warranty claim, scrap. One page, so the bar
  // shows it as a plain link.
  {
    category: "Repairs",
    items: [
      {
        name: "Repair & Warranty",
        path: "/stock/repairs",
        moduleKey: "repairs",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // Next to Masters: vendors are set-up data too, not day-to-day work.
  {
    category: "Vendor",
    items: [
      {
        name: "Vendors List",
        path: "/stock/vendors",
        moduleKey: "vendors",
        action: ["VIEW_MENU"],
      },
      {
        name: "Terms & Conditions",
        path: "/stock/vendors/terms",
        moduleKey: "terms-conditions",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Masters",
    items: [
      {
        name: "Product Definition",
        path: "/stock/masters/products",
        moduleKey: "product-definitions",
        action: ["VIEW_MENU"],
      },
      {
        name: "Category",
        path: "/stock/masters/categories",
        moduleKey: "categories",
        action: ["VIEW_MENU"],
      },
      {
        name: "Branches",
        path: "/stock/masters/branches",
        moduleKey: "branches",
        action: ["VIEW_MENU"],
      },
      {
        name: "GST Rates",
        path: "/stock/masters/gst-rates",
        moduleKey: "gst-rates",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // System-level setup, rarely touched: under Administration, not the bar.
  {
    category: "Configuration",
    section: "settings",
    icon: "config",
    items: [
      {
        name: "Field Definition",
        path: "/stock/admin/field-definitions",
        moduleKey: "field-definitions",
        action: ["VIEW_MENU"],
      },
      // Which Claude model reads uploaded invoices.
      {
        name: "AI Settings",
        path: "/stock/admin/ai-settings",
        moduleKey: "ai-settings",
        action: ["VIEW_MENU"],
      },
    ],
  },

  // One module per tab, so each page is granted on its own; the pages also
  // carry a tab bar showing just the tabs the user may open.
  {
    category: "Alerts & Escalations",
    section: "settings",
    icon: "alerts",
    items: [
      { name: "Rules", path: "/stock/admin/alerts/rules", moduleKey: "alert-rules", action: ["VIEW_MENU"] },
      { name: "Templates", path: "/stock/admin/alerts/templates", moduleKey: "alert-templates", action: ["VIEW_MENU"] },
      { name: "Contacts & Groups", path: "/stock/admin/alerts/contacts", moduleKey: "alert-contacts", action: ["VIEW_MENU"] },
      { name: "Escalations", path: "/stock/admin/alerts/escalations", moduleKey: "alert-escalations", action: ["VIEW_MENU"] },
      { name: "Message Log", path: "/stock/admin/alerts/log", moduleKey: "alert-log", action: ["VIEW_MENU"] },
      { name: "Channels", path: "/stock/admin/alerts/channels", moduleKey: "alert-channels", action: ["VIEW_MENU"] },
    ],
  },
];

// Admin-only — these endpoints are gated by requireAdmin on the backend, not
// by a per-module permission grant, so they're shown purely off isAdmin
// (see Navbar.jsx) rather than run through useFilteredNav.
export const adminNavCategories = [
  {
    category: "Access Control",
    section: "settings",
    icon: "access",
    // Ordered the way an admin actually sets someone up: see what exists,
    // grant it to a role, narrow it per department, then handle the one person
    // who is an exception.
    items: [
      { name: "Modules & Actions", path: "/stock/admin/access-control/modules" },
      { name: "Roles & Permissions", path: "/stock/admin/access-control/roles" },
      { name: "Department Restrictions", path: "/stock/admin/access-control/departments" },
      { name: "User Access", path: "/stock/admin/access-control/users" },
      { name: "Delegate Access", path: "/stock/admin/access-control/delegate" },
      { name: "Audit Log", path: "/stock/admin/access-control/audit-log" },
    ],
  },
];
