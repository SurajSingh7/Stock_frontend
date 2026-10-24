import { usePermissions } from "@/context/PermissionContext";
import { useFilteredNav } from "./PermissionNavBuilder";
import { navCategories, adminNavCategories } from "./NavCategories";

/*
  The navigation the signed-in user may see, split in two:
    main      — the categories in the top bar
    settings  — categories marked `section: "settings"` (Alerts & Escalations,
                Access Control, Testing), shown under the ⚙ menu instead

  Categories sharing a `group` (Inventory + Requests + Transfer) become ONE
  bar entry named after the group, placed where its first member was, with
  each member as a column (`sections`). `items` stays the flat list, so the
  "is this menu active" check works unchanged.

  One place for the permission rules, so the bar and the ⚙ menu can never
  disagree. Admins bypass module filtering (as the backend does) and also get
  the admin-only categories. `hidden` = no branch assigned: no navigation at
  all, see Navbar.
*/
const mergeGroups = (categories) => {
  const out = [];
  const byGroup = new Map();
  for (const c of categories) {
    if (!c.group) {
      out.push(c);
      continue;
    }
    let entry = byGroup.get(c.group);
    if (!entry) {
      entry = { category: c.group, sections: [], items: [] };
      byGroup.set(c.group, entry);
      out.push(entry);
    }
    entry.sections.push(c);
    entry.items.push(...c.items);
  }
  return out;
};

export const useNavCategories = () => {
  const { permissions, isAdmin, loading, error, branchId } = usePermissions();
  const filtered = useFilteredNav(navCategories, permissions);
  const all = isAdmin ? [...navCategories, ...adminNavCategories] : filtered;
  return {
    main: mergeGroups(all.filter((c) => c.section !== "settings")),
    settings: all.filter((c) => c.section === "settings"),
    hidden: !loading && !error && !branchId,
  };
};
