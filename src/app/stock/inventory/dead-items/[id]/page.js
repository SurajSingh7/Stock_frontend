"use client";
import { useParams } from "next/navigation";
import LostEntryForm from "@/modules/stock/lostItems/LostEntryForm";
import LostEntryView from "@/modules/stock/lostItems/LostEntryView";

// "new" opens Add Dead; an entry id opens it to read.
const Page = () => {
  const { id } = useParams();
  return id === "new" ? <LostEntryForm type="DEAD" /> : <LostEntryView key={id} family="dead" side="items" id={id} />;
};

export default Page;
