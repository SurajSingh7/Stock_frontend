"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Search,
  Check,
  Loader2,
  X,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  PackageSearch,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Sparkles,
  ImagePlus,
  ImageOff,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

import Pagination from "@/shared/ui/pagination/Pagination";

// The backend serves uploaded images from /uploads/... (static, NOT under
// /api/v1) — see stock.upload.helper.js. API_BACKEND_URL already ends in
// /api/v1, so strip that to get the plain origin for building image URLs.
const ASSET_BASE_URL = API_BACKEND_URL.replace(/\/api\/v1\/?$/, "");
function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${ASSET_BASE_URL}${imagePath}`;
}

const UNIT_TYPES = [
  { value: "pieces", label: "Pieces" },
  { value: "meter", label: "Meter" },
  { value: "kg", label: "Kg" },
  { value: "box", label: "Box" },
  { value: "litre", label: "Litre" },
  { value: "dozen", label: "Dozen" },
];

const TRACKING_METHODS = [
  {
    value: "individual",
    label: "Individual",
    description: "Each unit tracked separately (serial no., IMEI, etc.)",
  },
  {
    value: "quantity",
    label: "Quantity",
    description: "Tracked as a bulk quantity (notebooks, pens, cables, etc.)",
  },
];

const TRACKING_FILTER_TABS = [
  { value: "", label: "All Types" },
  { value: "individual", label: "Individual" },
  { value: "quantity", label: "Quantity" },
];

const PRODUCT_STATUS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
];

const STATUS_TABS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE_DEFAULT = 10;
const TRUNCATE_LIMIT = 30;

const emptyForm = {
  category: null,
  name: "",
  companyUseOnly: false,
  gstRate: "",
  unit: "",
  stockAlertThreshold: "",
  trackingMethod: "",
  status: "ACTIVE",
  selectedFields: [],
  image: null, // existing image URL/path (string) when editing
  imageFile: null, // new File selected by the user, not yet uploaded
};

async function apiSearchLeafCategories(search) {
  const params = new URLSearchParams({ limit: "100", type: "LEAF" });
  if (search) params.set("search", search);
  const res = await fetch(`${API_BACKEND_URL}/stock/categories/flat?${params.toString()}`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load categories");
  return json.data || [];
}

async function apiFetchGstRates() {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/gst-rates`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load GST rates");
  return json.data || [];
}

async function apiFetchFieldDefinitions() {
  const res = await fetch(`${API_BACKEND_URL}/stock/field-definitions?limit=200`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load field definitions");
  return json.data?.data || json.data || [];
}

// Both create/update now send multipart/form-data instead of raw JSON so the
// optional image file can travel alongside the payload in one request. The
// JSON payload is packed into a single "data" field (backend parses it via
// parseBody() in the controller) and the file — if any — goes in "image".
// IMPORTANT: never set a Content-Type header manually here — the browser
// must set it (including the multipart boundary) itself.
function buildProductDefinitionFormData(payload, imageFile) {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  if (imageFile) formData.append("image", imageFile);
  return formData;
}

async function apiCreateProductDefinition(payload, imageFile) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions`, {
    method: "POST",
    credentials: "include",
    body: buildProductDefinitionFormData(payload, imageFile),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to create product definition");
  return json.data;
}

async function apiUpdateProductDefinition(id, payload, imageFile) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, {
    method: "PUT",
    credentials: "include",
    body: buildProductDefinitionFormData(payload, imageFile),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to update product definition");
  return json.data;
}

async function apiGetProductDefinitionById(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product definition");
  return json.data;
}

async function apiListProductDefinitions({ page, limit, search, categoryId, showInactive }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (categoryId) params.set("categoryId", categoryId);
  if (showInactive) params.set("showInactive", "true");
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions?${params.toString()}`, {
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to load product definitions");
  const items = Array.isArray(json.data) ? json.data : json.data?.data || [];
  const total = json.pagination?.total ?? json.data?.pagination?.total ?? items.length;
  return { items, total };
}

async function apiSoftDeleteProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete product definition");
  return json.data;
}

