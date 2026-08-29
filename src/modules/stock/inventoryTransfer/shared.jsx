import { API_BACKEND_URL } from "@/config/getEnvVariables";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export const STATUS_META = {
  PENDING: { label: "Pending", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export const STATUS_TAB_STYLES = {
  PENDING: { active: "border-amber-600 bg-amber-600 text-white", inactive: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  COMPLETED: { active: "border-emerald-600 bg-emerald-600 text-white", inactive: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  REJECTED: { active: "border-rose-600 bg-rose-600 text-white", inactive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  ALL: { active: "border-slate-900 bg-slate-900 text-white", inactive: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" },
};

export const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
export const thRight = "px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700";

export const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, badge: "bg-slate-50 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

export const BranchPair = ({ from, to }) => (
  <div className="flex items-center gap-1.5 text-sm">
    <span className="font-medium text-slate-900">{from?.name || "—"}</span>
    <span className="text-slate-400">→</span>
    <span className="font-medium text-slate-900">{to?.name || "—"}</span>
  </div>
);

export const ItemsCell = ({ row }) => (
  <div className="max-w-55">
    <p className="truncate text-sm text-slate-700">{row.itemsSummary || "—"}</p>
    <span className="mt-0.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      {row.lines?.length || 0} Item{row.lines?.length === 1 ? "" : "s"}
    </span>
  </div>
);

// Branch pickers for every transfer screen. Served by the transfer-requests
// module rather than /branches/active, so branch staff don't need the
// Master > Branch permission just to name a branch.
//
// `branches` is every active branch (a transfer's counterparty is by
// definition another branch); `defaultBranchId` is the caller's own branch,
// the only branch they may raise a request on behalf of.
export async function fetchTransferBranches() {
  const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests/branches`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load branches");
  return {
    branches: json.data?.branches || [],
    defaultBranchId: json.data?.defaultBranchId ? String(json.data.defaultBranchId) : "",
  };
}

// For the screens that only ever need the flat list.
export async function fetchActiveBranches() {
  return (await fetchTransferBranches()).branches;
}

// One shared fetch for the /transfer-requests/board endpoint — each page
// passes its own fixed `role` (or none) and the query params it wants to
// let the user control (status/search/pagination).
export async function fetchTransferBoard({ branchId, role, status, search, page, limit }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (branchId) params.set("branchId", branchId);
  if (branchId && role) params.set("role", role);
  if (status) params.set("status", status);
  if (search && search.trim()) params.set("search", search.trim());

  const res = await fetch(`${API_BACKEND_URL}/stock/transfer-requests/board?${params.toString()}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch transfer requests");
  return {
    rows: json.data?.rows || [],
    counts: json.data?.counts || { ALL: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0 },
    total: json.pagination?.total ?? 0,
  };
}
