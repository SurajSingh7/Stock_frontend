"use client";

import { useParams } from "next/navigation";

import VendorForm from "@/modules/stock/vendor/Vendorform";

// Read-only vendor detail — the same form the edit route renders, with every
// control inert and nothing to submit.
const VendorViewPage = () => {
  const { id } = useParams();

  return <VendorForm vendorId={id} readOnly />;
};

export default VendorViewPage;
