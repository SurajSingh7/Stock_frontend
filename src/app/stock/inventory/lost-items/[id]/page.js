"use client";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import LostEntryForm from "@/modules/stock/lostItems/LostEntryForm";
import LostEntryView from "@/modules/stock/lostItems/LostEntryView";

// "new?type=LOST|FOUND" opens the form; an entry id opens it to read.
const Inner = () => {
  const { id } = useParams();
  const type = useSearchParams().get("type") === "FOUND" ? "FOUND" : "LOST";
  return id === "new" ? <LostEntryForm key={type} type={type} /> : <LostEntryView key={id} side="items" id={id} />;
};

const Page = () => (
  <Suspense fallback={null}>
    <Inner />
  </Suspense>
);

export default Page;
