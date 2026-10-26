/*
  The two opening-entry screens. Same editor and list, different rules:
    STORE   what is in the store — Working / Faulty / Beyond Repair, Excel upload
    ISSUED  what is already with one person — posting makes it ASSIGNED to them
*/
export const OPENING_KINDS = {
  STORE: {
    kind: "STORE",
    moduleKey: "opening-stock",
    path: "/stock/opening-stock",
    title: "Opening Stock",
    newTitle: "New Opening Stock Entry",
    subtitle: "Stock that is in the store and was already on hand before this system — entered once, with whatever is known about it.",
    searchPlaceholder: "Search OS number…",
    empty: "No opening stock entries yet",
  },
  ISSUED: {
    kind: "ISSUED",
    moduleKey: "opening-issued-stock",
    path: "/stock/opening-issued",
    title: "Opening Issued Stock",
    newTitle: "New Opening Issued Stock Entry",
    subtitle: "Stock that was already with an employee or a subscriber before this system — one person per entry. Posting assigns it to them.",
    searchPlaceholder: "OI number, name, code or order ID…",
    empty: "No opening issued stock entries yet",
  },
};

export const kindConfig = (kind) => OPENING_KINDS[kind] || OPENING_KINDS.STORE;
