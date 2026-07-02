
// FOR FRONTEND MAPPING PART: "DSR", path: "/dsr?form=create",
// FOR BACKEND MAPPING PART:
// moduleName: "dsr", url: "/dsr", action: ["CREATE", "UPDATE", "READ"], exceptions: ["canViewAll"]


import { SHOW_DEV } from "@/config/getEnvVariables";


export const navCategories = [
  {
    category: "Master",
    items: [
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
      {
        name: "Product Definition",
        path: "/master/product-definition",
        moduleName: "Stock Product Definition",
        url: "/stock/master/product-definition",
        action: ["READ"],
      },
    ],
  },
];