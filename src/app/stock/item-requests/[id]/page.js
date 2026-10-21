"use client";
import ItemRequestDetail from "@/modules/stock/itemRequests/ItemRequestDetail";
import { useParams } from "next/navigation";

const Page = () => {
  const { id } = useParams();
  return (
    <div>
      <ItemRequestDetail key={id} requestId={id} />
    </div>
  );
};

export default Page;
