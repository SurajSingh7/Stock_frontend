
"use client";

import POCreateView from "@/modules/stock/purchaseOrder/Pocreateview";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <POCreateView/>
    </Suspense>
  );
}