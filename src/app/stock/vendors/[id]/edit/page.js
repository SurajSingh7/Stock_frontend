"use client";

import { useParams } from "next/navigation";

import VendorForm from "@/components/stock/VendorForm";

const page = () => {
  const { id } = useParams();

  return <VendorForm vendorId={id} />;
}

export default page;

