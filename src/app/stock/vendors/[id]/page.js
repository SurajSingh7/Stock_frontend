"use client";

import { useParams } from "next/navigation";

import VendorView from "@/modules/stock/vendor/VendorView";

// Read-only vendor detail — its own page, not the edit form with every control disabled.
const VendorViewPage = () => {
  const { id } = useParams();

  return <VendorView vendorId={id} />;
};

export default VendorViewPage;
