
// FOR FRONTEND MAPPING PART: "DSR", path: "/dsr?form=create",
// FOR BACKEND MAPPING PART:
// moduleKey must equal the backend Module's `key` exactly — see
// stock-backend/seeders/stock.module.seeder.js for the canonical list.

import { SHOW_DEV } from "@/config/getEnvVariables";

export const navCategories = [
   {
    category: "Tracking Orders",
    items: [
      {
        name: "track",
        path: "/stock/tracking-orders",
        moduleKey: "tracking-orders",
        action: ["READ"],
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
        action: ["READ"],
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
        action: ["READ"],
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
        action: ["READ"],
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
        action: ["READ"],
      },
      {
        name: "Invoice Approval",
        path: "/stock/invoice-approval",
        moduleKey: "invoices",
        action: ["READ"],
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
        action: ["READ"],
      },
      {
        name: "Item Inventory",
        path: "/stock/item-inventory",
        moduleKey: "inventory-items",
        action: ["READ"],
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
        action: ["READ"],
      },
      {
        name: "Incoming Requests",
        path: "/stock/incoming-requests",
        moduleKey: "transfer-requests",
        action: ["READ"],
      },
      {
        name: "Transfer History",
        path: "/stock/transfer-history",
        moduleKey: "transfer-requests",
        action: ["READ"],
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
        action: ["READ"],
      },
      {
        name: "Category",
        path: "/master/category",
        moduleKey: "categories",
        action: ["READ"],
      },
      {
        name: "Field Definition",
        path: "/master/field-definition",
        moduleKey: "field-definitions",
        action: ["READ"],
      },
      {
        name: "Terms & Conditions",
        path: "/master/terms-condition",
        moduleKey: "terms-conditions",
        action: ["READ"],
      },
      {
        name: "Notification",
        path: "/master/notification",
        moduleKey: "notifications",
        action: ["READ"],
      },
      {
        name: "Branches",
        path: "/master/branch",
        moduleKey: "branches",
        action: ["READ"],
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
