/*
  The two opening-entry screens. Same editor and list, different rules:
    STORE   what is in the store — Working / Faulty / Beyond Repair, Excel upload
    ISSUED  what is already with one person — posting makes it ASSIGNED to them
*/
export const OPENING_KINDS = {
  STORE: {
    kind: "STORE",
    moduleKey: "opening-stock",
    path: "/stock/inventory/opening/in-store",
    title: "Opening Stock",
    newTitle: "New Opening Stock Entry",
    searchPlaceholder: "Search OS number…",
    empty: "No opening stock entries yet",
  },
  ISSUED: {
    kind: "ISSUED",
    moduleKey: "opening-issued-stock",
    path: "/stock/inventory/opening/with-people",
    title: "Opening Issued Stock",
    newTitle: "New Opening Issued Stock Entry",
    searchPlaceholder: "OI number, name, code or order ID…",
    empty: "No opening issued stock entries yet",
  },
};

export const kindConfig = (kind) => OPENING_KINDS[kind] || OPENING_KINDS.STORE;
