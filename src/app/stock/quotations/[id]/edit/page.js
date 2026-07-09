"use client";
import { useParams } from "next/navigation";
// import QuotationResubmitForm from "@/modules/stock/quotations/list/QuotationResubmitForm";

const page = () => {
  const { id } = useParams();
  return (
    <div>
      {/* <QuotationResubmitForm quotationId={id} /> */}
    </div>
  );
};

export default page;