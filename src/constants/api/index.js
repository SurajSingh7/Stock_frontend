import { CORE_API } from "./core";
import { PURCHASE_API } from "./purchase";
import { INVENTORY_API } from "./inventory";
import { MASTER_API } from "./master";
import { ADMIN_API } from "./admin";

/*
  Every backend path the app calls, grouped the way the top menu is. Paths are
  relative to the stock backend (apiClient adds the host); an id goes in
  through a function, never by string concatenation at the call site.
*/
export const API_ENDPOINTS = {
  core: CORE_API,
  purchase: PURCHASE_API,
  inventory: INVENTORY_API,
  master: MASTER_API,
  admin: ADMIN_API,
};
