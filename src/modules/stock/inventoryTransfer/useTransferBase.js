"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTransferBranches } from "./transferApi";

const ALL = "ALL";

/*
  Branch lists for one transfer page, scoped to its module —
  "my-stock-requests" | "stock-requests-to-us" | "stock-transfer-history".
*/
export const useTransferBranches = (module) => {
  const [branches, setBranches] = useState([]);
  const [defaultBranchId, setDefaultBranchId] = useState("");
  const [myBranchIds, setMyBranchIds] = useState([]);

  useEffect(() => {
    fetchTransferBranches(module)
      .then((b) => { setBranches(b.branches); setDefaultBranchId(b.defaultBranchId); setMyBranchIds(b.myBranchIds); })
      .catch(() => setBranches([]));
  }, [module]);

  // Is this branch one I act for on this page? (null = every branch)
  const isMine = useCallback((id) => myBranchIds === null || myBranchIds.includes(String(id?._id || id)), [myBranchIds]);

  /*
    "Our branch" — the branch that is "us" for someone who covers several.
    "We asked" / "we were asked" only mean something from ONE branch's side;
    with all of them every request is both. So the picker offers All branches
    (everything, no direction) or one branch, and starts on:
      all branches (admin)  → All branches — they see everything
      a few branches        → their own branch
      one branch            → no picker; their scope already is that branch
    ourBranch(picked) is the id to filter by ("" = every branch);
    ourValue(picked) is what the picker shows.
  */
  const coversMany = myBranchIds === null || myBranchIds.length > 1;
  const startValue = myBranchIds === null ? ALL : defaultBranchId || ALL;
  const ourValue = useCallback((picked) => picked || startValue, [startValue]);
  const ourBranch = useCallback((picked) => {
    const v = picked || startValue;
    return coversMany && v !== ALL ? v : "";
  }, [coversMany, startValue]);
  const ourOptions = [
    { value: ALL, label: "All branches" },
    ...branches.filter((b) => isMine(b._id)).map((b) => ({ value: String(b._id), label: b.name })),
  ];

  return { branches, defaultBranchId, myBranchIds, isMine, coversMany, ourBranch, ourValue, ourOptions };
};

// Search box value plus its debounced copy.
export const useDebounced = (value, ms = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};
