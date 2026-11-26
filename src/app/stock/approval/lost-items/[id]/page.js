"use client";
import { useParams } from "next/navigation";
import LostEntryView from "@/modules/stock/lostItems/LostEntryView";

const Page = () => {
  const { id } = useParams();
  return <LostEntryView key={id} side="approval" id={id} />;
};

export default Page;
