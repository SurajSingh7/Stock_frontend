"use client";
import PODetailsView from "@/modules/stock/purchaseOrder/Podetailsview";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams();
  return <PODetailsView purchaseOrderId={id} />;
}