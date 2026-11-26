"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Search, Plus, Pencil, Trash2, RotateCcw, ShieldCheck, ShieldAlert,
  Building2, Phone, X, ChevronDown, MoreVertical, Eye, Users, ArrowLeft, Info, Mail, CornerDownRight,
} from "lucide-react";
import { fetchVendorList, fetchVendor, fetchVendorGroup, deleteVendor, restoreVendor, fetchCategory } from "./vendorApi";
import { fetchLeafCategories, fetchProductDefinitions, fetchScopedBranches } from "@/modules/stock/shared/lookupsApi";
import Pagination from "@/shared/ui/pagination/Pagination";
import { formatWarrantyShort } from "@/shared/warranty/warranty";

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
/* Assigned-products page                                         */
/* ============================================================= */

const AssignedProductsPage = ({ vendor, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pathMap, setPathMap] = useState({});

  useEffect(() => {
    (async () => {
      try {
        // A deleted vendor (Inactive tab) can still be inspected.
        setDetail(await fetchVendor(vendor._id, { includeInactive: !vendor.isActive }));
      } catch {
        // Non-fatal — the panel just shows no assigned products.
      } finally {
        setLoading(false);
      }
    })();
  }, [vendor._id, vendor.isActive]);

  const groups = (detail?.assignedProducts || [])
    .filter((ap) => ap.categoryId)
    .map((ap) => ({
      categoryId: ap.categoryId?._id || ap.categoryId,
      categoryName: ap.categoryId?.name || ap.categoryName || "",
      products: (ap.products || []).map((p) => {
        const productId = p.productId;
        const product = typeof productId === "object" ? productId : { _id: productId, name: "—" };
        return { ...product, warrantyMonths: p.overrides?.warrantyMonths ?? null };
      }),
    }));

  // assignedProducts.categoryId is only populated with {name, type} — resolve
  // each group's full breadcrumb path so it can always be shown inline.
  useEffect(() => {
    const ids = [...new Set(groups.map((g) => g.categoryId).filter(Boolean))];
    const missing = ids.filter((id) => !(id in pathMap));
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => {
          try {
            const cat = await fetchCategory(id);
            return [id, cat?.displayPath || cat?.name || ""];
          } catch {
            return [id, ""];
          }
        })
      );
      setPathMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const productTotal = groups.reduce((n, g) => n + g.products.length, 0);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <button
          type="button" onClick={onBack}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight text-slate-900">{vendor.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Assigned products
            {!loading && ` · ${groups.length} categor${groups.length === 1 ? "y" : "ies"} · ${productTotal} product${productTotal === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">No products assigned to this vendor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groups.map((g) => (
              <div key={g.categoryId} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <span className="min-w-0 break-words text-sm font-bold text-slate-900">
                    {pathMap[g.categoryId] || g.categoryName}
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
                      <span key={p._id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100">
                        {p.name}
                        {p.warrantyMonths ? ` · ${formatWarrantyShort(p.warrantyMonths)}` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================= */
/* Misc bits                                                      */
/* ============================================================= */

// Delete (rose) or Restore (emerald) — one confirm for both.
const ConfirmVendorModal = ({ vendor, mode = "delete", onConfirm, onCancel, busy }) => {
  if (!vendor) return null;
  const restore = mode === "restore";
  return (
    <Modal onClose={onCancel} title={restore ? "Restore vendor?" : "Delete vendor?"} maxWidth="max-w-md">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${restore ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
          {restore ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </span>
        <p className="text-sm leading-relaxed text-slate-500">
          {restore ? (
            <><span className="font-semibold text-slate-800">{vendor.name}</span> will be active again and show up in every vendor picker.</>
          ) : (
            <>This will deactivate <span className="font-semibold text-slate-800">{vendor.name}</span>. You can restore it later from the Inactive tab.</>
          )}
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button" onClick={onConfirm} disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
            restore ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
          }`}
        >
          {restore ? (busy ? "Restoring..." : "Restore") : busy ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {Array.from({ length: 10 }).map((__, j) => (
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

/* RowMenu renders through a portal, positioned via getBoundingClientRect so it
   floats above everything and never gets clipped by the table's overflow-x-auto
   or neighbouring rows. The panel is RIGHT-aligned to the button and clamped to
   the viewport: the actions cell sits at the far right edge of the table, so any
   offset that pushes the menu further right drops it off-screen entirely. */
const MENU_WIDTH = 160;

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
      // The panel's right edge lines up with the button's, then is clamped 8px
      // inside both viewport edges.
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8
      );
      // Flip above the button when there is no room below (last rows of a long
      // page), so the menu is never pushed under the viewport fold.
      const height = items.length * 36 + 12;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
      setCoords({ top, left });
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
          style={{ position: "fixed", top: coords.top, left: coords.left, width: MENU_WIDTH }}
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

const GroupMemberRow = ({ v, main }) => (
  <div className={`rounded-xl border px-3 py-2.5 ${v.isCurrent ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white"}`}>
    <div className="flex flex-wrap items-center gap-2">
      {main ? (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Main</span>
      ) : (
        <CornerDownRight className="h-3.5 w-3.5 text-slate-400" />
      )}
      <span className="text-sm font-semibold text-slate-900">{v.name}</span>
      {v.vendorCode && <span className="text-xs text-slate-400">{v.vendorCode}</span>}
      {v.isCurrent && <span className="text-[11px] font-semibold text-indigo-600">· this vendor</span>}
    </div>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {v.contactName && <span>{v.contactName}</span>}
      <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{v.phone || "—"}</span>
      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" />{v.email || "—"}</span>
      {v.gstNumber && <span className="text-slate-400">GST {v.gstNumber}</span>}
    </div>
  </div>
);


/* ── A vendor's group: its main vendor and every child firm ───────── */
/* So when one firm is a problem, the owner's other firms are one     */
/* click away — with whom to call.                                    */
const VendorGroupPopup = ({ vendorId, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        setData(await fetchVendorGroup(vendorId));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [vendorId]);

  return (
    <Modal onClose={onClose} title="Vendor group" maxWidth="max-w-xl">
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : !data ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-2">
          {data.main && <GroupMemberRow v={data.main} main />}
          {data.children.length === 0 ? (
            <p className="px-1 text-sm text-slate-400">No other vendor under this main vendor yet.</p>
          ) : (
            <div className="space-y-2 pl-4">{data.children.map((c) => <GroupMemberRow key={c._id} v={c} />)}</div>
          )}
        </div>
      )}
    </Modal>
  );
};

const VendorsComp = () => {
  const router = useRouter();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [status, setStatus] = useState("ACTIVE");
  // "all" = every vendor in its own row (a child says "under X");
  // "top" = main / stand-alone vendors, children opened under their main;
  // "groups" = only main vendors that have child vendors.
  // "top" = every main/standalone vendor, each main vendor's child firms listed
  // right under it. "groups" = only main vendors that have child firms.
  const [groupView, setGroupView] = useState("top");
  const [childrenOf, setChildrenOf] = useState({});     // mainId -> rows | "loading"
  const [groupPopup, setGroupPopup] = useState(null);   // vendorId

  const [categories, setCategories] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [productsPopup, setProductsPopup] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

  // leaf categories that have products — filtered SERVER-SIDE (Rule 23)
  useEffect(() => {
    (async () => {
      try {
        setCategories(await fetchLeafCategories());
      } catch {}
    })();
  }, []);

  // Product filter = DEPENDENT dropdown, scoped to the selected category (server-side)
  useEffect(() => {
    (async () => {
      // That category's products, or every product when none is chosen.
      try {
        setProductOptions(await fetchProductDefinitions({ categoryId: categoryId || undefined }));
      } catch { setProductOptions([]); }
    })();
  }, [categoryId]);

  // Branches this user may see vendors of.
  useEffect(() => {
    fetchScopedBranches("vendors").then(setBranches).catch(() => setBranches([]));
  }, []);

  // RULE 07: stable useCallback loader, never fetch in the component body.
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    setChildrenOf({});
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status, // ACTIVE | INACTIVE — filtered on the server so paging is right
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (productId) params.set("productId", productId);
      if (branchId) params.set("branchId", branchId);
      params.set("group", groupView);

      const json = await fetchVendorList(params);

      const filtered = json.data || [];

      setVendors(filtered);
      setTotal(json.pagination?.total ?? filtered.length);

      // Child firms are always shown under their main vendor — fetch them with the page.
      const mains = filtered.filter((v) => !v.parentVendorId && v.childCount > 0);
      if (mains.length) {
        setChildrenOf(Object.fromEntries(mains.map((m) => [m._id, "loading"])));
        const loaded = await Promise.all(
          mains.map((m) =>
            fetchVendorList({ parentId: m._id, limit: 200 })
              .then((j) => [m._id, j.data || []])
              .catch(() => [m._id, []])
          )
        );
        setChildrenOf(Object.fromEntries(loaded));
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, categoryId, productId, branchId, status, groupView]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget._id);
      toast.success(`"${deleteTarget.name}" was deleted.`);
      setDeleteTarget(null);
      loadVendors();
    } catch (err) {
      toast.error(err.message || "Failed to delete vendor");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await restoreVendor(restoreTarget._id);
      toast.success(`"${restoreTarget.name}" was restored.`);
      setRestoreTarget(null);
      loadVendors();
    } catch (err) {
      toast.error(err.message || "Failed to restore vendor");
    } finally {
      setRestoring(false);
    }
  };

  const productCategoryId = (p) => String(p?.categoryId?._id || p?.categoryId || "");
  const categoryPathById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c._id, c.displayPath || c.name])),
    [categories]
  );
  const productSelectOptions = useMemo(
    () =>
      productOptions.map((p) => ({
        value: p._id,
        // Across all categories the same name can repeat — say which one.
        label: categoryId || !categoryPathById[productCategoryId(p)] ? p.name : `${p.name} — ${categoryPathById[productCategoryId(p)]}`,
      })),
    [productOptions, categoryId, categoryPathById]
  );
  // A product picked without a category fills in its category too.
  const pickProduct = (v) => {
    setProductId(v);
    setPage(1);
    if (!v || categoryId) return;
    const cat = productCategoryId(productOptions.find((p) => String(p._id) === String(v)));
    if (cat) setCategoryId(cat);
  };
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.code ? `${b.name} (${b.code})` : b.name })),
    [branches]
  );

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c._id, label: c.displayPath || c.name })),
    [categories]
  );

  const hasActiveFilters = !!search || !!categoryId || !!productId || !!branchId || status !== "ACTIVE" || groupView !== "top";

  const clearFilters = () => {
    setSearch(""); setCategoryId(""); setProductId(""); setBranchId(""); setStatus("ACTIVE"); setGroupView("top"); setPage(1);
  };

  // Assigned products open as a page in place of the list; Back returns to it.
  if (productsPopup) {
    return <AssignedProductsPage vendor={productsPopup} onBack={() => setProductsPopup(null)} />;
  }

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, code, GST or mobile..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="lg:col-span-1">
            <SearchableSelect
              value={categoryId}
              onChange={(v) => { setCategoryId(v); setProductId(""); setPage(1); }}
              options={categoryOptions} placeholder="All categories"
            />
          </div>
          <div className="lg:col-span-1">
            <SearchableSelect
              value={productId} onChange={pickProduct}
              options={productSelectOptions}
              placeholder="All products"
            />
          </div>
          <div className="lg:col-span-1">
            <SearchableSelect
              value={branchId}
              onChange={(v) => { setBranchId(v); setPage(1); }}
              options={branchOptions} placeholder="All branches"
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

      {/* Every vendor (child firms folded under their main vendor), or only the groups. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Show</span>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {[
            { key: "top", label: "All Vendors" },
            { key: "groups", label: "Vendor Groups" },
          ].map((o) => (
            <button
              key={o.key} type="button" onClick={() => { setGroupView(o.key); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                groupView === o.key ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          Child vendors are listed under their main vendor.
        </span>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/60">
            <tr>
              <th className={th}>Vendor Name</th>
              <th className={th}>Alias</th>
              <th className={th}>Branch</th>
              <th className={th}>GST Status</th>
              <th className={th}>Phone</th>
              <th className={th}>Payment Term</th>
              <th className={th}>TDS</th>
              <th className={th}>Assigned Products</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <SkeletonRows />
            ) : error ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-rose-600">{error}</td></tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">No vendors found</p>
                  <p className="mt-1 text-sm text-slate-400">Adjust the filters above, or add a new vendor.</p>
                </td>
              </tr>
            ) : (
              vendors
                // A search can match a child firm on its own; it already shows
                // under its main vendor when that one is on the page too.
                .filter((v) => !(v.parentVendorId && childrenOf[String(v.parentVendorId)]))
                .flatMap((top) => {
                const kids = childrenOf[top._id] || null;
                return [
                  { vendor: top, child: false },
                  ...(kids === "loading" ? [{ loadingFor: top._id }] : (kids || []).map((k) => ({ vendor: k, child: true }))),
                ];
              }).map((entry) => {
                if (entry.loadingFor) {
                  return (
                    <tr key={`loading-${entry.loadingFor}`}>
                      <td colSpan={10} className="bg-slate-50/50 px-10 py-2.5 text-xs text-slate-400">Loading child vendors…</td>
                    </tr>
                  );
                }
                const { vendor, child } = entry;
                const primaryContact = vendor.contacts?.find((c) => c.label === "PRIMARY") || vendor.contacts?.[0];
                const productCount = (vendor.assignedProducts || []).reduce((sum, ap) => sum + (ap.products?.length || 0), 0);
                const isMain = !vendor.parentVendorId && vendor.childCount > 0;
                return (
                  <tr key={vendor._id} className={`transition hover:bg-slate-50/60 ${child ? "bg-slate-50/40" : ""}`}>
                    <td className={`py-3.5 pr-4 ${child ? "pl-10" : "pl-4"}`}>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        {child && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        <TruncateText text={vendor.name} title="Vendor name" />
                        {isMain && (
                          <button
                            type="button" onClick={() => setGroupPopup(vendor._id)} title="Vendor group"
                            className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 transition hover:bg-violet-200"
                          >
                            <Users className="h-3 w-3" /> Main · {vendor.childCount}
                          </button>
                        )}
                        {vendor.parentVendorId && (
                          <button
                            type="button" onClick={() => setGroupPopup(vendor._id)} title="See the whole group"
                            className="rounded-md p-0.5 text-violet-500 transition hover:bg-violet-50"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {vendor.parentVendorId && !child && vendor.parentVendorName && (
                        <div className="mt-0.5 text-xs text-violet-600">under {vendor.parentVendorName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {vendor.vendorAlias ? (
                        <TruncateText text={vendor.vendorAlias} max={20} title="Vendor alias" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">
                      {vendor.branchName ? (
                        <TruncateText text={vendor.branchName} max={20} title="Branch" />
                      ) : (
                        <span className="text-slate-300">—</span>
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
                    <td className="px-4 py-3.5 text-sm">
                      {vendor.tdsRate > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                          {vendor.tdsRate}%
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
                        {/* View works on deleted vendors too — the record has to be
                            inspectable before deciding whether to restore it. */}
                        <IconBtn title="View vendor" tone="indigo" onClick={() => router.push(`/stock/vendors/${vendor._id}`)}>
                          <Eye className="h-4 w-4" />
                        </IconBtn>
                        {vendor.isActive && (
                          <IconBtn title="Edit vendor" tone="orange" onClick={() => router.push(`/stock/vendors/${vendor._id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                          </IconBtn>
                        )}
                        <RowMenu
                          items={
                            vendor.isActive
                              ? [{ label: "Delete", tone: "red", onClick: () => setDeleteTarget(vendor) }]
                              : [{ label: "Restore", onClick: () => setRestoreTarget(vendor) }]
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


      {groupPopup && <VendorGroupPopup vendorId={groupPopup} onClose={() => setGroupPopup(null)} />}

      <ConfirmVendorModal
        vendor={deleteTarget} mode="delete" busy={deleting}
        onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete}
      />
      <ConfirmVendorModal
        vendor={restoreTarget} mode="restore" busy={restoring}
        onCancel={() => setRestoreTarget(null)} onConfirm={handleRestore}
      />
    </div>
  );
};

export default VendorsComp;