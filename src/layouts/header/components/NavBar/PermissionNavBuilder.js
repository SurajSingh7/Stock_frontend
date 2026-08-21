import { useMemo } from "react";

/** Find the backend module entry for a frontend nav item — matched by
 * moduleKey, which must equal the backend Module's `key` exactly (see
 * stock-backend's seeders/stock.module.seeder.js for the canonical list). */
function findMatchingModule(item, permissionsData) {
  return permissionsData.find((m) => m.moduleKey === item.moduleKey);
}

/** Nav item is visible if the user's effective actions for that module
 * include at least one of the actions the item declares as required. */
function hasRequiredActions(frontActions = [], backendActions = []) {
  const backendCodes = backendActions.map((a) => String(a).toUpperCase());
  return frontActions.some((req) => backendCodes.includes(String(req).toUpperCase()));
}

/** Filter each nav item using backend permissions */
function filterNavCategories(navCategories, permissionsData) {
  return navCategories
    .map((category) => {
      const filteredItems = category.items.filter((item) => {
        const match = findMatchingModule(item, permissionsData);
        if (!match) return false;
        return hasRequiredActions(item.action, match.allowedActions || []);
      });

      return filteredItems.length ? { ...category, items: filteredItems } : null;
    })
    .filter(Boolean);
}

export function useFilteredNav(navCategories, permissionsData) {
  return useMemo(() => {
    if (!permissionsData || permissionsData.length === 0) return [];

    return filterNavCategories(navCategories, permissionsData);
  }, [navCategories, permissionsData]);
}
