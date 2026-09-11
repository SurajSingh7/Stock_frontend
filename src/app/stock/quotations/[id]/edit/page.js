"use client";
import { useParams } from "next/navigation";
import QuotationForm from "@/modules/stock/quotations/list/Quotationform";

const EditQuotationPage = () => {
  const { id } = useParams();
  return (
    <div>
      <QuotationForm quotationId={id} />
    </div>
  );
};

export default EditQuotationPage;
