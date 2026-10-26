"use client";
import OpeningStockEditor from "@/modules/stock/openingStock/OpeningStockEditor";
import { useParams } from "next/navigation";

// "new" opens an empty draft; anything else is an entry id.
const Page = () => {
  const { id } = useParams();
  return (
    <div>
      <OpeningStockEditor key={id} entryId={id} kind="ISSUED" />
    </div>
  );
};

export default Page;
