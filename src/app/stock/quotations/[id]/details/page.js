
"use client";
import QuotationApproval from "@/modules/stock/quotations/list/QuotationApproval";
import { useParams } from "next/navigation";


export default function Page() {
  const { id } = useParams();
  return <QuotationApproval quotationId={id} mode="details" />;
}