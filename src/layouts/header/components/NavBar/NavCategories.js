
// FOR FRONTEND MAPPING PART: "DSR", path: "/dsr?form=create",
// FOR BACKEND MAPPING PART:
// moduleName: "dsr", url: "/dsr", action: ["CREATE", "UPDATE", "READ"], exceptions: ["canViewAll"]

import { SHOW_DEV } from "@/config/getEnvVariables";

export const navCategories = [

  {
    category: "Quotation",
    items: [
      {
        name: "Quotations",
        path: "/stock/quotations/list",
        moduleName: "Stock Category",
        url: "/stock/quotations/list",
        action: ["READ"],
      },
    ],
  },
    {
    category: "Purchase Orders",
    items: [
      {
        name: "Purchase Order(po)",
        path: "/stock/purchase-orders",
        moduleName: "Stock Field Definition",
        url: "/stock/master/field-definition",
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
        moduleName: "vendor",
        url: "/stock/vendors",
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
        moduleName: "Stock Category",
        url: "/stock/quotations/approval",
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
        moduleName: "Stock Product Definition",
        url: "/stock/master/product-definition",
        action: ["READ"],
      },
      {
        name: "Category",
        path: "/master/category",
        moduleName: "Stock Category",
        url: "/stock/master/category",
        action: ["READ"],
      },
      {
        name: "Field Definition",
        path: "/master/field-definition",
        moduleName: "Stock Field Definition",
        url: "/stock/master/field-definition",
        action: ["READ"],
      },
    ],
  },
];