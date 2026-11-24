"use client";
import { useParams } from "next/navigation";
import LostEntryForm from "@/modules/stock/lostItems/LostEntryForm";

// A rejected Dead entry, fixed and sent again by whoever made it.
const Page = () => {
  const { id } = useParams();
  return <LostEntryForm key={id} type="DEAD" entryId={id} />;
};

export default Page;
