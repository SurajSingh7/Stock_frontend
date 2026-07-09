"use client";

import { useParams } from "next/navigation";

import VendorForm from "@/modules/stock/vendor/Vendorform";

const page = () => {
  const { id } = useParams();

  return <VendorForm vendorId={id} />;
}

export default page;

