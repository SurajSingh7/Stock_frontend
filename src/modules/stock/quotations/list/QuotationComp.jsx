"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";

const STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  PARTIALLY_APPROVED: "PARTIALLY_APPROVED",
  REJECTED: "REJECTED",
};

const STATUS_META = {
  PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-50 text-green-700" },
  PARTIALLY_APPROVED: { label: "Partially approved", cls: "bg-indigo-50 text-indigo-700" },
  REJECTED: { label: "Rejected", cls: "bg-red-50 text-red-600" },
};

const CountCard = ({ label, count, active, tone, onClick }) => {
  const toneCls =
    active && tone === "warning"
      ? "border-amber-400 bg-amber-50"
      : active
      ? "border-indigo-400 bg-indigo-50"
      : "border-gray-200 bg-gray-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${toneCls}`}
    >
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{count}</p>
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

const Avatar = ({ name }) => {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-medium text-indigo-600">
        {initials}
      </span>
      <span className="text-gray-900">{name || "\u2014"}</span>
    </span>
  );
};

// Quotation module has no PO action anymore — PO Management is a separate module
// that reads the approved snapshot. Reviewed rows are "Completed" here; the only
// action is a read-only view.
const CreatorAction = ({ quotation, onView, onDetails }) => (
  <div className="flex items-center justify-end gap-2">
    {quotation.status !== STATUS.PENDING && (
      <span className="text-xs text-gray-400">Completed</span>
    )}
    <button
      type="button"
      onClick={() => onDetails(quotation)}
      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
    >
      Details
    </button>
    <button
      type="button"
      onClick={() => onView(quotation)}
      className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
    >
      View
    </button>
  </div>
);

const QuotationComp = () => {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState({
    PENDING: 0,
    APPROVED: 0,
    PARTIALLY_APPROVED: 0,
    REJECTED: 0,
    ALL: 0,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/quotations/status-summary`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) setSummary(json.data || {});
    } catch {
      /* non-critical */
    }
  }, []);

  const loadFilterSources = useCallback(async () => {
    try {
      const [catRes, venRes] = await Promise.all([
        fetch(`${API_BACKEND_URL}/stock/categories/flat?type=LEAF&limit=100`, { credentials: "include" }),
        fetch(`${API_BACKEND_URL}/stock/vendors?limit=100`, { credentials: "include" }),
      ]);
      const catJson = await catRes.json();
      const venJson = await venRes.json();
      if (catJson.success) setCategories(catJson.data || []);
      if (venJson.success) setVendors(venJson.data || []);
    } catch {
      /* degrade gracefully */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (vendorId) params.set("vendorId", vendorId);

      const res = await fetch(`${API_BACKEND_URL}/stock/quotations?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch quotations");

      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, categoryId, vendorId]);

  useEffect(() => {
    loadSummary();
    loadFilterSources();
  }, [loadSummary, loadFilterSources]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const applyFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const onStatusCard = (next) => {
    setStatus((prev) => (prev === next ? "" : next));
    setPage(1);
  };

  const categoryOptions = categories.map((c) => ({ id: c._id, label: c.displayPath || c.name }));

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quotations</h1>
          <p className="mt-1 text-sm text-gray-500">Approved categories flow to PO Management separately</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/stock/quotations/create")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add quotation
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CountCard label="Pending" count={summary.PENDING ?? 0} active={status === STATUS.PENDING} tone="warning" onClick={() => onStatusCard(STATUS.PENDING)} />
        <CountCard label="Approved" count={summary.APPROVED ?? 0} active={status === STATUS.APPROVED} onClick={() => onStatusCard(STATUS.APPROVED)} />
        <CountCard label="Partial" count={summary.PARTIALLY_APPROVED ?? 0} active={status === STATUS.PARTIALLY_APPROVED} onClick={() => onStatusCard(STATUS.PARTIALLY_APPROVED)} />
        <CountCard label="Rejected" count={summary.REJECTED ?? 0} active={status === STATUS.REJECTED} onClick={() => onStatusCard(STATUS.REJECTED)} />
        <CountCard label="All" count={summary.ALL ?? 0} active={status === ""} onClick={() => onStatusCard("")} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => applyFilter(setSearch)(e.target.value)}
          placeholder="Search quotation number or vendor"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:max-w-md"
        />
        <select value={categoryId} onChange={(e) => applyFilter(setCategoryId)(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select value={vendorId} onChange={(e) => applyFilter(setVendorId)(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v._id} value={v._id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Quotation #", "Categories", "Vendors", "Created by", "Status", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  <p className="mt-2 text-sm text-gray-500">Loading quotations…</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">No quotations found.</td>
              </tr>
            ) : (
              rows.map((q) => {
                const catNames = [...new Set((q.items || []).map((it) => it.categoryName).filter(Boolean))].join(", ");
                const vendorCount = new Set((q.items || []).map((it) => String(it.vendorId))).size;
                return (
                  <tr key={q._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.quotationNumber || "\u2014"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{catNames || "\u2014"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{vendorCount}</td>
                    <td className="px-4 py-3 text-sm"><Avatar name={q.createdByName} /></td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <CreatorAction
                        quotation={q}
                        onView={(qt) => router.push(`/stock/quotations/${qt._id}/view`)}
                        onDetails={(qt) => router.push(`/stock/quotations/${qt._id}/details`)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
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
    </div>
  );
};

export default QuotationComp;