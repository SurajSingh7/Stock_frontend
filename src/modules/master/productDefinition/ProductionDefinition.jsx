"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ChevronDown, Search, Check, Loader2, X, Plus, Pencil, Trash2, RotateCcw,
  PackageSearch, AlertTriangle, ArrowLeft, Eye, ImagePlus, ImageOff, FileText,
  MoreVertical,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

import Pagination from "@/shared/ui/pagination/Pagination";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */

// The backend serves uploaded files from /uploads/... (static, NOT under
// /api/v1) — see server.js. API_BACKEND_URL already ends in /api/v1, so strip
// that to get the plain origin for building asset URLs.
const ASSET_BASE_URL = API_BACKEND_URL.replace(/\/api\/v1\/?$/, "");
function resolveAssetUrl(assetPath) {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${ASSET_BASE_URL}${assetPath}`;
}
const isPdfPath = (p) => /\.pdf($|\?)/i.test(String(p || ""));

const UNIT_TYPES = [
  { value: "pieces", label: "Pieces" },
  { value: "meter", label: "Meter" },
  { value: "kg", label: "Kg" },
  { value: "box", label: "Box" },
  { value: "litre", label: "Litre" },
  { value: "dozen", label: "Dozen" },
];

const TRACKING_METHODS = [
  { value: "individual", label: "Individual", description: "Each unit tracked separately (serial no., IMEI, etc.)" },
  { value: "quantity", label: "Quantity", description: "Tracked as a bulk quantity (notebooks, pens, cables, etc.)" },
];

// Type filter is a DROPDOWN now (was a pill group)
const TRACKING_FILTER_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "quantity", label: "Quantity" },
];

const PRODUCT_STATUS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
];

// Active / Inactive is a DROPDOWN now (was a pill group)
const RECORD_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE_DEFAULT = 10;
const TRUNCATE_LIMIT = 30;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

const emptyForm = {
  category: null,
  name: "",
  gstRate: "",
  warrantyYears: "",
  unit: "",
  stockAlertThreshold: "",
  trackingMethod: "",
  status: "ACTIVE",
  selectedFields: [],
  image: null,     // existing stored path (string) when editing — image OR pdf
  imageFile: null, // new File selected by the user, not yet uploaded
};

/* ---------- shared class tokens (same as PurchaseOrderPage) ---------- */
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const inputErrCls =
  "w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";
const cardTitleCls = "text-xs font-bold uppercase tracking-wider text-slate-600";
const th = "px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-700";
const thRight = `${th} text-right`;

const leafOf = (c) => String(c || "").split("/").pop().trim();
const hasPath = (leaf, path) => Boolean(path) && String(path).trim() !== String(leaf).trim();

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */

async function apiSearchLeafCategories(search) {
  const params = new URLSearchParams({ limit: "100", type: "LEAF" });
  if (search) params.set("search", search);
  const res = await fetch(`${API_BACKEND_URL}/stock/categories/flat?${params.toString()}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load categories");
  return json.data || [];
}

// Fetch a single category by id — used by the redirect=category auto-open flow
// AND by the lockCategory prop flow, so a locked category can show its real
// name/path instead of just holding onto the raw id.
async function apiGetLeafCategoryById(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/categories/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load category");
  return json.data;
}

async function apiFetchGstRates() {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/gst-rates`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load GST rates");
  return json.data || [];
}

async function apiFetchFieldDefinitions() {
  const res = await fetch(`${API_BACKEND_URL}/stock/field-definitions?limit=200`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load field definitions");
  return json.data?.data || json.data || [];
}

// Create/update send multipart/form-data so the optional file travels with the
// payload in one request. The JSON payload is packed into a single "data" field
// (backend parses it via parseBody()) and the file — if any — goes in "image".
// NEVER set Content-Type manually: the browser must set the multipart boundary.
function buildProductDefinitionFormData(payload, uploadFile) {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  if (uploadFile) formData.append("image", uploadFile);
  return formData;
}

async function apiCreateProductDefinition(payload, uploadFile) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions`, {
    method: "POST", credentials: "include", body: buildProductDefinitionFormData(payload, uploadFile),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to create product definition");
  return json.data;
}

async function apiUpdateProductDefinition(id, payload, uploadFile) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, {
    method: "PUT", credentials: "include", body: buildProductDefinitionFormData(payload, uploadFile),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to update product definition");
  return json.data;
}

async function apiGetProductDefinitionById(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product definition");
  return json.data;
}

/*
  ALL list filters are query params — the backend does the filtering (Rule 23).
  NOTE: `trackingMethod` and `productId` are NEW params. Until the service reads
  them (see the handover snippet), they are simply ignored server-side — they
  are NOT filtered in the browser, because a client-side .filter() silently
  breaks limit/total (a page of 10 would render 3 while the count still says 10).
*/
async function apiListProductDefinitions({ page, limit, search, categoryId, productId, trackingMethod, showInactive }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (categoryId) params.set("categoryId", categoryId);
  if (productId) params.set("productId", productId);
  if (trackingMethod) params.set("trackingMethod", trackingMethod);
  if (showInactive) params.set("showInactive", "true");
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions?${params.toString()}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product definitions");
  const items = Array.isArray(json.data) ? json.data : json.data?.data || [];
  const total = json.pagination?.total ?? json.data?.pagination?.total ?? items.length;
  return { items, total };
}

// Products of one category — powers the dependent Product filter dropdown.
async function apiProductsByCategory(categoryId) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions?categoryId=${categoryId}&limit=500`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) return [];
  return Array.isArray(json.data) ? json.data : json.data?.data || [];
}

/*
  Duplicate-name pre-check. This gives the user a clean inline message instead
  of a raw E11000. It is NOT the real guard — two people saving at the same
  instant would both pass this check. The real guard is the compound unique
  index { categoryId, name } (case-insensitive collation) on the model, plus
  the service-level check. See the handover notes.
*/
async function apiNameExistsInCategory(categoryId, name, excludeId) {
  const list = await apiProductsByCategory(categoryId);
  const target = String(name).trim().toLowerCase();
  return list.some((p) => String(p.name).trim().toLowerCase() === target && String(p._id) !== String(excludeId || ""));
}

async function apiSoftDeleteProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, { method: "DELETE", credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete product definition");
  return json.data;
}

async function apiRestoreProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}/restore`, { method: "PATCH", credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to restore product definition");
  return json.data;
}

/* ================================================================== */
/* Primitives                                                          */
/* ================================================================== */

function RequiredMark() {
  return <span className="ml-0.5 text-rose-500">*</span>;
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600">
      <AlertTriangle size={12} /> {message}
    </p>
  );
}

