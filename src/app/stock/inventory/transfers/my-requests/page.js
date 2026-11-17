import { Suspense } from "react";
import StockRequestsPage from "@/modules/stock/inventoryTransfer/StockRequestsPage";

// Suspense: the page reads ?search= (links from notifications).
export default function Page() {
  return (
    <Suspense>
      <StockRequestsPage side="mine" />
    </Suspense>
  );
}
