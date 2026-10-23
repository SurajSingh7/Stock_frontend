import { alertApi, ALERTS_API } from "../shared/alertApi";

// The signed-in user's own notifications (website bell).
export const fetchInbox = ({ page = 1, limit = 8, unread } = {}) =>
  alertApi("/inbox", { query: { page, limit, unread: unread ? "true" : undefined } });
export const fetchUnreadCount = () => alertApi("/inbox/unread-count").then((r) => r.data?.unread || 0);
export const markRead = (id) => alertApi(`/inbox/${id}/read`, { method: "PATCH" });
export const markAllRead = () => alertApi("/inbox/read-all", { method: "PATCH" });
export const INBOX_STREAM_URL = `${ALERTS_API}/inbox/stream`;

/*
  Links in notifications are absolute (APP_PUBLIC_URL), built for WhatsApp.
  Inside the app the same page is opened as a path, so the router keeps the
  session and does not reload.
*/
export const toAppPath = (link) => {
  if (!link) return null;
  try {
    const u = new URL(link, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
};

export const timeAgo = (d) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
