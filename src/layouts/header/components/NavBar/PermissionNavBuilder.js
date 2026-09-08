import { useMemo } from "react";

/** Find the backend module entry for a frontend nav item — matched by
 * moduleKey, which must equal the backend Module's `key` exactly (see
 * stock-backend's seeders/stock.module.seeder.js for the canonical list). */
function findMatchingModule(item, permissionsData) {
  return permissionsData.find((m) => m.moduleKey === item.moduleKey);
}

const VIEW_MENU = "VIEW_MENU";

/** Nav item is visible if the user's effective actions for that module
 * include at least one of the actions the item declares as required.
 *
 * VIEW_MENU carries one extra condition: it decides whether a module is
 * ADVERTISED, not whether it can be used, so on its own it would produce a
 * menu entry whose page immediately 403s. It therefore also requires at least
 * one real action on that module — anything the user can actually do there. */
function hasRequiredActions(frontActions = [], backendActions = []) {
  const backendCodes = backendActions.map((a) => String(a).toUpperCase());
  const wanted = frontActions.map((a) => String(a).toUpperCase());

  if (!wanted.some((req) => backendCodes.includes(req))) return false;

  if (wanted.includes(VIEW_MENU)) {
    return backendCodes.some((a) => a !== VIEW_MENU);
  }
  return true;
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

/** Which module a URL belongs to, from the nav config itself — so a route and
 * its menu entry can never disagree about which permission governs them.
 *
 * Matching is longest-prefix and segment-aware: /stock/vendors/create and
 * /stock/vendors/<id>/edit both resolve to "vendors", while a hypothetical
 * /stock/vendors-archive would not.
 *
 * Returns null for anything the nav does not describe. Callers treat that as
 * "allow" — the API guards the data either way, and failing closed here would
 * make every new page unreachable until someone remembered to map it. */
export function resolveModuleForPath(navCategories, pathname) {
  if (!pathname) return null;
  let best = null;
  for (const category of navCategories) {
    for (const item of category.items || []) {
      if (!item.path || !item.moduleKey) continue;
      const p = item.path.split("?")[0];
      const matches = pathname === p || pathname.startsWith(p + "/");
      if (matches && (!best || p.length > best.path.length)) {
        best = { path: p, moduleKey: item.moduleKey, action: item.action || [] };
      }
    }
  }
  return best;
}

/** First page this user can actually open, in nav order — what login lands on. */
export function firstAccessiblePath(navCategories, permissionsData) {
  const visible = filterNavCategories(navCategories, permissionsData || []);
  return visible[0]?.items?.[0]?.path || null;
}

export function useFilteredNav(navCategories, permissionsData) {
  return useMemo(() => {
    if (!permissionsData || permissionsData.length === 0) return [];

    return filterNavCategories(navCategories, permissionsData);
  }, [navCategories, permissionsData]);
}
