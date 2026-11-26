import { Suspense } from "react";
import InvoiceListComp from "@/modules/stock/invoiceList/InvoiceListComp";

const Page = () => (
  <Suspense fallback={null}>
    <InvoiceListComp />
  </Suspense>
);

export default Page;
