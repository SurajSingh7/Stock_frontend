"use client";
import OpeningStockEditor from "@/modules/stock/openingStock/OpeningStockEditor";
import { useParams } from "next/navigation";

// A draft, open to change (the plain address only reads it).
const Page = () => {
  const { id } = useParams();
  return <OpeningStockEditor key={`${id}-edit`} entryId={id} kind="ISSUED" mode="edit" />;
};

export default Page;
