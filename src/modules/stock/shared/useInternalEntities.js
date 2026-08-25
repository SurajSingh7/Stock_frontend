"use client";

import { useEffect, useState } from "react";

// Internal companies come from the ERP backend's config master data. The call
// goes through the same-origin /erp-api rewrite (next.config.mjs) because that
// host only whitelists https://sales.gtel.in for CORS — a direct browser fetch
// would fail in local dev.
//
// The endpoint is paginated (default limit 10), so ask for one large page:
// the full list is ~24 rows and every consumer needs all of them to build the
// Entity/State dropdowns.
const INTERNAL_COMPANIES_URL =
  "/erp-api/config/internal/company/all?page=1&limit=1000&isActive=true";

// Entity/State master data — same source used by PO creation. Kept as one hook
// so every screen that needs Entity/State dropdowns (Tracking Orders'
// "+ Add Entity" popup, the Purchase Order board filter, and the read-only
// display on PO Create/Edit) reads the exact same list.
export default function useInternalEntities() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(INTERNAL_COMPANIES_URL);
        const json = await res.json();
        const list = (json.data || []).filter(
          (e) => e.isActive !== false && e.isShownOnDropDown !== false
        );
        setEntities(list);
      } catch {
        setEntities([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aliases = [...new Set(entities.map((e) => e.alias).filter(Boolean))];

  return { entities, aliases, loading };
}