function Banner({ type = "error", children, onClose }) {
  const styles =
    type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const Icon = type === "error" ? AlertTriangle : type === "success" ? Check : AlertTriangle;
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span className="flex items-center gap-2">
        <Icon size={15} className="shrink-0" />
        {children}
      </span>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 transition hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* Portal modal — same as PurchaseOrderPage */
function Modal({ onClose, title, children, maxWidth = "max-w-lg" }) {
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
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <p className="truncate pr-4 text-base font-semibold tracking-tight text-slate-900">{title}</p>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* Truncate + "...more" popup — same as PurchaseOrderPage */
function TruncateText({ text, max = TRUNCATE_LIMIT, title = "Full details", className = "" }) {
  const [open, setOpen] = useState(false);
  const str = text == null || text === "" ? "\u2014" : String(text);
  if (str.length <= max) return <span className={className}>{str}</span>;
  return (
    <>
      <span className={className}>
        {str.slice(0, max)}...
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
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
}

/* Category path popup — opened by every eye button in this screen */
function CategoryPathModal({ label, path, onClose }) {
  return (
    <Modal onClose={onClose} title={label} maxWidth="max-w-md">
      <p className={cardTitleCls}>Full category path</p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-900">{path || "\u2014"}</p>
    </Modal>
  );
}

/* Category cell / chip: leaf NAME + eye button (never the raw path) */
function CategoryLabel({ name, path, onViewPath, className = "" }) {
  const leaf = leafOf(name || path);
  if (!leaf) return <span className="text-slate-400">{"\u2014"}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <TruncateText text={leaf} title="Category" />
      {hasPath(leaf, path) && (
        <button
          type="button" title="View full path"
          onClick={(e) => { e.stopPropagation(); onViewPath({ label: leaf, path }); }}
          className="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-indigo-600"
        >
          <Eye size={14} />
        </button>
      )}
    </span>
  );
}

function StatusPill({ value }) {
  const map = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  const dot = { ACTIVE: "bg-emerald-500", DRAFT: "bg-amber-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${map[value] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[value] || "bg-slate-400"}`} />
      {value}
    </span>
  );
}

function TrackingPill({ value }) {
  const map = {
    individual: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    quantity: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  const dot = { individual: "bg-indigo-500", quantity: "bg-sky-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${map[value] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[value] || "bg-slate-400"}`} />
      {value || "\u2014"}
    </span>
  );
}

/* ================================================================== */
/* Searchable dropdown — reused by every filter and the form picker    */
/* Shows the leaf NAME; the eye button opens the full path.            */
/* ================================================================== */

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "All",
  disabled = false,
  loading = false,
  onSearch,
  renderExtra,
  error,
  buttonClassName,
  selectedLabel, // NEW: fallback label used when options[] doesn't yet contain `value`
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const hasFetchedOnce = useRef(false); // NEW: ensures we fetch once on mount

  // close on outside click
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // NEW: fetch default options once immediately on mount (not only when opened)
  useEffect(() => {
    if (!onSearch || hasFetchedOnce.current) return;
    hasFetchedOnce.current = true;
    onSearch("");
  }, [onSearch]);

  // server-driven search while dropdown is open
  useEffect(() => {
    if (!open || !onSearch) return;
    const t = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, open, onSearch]);

  const selected = options.find((o) => o.value === value);
  // NEW: fallback so the button always shows the right text
  const displayLabel = selected?.label ?? (value ? selectedLabel : null);

  const visible = onSearch
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${error ? inputErrCls : inputCls} flex items-center justify-between text-left ${
          disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
        } ${buttonClassName || ""}`}
      >
        <span className={`truncate ${displayLabel ? "text-slate-900" : "text-slate-400"}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search size={15} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null, null);
                setOpen(false);
                setQuery("");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50"
            >
              {placeholder}
            </button>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" />
                Loading...
              </div>
            )}

            {!loading && visible.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-slate-400">No match</p>
            )}

            {!loading &&
              visible.map((o) => (
                <div
                  key={o.value}
                  className={`flex items-center gap-1 px-2 transition hover:bg-indigo-50/60 ${
                    o.value === value ? "bg-indigo-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value, o);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex flex-1 items-center gap-2 truncate px-1 py-2 text-left text-sm text-slate-800"
                  >
                    {o.value === value && (
                      <Check size={14} className="shrink-0 text-indigo-600" />
                    )}
                    <span className="truncate">{o.label}</span>
                  </button>
                  {renderExtra && renderExtra(o)}
                </div>
              ))}
          </div>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}
/* ================================================================== */
/* Form pieces                                                         */
/* ================================================================== */

function FieldDefinitionMultiSelect({ fields, loading, selectedFields, onToggle, onToggleRequired }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-sm text-slate-400">
        <Loader2 size={15} className="animate-spin" /> Loading field definitions...
      </div>
    );
  }
  if (!fields.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
        No field definitions available
      </div>
    );
  }
  return (
    <div className="grid max-h-64 grid-cols-1 gap-2.5 overflow-y-auto p-1 sm:grid-cols-2">
      {fields.map((field) => {
        const selected = selectedFields.find((sf) => sf.fieldDefId === field._id);
        const checked = Boolean(selected);
        return (
          <div
            key={field._id}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
              checked ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-700"
            }`}
          >
            <button type="button" onClick={() => onToggle(field._id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-indigo-600 bg-indigo-600" : "border-slate-300"}`}>
                {checked && <Check size={11} className="text-white" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  <TruncateText text={field.label} title="Field Label" />
                </span>
                <span className="text-xs text-slate-400">{field.inputType}</span>
              </span>
            </button>
            {checked && (
              <button
                type="button" onClick={() => onToggleRequired(field._id)} title="Toggle required"
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition ${
                  selected.isRequired ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-400"
                }`}
              >
                Req
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Attachment picker — IMAGE or PDF, up to 5 MB (validated here AND by multer) */
function AttachmentUploadField({ existingFile, file, onFileChange, onRemoveExisting, error, onError }) {
  const inputRef = useRef(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file || file.type === "application/pdf") { setLocalPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existingIsPdf = existingFile && isPdfPath(existingFile);
  const showingPdf = (file && file.type === "application/pdf") || (!file && existingIsPdf);
  const previewUrl = localPreviewUrl || (existingFile && !existingIsPdf ? resolveAssetUrl(existingFile) : null);
  const hasSomething = Boolean(file || existingFile);

  const handlePick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!picked) return;

    if (!ACCEPTED_UPLOAD_TYPES.includes(picked.type)) {
      onError("Only JPG, PNG, WEBP or PDF files are allowed");
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      onError(`File is too large (${(picked.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
      return;
    }
    onError(undefined);
    onFileChange(picked);
  };

  return (
    <div>
      <label className={labelCls}>Product Image / PDF</label>
      <div className="flex items-center gap-4">
        <div className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 ${error ? "border-rose-400" : "border-slate-300"}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="Product preview" className="h-full w-full object-cover" />
          ) : showingPdf ? (
            <div className="flex flex-col items-center gap-1 text-rose-500">
              <FileText size={22} />
              <span className="text-xs font-semibold">PDF</span>
            </div>
          ) : (
            <ImageOff size={22} className="text-slate-300" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ImagePlus size={14} />
              {hasSomething ? "Replace File" : "Upload File"}
            </button>
            {hasSomething && !file && existingFile && (
              <a
                href={resolveAssetUrl(existingFile)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50"
              >
                <Eye size={14} /> Open
              </a>
            )}
            {hasSomething && (
              <button
                type="button"
                onClick={() => { onFileChange(null); onRemoveExisting(); onError(undefined); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
              >
                <X size={14} /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "JPG, PNG, WEBP or PDF · up to 5 MB"}
          </p>
        </div>

        <input
          ref={inputRef} type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
          onChange={handlePick} className="hidden"
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function ConfirmDialog({ open, title, description, confirmLabel, loading, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <Modal onClose={loading ? () => {} : onCancel} title={title} maxWidth="max-w-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <AlertTriangle size={18} />
        </span>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          type="button" disabled={loading} onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button" disabled={loading} onClick={onConfirm}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* Fields column popup — click the count, see every field name */
function FieldsPopup({ row, fieldLabelMap, onClose }) {
  const list = (row.selectedFields || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((sf) => {
      const id = sf.fieldDefId?._id || sf.fieldDefId;
      return {
        id,
        label: sf.fieldDefId?.label || fieldLabelMap[id] || "Unknown field",
        inputType: sf.fieldDefId?.inputType || "",
        isRequired: Boolean(sf.isRequired),
      };
    });

  return (
    <Modal onClose={onClose} title={`${row.name} · ${list.length} field${list.length === 1 ? "" : "s"}`} maxWidth="max-w-md">
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No fields selected on this product.</p>
      ) : (
        <div className="space-y-2">
          {list.map((f, i) => (
            <div key={f.id || i} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200 tabular-nums">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-900">{f.label}</span>
                {f.inputType && <span className="shrink-0 text-xs text-slate-400">{f.inputType}</span>}
              </span>
              {f.isRequired && (
                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                  Required
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function RowDetailModal({ row, categoryName, categoryPath, onViewPath, onClose }) {
  if (!row) return null;
  const attachment = row.image;
  const pdf = isPdfPath(attachment);

  const rows = [
    ["Tracking Method", row.trackingMethod],
    ["Fields Count", row.selectedFields?.length ?? 0],
    ["GST Rate", row.gstRate ? `${row.gstRate}%` : "\u2014"],
    ["Warranty", row.warrantyYears ? `${row.warrantyYears} Year${row.warrantyYears === 1 ? "" : "s"}` : "\u2014"],
    ["Unit", row.unit || "\u2014"],
    ["Stock Alert Threshold", row.stockAlertThreshold ?? "\u2014"],
    ["Status", row.status],
    ["Active", row.isActive ? "Yes" : "No"],
    ["Product ID", row._id],
  ];

  return (
    <Modal onClose={onClose} title={row.name} maxWidth="max-w-lg">
      <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {attachment ? (
          pdf ? (
            <a
              href={resolveAssetUrl(attachment)} target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-2 text-rose-500 transition hover:text-rose-600"
            >
              <FileText size={30} />
              <span className="text-xs font-semibold">Open PDF</span>
            </a>
          ) : (
            <img src={resolveAssetUrl(attachment)} alt={row.name} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-300">
            <ImageOff size={26} />
            <span className="text-xs">No file</span>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2">
        <span className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">Category</span>
        <span className="text-right text-sm text-slate-800">
          <CategoryLabel name={categoryName} path={categoryPath} onViewPath={onViewPath} />
        </span>
      </div>

      {rows.map(([label, val]) => (
        <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
          <span className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="break-all text-right text-sm text-slate-800">
            <TruncateText text={val} title={label} />
          </span>
        </div>
      ))}
    </Modal>
  );
}

function TableSkeletonRows({ rows = 6, cols = 7 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3.5">
              <div className={`h-3.5 animate-pulse rounded bg-slate-100 ${c === 0 ? "w-3/4" : "w-1/2"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ onCreate }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <PackageSearch size={32} className="mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No product definitions found</p>
          <p className="mt-1 text-sm text-slate-400">Adjust the filters above, or create a new one.</p>
          {onCreate && (
            <button
              type="button" onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Plus size={15} /> New Product Definition
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ================================================================== */
/* Form                                                                */
/* ================================================================== */

function ProductDefinitionForm({ initialData, categoryLocked, onCancel, onSaved }) {
  const [form, setForm] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pathModal, setPathModal] = useState(null);

  const [gstOptions, setGstOptions] = useState([]);
  const [gstLoading, setGstLoading] = useState(true);

  const [fieldDefs, setFieldDefs] = useState([]);
  const [fieldDefsLoading, setFieldDefsLoading] = useState(false);
  const [fieldDefsLoaded, setFieldDefsLoaded] = useState(false);

  // leaf-category picker options (server-side search)
  const [catOptions, setCatOptions] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  const searchCategories = useCallback(async (q) => {
    setCatLoading(true);
    try {
      const data = await apiSearchLeafCategories(q);
      setCatOptions(data);
    } catch {
      setCatOptions([]);
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadGstRates = useCallback(async () => {
    setGstLoading(true);
    try {
      setGstOptions(await apiFetchGstRates());
    } catch {
      setGstOptions([]);
    } finally {
      setGstLoading(false);
    }
  }, []);

  const loadFieldDefinitions = useCallback(async () => {
    setFieldDefsLoading(true);
    try {
      setFieldDefs(await apiFetchFieldDefinitions());
      setFieldDefsLoaded(true);
    } catch {
      setFieldDefs([]);
    } finally {
      setFieldDefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGstRates();
    if (initialData.trackingMethod) loadFieldDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrackingMethodChange = (value) => {
    setForm((f) => ({ ...f, trackingMethod: value }));
    setErrors((e) => ({ ...e, trackingMethod: undefined }));
    if (!fieldDefsLoaded) loadFieldDefinitions();
  };

  const toggleFieldDef = (fieldDefId) => {
    setForm((f) => {
      const exists = f.selectedFields.some((sf) => sf.fieldDefId === fieldDefId);
      return {
        ...f,
        selectedFields: exists
          ? f.selectedFields.filter((sf) => sf.fieldDefId !== fieldDefId)
          : [...f.selectedFields, { fieldDefId, isRequired: false }],
      };
    });
  };

  const toggleFieldRequired = (fieldDefId) => {
    setForm((f) => ({
      ...f,
      selectedFields: f.selectedFields.map((sf) =>
        sf.fieldDefId === fieldDefId ? { ...sf, isRequired: !sf.isRequired } : sf
      ),
    }));
  };

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!categoryLocked && !form.category) next.category = "Leaf category is required";
    if (!form.name.trim()) next.name = "Product name is required";
    if (!form.trackingMethod) next.trackingMethod = "Please select a tracking method";
    if (!form.selectedFields.length) next.selectedFields = "Select at least one field";
    if (
      !form.warrantyYears ||
      isNaN(Number(form.warrantyYears)) ||
      !Number.isInteger(Number(form.warrantyYears)) ||
      Number(form.warrantyYears) < 1
    ) {
      next.warrantyYears = "Warranty must be a whole number of at least 1 year";
    }
    if (
      form.stockAlertThreshold !== "" &&
      (isNaN(Number(form.stockAlertThreshold)) || Number(form.stockAlertThreshold) < 0)
    ) {
      next.stockAlertThreshold = "Must be a non-negative number";
    }
    if (errors.imageFile) next.imageFile = errors.imageFile; // keep an unresolved upload error
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const categoryId = form.category._id;

      // Product names must be unique WITHIN a category (the same name is fine
      // in a different category). Pre-check for a clean message; the DB compound
      // unique index is the actual guard against a concurrent double-save.
      const duplicate = await apiNameExistsInCategory(categoryId, form.name, form.id);
      if (duplicate) {
        setErrors((e) => ({ ...e, name: "A product with this name already exists in this category" }));
        setSubmitting(false);
        return;
      }

      const basePayload = {
        name: form.name.trim(),
        trackingMethod: form.trackingMethod,
        status: form.status,
        selectedFields: form.selectedFields.map((sf, index) => ({
          fieldDefId: sf.fieldDefId,
          isRequired: sf.isRequired,
          order: index + 1,
        })),
        gstRate: form.gstRate || null,
        warrantyYears: Number(form.warrantyYears),
        unit: form.unit || null,
        stockAlertThreshold: form.stockAlertThreshold === "" ? null : Number(form.stockAlertThreshold),
        // Explicit null tells the backend "clear the file" when the user hit
        // Remove without picking a new one. Omitting the key (undefined) would
        // leave the stored file untouched.
        image: form.imageFile ? undefined : form.image,
      };

      let saved;
      if (form.id) {
        saved = await apiUpdateProductDefinition(form.id, basePayload, form.imageFile);
      } else {
        saved = await apiCreateProductDefinition({ ...basePayload, categoryId }, form.imageFile);
      }
      onSaved(saved, form.id ? "updated" : "created");
    } catch (err) {
      // E11000 from the compound index → show it on the name field, not as a raw dump
      const msg = err.message || "Something went wrong";
      if (/duplicate|E11000/i.test(msg)) {
        setErrors((e) => ({ ...e, name: "A product with this name already exists in this category" }));
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLeaf = form.category ? leafOf(form.category.name || form.category.displayPath) : "";
  const categoryPath = form.category?.displayPath || form.category?.name || "";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button" onClick={onCancel} disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              {form.id ? "Edit Product Definition" : "New Product Definition"}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {form.id
                ? "Category cannot be changed after creation."
                : categoryLocked
                ? "The category is locked for this product definition."
                : "Define a product under a leaf category with its tracking rules and attributes."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="rounded-t-2xl border-b border-slate-100 bg-slate-50/60 px-6 py-3">
            <p className={cardTitleCls}>Product details</p>
          </div>

          <div className="space-y-6 p-6">
            {/* Leaf category — shows the NAME; the eye button reveals the path */}
            <div>
              <label className={labelCls}>
                Leaf Category
                {!categoryLocked && <RequiredMark />}
              </label>

              {categoryLocked ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <CategoryLabel name={categoryLeaf} path={categoryPath} onViewPath={setPathModal} />
                  <span className="text-xs font-medium text-slate-400">Locked</span>
                </div>
              ) : (
                <SearchableSelect
                  value={form.category?._id || ""}
                  onChange={(_val, option) => updateField("category", option ? option.raw : null)}
                  options={catOptions.map((c) => ({
                    value: c._id,
                    label: c.name,                       // NAME only, not the path
                    path: c.displayPath || c.name,
                    raw: c,
                  }))}
                  onSearch={searchCategories}
                  loading={catLoading}
                  placeholder="Select a leaf category"
                  error={errors.category}
                  renderExtra={(o) =>
                    hasPath(o.label, o.path) ? (
                      <button
                        type="button" title="View full path"
                        onClick={(e) => { e.stopPropagation(); setPathModal({ label: o.label, path: o.path }); }}
                        className="shrink-0 rounded p-1 text-slate-400 transition hover:text-indigo-600"
                      >
                        <Eye size={14} />
                      </button>
                    ) : null
                  }
                />
              )}

              {!categoryLocked && form.category && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
                  Selected: <CategoryLabel name={categoryLeaf} path={categoryPath} onViewPath={setPathModal} />
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Product Name
                <RequiredMark />
              </label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Poco M2 Pro"
                className={errors.name ? inputErrCls : inputCls}
              />
              <FieldError message={errors.name} />
              <p className="mt-1 text-xs text-slate-400">
                Must be unique within this category. The same name is allowed in a different category.
              </p>
            </div>

            <AttachmentUploadField
              existingFile={form.image}
              file={form.imageFile}
              onFileChange={(file) => setForm((f) => ({ ...f, imageFile: file }))}
              onRemoveExisting={() => setForm((f) => ({ ...f, image: null, imageFile: null }))}
              error={errors.imageFile}
              onError={(msg) => setErrors((e) => ({ ...e, imageFile: msg }))}
            />

            <div>
              <label className={labelCls}>Status</label>
              <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                {PRODUCT_STATUS.map((s) => (
                  <button
                    key={s.value} type="button" onClick={() => updateField("status", s.value)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                      form.status === s.value ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
              <div>
                <label className={labelCls}>GST</label>
                <select
                  value={form.gstRate} onChange={(e) => updateField("gstRate", e.target.value)} disabled={gstLoading}
                  className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">{gstLoading ? "Loading..." : "Select GST rate"}</option>
                  {gstOptions.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Warranty (Years)
                  <RequiredMark />
                </label>
                <input
                  type="number" min="1" step="1" value={form.warrantyYears}
                  onChange={(e) => updateField("warrantyYears", e.target.value)}
                  placeholder="e.g. 1"
                  className={errors.warrantyYears ? inputErrCls : inputCls}
                />
                <FieldError message={errors.warrantyYears} />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <select value={form.unit} onChange={(e) => updateField("unit", e.target.value)} className={inputCls}>
                  <option value="">Select unit</option>
                  {UNIT_TYPES.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Stock Alert Threshold</label>
                <input
                  type="number" min="0" value={form.stockAlertThreshold}
                  onChange={(e) => updateField("stockAlertThreshold", e.target.value)}
                  placeholder="e.g. 5"
                  className={errors.stockAlertThreshold ? inputErrCls : inputCls}
                />
                <FieldError message={errors.stockAlertThreshold} />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Tracking Method
                <RequiredMark />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TRACKING_METHODS.map((method) => {
                  const checked = form.trackingMethod === method.value;
                  return (
                    <button
                      type="button" key={method.value} onClick={() => handleTrackingMethodChange(method.value)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        checked ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-indigo-600" : "border-slate-300"}`}>
                          {checked && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                        </span>
                        <span className={`text-sm font-medium ${checked ? "text-indigo-700" : "text-slate-800"}`}>
                          {method.label}
                        </span>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-slate-400">{method.description}</p>
                    </button>
                  );
                })}
              </div>
              <FieldError message={errors.trackingMethod} />
            </div>

            {form.trackingMethod && (
              <div>
                <label className={labelCls}>
                  Applicable Fields
                  <RequiredMark />
                  <span className="ml-2 text-xs font-normal text-slate-400">({form.selectedFields.length} selected)</span>
                </label>
                <FieldDefinitionMultiSelect
                  fields={fieldDefs}
                  loading={fieldDefsLoading}
                  selectedFields={form.selectedFields}
                  onToggle={toggleFieldDef}
                  onToggleRequired={toggleFieldRequired}
                />
                <FieldError message={errors.selectedFields} />
              </div>
            )}

            {submitError && <Banner type="error">{submitError}</Banner>}

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button" onClick={onCancel} disabled={submitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button" disabled={submitting} onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {submitting ? "Saving..." : form.id ? "Save Changes" : "Save Product Definition"}
              </button>
            </div>
          </div>
        </div>

        {pathModal && (
          <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Row actions — icon buttons + overflow menu                          */
/* ================================================================== */

function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!items.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button" title="More actions" onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl ring-1 ring-slate-900/5">
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
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

export default function ProductDefinition({ categoryId, lockCategory }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // When lockCategory is on, the passed-in categoryId is the one and only
  // category this screen works with — it wins over any URL param.
  const isCategoryLocked = Boolean(lockCategory && categoryId);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE_DEFAULT);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [recordStatus, setRecordStatus] = useState("active"); // dropdown now
  const [categoryFilter, setCategoryFilter] = useState(
    isCategoryLocked ? categoryId : searchParams.get("categoryId") || ""
  );
  const [productFilter, setProductFilter] = useState("");     // dependent on category
  const [trackingFilter, setTrackingFilter] = useState("");   // dropdown now

  const [leafCategories, setLeafCategories] = useState([]);
  const [catSearchLoading, setCatSearchLoading] = useState(false);
  const [productOptions, setProductOptions] = useState([]);
  const [productOptionsLoading, setProductOptionsLoading] = useState(false);

  // Locked-category display info (name + path) — fetched once so the disabled
  // select and the table's Category column show the real name, not the raw id.
  const [lockedCategory, setLockedCategory] = useState(null);

  const [fieldLabelMap, setFieldLabelMap] = useState({});

  const [view, setView] = useState("list");
  const [formMode, setFormMode] = useState("create");
  const [formInitialData, setFormInitialData] = useState(emptyForm);
  const [formLoadingRow, setFormLoadingRow] = useState(null);

  const [detailRow, setDetailRow] = useState(null);
  const [fieldsPopupRow, setFieldsPopupRow] = useState(null);
  const [pathModal, setPathModal] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [toast, setToast] = useState(null);

  const updateCategoryFilter = (nextCategoryId) => {
    // Locked mode: the category can never change away from the passed-in id.
    if (isCategoryLocked) return;
    setCategoryFilter(nextCategoryId);
    setProductFilter(""); // dependent filter resets with its parent
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (nextCategoryId) params.set("categoryId", nextCategoryId);
    else params.delete("categoryId");
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Locked mode: resolve the category's real name/path once for display.
  useEffect(() => {
    if (!isCategoryLocked) { setLockedCategory(null); return; }
    let cancelled = false;
    (async () => {
      // Sensible fallback if the lookup fails — the id still filters correctly.
      let cat = { _id: categoryId, name: "Selected category", displayPath: "Selected category" };
      try {
        const full = await apiGetLeafCategoryById(categoryId);
        cat = { _id: full._id, name: full.name, displayPath: full.displayPath || full.name };
      } catch {
        // keep the fallback
      }
      if (!cancelled) setLockedCategory(cat);
    })();
    return () => { cancelled = true; };
  }, [isCategoryLocked, categoryId]);

  // Locked mode: if the prop's categoryId ever changes, follow it.
  useEffect(() => {
    if (isCategoryLocked) {
      setCategoryFilter(categoryId);
      setProductFilter("");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCategoryLocked, categoryId]);

  // leaf categories for the filter dropdown (server-side search as you type)
  const searchCategories = useCallback(async (q) => {
    setCatSearchLoading(true);
    try {
      setLeafCategories(await apiSearchLeafCategories(q));
    } catch {
      setLeafCategories([]);
    } finally {
      setCatSearchLoading(false);
    }
  }, []);

  useEffect(() => { searchCategories(""); }, [searchCategories]);

  // field definitions → id→label map, so the Fields popup can name every field
  // even when the backend doesn't populate selectedFields.fieldDefId.
  useEffect(() => {
    (async () => {
      try {
        const defs = await apiFetchFieldDefinitions();
        const map = {};
        defs.forEach((d) => { map[d._id] = d.label; });
        setFieldLabelMap(map);
      } catch {
        setFieldLabelMap({});
      }
    })();
  }, []);

  // Product filter is DEPENDENT: options only exist once a category is chosen.
  useEffect(() => {
    (async () => {
      if (!categoryFilter) { setProductOptions([]); return; }
      setProductOptionsLoading(true);
      try {
        setProductOptions(await apiProductsByCategory(categoryFilter));
      } catch {
        setProductOptions([]);
      } finally {
        setProductOptionsLoading(false);
      }
    })();
  }, [categoryFilter]);

  // id → { name, path } for the Category column (locked category included so
  // the table can name it even if it's missing from the searched-100 list)
  const categoryMap = useMemo(() => {
    const map = {};
    leafCategories.forEach((c) => {
      map[c._id] = { name: c.name, path: c.displayPath || c.name };
    });
    if (lockedCategory) {
      map[lockedCategory._id] = { name: lockedCategory.name, path: lockedCategory.displayPath };
    }
    return map;
  }, [leafCategories, lockedCategory]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const { items: fetched, total: fetchedTotal } = await apiListProductDefinitions({
        page,
        limit,
        search,
        categoryId: categoryFilter || undefined,
        productId: productFilter || undefined,
        trackingMethod: trackingFilter || undefined,
        showInactive: recordStatus === "inactive",
      });

      // KNOWN CONSTRAINT (unchanged — same as Field Definitions / Vendors):
      // showInactive only supports "everything" vs "active only" server-side,
      // so the Inactive view still narrows here. Every OTHER filter (search,
      // category, product, tracking) is applied by the backend so that
      // limit/total stay correct.
      const visible = recordStatus === "inactive" ? fetched.filter((d) => !d.isActive) : fetched;

      setItems(visible);
      setTotal(fetchedTotal);
    } catch (err) {
      setListError(err.message || "Failed to load product definitions");
      setItems([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, search, categoryFilter, productFilter, trackingFilter, recordStatus]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setFormMode("create");
    // Locked mode: pre-fill AND lock the category on the create form too.
    setFormInitialData({
      ...emptyForm,
      id: null,
      category: isCategoryLocked
        ? (lockedCategory || { _id: categoryId, name: "Selected category", displayPath: "Selected category" })
        : null,
    });
    setView("form");
  };

  // ------------------------------------------------------------------
  // Auto-open: ?redirect=category&categoryId=XXXX
  // When someone lands here with these two params, skip the list entirely
  // and open "New Product Definition" straight away with that category
  // pre-selected — no extra click needed.
  // ------------------------------------------------------------------
  const autoRedirectHandled = useRef(false);

  useEffect(() => {
    if (autoRedirectHandled.current) return;

    const redirect = searchParams.get("redirect");
    const redirectCategoryId = searchParams.get("categoryId");
    if (redirect !== "category" || !redirectCategoryId) return;

    autoRedirectHandled.current = true;

    (async () => {
      // Reasonable placeholder in case the category lookup fails — the id is
      // still valid and the form will submit correctly against it.
      let categoryObj = {
        _id: redirectCategoryId,
        name: "Selected category",
        displayPath: "Selected category",
      };

      try {
        const full = await apiGetLeafCategoryById(redirectCategoryId);
        categoryObj = {
          _id: full._id,
          name: full.name,
          displayPath: full.displayPath || full.name,
        };
      } catch {
        // keep the placeholder above
      }

      setFormMode("create");
      setFormInitialData({ ...emptyForm, id: null, category: categoryObj });
      setView("form");

      // Strip redirect/categoryId from the URL so navigating back to the list
      // (or refreshing) doesn't re-trigger this auto-open.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("redirect");
      params.delete("categoryId");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = async (row) => {
    setFormLoadingRow(row._id);
    try {
      const full = await apiGetProductDefinitionById(row._id);
      const cat = categoryMap[full.categoryId];

      setFormInitialData({
        id: full._id,
        category: cat
          ? { _id: full.categoryId, name: cat.name, displayPath: cat.path }
          : { _id: full.categoryId, name: "Existing category", displayPath: "Existing category" },
        name: full.name || "",
        gstRate: full.gstRate ?? "",
        warrantyYears: full.warrantyYears ?? "",
        unit: full.unit ?? "",
        stockAlertThreshold: full.stockAlertThreshold ?? "",
        trackingMethod: full.trackingMethod || "",
        status: full.status || "ACTIVE",
        image: full.image || null,
        imageFile: null,
        selectedFields: (full.selectedFields || [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((sf) => ({
            fieldDefId: sf.fieldDefId?._id || sf.fieldDefId,
            isRequired: Boolean(sf.isRequired),
          })),
      });
      setFormMode("edit");
      setView("form");
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to load product definition" });
    } finally {
      setFormLoadingRow(null);
    }
  };

  const closeForm = () => setView("list");

  const handleSaved = (_saved, action) => {
    setView("list");
    setToast({
      type: "success",
      message: action === "created" ? "Product definition created successfully." : "Product definition updated successfully.",
    });
    if (action === "created") setPage(1);
    loadList();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiSoftDeleteProductDefinition(deleteTarget._id);
      setToast({ type: "success", message: `"${deleteTarget.name}" was deleted.` });
      setDeleteTarget(null);
      loadList();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to delete product definition" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (row) => {
    setRestoringId(row._id);
    try {
      await apiRestoreProductDefinition(row._id);
      setToast({ type: "success", message: `"${row.name}" was restored.` });
      loadList();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to restore product definition" });
    } finally {
      setRestoringId(null);
    }
  };

  // Locked mode: the locked category itself never counts as an "active filter".
  const hasActiveFilters =
    Boolean(searchInput) ||
    (Boolean(categoryFilter) && !isCategoryLocked) ||
    Boolean(productFilter) ||
    Boolean(trackingFilter) ||
    recordStatus !== "active";

  const clearFilters = () => {
    setSearchInput("");
    setTrackingFilter("");
    setProductFilter("");
    setRecordStatus("active");
    setPage(1);
    if (isCategoryLocked) {
      // keep the locked category — only the other filters reset
      setCategoryFilter(categoryId);
    } else {
      updateCategoryFilter("");
    }
  };

  if (view === "form") {
    return (
      <ProductDefinitionForm
        key={formInitialData.id || "create"}
        initialData={formInitialData}
        categoryLocked={formMode === "edit" || (formMode === "create" && isCategoryLocked)}
        onCancel={closeForm}
        onSaved={handleSaved}
      />
    );
  }

  return (
   <div className={`min-h-screen bg-slate-50/60 ${lockCategory ? "" : "p-6"}`}>
      {/* page header */}
      {!lockCategory && (
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Product Definitions</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Define products under leaf categories with tracking rules and attributes.
          </p>
        </div>
        <button
          type="button" onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <Plus size={16} /> New Product Definition
        </button>
      </div>
      )}
    
      {toast && (
        <div className="mb-4">
          <Banner type={toast.type} onClose={() => setToast(null)}>{toast.message}</Banner>
        </div>
      )}

      {/* SINGLE FILTER ROW — search · category · product · type · active/inactive · reset */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {/* Search */}
          <div className="relative min-w-0 flex-1 xl:basis-64">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name..."
              className={`${inputCls} pl-9`}
            />
          </div>

          {/* Category — searchable, shows NAME, eye button reveals the path.
              Locked mode: disabled + always shows the locked category's name. */}
          <div className="min-w-0 flex-1 xl:basis-48">
            <SearchableSelect
              value={categoryFilter}
              onChange={(v) => updateCategoryFilter(v)}
              options={leafCategories.map((c) => ({
                value: c._id,
                label: c.name,
                path: c.displayPath || c.name,
              }))}
              onSearch={searchCategories}
              loading={catSearchLoading}
              disabled={isCategoryLocked}
              selectedLabel={isCategoryLocked ? lockedCategory?.name || "Selected category" : undefined}
              placeholder="All categories"
              renderExtra={(o) =>
                hasPath(o.label, o.path) ? (
                  <button
                    type="button" title="View full path"
                    onClick={(e) => { e.stopPropagation(); setPathModal({ label: o.label, path: o.path }); }}
                    className="shrink-0 rounded p-1 text-slate-400 transition hover:text-indigo-600"
                  >
                    <Eye size={14} />
                  </button>
                ) : null
              }
            />
          </div>

          {/* Product — DEPENDENT on the category */}
          <div className="min-w-0 flex-1 xl:basis-48">
            <SearchableSelect
              value={productFilter}
              onChange={(v) => { setProductFilter(v); setPage(1); }}
              options={productOptions.map((p) => ({ value: p._id, label: p.name }))}
              loading={productOptionsLoading}
              disabled={!categoryFilter}
              placeholder={categoryFilter ? "All products" : "Select a category first"}
            />
          </div>

          {/* Type */}
          <div className="min-w-0 flex-1 xl:basis-40">
            <SearchableSelect
              value={trackingFilter}
              onChange={(v) => { setTrackingFilter(v); setPage(1); }}
              options={TRACKING_FILTER_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
              placeholder="All types"
            />
          </div>

          {/* Active / Inactive */}
          <div className="min-w-0 flex-1 xl:basis-40">
            <SearchableSelect
              value={recordStatus}
              onChange={(v) => { setRecordStatus(v || "active"); setPage(1); }}
              options={RECORD_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Active"
            />
          </div>

          {/* Total + Reset */}
          <div className="flex shrink-0 items-center justify-end gap-3">
            <span className="text-xs font-semibold text-slate-400 tabular-nums">{total} total</span>
            {hasActiveFilters && (
              <button
                type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-400 hover:bg-rose-100"
              >
                <RotateCcw size={15} /> Reset
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
              <th className={th}>Name</th>
              <th className={th}>Category</th>
              <th className={th}>Tracking</th>
              <th className={th}>Fields</th>
              <th className={th}>GST / Unit</th>
              <th className={th}>Status</th>
              <th className={thRight}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listLoading && <TableSkeletonRows />}

            {!listLoading && listError && (
              <tr>
                <td colSpan={7} className="px-4 py-10">
                  <Banner type="error">{listError}</Banner>
                </td>
              </tr>
            )}

            {!listLoading && !listError && items.length === 0 && <EmptyState onCreate={openCreate} />}

            {!listLoading &&
              !listError &&
              items.map((row) => {
                const cat = categoryMap[row.categoryId];
                const fieldCount = row.selectedFields?.length ?? 0;
                return (
                  <tr
                    key={row._id}
                    onClick={() => setDetailRow(row)}
                    className="cursor-pointer transition hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {row.image ? (
                            isPdfPath(row.image) ? (
                              <FileText size={15} className="text-rose-500" />
                            ) : (
                              <img src={resolveAssetUrl(row.image)} alt={row.name} className="h-full w-full object-cover" />
                            )
                          ) : (
                            <ImageOff size={14} className="text-slate-300" />
                          )}
                        </div>
                        <span className="font-medium text-slate-900">
                          <TruncateText text={row.name} title="Product name" />
                        </span>
                      </div>
                    </td>

                    {/* Category — leaf NAME + eye button → full path */}
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      <CategoryLabel name={cat?.name} path={cat?.path} onViewPath={setPathModal} />
                    </td>

                    <td className="px-4 py-3.5">
                      <TrackingPill value={row.trackingMethod} />
                    </td>

                    {/* Fields — click the count to see every field name */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {fieldCount === 0 ? (
                        <span className="text-sm text-slate-400">0</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFieldsPopupRow(row)}
                          title="View all fields"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <span className="tabular-nums">{fieldCount}</span>
                          <span className="font-medium text-slate-400">field{fieldCount === 1 ? "" : "s"}</span>
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums">
                      {row.gstRate ? `${row.gstRate}%` : "\u2014"}
                      {row.unit ? ` \u00b7 ${row.unit}` : ""}
                      {row.warrantyYears ? ` \u00b7 ${row.warrantyYears}yr` : ""}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill value={row.status} />
                        {!row.isActive && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Deleted
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {row.isActive ? (
                          <>
                            <button
                              type="button" onClick={() => openEdit(row)} disabled={formLoadingRow === row._id} title="Edit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                            >
                              {formLoadingRow === row._id ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                            </button>
                            <RowMenu items={[{ label: "Delete", tone: "red", onClick: () => setDeleteTarget(row) }]} />
                          </>
                        ) : (
                          <button
                            type="button" onClick={() => handleRestore(row)} disabled={restoringId === row._id} title="Restore"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {restoringId === row._id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!listLoading && !listError && items.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              currentPage={page}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            />
          </div>
        )}
      </div>

      {detailRow && (
        <RowDetailModal
          row={detailRow}
          categoryName={categoryMap[detailRow.categoryId]?.name}
          categoryPath={categoryMap[detailRow.categoryId]?.path}
          onViewPath={setPathModal}
          onClose={() => setDetailRow(null)}
        />
      )}

      {fieldsPopupRow && (
        <FieldsPopup row={fieldsPopupRow} fieldLabelMap={fieldLabelMap} onClose={() => setFieldsPopupRow(null)} />
      )}

      {pathModal && (
        <CategoryPathModal label={pathModal.label} path={pathModal.path} onClose={() => setPathModal(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product definition?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be soft-deleted and hidden from active lists. This is blocked if active inventory items still reference it.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}