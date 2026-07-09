"use client";
import QuotationApproval from "@/modules/stock/quotations/list/QuotationApproval";
import { useParams } from "next/navigation";


const page = () => {
  const { id } = useParams();
  return (
    <div>
      <QuotationApproval quotationId={id} mode="review" />
    </div>
  );
};

export default page;