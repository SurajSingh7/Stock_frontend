
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
