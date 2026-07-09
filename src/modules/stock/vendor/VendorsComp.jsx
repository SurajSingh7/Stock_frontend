"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Phone,
  X,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import Pagination from "@/shared/ui/pagination/Pagination";

/* ------------------------------------------------------------------ */
/* Small inline sub-components (Rule 16 — single-file component)       */
/* ------------------------------------------------------------------ */

const StatusTabs = ({ status, onChange }) => (
  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
    {["ACTIVE", "INACTIVE"].map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          status === tab
            ? "bg-white text-indigo-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {tab === "ACTIVE" ? "Active" : "Inactive"}
      </button>
    ))}
  </div>
);

const GstBadge = ({ gst }) => {
  if (!gst?.isAvailable) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
        N/A
      </span>
    );
  }
  return gst.isVerified ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
      <ShieldCheck className="w-3.5 h-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
      <ShieldAlert className="w-3.5 h-3.5" /> Not Verified
    </span>
  );
};

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
        toast.type === "error"
          ? "bg-red-600 text-white"
          : "bg-gray-900 text-white"
      }`}
    >
      {toast.message}
      <button onClick={onClose} className="opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const ConfirmDeleteModal = ({ vendor, onConfirm, onCancel, deleting }) => {
  if (!vendor) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900">Delete vendor?</h3>
        <p className="mt-2 text-sm text-gray-500">
          This will deactivate <span className="font-medium text-gray-700">{vendor.name}</span>.
          You can restore it later from the Inactive tab.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {Array.from({ length: 7 }).map((__, j) => (
          <td key={j} className="px-4 py-4">
            <div className="h-3 bg-gray-100 rounded w-full max-w-[120px]" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const EmptyState = ({ onCreate }) => (
  <tr>
    <td colSpan={7} className="px-4 py-16 text-center">
      <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">No vendors found.</p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
      >
        <Plus className="w-4 h-4" /> Add Vendor
      </button>
    </td>
  </tr>
);

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const VendorsComp = () => {
  const router = useRouter();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");

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

  // RULE 07: never fetch inside component body — stable useCallback loader.
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // FRONTEND NOTE: backend showInactive only supports "show everything"
      // vs "active only" (Section 8.2/14 caveat, same as Field Definitions /
      // Product Definitions). The "Inactive" tab is therefore filtered
      // client-side here, exactly like FieldDefinition.jsx does.
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        showInactive: "true",
      });
      if (search) params.set("search", search);

      const res = await fetch(`${API_BACKEND_URL}/stock/vendors?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch vendors");
      }

      const rows = json.data || [];
      const filtered = rows.filter((v) =>
        status === "ACTIVE" ? v.isActive : !v.isActive
      );

      setVendors(filtered);
      setTotal(json.pagination?.total ?? filtered.length);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BACKEND_URL}/stock/vendors/${deleteTarget._id}`, {
        method: "DELETE",
        credentials: "include",
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
        method: "PATCH",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Restore failed");
      showToast("Vendor restored successfully");
      loadVendors();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage vendor master data — contacts, GST, bank details, and assigned products.
          </p>
        </div>
        <button
          onClick={() => router.push("/stock/vendors/create")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Premium card wrapper */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border-b border-gray-100">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, GST number, phone..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <StatusTabs
            status={status}
            onChange={(s) => {
              setStatus(s);
              setPage(1);
            }}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Vendor Name</th>
                <th className="px-4 py-3">GST Status</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Payment Term</th>
                <th className="px-4 py-3">Assigned Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-red-500 text-sm">
                    {error}
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <EmptyState onCreate={() => router.push("/stock/vendors/create")} />
              ) : (
                vendors.map((vendor) => {
                  const primaryContact =
                    vendor.contacts?.find((c) => c.label === "PRIMARY") || vendor.contacts?.[0];
                  const productCount = (vendor.assignedProducts || []).reduce(
                    (sum, ap) => sum + (ap.productIds?.length || 0),
                    0
                  );
                  return (
                    <tr key={vendor._id} className="group hover:bg-gray-50/70">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{vendor.name}</div>
                        {vendor.vendorAlias && (
                          <div className="text-xs text-gray-400">{vendor.vendorAlias}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <GstBadge gst={vendor.gst} />
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {primaryContact?.phone || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {vendor.paymentTerms?.replace("_", " ") || "—"}
                      </td>
                      <td className="px-4 py-4 text-gray-600">{productCount}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            vendor.isActive
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {vendor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => router.push(`/stock/vendors/${vendor._id}`)}
                            title="View"
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/stock/vendors/${vendor._id}/edit`)}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {vendor.isActive ? (
                            <button
                              onClick={() => setDeleteTarget(vendor)}
                              title="Delete"
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(vendor)}
                              title="Restore"
                              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Shared Pagination — Rule 17 / Section 18: all five props, always */}
        <div className="p-4 border-t border-gray-100">
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

      <ConfirmDeleteModal
        vendor={deleteTarget}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default VendorsComp;