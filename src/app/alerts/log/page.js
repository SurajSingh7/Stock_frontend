import { Suspense } from "react";
import AlertLog from "@/modules/alerts/log/AlertLog";

// useSearchParams (?recordId=) needs a Suspense boundary in the App Router.
const page = () => (
  <Suspense fallback={null}>
    <AlertLog />
  </Suspense>
);

export default page;
