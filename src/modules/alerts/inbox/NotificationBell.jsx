"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Bell, CheckCheck } from "lucide-react";
import { fetchInbox, fetchUnreadCount, markRead, markAllRead, INBOX_STREAM_URL, toAppPath, timeAgo } from "./inboxApi";

/*
  The website bell in the header.

  Live: one EventSource per tab; a new notification bumps the count and shows
  a toast. The count is also re-read every minute and whenever the tab comes
  back into view, so a dropped stream (or another API process) can only make
  it late, never wrong.
*/
const POLL_MS = 60 * 1000;

const NotificationBell = () => {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  const refreshCount = useCallback(() => {
    fetchUnreadCount().then(setCount).catch(() => {});
  }, []);

  const loadItems = useCallback(() => {
    fetchInbox({ limit: 8 })
      .then((r) => {
        setItems(r.data || []);
        setCount(r.pagination?.unread ?? 0);
      })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const first = setTimeout(refreshCount, 0);
    const poll = setInterval(refreshCount, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refreshCount();
    document.addEventListener("visibilitychange", onVisible);

    let es;
    try {
      es = new EventSource(INBOX_STREAM_URL, { withCredentials: true });
      es.addEventListener("notification", (e) => {
        const n = JSON.parse(e.data || "{}");
        setCount((c) => c + 1);
        setItems((list) => (list ? [{ ...n, readAt: null }, ...list].slice(0, 8) : list));
        toast(n.title || "New notification", { icon: "🔔" });
      });
      es.addEventListener("read", () => refreshCount());
    } catch {
      // No EventSource — polling alone keeps the count right.
    }
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    if (!open) loadItems();
    setOpen((o) => !o);
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.readAt) {
      setCount((c) => Math.max(0, c - 1));
      markRead(n._id).catch(() => {});
    }
    const path = toAppPath(n.link);
    if (path) router.push(path);
  };

  const readAll = async () => {
    try {
      await markAllRead();
      setCount(0);
      setItems((list) => (list || []).map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={count ? `${count} unread notifications` : "Notifications"}
        className="relative rounded-full p-2 text-gray-200 transition hover:bg-gray-700 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-gray-800">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white text-slate-800 shadow-2xl ring-1 ring-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" />Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${n.readAt ? "" : "bg-indigo-50/40"}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-indigo-500"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{n.title}</span>
                    <span className="block truncate text-xs text-slate-500">{String(n.body || "").split("\n")[0]}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 hover:bg-slate-50">
            View all
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