async function apiRestoreProductDefinition(id) {
  const res = await fetch(`${API_BACKEND_URL}/stock/product-definitions/${id}/restore`, {
    method: "PATCH",
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to restore product definition");
  return json.data;
}

function RequiredMark() {
  return <span className="text-rose-500 ml-0.5">*</span>;
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-rose-500">{message}</p>;
}

function Banner({ type = "error", children, onClose }) {
  const styles =
    type === "error"
      ? "bg-rose-50 text-rose-600 border border-rose-200"
      : type === "success"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "bg-amber-50 text-amber-700 border border-amber-200";
  const Icon = type === "error" ? X : type === "success" ? Check : AlertTriangle;
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm shadow-sm ${styles}`}>
      <span className="flex items-center gap-2">
        <Icon size={15} className="shrink-0" />
        {children}
      </span>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function StatusPill({ value }) {
  const map = {
    ACTIVE: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-200",
    DRAFT: "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-200",
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${map[value] || "bg-gray-100 text-gray-600"}`}>
      {value}
    </span>
  );
}

function TrackingPill({ value }) {
  const map = {
    individual: "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-200",
    quantity: "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-sm shadow-sky-200",
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${map[value] || "bg-gray-100 text-gray-600"}`}>
      {value || "\u2014"}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, labelYes = "Yes", labelNo = "No" }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
          ${checked ? "bg-gradient-to-r from-indigo-600 to-violet-600" : "bg-gray-300"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
      <span className="text-sm font-medium text-gray-700">{checked ? labelYes : labelNo}</span>
    </div>
  );
}

function TruncatedText({ text, limit = TRUNCATE_LIMIT, label = "Value" }) {
  const [open, setOpen] = useState(false);
  const value = text == null || text === "" ? "\u2014" : String(text);
  const isLong = value.length > limit;

  if (!isLong) return <span>{value}</span>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
        title="Click to view full value"
      >
        {value.slice(0, limit)}...
        <Eye size={13} className="shrink-0" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-indigo-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-gray-900">{label}</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
              {value}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function SearchableCategoryDropdown({ value, onChange, error, disabled, placeholder = "Select a leaf category" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const loadOptions = useCallback(async (search) => {
    setLoading(true);
    try {
      const data = await apiSearchLeafCategories(search);
      setOptions(data);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => loadOptions(query), 300);
    return () => clearTimeout(timeout);
  }, [query, open, loadOptions]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        Leaf Category
        {!disabled && <RequiredMark />}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-white text-left text-sm shadow-sm transition-colors
          ${error ? "border-rose-400" : "border-gray-300 hover:border-indigo-400"}
          ${open ? "ring-2 ring-indigo-500 border-indigo-500" : ""}
          ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed hover:border-gray-300" : ""}`}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? value.displayPath || value.name : placeholder}
        </span>
        {!disabled && <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
            <Search size={15} className="text-indigo-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leaf categories..."
              className="w-full text-sm outline-none placeholder:text-gray-400 bg-transparent"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                <Loader2 size={15} className="animate-spin" /> Loading...
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-400">No leaf categories found</div>
            )}
            {!loading &&
              options.map((cat) => (
                <button
                  type="button"
                  key={cat._id}
                  onClick={() => {
                    onChange(cat);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors
                    ${value?._id === cat._id ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                >
                  <span className="truncate">{cat.displayPath || cat.name}</span>
                  {value?._id === cat._id && <Check size={15} className="text-indigo-600 shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}

function FieldDefinitionMultiSelect({ fields, loading, selectedFields, onToggle, onToggleRequired }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        <Loader2 size={15} className="animate-spin" /> Loading field definitions...
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div className="py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No field definitions available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
      {fields.map((field) => {
        const selected = selectedFields.find((sf) => sf.fieldDefId === field._id);
        const checked = Boolean(selected);
        return (
          <div
            key={field._id}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-left text-sm transition-colors
              ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-gray-200 text-gray-700"}`}
          >
            <button type="button" onClick={() => onToggle(field._id)} className="flex items-center gap-2.5 text-left flex-1 min-w-0">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border
                  ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}
              >
                {checked && <Check size={11} className="text-white" />}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-medium truncate">
                  <TruncatedText text={field.label} label="Field Label" />
                </span>
                <span className="text-xs text-gray-400">{field.inputType}</span>
              </span>
            </button>
            {checked && (
              <button
                type="button"
                onClick={() => onToggleRequired(field._id)}
                title="Toggle required"
                className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors
                  ${selected.isRequired ? "bg-indigo-600 text-white" : "bg-white text-gray-400 border border-gray-200"}`}
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

/* Image picker with drag/click-to-upload, preview, and remove. Works for
   both a brand-new File (create) and an existing stored path (edit). */
function ImageUploadField({ existingImage, file, onFileChange, onRemoveExisting, error }) {
  const inputRef = useRef(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = localPreviewUrl || (existingImage ? resolveImageUrl(existingImage) : null);

  const handlePick = (e) => {
    const picked = e.target.files?.[0];
    if (picked) onFileChange(picked);
    e.target.value = ""; // allow re-selecting the same file later
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Image</label>
      <div className="flex items-center gap-4">
        <div
          className={`relative h-24 w-24 shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-gray-50
            ${error ? "border-rose-400" : "border-gray-300"}`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Product preview" className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={22} className="text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <ImagePlus size={14} />
              {previewUrl ? "Replace Image" : "Upload Image"}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => {
                  onFileChange(null);
                  onRemoveExisting();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <X size={14} /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, or WEBP · up to 5MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={handlePick}
          className="hidden"
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function ConfirmDialog({ open, title, description, confirmLabel, tone = "danger", loading, onConfirm, onCancel }) {
  if (!open) return null;
  const confirmClasses =
    tone === "danger"
      ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700"
      : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${confirmClasses}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowDetailModal({ row, categoryLabel, onClose }) {
  if (!row) return null;
  const rows = [
    ["Name", row.name],
    ["Category", categoryLabel],
    ["Tracking Method", row.trackingMethod],
    ["Fields Count", row.selectedFields?.length ?? 0],
    ["GST Rate", row.gstRate ? `${row.gstRate}%` : "\u2014"],
    ["Unit", row.unit || "\u2014"],
    ["Stock Alert Threshold", row.stockAlertThreshold ?? "\u2014"],
    ["Company Use Only", row.companyUseOnly ? "Yes" : "No"],
    ["Status", row.status],
    ["Active", row.isActive ? "Yes" : "No"],
    ["Product ID", row._id],
    ["Category ID", row.categoryId],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-indigo-100">
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="text-base font-bold">Product Details</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-3">
          <div className="h-40 w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center mb-1">
            {row.image ? (
              <img src={resolveImageUrl(row.image)} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-gray-300">
                <ImageOff size={26} />
                <span className="text-xs">No image</span>
              </div>
            )}
          </div>
          {rows.map(([label, val]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-40">{label}</span>
              <span className="text-sm text-gray-800 text-right break-all">
                <TruncatedText text={val} limit={TRUNCATE_LIMIT} label={label} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableSkeletonRows({ rows = 6, cols = 7 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3.5">
              <div className="h-3.5 rounded bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse" style={{ width: c === 0 ? "70%" : "50%" }} />
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
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white mb-3 shadow-lg shadow-indigo-200">
            <PackageSearch size={22} />
          </span>
          <p className="text-sm font-semibold text-gray-700">No product definitions found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters, or create a new one.</p>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-md shadow-indigo-200"
            >
              <Plus size={15} /> New Product Definition
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ProductDefinitionForm({ initialData, categoryLocked, onCancel, onSaved }) {
  const [form, setForm] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [gstOptions, setGstOptions] = useState([]);
  const [gstLoading, setGstLoading] = useState(true);

  const [fieldDefs, setFieldDefs] = useState([]);
  const [fieldDefsLoading, setFieldDefsLoading] = useState(false);
  const [fieldDefsLoaded, setFieldDefsLoaded] = useState(false);

  const loadGstRates = useCallback(async () => {
    setGstLoading(true);
    try {
      const data = await apiFetchGstRates();
      setGstOptions(data);
    } catch {
      setGstOptions([]);
    } finally {
      setGstLoading(false);
    }
  }, []);

  const loadFieldDefinitions = useCallback(async () => {
    setFieldDefsLoading(true);
    try {
      const data = await apiFetchFieldDefinitions();
      setFieldDefs(data);
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
      form.stockAlertThreshold !== "" &&
      (isNaN(Number(form.stockAlertThreshold)) || Number(form.stockAlertThreshold) < 0)
    )
      next.stockAlertThreshold = "Must be a non-negative number";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const basePayload = {
        name: form.name.trim(),
        trackingMethod: form.trackingMethod,
        status: form.status,
        selectedFields: form.selectedFields.map((sf, index) => ({
          fieldDefId: sf.fieldDefId,
          isRequired: sf.isRequired,
          order: index + 1,
        })),
        companyUseOnly: form.companyUseOnly,
        gstRate: form.gstRate || null,
        unit: form.unit || null,
        stockAlertThreshold: form.stockAlertThreshold === "" ? null : Number(form.stockAlertThreshold),
        // Explicit null tells the backend "clear the image" when the user hit
        // Remove on an existing image without picking a new file. Omitting
        // the key entirely (undefined) would leave the stored image untouched.
        image: form.imageFile ? undefined : form.image,
      };

      let saved;
      if (form.id) {
        saved = await apiUpdateProductDefinition(form.id, basePayload, form.imageFile);
      } else {
        saved = await apiCreateProductDefinition(
          { ...basePayload, categoryId: form.category._id },
          form.imageFile
        );
      }
      onSaved(saved, form.id ? "updated" : "created");
    } catch (err) {
      setSubmitError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 shadow-sm disabled:opacity-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {form.id ? "Edit Product Definition" : "New Product Definition"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {form.id
              ? "Category cannot be changed after creation."
              : "Define a product under a leaf category with its tracking rules and attributes."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <SearchableCategoryDropdown
          value={form.category}
          onChange={(cat) => updateField("category", cat)}
          error={errors.category}
          disabled={categoryLocked}
          placeholder={categoryLocked ? undefined : "Select a leaf category"}
        />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Product Name
            <RequiredMark />
          </label>
          <input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. Poco M2 Pro"
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm shadow-sm outline-none transition-colors
              ${errors.name ? "border-rose-400" : "border-gray-300 focus:border-indigo-500"}
              focus:ring-2 focus:ring-indigo-500/30`}
          />
          <FieldError message={errors.name} />
        </div>

        <ImageUploadField
          existingImage={form.image}
          file={form.imageFile}
          onFileChange={(file) => setForm((f) => ({ ...f, imageFile: file }))}
          onRemoveExisting={() => setForm((f) => ({ ...f, image: null, imageFile: null }))}
        />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
            {PRODUCT_STATUS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => updateField("status", s.value)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${form.status === s.value ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-gray-500"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Use</label>
            <ToggleSwitch checked={form.companyUseOnly} onChange={(v) => updateField("companyUseOnly", v)} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">GST</label>
            <div className="relative">
              <select
                value={form.gstRate}
                onChange={(e) => updateField("gstRate", e.target.value)}
                disabled={gstLoading}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{gstLoading ? "Loading..." : "Select GST rate"}</option>
                {gstOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
            <div className="relative">
              <select
                value={form.unit}
                onChange={(e) => updateField("unit", e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">Select unit</option>
                {UNIT_TYPES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stock Alert Threshold</label>
            <input
              type="number"
              min="0"
              value={form.stockAlertThreshold}
              onChange={(e) => updateField("stockAlertThreshold", e.target.value)}
              placeholder="e.g. 5"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm shadow-sm outline-none transition-colors
                ${errors.stockAlertThreshold ? "border-rose-400" : "border-gray-300 focus:border-indigo-500"}
                focus:ring-2 focus:ring-indigo-500/30`}
            />
            <FieldError message={errors.stockAlertThreshold} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Tracking Method
            <RequiredMark />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRACKING_METHODS.map((method) => {
              const checked = form.trackingMethod === method.value;
              return (
                <button
                  type="button"
                  key={method.value}
                  onClick={() => handleTrackingMethodChange(method.value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors
                    ${checked ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border
                        ${checked ? "border-indigo-600" : "border-gray-300"}`}
                    >
                      {checked && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </span>
                    <span className={`text-sm font-medium ${checked ? "text-indigo-700" : "text-gray-800"}`}>
                      {method.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">{method.description}</p>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.trackingMethod} />
        </div>

        {form.trackingMethod && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Applicable Fields
              <RequiredMark />
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({form.selectedFields.length} selected)
              </span>
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

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting ? "Saving..." : form.id ? "Save Changes" : "Save Product Definition"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductDefinition() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE_DEFAULT);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") || "");
  const [trackingFilter, setTrackingFilter] = useState("");
  const [leafCategories, setLeafCategories] = useState([]);

  const [view, setView] = useState("list");
  const [formMode, setFormMode] = useState("create");
  const [formInitialData, setFormInitialData] = useState(emptyForm);
  const [formLoadingRow, setFormLoadingRow] = useState(null);

  const [detailRow, setDetailRow] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [restoringId, setRestoringId] = useState(null);

  const [toast, setToast] = useState(null);

  const updateCategoryFilter = (categoryId) => {
    setCategoryFilter(categoryId);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) params.set("categoryId", categoryId);
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

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiSearchLeafCategories("");
        setLeafCategories(cats);
      } catch {
        setLeafCategories([]);
      }
    })();
  }, []);

  const categoryNameMap = useRef({});
  useEffect(() => {
    const map = {};
    leafCategories.forEach((c) => {
      map[c._id] = c.displayPath || c.name;
    });
    categoryNameMap.current = map;
  }, [leafCategories]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const { items: fetched, total: fetchedTotal } = await apiListProductDefinitions({
        page,
        limit,
        search,
        categoryId: categoryFilter || undefined,
        showInactive: statusTab === "inactive",
      });

      let visible = statusTab === "inactive" ? fetched.filter((d) => !d.isActive) : fetched;
      if (trackingFilter) visible = visible.filter((d) => d.trackingMethod === trackingFilter);

      setItems(visible);
      setTotal(fetchedTotal);
    } catch (err) {
      setListError(err.message || "Failed to load product definitions");
      setItems([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, search, categoryFilter, statusTab, trackingFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setFormMode("create");
    setFormInitialData({ ...emptyForm, id: null });
    setView("form");
  };

  const openEdit = async (row) => {
    setFormLoadingRow(row._id);
    try {
      const full = await apiGetProductDefinitionById(row._id);
      const categoryDisplay =
        categoryNameMap.current[full.categoryId] ||
        leafCategories.find((c) => c._id === full.categoryId)?.displayPath ||
        null;

      setFormInitialData({
        id: full._id,
        category: categoryDisplay
          ? { _id: full.categoryId, displayPath: categoryDisplay, name: categoryDisplay }
          : { _id: full.categoryId, name: "Existing category", displayPath: "Existing category" },
        name: full.name || "",
        companyUseOnly: full.companyUseOnly ?? false,
        gstRate: full.gstRate ?? "",
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

  const confirmDelete = (row) => setDeleteTarget(row);

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

  if (view === "form") {
    return (
      <ProductDefinitionForm
        key={formInitialData.id || "create"}
        initialData={formInitialData}
        categoryLocked={formMode === "edit"}
        onCancel={closeForm}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 rounded-2xl px-6 py-6 shadow-lg shadow-indigo-200">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} /> Product Definitions
          </h1>
          <p className="text-sm text-indigo-100 mt-1">
            Define products under leaf categories with tracking rules and attributes.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-md hover:bg-indigo-50 transition-colors self-start"
        >
          <Plus size={16} /> New Product Definition
        </button>
      </div>

      {toast && (
        <div className="mb-4">
          <Banner type={toast.type} onClose={() => setToast(null)}>
            {toast.message}
          </Banner>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product definitions by name..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="relative w-full lg:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => updateCategoryFilter(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">All Categories</option>
              {leafCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.displayPath || c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 shrink-0">
            {TRACKING_FILTER_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTrackingFilter(t.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                  ${trackingFilter === t.value ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-gray-500"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setStatusTab(t.value);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${statusTab === t.value ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-gray-500"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-semibold">{total} total</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 text-left text-xs font-bold text-indigo-600 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Fields</th>
                <th className="px-4 py-3">GST / Unit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
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
                items.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => setDetailRow(row)}
                    className="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                          {row.image ? (
                            <img
                              src={resolveImageUrl(row.image)}
                              alt={row.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageOff size={14} className="text-gray-300" />
                          )}
                        </div>
                        <div className="font-semibold text-gray-800">
                          <TruncatedText text={row.name} label="Name" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      <TruncatedText text={categoryNameMap.current[row.categoryId]} label="Category" />
                    </td>
                    <td className="px-4 py-3.5">
                      <TrackingPill value={row.trackingMethod} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{row.selectedFields?.length ?? 0}</td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {row.gstRate ? `${row.gstRate}%` : "\u2014"}
                      {row.unit ? ` \u00b7 ${row.unit}` : ""}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill value={row.status} />
                      {!row.isActive && (
                        <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          Deleted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {row.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              disabled={formLoadingRow === row._id}
                              title="Edit"
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              {formLoadingRow === row._id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Pencil size={15} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(row)}
                              title="Delete"
                              className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(row)}
                            disabled={restoringId === row._id}
                            title="Restore"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {restoringId === row._id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <RotateCcw size={13} />
                            )}
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!listLoading && !listError && items.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination
              currentPage={page}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      <RowDetailModal
        row={detailRow}
        categoryLabel={detailRow ? categoryNameMap.current[detailRow.categoryId] : ""}
        onClose={() => setDetailRow(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product definition?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be soft-deleted and hidden from active lists. This is blocked if active inventory items still reference it.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}