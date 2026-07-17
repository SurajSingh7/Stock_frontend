"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search, Plus, Eye, Pencil, Trash2, RotateCcw, ShieldCheck, ShieldAlert,
  Building2, Phone, X, ChevronDown, MoreVertical, Loader2,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";

/* ============================================================= */
/* Tokens — SAME as PurchaseOrderPage                             */
/* ============================================================= */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

const TRUNCATE_LEN = 25;

const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

const leafOf = (c) => String(c || "").split("/").pop().trim();
const hasPath = (leaf, path) => Boolean(path) && String(path).trim() !== String(leaf).trim();

/* ============================================================= */
/* Portal Modal — same as PO board                                */
/* ============================================================= */

const Modal = ({ onClose, title, children, maxWidth = "max-w-lg" }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`max-h-full w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <p className="truncate pr-4 text-base font-semibold tracking-tight text-slate-900">{title}</p>
            <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================= */
/* Truncate + "...more" popup — same as PO board                  */
/* ============================================================= */

const TruncateText = ({ text, max = TRUNCATE_LEN, title = "Full details", className = "" }) => {
  const [open, setOpen] = useState(false);
  const str = text == null || text === "" ? "—" : String(text);
  if (str.length <= max) return <span className={className}>{str}</span>;
  return (
    <>
      <span className={className}>
        {str.slice(0, max)}...
        <button
          type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="ml-1 text-xs font-semibold text-indigo-600 hover:underline"
        >
          more
        </button>
      </span>
      {open && (
        <Modal onClose={() => setOpen(false)} title={title} maxWidth="max-w-md">
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{str}</p>
        </Modal>
      )}
    </>
  );
};

/* ============================================================= */
/* Searchable select — same as PO board                           */
/* ============================================================= */

const SearchableSelect = ({ value, onChange, options, placeholder = "All", disabled = false, renderExtra }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = React.useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""}`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..."
              className="w-full py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button" onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50"
            >
              {placeholder}
            </button>
            {filtered.map((o) => (
              <div key={o.value} className={`flex items-center gap-1 px-2 transition hover:bg-indigo-50/60 ${o.value === value ? "bg-indigo-50" : ""}`}>
                <button
                  type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className="flex-1 truncate px-1 py-2 text-left text-sm text-slate-800"
                >
                  {o.label}
                </button>
                {renderExtra && renderExtra(o)}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-400">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Simple select (non-searchable) — used for Status dropdown      */
/* ============================================================= */

const SimpleSelect = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span className="truncate text-slate-900">{selected ? selected.label : "Select status"}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          {options.map((o) => (
            <button
              key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                o.value === value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================= */
/* Badges                                                         */
/* ============================================================= */

const GstBadge = ({ gst }) => {
  if (!gst?.isAvailable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> N/A
      </span>
    );
  }
  return gst.isVerified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <ShieldCheck className="h-3.5 w-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
      <ShieldAlert className="h-3.5 w-3.5" /> Not verified
    </span>
  );
};

const ActiveBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
      isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
    {isActive ? "Active" : "Inactive"}
  </span>
);

/* ============================================================= */
/* Assigned-products popup                                        */
/* ============================================================= */

const CategoryPathModal = ({ categoryId, label, onClose }) => {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/categories/${categoryId}`, { credentials: "include" });
        const json = await res.json();
        if (json.success) setPath(json.data?.displayPath || json.data?.name || "");
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId]);

  return (
    <Modal onClose={onClose} title={label} maxWidth="max-w-md">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Full category path</p>
      {loading ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading path...
        </p>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-900">{path || "—"}</p>
      )}
    </Modal>
  );
};

const AssignedProductsPopup = ({ vendor, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pathFor, setPathFor] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${vendor._id}`, { credentials: "include" });
        const json = await res.json();
        if (json.success) setDetail(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendor._id]);

  const groups = (detail?.assignedProducts || [])
    .filter((ap) => ap.categoryId)
    .map((ap) => ({
      categoryId: ap.categoryId?._id || ap.categoryId,
      categoryName: ap.categoryId?.name || ap.categoryName || "",
      products: (ap.productIds || []).map((p) => (typeof p === "object" ? p : { _id: p, name: "—" })),
    }));

  return (
    <>
      <Modal onClose={onClose} title={`${vendor.name} · assigned products`} maxWidth="max-w-2xl">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No products assigned to this vendor.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.categoryId} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    {leafOf(g.categoryName)}
                    <button
                      type="button" title="View full path"
                      onClick={() => setPathFor({ categoryId: g.categoryId, label: leafOf(g.categoryName) })}
                      className="rounded p-0.5 text-slate-400 transition hover:text-indigo-600"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      LEAF
                    </span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
                    {g.products.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-4">
                  {g.products.length === 0 ? (
                    <span className="text-xs text-slate-400">No products selected in this category</span>
                  ) : (
                    g.products.map((p) => (
                      <span key={p._id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {pathFor && (
        <CategoryPathModal categoryId={pathFor.categoryId} label={pathFor.label} onClose={() => setPathFor(null)} />
      )}
    </>
  );
};

/* ============================================================= */
/* Misc bits                                                      */
/* ============================================================= */

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
        toast.type === "error" ? "bg-rose-600 text-white" : "bg-slate-900 text-white"
      }`}
    >
      {toast.message}
      <button onClick={onClose} className="opacity-70 transition hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const ConfirmDeleteModal = ({ vendor, onConfirm, onCancel, deleting }) => {
  if (!vendor) return null;
  return (
    <Modal onClose={onCancel} title="Delete vendor?" maxWidth="max-w-md">
      <p className="text-sm text-slate-500">
        This will deactivate <span className="font-semibold text-slate-800">{vendor.name}</span>. You can restore it later from the Inactive tab.
      </p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button" onClick={onConfirm} disabled={deleting}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {Array.from({ length: 7 }).map((__, j) => (
          <td key={j} className="px-4 py-4"><div className="h-3 w-full max-w-[120px] rounded bg-slate-100" /></td>
        ))}
      </tr>
    ))}
  </>
);

/* ============================================================= */
/* Row actions — icon buttons + overflow menu (portal, no overlap) */
/* ============================================================= */

const IconBtn = ({ title, onClick, tone = "slate", children }) => {
  const toneCls =
    tone === "indigo" ? "text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
    : tone === "red" ? "text-rose-600 hover:border-rose-200 hover:bg-rose-50"
    : tone === "green" ? "text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
    : tone === "orange" ? "text-orange-500 hover:border-orange-200 hover:bg-orange-50"
    : "text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700";
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls}`}
    >
      {children}
    </button>
  );
};

/* RowMenu now renders through a portal, positioned via getBoundingClientRect
   so it floats above everything and never gets clipped/overlapped by the
   table's overflow-x-auto or neighboring rows (fixes the issue in the screenshot). */
const RowMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);
  const menuRef = React.useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", () => setOpen(false), true);
    window.addEventListener("resize", () => setOpen(false));
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("scroll", () => setOpen(false), true);
      window.removeEventListener("resize", () => setOpen(false));
    };
  }, []);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.right - 160 });
    }
    setOpen((o) => !o);
  };

  if (items.length === 0) return null;

  return (
    <>
      <div ref={btnRef}>
        <IconBtn title="More actions" onClick={toggleOpen}><MoreVertical className="h-4 w-4" /></IconBtn>
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: 160 }}
          className="z-[70] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl ring-1 ring-slate-900/5"
        >
          {items.map((it) => (
            <button
              key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
              className={`block w-full px-4 py-2 text-left text-sm transition ${
                it.tone === "red" ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

/* ============================================================= */
/* Main                                                           */
/* ============================================================= */

const VendorsComp = () => {
  const router = useRouter();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [pathModal, setPathModal] = useState(null);
  const [productsPopup, setProductsPopup] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  // leaf categories that have products — filtered SERVER-SIDE (Rule 23)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&hasProducts=true&limit=500`, { credentials: "include" });
        const j = await r.json();
        if (j.success) setCategories(j.data || []);
      } catch {}
    })();
  }, []);

  // Product filter = DEPENDENT dropdown, scoped to the selected category (server-side)
  useEffect(() => {
    (async () => {
      if (!categoryId) { setProductOptions([]); return; }
      try {
        const r = await fetch(`${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryId}&limit=1000`, { credentials: "include" });
        const j = await r.json();
        setProductOptions(j.success ? (j.data || []).map((p) => ({ value: p._id, label: p.name })) : []);
      } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  // RULE 07: stable useCallback loader, never fetch in the component body.
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        showInactive: "true",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productId", productId);

      const res = await fetch(`${API_BACKEND_URL}/stock/vendors?${params.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch vendors");

      const rows = json.data || [];
      const filtered = rows.filter((v) => (status === "ACTIVE" ? v.isActive : !v.isActive));

      setVendors(filtered);
      setTotal(json.pagination?.total ?? filtered.length);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, categoryId, productId, status]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${deleteTarget._id}`, {
        method: "DELETE", credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Delete failed");
      showToast("Vendor deleted successfully");
      setDeleteTarget(null);
      loadVendors();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (vendor) => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${vendor._id}/restore`, {
        method: "PATCH", credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Restore failed");
      showToast("Vendor restored successfully");
      loadVendors();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c._id, label: c.name, path: c.displayPath || c.name })),
    [categories]
  );

  const hasActiveFilters = !!search || !!categoryId || !!productId || status !== "ACTIVE";

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setStatus("ACTIVE"); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      {/* page header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Vendors Lists</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage vendor master data — contacts, GST, bank details, and assigned products.
          </p>
        </div>
        <button
          type="button" onClick={() => router.push("/stock/vendors/create")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <Plus className="h-4 w-4" /> Add vendor
        </button>
      </div>

      {/* ROW 1 — search + Category + Product + Status + Reset, all in one row */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, vendor code, GST number..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="lg:col-span-1">
            <SearchableSelect
              value={categoryId}
              onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
              options={categoryOptions} placeholder="All categories"
              renderExtra={(o) =>
                hasPath(o.label, o.path) ? (
                  <button
                    type="button" title="View full path"
                    onClick={(e) => { e.stopPropagation(); setPathModal(o); }}
                    className="shrink-0 rounded p-1 text-slate-400 transition hover:text-indigo-600"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                ) : null
              }
            />
          </div>
          <div className="lg:col-span-1">
            <SearchableSelect
              value={productId} onChange={(v) => { setProductId(v); setPage(1); }}
              options={productOptions}
              placeholder={categoryId ? "All products" : "Select a category first"}
              disabled={!categoryId}
            />
          </div>
          <div className="lg:col-span-1">
            <SimpleSelect
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="lg:col-span-1">
            {hasActiveFilters ? (
              <button
                type="button" onClick={clearFilters}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            ) : (
              <button
                type="button" disabled
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400 shadow-sm cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Vendor Name</th>
              <th className={th}>GST Status</th>
              <th className={th}>Phone</th>
              <th className={th}>Payment Term</th>
              <th className={th}>Assigned Products</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows />
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-rose-600">{error}</td></tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">No vendors found</p>
                  <p className="mt-1 text-sm text-slate-400">Adjust the filters above, or add a new vendor.</p>
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => {
                const primaryContact = vendor.contacts?.find((c) => c.label === "PRIMARY") || vendor.contacts?.[0];
                const productCount = (vendor.assignedProducts || []).reduce((sum, ap) => sum + (ap.productIds?.length || 0), 0);
                return (
                  <tr key={vendor._id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3.5">
                      <div className="text-sm font-medium text-slate-900">
                        <TruncateText text={vendor.name} title="Vendor name" />
                      </div>
                      {vendor.vendorAlias && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          <TruncateText text={vendor.vendorAlias} max={20} title="Vendor alias" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><GstBadge gst={vendor.gst} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {primaryContact?.phone || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      {vendor.paymentTerms?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {productCount === 0 ? (
                        <span className="text-sm text-slate-400">0</span>
                      ) : (
                        <button
                          type="button" onClick={() => setProductsPopup(vendor)}
                          title="View assigned categories and products"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <span className="tabular-nums">{productCount}</span>
                          <span className="font-medium text-slate-400">products</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><ActiveBadge isActive={vendor.isActive} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* <IconBtn title="View vendor" tone="indigo" onClick={() => router.push(`/stock/vendors/${vendor._id}`)}>
                          <Eye className="h-4 w-4" />
                        </IconBtn> */}
                        {vendor.isActive && (
                          <IconBtn title="Edit vendor" tone="orange" onClick={() => router.push(`/stock/vendors/${vendor._id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                          </IconBtn>
                        )}
                        <RowMenu
                          items={
                            vendor.isActive
                              ? [{ label: "Delete", tone: "red", onClick: () => setDeleteTarget(vendor) }]
                              : [{ label: "Restore", onClick: () => handleRestore(vendor) }]
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Shared Pagination — Rule 17 / Section 18: all five props, always */}
        <div className="border-t border-slate-100 p-4">
          <Pagination
            currentPage={page}
            totalItems={total}
            itemsPerPage={limit}
            onPageChange={setPage}
            onItemsPerPageChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </div>
      </div>

      {productsPopup && <AssignedProductsPopup vendor={productsPopup} onClose={() => setProductsPopup(null)} />}
      {pathModal && (
        <Modal onClose={() => setPathModal(null)} title={pathModal.label} maxWidth="max-w-md">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Full category path</p>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-900">{pathModal.path}</p>
        </Modal>
      )}

      <ConfirmDeleteModal
        vendor={deleteTarget} deleting={deleting}
        onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default VendorsComp;