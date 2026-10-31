"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass } from "lucide-react";

/*
  Any address that is not a page. Page addresses were reorganised to follow
  the menu (2026-10-31), so an old bookmark or an old WhatsApp/email link
  lands here — it should read as "moved", with a way on, not as a crash.
*/
export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50/60 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Compass className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">This page is not here</h1>
        <p className="mt-2 text-sm text-slate-500">
          Some page addresses changed when the menu was reorganised. Open it again from the menu at the top.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Link
            href="/stock/home"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
