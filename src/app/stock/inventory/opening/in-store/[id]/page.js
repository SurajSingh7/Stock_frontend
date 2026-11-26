"use client";
import OpeningStockEditor from "@/modules/stock/openingStock/OpeningStockEditor";
import { useParams } from "next/navigation";

// "new" opens an empty draft; an entry id opens it to read (Edit is /edit).
const Page = () => {
  const { id } = useParams();
  return <OpeningStockEditor key={id} entryId={id} mode={id === "new" ? "edit" : "view"} />;
};

export default Page;
