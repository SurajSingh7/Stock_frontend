"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CheckCheck, ExternalLink } from "lucide-react";
import Pagination from "@/shared/ui/pagination/Pagination";
import { fetchInbox, markRead, markAllRead, toAppPath, timeAgo } from "./inboxApi";
import { btnGhost, Empty, ErrorBox } from "../shared/AlertUI";

// Everything the bell ever showed this user, newest first.
const MyNotifications = () => {
  const router = useRouter();
  const [view, setView] = useState("all");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchInbox({ page, limit, unread: view === "unread" });
      setRows(r.data || []);
      setTotal(r.pagination?.total || 0);
      setUnread(r.pagination?.unread || 0);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, view]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (n) => {
    if (!n.readAt) await markRead(n._id).catch(() => {});
    const path = toAppPath(n.link);
    if (path) router.push(path);
    else load();
  };

  const readAll = async () => {
    try {
      await markAllRead();
      toast.success("All marked as read");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">{unread ? `${unread} unread` : "All caught up"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {[["all", "All"], ["unread", "Unread"]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => { setView(k); setPage(1); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {label}
                </button>
              ))}
            </div>
            {unread > 0 && <button type="button" className={btnGhost} onClick={readAll}><CheckCheck className="h-4 w-4" />Mark all read</button>}
          </div>
        </div>

        <ErrorBox>{error}</ErrorBox>
        {!loading && rows.length === 0 ? (
          <Empty title={view === "unread" ? "No unread notifications" : "No notifications yet"} message="Approvals waiting on you, and work sent back to you, show up here." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {rows.map((n) => (
              <button key={n._id} type="button" onClick={() => open(n)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition last:border-0 hover:bg-slate-50 ${n.readAt ? "" : "bg-indigo-50/40"}`}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-slate-200" : "bg-indigo-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-900">{n.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block whitespace-pre-line text-sm text-slate-600">{String(n.body || "").replace(/https?:\/\/\S+/g, "").trim()}</span>
                  {n.recordType && <span className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600">{n.recordType} {n.recordRef}<ExternalLink className="h-3 w-3" /></span>}
                </span>
              </button>
            ))}
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination currentPage={page} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(x) => { setLimit(x); setPage(1); }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyNotifications;
