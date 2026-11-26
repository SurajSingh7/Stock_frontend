import { Suspense } from "react";
import TransferHistoryPage from "@/modules/stock/inventoryTransfer/TransferHistoryPage";

// Suspense: the page reads ?search= (links from notifications).
export default function Page() {
  return (
    <Suspense>
      <TransferHistoryPage />
    </Suspense>
  );
}
