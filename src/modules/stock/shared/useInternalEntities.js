"use client";

import { useEffect, useState } from "react";

const INTERNAL_COMPANIES_URL =
  "https://gist.githubusercontent.com/SurajSingh7/ac8ffea18746e9fea058db22054bd3f3/raw/internal-companies.json";

// Entity/State master data — same external source used by PO creation
// (see stock-backend CLAUDE.md §1.11/18.9: a temporary stub pending a real
// internal Entity API). Kept as one hook so every screen that needs
// Entity/State dropdowns (Tracking Orders' "+ Add Entity" popup, and the
// read-only display on PO Create/Edit) reads the exact same list.
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
