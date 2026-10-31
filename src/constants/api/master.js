/* Masters menu, plus Administration → Configuration (Field Definition, AI Settings). */

export const MASTER_API = {
  categories: {
    list: "/stock/categories",
    flat: "/stock/categories/flat",
    byId: (id) => `/stock/categories/${id}`,
    // toggle-type | restore | move
    action: (id, action) => `/stock/categories/${id}/${action}`,
  },

  fieldDefinitions: {
    list: "/stock/field-definitions",
    byId: (id) => `/stock/field-definitions/${id}`,
    restore: (id) => `/stock/field-definitions/${id}/restore`,
  },

  productDefinitions: {
    list: "/stock/product-definitions",
    byId: (id) => `/stock/product-definitions/${id}`,
    restore: (id) => `/stock/product-definitions/${id}/restore`,
    byCategory: (categoryId) => `/stock/product-definitions/by-category/${categoryId}`,
  },

  branches: {
    active: "/stock/branches/active",
    list: "/stock/branches",
    byId: (id) => `/stock/branches/${id}`,
    restore: (id) => `/stock/branches/${id}/restore`,
    // Branches the caller may see on one module's screen.
    scoped: "/stock/scoped-branches",
  },

  gstRates: {
    list: "/stock/gst-rates",
    // Authenticate-only — fills GST dropdowns without the GST Rates permission.
    active: "/stock/gst-rates/active",
    byId: (id) => `/stock/gst-rates/${id}`,
    restore: (id) => `/stock/gst-rates/${id}/restore`,
  },

  termsConditions: {
    list: "/stock/terms-conditions",
    byId: (id) => `/stock/terms-conditions/${id}`,
    restore: (id) => `/stock/terms-conditions/${id}/restore`,
    resolve: (vendorId) => `/stock/terms-conditions/resolve/${vendorId}`,
  },

  aiSettings: {
    base: "/stock/ai-settings",
  },
};
