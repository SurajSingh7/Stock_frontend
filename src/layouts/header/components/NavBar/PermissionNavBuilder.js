import { useMemo } from "react";

/** Normalize URLs (remove trailing slash) */
const normalizeUrl = (url) => (url || "").replace(/\/+$/, "");

/** Find matching backend module for a frontend nav item */
function findMatchingModule(item, permissionsData) {
  const itemModule = (item.moduleName || "").trim().toLowerCase();
  const itemUrl = normalizeUrl(item.url);

  return permissionsData.find((m) => {
    const backendModule = (m.moduleName || "").trim().toLowerCase();
    const backendUrl = normalizeUrl(m.url);

    const moduleMatch = itemModule && backendModule === itemModule;
    const urlMatch = itemUrl && backendUrl === itemUrl;

    return moduleMatch || urlMatch;
  });
}

/** Check if frontend required actions exist in backend actions */
function hasRequiredActions(frontActions = [], backendActions = []) {
  const backendCodes = backendActions.map((a) => a.code?.toUpperCase());
  return frontActions.some((req) => backendCodes.includes(req.toUpperCase()));
}

/** NEW — Check exceptions (all exceptions listed in nav must be true in backend) */
function hasRequiredExceptions(frontExceptions = [], backendExceptionObj = {}) {
  if (!frontExceptions || frontExceptions.length === 0) return true; // no exception required

  return frontExceptions.every((exKey) => backendExceptionObj[exKey] === true);
}

/** Filter each nav item using backend permissions */
function filterNavCategories(navCategories, permissionsData) {
  return navCategories
    .map((category) => {
      const filteredItems = category.items.filter((item) => {
        const match = findMatchingModule(item, permissionsData);
        if (!match) return false;

        const backendActions = match.actions || [];
        const backendExceptions = match.abac?.exceptions || {};

        const actionOk = hasRequiredActions(item.action, backendActions);
        const exceptionOk = hasRequiredExceptions(item.exceptions, backendExceptions);

        // MUST satisfy BOTH checks
        return actionOk && exceptionOk;
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
