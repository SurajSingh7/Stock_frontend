
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
    category: "Tracking Orders",
    items: [
      {
        name: "track",
        path: "/stock/tracking-orders",
        moduleKey: "tracking-orders",
        action: ["VIEW_MENU"],
      },
      // Read-only register of what was decided against. Its own moduleKey so
      // seeing that history is granted apart from the right to create it.
      {
        name: "Not Required",
        path: "/stock/not-required",
        moduleKey: "not-required",
        action: ["VIEW_MENU"],
      },
    ],
  },
   {
    category: "Invoice list",
    items: [
      {
        name: "Invoice List",
        path: "/stock/invoice-list",
        moduleKey: "invoice-list",
        action: ["VIEW_MENU"],
      },
      // Everything debit notes claimed as faulty — its own module, so it can be
      // given to someone who does not get the Invoice List.
      {
        name: "Faulty Items",
        path: "/stock/faulty-items",
        moduleKey: "faulty-items",
        action: ["VIEW_MENU"],
      },
    ],
  },


  {
    category: "Quotation",
    items: [
      {
        name: "Quotations",
        path: "/stock/quotations/list",
        moduleKey: "quotations",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Vendor",
    items: [
      {
        name: "Vendors List",
        path: "/stock/vendors",
        moduleKey: "vendors",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Approval",
    items: [
      {
        name: "Quotations",
        path: "/stock/quotations/approval",
        moduleKey: "quotations",
        action: ["VIEW_MENU"],
      },
      {
        name: "Approvals",
        path: "/stock/payment-approval",
        moduleKey: "payment-approval",
        action: ["VIEW_MENU"],
      },
    ],
  },
  {
    category: "Account",
    items: [
      {
        name: "Po Approval",
        path: "/stock/purchase-orders",
        moduleKey: "purchase-orders",
        action: ["VIEW_MENU"],
      },
      {
        name: "Invoice Approval",
        path: "/stock/invoice-approval",
        moduleKey: "invoices",
        action: ["VIEW_MENU"],
      },
      {
        name: "Payments",
        path: "/stock/payments",
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
        name: "Vendor Outstanding Overview",
        path: "/stock/reports/account-summary",
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
    category: "Inventory",
    items: [
      {
        name: "Product Inventory",
        path: "/stock/product-inventory",
        moduleKey: "inventory-items",
        action: ["VIEW_MENU"],
      },
      {
        name: "Item Inventory",
        path: "/stock/item-inventory",
        moduleKey: "inventory-items",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Transfer",
    items: [
      {
        name: "Transfer Requests",
        path: "/stock/transfer-requests",
        moduleKey: "transfer-requests",
        action: ["VIEW_MENU"],
      },
      {
        name: "Incoming Requests",
        path: "/stock/incoming-requests",
        moduleKey: "transfer-requests",
        action: ["VIEW_MENU"],
      },
      {
        name: "Transfer History",
        path: "/stock/transfer-history",
        moduleKey: "transfer-requests",
        action: ["VIEW_MENU"],
      },
    ],
  },

  {
    category: "Master",
    items: [
      {
        name: "Product Definition",
        path: "/master/product-definition",
        moduleKey: "product-definitions",
        action: ["VIEW_MENU"],
      },
      {
        name: "Category",
        path: "/master/category",
        moduleKey: "categories",
        action: ["VIEW_MENU"],
      },
      {
        name: "Field Definition",
        path: "/master/field-definition",
        moduleKey: "field-definitions",
        action: ["VIEW_MENU"],
      },
      {
        name: "Terms & Conditions",
        path: "/master/terms-condition",
        moduleKey: "terms-conditions",
        action: ["VIEW_MENU"],
      },
      {
        name: "Notification",
        path: "/master/notification",
        moduleKey: "notifications",
        action: ["VIEW_MENU"],
      },
      {
        name: "Branches",
        path: "/master/branch",
        moduleKey: "branches",
        action: ["VIEW_MENU"],
      },
      {
        name: "GST Rates",
        path: "/master/gst-rate",
        moduleKey: "gst-rates",
        action: ["VIEW_MENU"],
      },
    ],
  },
];

// Admin-only — these endpoints are gated by requireAdmin on the backend, not
// by a per-module permission grant, so they're shown purely off isAdmin
// (see Navbar.jsx) rather than run through useFilteredNav.
export const adminNavCategories = [
  {
    category: "Access Control",
    // Ordered the way an admin actually sets someone up: see what exists,
    // grant it to a role, narrow it per department, then handle the one person
    // who is an exception.
    items: [
      { name: "Modules & Actions", path: "/access-control/modules" },
      { name: "Roles & Permissions", path: "/access-control/roles" },
      { name: "Department Restrictions", path: "/access-control/departments" },
      { name: "User Access", path: "/access-control/users" },
      { name: "Delegate Access", path: "/access-control/delegate" },
      { name: "Audit Log", path: "/access-control/audit-log" },
    ],
  },
];
