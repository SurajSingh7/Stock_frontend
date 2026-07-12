"use client";
import QuotationApproval from "@/modules/stock/quotations/approval/QuotationApproval";
import { useParams } from "next/navigation";


const page = () => {
  const { id } = useParams();
  return (
    <div>
       <QuotationApproval quotationId={id} mode="view" />
    </div>
  );
};

export default page;