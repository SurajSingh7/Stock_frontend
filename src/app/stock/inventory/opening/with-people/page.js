import OpeningStockList from "@/modules/stock/openingStock/OpeningStockList";
import React, { Suspense } from "react";

// Opening Issued Stock — the same list as Opening Stock, for entries of stock
// already with someone.
const page = () => {
  return (
    <div>
      <Suspense fallback={null}>
        <OpeningStockList kind="ISSUED" />
      </Suspense>
    </div>
  );
};

export default page;
