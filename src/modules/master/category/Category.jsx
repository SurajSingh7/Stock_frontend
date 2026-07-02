"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Search,
  GitBranch,
  ChevronRight,
  ArrowLeft,
  Plus,
  Package,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  X,
  AlertTriangle,
  Loader2,
  FolderTree,
  Info,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";

/* =============================================================================
   CONSTANTS
============================================================================= */

const CATEGORY_TYPE = {
  GROUP: "GROUP",
  LEAF: "LEAF",
};

const CATEGORIES_ENDPOINT = `${API_BACKEND_URL}/stock/categories`;

/* =============================================================================
   API FUNCTIONS
============================================================================= */

async function parseResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Something went wrong. Please try again.");
  }
  return json;
}

const categoryApi = {
  getRootCategories: async () => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}`, {
      method: "GET",
      credentials: "include",
    });
    const json = await parseResponse(res);
    return Array.isArray(json.data) ? json.data : [];
  },

  getCategoryById: async (categoryId) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}`, {
      method: "GET",
      credentials: "include",
    });
    const json = await parseResponse(res);
    return json.data;
  },

  searchCategories: async ({ search, page, limit }) => {
    const params = new URLSearchParams({
      search: search || "",
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`${CATEGORIES_ENDPOINT}/flat?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    const json = await parseResponse(res);
    return {
      items: json.data || [],
      total: json.pagination?.total ?? 0,
    };
  },

  createCategory: async ({ name, description, type, parentId }) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, type, parentId: parentId || null }),
    });
    return parseResponse(res);
  },

  renameCategory: async (categoryId, { name, description }) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    return parseResponse(res);
  },

  toggleCategoryType: async (categoryId, nextType) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}/toggle-type`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: nextType }),
    });
    return parseResponse(res);
  },

  softDeleteCategory: async (categoryId) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return parseResponse(res);
  },

  restoreCategory: async (categoryId) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}/restore`, {
      method: "PATCH",
      credentials: "include",
    });
    return parseResponse(res);
  },
};

/* =============================================================================
   UTILITY FUNCTIONS
============================================================================= */

function isLeaf(type) {
  return type === CATEGORY_TYPE.LEAF;
}

function buildProductCreateUrl(categoryId) {
  return `/products/create?categoryId=${categoryId}`;
}

// Walks a nested tree to find the full ancestry chain (id + name) down to targetId.
// Used by the Tree Structure modal so clicking a node lands on the correct breadcrumb.
function findNodeTrail(tree, targetId, trailSoFar = []) {
  for (const node of tree) {
    const nextTrail = [...trailSoFar, { id: node._id, name: node.name }];
    if (node._id === targetId) return nextTrail;
    if (node.children?.length) {
      const found = findNodeTrail(node.children, targetId, nextTrail);
      if (found) return found;
    }
  }
  return null;
}

/* =============================================================================
   SMALL UI PRIMITIVES
============================================================================= */

function TypeBadge({ type }) {
  const isLeafType = isLeaf(type);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isLeafType
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}
    >
      {isLeafType ? "LEAF" : "GROUP"}
    </span>
  );
}

function IconButton({ icon: Icon, onClick, title, variant = "default", disabled = false }) {
  const variants = {
    default: "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
    danger: "text-gray-500 hover:text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <FolderTree className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/5" />
          <div className="h-4 bg-gray-200 rounded w-2/5" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm text-gray-700 font-medium mb-1">Couldn't load categories</p>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  );
}

/* =============================================================================
   SEARCH CATEGORY
============================================================================= */

function SearchCategory({ value, onChange, onFocus, results, isSearching, showResults, onSelectResult, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={containerRef} className="relative w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="category-search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="Search categories..."
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">
          /
        </kbd>
      </div>
      {showResults && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-gray-400">No categories found.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((cat) => (
                <li key={cat._id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(cat)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm text-gray-800">{cat.name}</p>
                      {/* FIX 2: show human-readable displayPath, not raw id path */}
                      <p className="text-xs text-gray-400">{cat.displayPath}</p>
                    </div>
                    <TypeBadge type={cat.type} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   CATEGORY TREE STRUCTURE (modal)
============================================================================= */

function TreeNode({ node, depth = 0, onNavigate }) {
  // FIX 5: default-expanded (was `depth < 1`)
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-gray-50 cursor-pointer"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 text-gray-400 hover:text-gray-700"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          onClick={() => onNavigate(node)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          {node.name}
        </button>
        <TypeBadge type={node.type} />
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child._id} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryTreeStructureModal({ isOpen, onClose, tree, isLoading, onNavigate }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">Tree Structure</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No categories yet.</p>
          ) : (
            <div>
              <div
                className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                onClick={() => onNavigate(null)}
              >
                <Home className="w-3.5 h-3.5 text-gray-400" />
                Home
              </div>
              {tree.map((node) => (
                <TreeNode key={node._id} node={node} depth={1} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   BREADCRUMB
============================================================================= */

function Breadcrumb({ trail, onNavigate }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-5 py-3.5 bg-gray-50/60 border border-gray-100 rounded-xl text-sm">
      {trail.map((crumb, idx) => {
        const isLast = idx === trail.length - 1;
        return (
          <React.Fragment key={crumb.id ?? "home"}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
            <button
              type="button"
              disabled={isLast}
              onClick={() => onNavigate(idx)}
              className={`flex items-center gap-1.5 ${
                isLast
                  ? "text-blue-600 font-medium cursor-default"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {idx === 0 && <Home className="w-3.5 h-3.5" />}
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* =============================================================================
   ACTION BAR (Back / Create Category / Add Product / Type Toggle)
============================================================================= */

function TypeToggle({ type, disabledReason, onToggle, isToggling }) {
  const isLeafType = isLeaf(type);
  return (
    <div className="flex items-center gap-2" title={disabledReason || ""}>
      <span className={`text-xs font-medium ${!isLeafType ? "text-gray-900" : "text-gray-400"}`}>GROUP</span>
      <button
        type="button"
        disabled={!!disabledReason || isToggling}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isLeafType ? "bg-emerald-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isLeafType ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-xs font-medium ${isLeafType ? "text-emerald-600" : "text-gray-400"}`}>LEAF</span>
    </div>
  );
}

function ActionBar({
  canGoBack,
  onBack,
  currentType,
  onCreateClick,
  onAddProduct,
  onToggleType,
  isToggling,
  isRoot,
  hasChildren,
  hasProducts,
}) {
  const createDisabled = !isRoot && isLeaf(currentType);
  const addProductDisabled = isRoot || !isLeaf(currentType);

  let toggleDisabledReason = "";
  if (!isRoot) {
    if (!isLeaf(currentType) && hasChildren) {
      toggleDisabledReason = "Cannot convert to LEAF: this category has subcategories.";
    } else if (isLeaf(currentType) && hasProducts) {
      toggleDisabledReason = "Cannot convert to GROUP because this category contains products.";
    }
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        {/* FIX 3: Back button only renders when canGoBack is true (hidden on Home) */}
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {!createDisabled ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Create Category
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-gray-400 italic">
            <Info className="w-3.5 h-3.5" />
            Leaf categories cannot have subcategories.
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onAddProduct}
          disabled={addProductDisabled}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed enabled:text-emerald-700 enabled:bg-emerald-50 enabled:border-emerald-200 enabled:hover:bg-emerald-100"
        >
          <Package className="w-4 h-4" />
          Add Product
        </button>

        {!isRoot && (
          <TypeToggle
            type={currentType}
            disabledReason={toggleDisabledReason}
            onToggle={onToggleType}
            isToggling={isToggling}
          />
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   CATEGORY INFO CARD
============================================================================= */

function CategoryInfoCard({ category }) {
  if (!category) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900">{category.name}</h2>
            <TypeBadge type={category.type} />
          </div>
     
          <p className="text-sm text-gray-500">{category.description || "No description provided."}</p>
       
          <p className="text-xs text-gray-400 mt-2 font-mono">{category.displayPath}</p>
        </div> */}
      </div>
    </div>
  );
}

/* =============================================================================
   CATEGORY TABLE
============================================================================= */

function CategoryTableRow({ row, onView, onEdit, onDelete, onRestore }) {
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
      <td className="px-6 py-3.5">
        <button
          type="button"
          onClick={() => onView(row)}
          className="text-sm font-medium text-gray-800 hover:text-blue-600"
        >
          {row.name}
        </button>
      </td>
      <td className="px-6 py-3.5 text-sm text-gray-500 max-w-xs truncate">{row.description || "—"}</td>
      {/* FIX 2: use displayPath (names), not path (raw ObjectIds) */}
      <td className="px-6 py-3.5 text-xs text-gray-400 font-mono">{row.displayPath}</td>
      <td className="px-6 py-3.5">
        <TypeBadge type={row.type} />
      </td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-1">
          <IconButton icon={Eye} title="View" onClick={() => onView(row)} />
          <IconButton icon={Pencil} title="Edit" onClick={() => onEdit(row)} />
          {row.isActive === false ? (
            <IconButton icon={RotateCcw} title="Restore" onClick={() => onRestore(row)} />
          ) : (
            <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => onDelete(row)} />
          )}
        </div>
      </td>
    </tr>
  );
}

function CategoryTable({ rows, onView, onEdit, onDelete, onRestore }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Path</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CategoryTableRow
              key={row._id}
              row={row}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =============================================================================
   CREATE / EDIT CATEGORY MODAL
============================================================================= */

function CategoryFormModal({ isOpen, onClose, onSubmit, isSubmitting, parentIsLeaf, initialData }) {
  const isEditMode = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || "");
      setDescription(initialData?.description || "");
      setFormError("");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (parentIsLeaf) {
      setFormError("You cannot create a category inside a LEAF category.");
      return;
    }
    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }
    setFormError("");
    // FIX 4: type selector removed from UI — always create as GROUP.
    // Convert to LEAF afterward via the GROUP/LEAF toggle switch in ActionBar.
    onSubmit({ name: name.trim(), description: description.trim(), type: CATEGORY_TYPE.GROUP });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {isEditMode ? "Edit Category" : "Create Category"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {parentIsLeaf && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              You cannot create a category inside a LEAF category.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Phones"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 resize-none"
            />
          </div>

          {/* Category Type selector block removed entirely — Fix 4 */}

          {formError && <p className="text-xs text-red-500">{formError}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || parentIsLeaf}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEditMode ? "Save Changes" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   CONFIRM DELETE MODAL
============================================================================= */

function ConfirmDeleteModal({ isOpen, category, onCancel, onConfirm, isDeleting }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">Delete category</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Are you sure you want to delete <span className="font-medium text-gray-700">{category?.name}</span>?
          {category?.type === CATEGORY_TYPE.GROUP
            ? " All subcategories under it will also be removed."
            : " Any products under it will also be removed."}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   HEADER
============================================================================= */

function Header({ searchProps, onOpenTree }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
          <Home className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Category Management</h1>
          <p className="text-sm text-gray-500">Organize your products using categories (Group or Leaf).</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchCategory {...searchProps} />
        <button
          type="button"
          onClick={onOpenTree}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50"
        >
          <GitBranch className="w-4 h-4" />
          Tree Structure
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

const Category = () => {
  const router = useRouter();

  const [trail, setTrail] = useState([{ id: null, name: "Home" }]);
  const currentCategoryId = trail[trail.length - 1].id;
  const isRoot = currentCategoryId === null;

  const [currentCategory, setCurrentCategory] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchDebounceRef = useRef(null);

  const [showTreeModal, setShowTreeModal] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isToggling, setIsToggling] = useState(false);

  const loadCurrentLevel = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isRoot) {
        const rootNodes = await categoryApi.getRootCategories();
        setCurrentCategory(null);
        setChildren(rootNodes);
      } else {
        const detail = await categoryApi.getCategoryById(currentCategoryId);
        setCurrentCategory(detail);
        setChildren(detail?.children || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCategoryId, isRoot]);

  useEffect(() => {
    loadCurrentLevel();
  }, [loadCurrentLevel]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("category-search-input")?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ---------------- Search ---------------- */

  const handleSearchChange = (value) => {
    setSearchValue(value);
    setShowSearchResults(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { items } = await categoryApi.searchCategories({ search: value, page: 1, limit: 10 });
        setSearchResults(items);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSearchResult = (cat) => {
    setShowSearchResults(false);
    setSearchValue("");
    setTrail([{ id: null, name: "Home" }, { id: cat._id, name: cat.name }]);
  };

  /* ---------------- Breadcrumb / navigation ---------------- */

  const navigateInto = (row) => {
    setTrail((prev) => [...prev, { id: row._id, name: row.name }]);
  };

  const navigateToBreadcrumb = (index) => {
    setTrail((prev) => prev.slice(0, index + 1));
  };

  const navigateBack = () => {
    if (trail.length <= 1) return;
    setTrail((prev) => prev.slice(0, -1));
  };

  // FIX 5: reconstructs full ancestry from the loaded tree instead of jumping
  // straight to Home -> node, so the breadcrumb reflects the real path.
  const navigateFromTree = (node) => {
    setShowTreeModal(false);
    if (!node) {
      setTrail([{ id: null, name: "Home" }]);
      return;
    }
    const ancestryTrail = findNodeTrail(treeData, node._id);
    setTrail([{ id: null, name: "Home" }, ...(ancestryTrail || [{ id: node._id, name: node.name }])]);
  };

  /* ---------------- Tree modal ---------------- */

  const openTreeModal = async () => {
    setShowTreeModal(true);
    setTreeLoading(true);
    try {
      const rootNodes = await categoryApi.getRootCategories();
      setTreeData(rootNodes);
    } catch {
      setTreeData([]);
    } finally {
      setTreeLoading(false);
    }
  };

  /* ---------------- Create / Edit ---------------- */

  const openCreateModal = () => {
    setEditingCategory(null);
    setShowFormModal(true);
  };

  const openEditModal = (row) => {
    setEditingCategory(row);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (payload) => {
    setIsSubmittingForm(true);
    try {
      if (editingCategory) {
        await categoryApi.renameCategory(editingCategory._id, {
          name: payload.name,
          description: payload.description,
        });
      } else {
        await categoryApi.createCategory({
          ...payload,
          parentId: isRoot ? null : currentCategoryId,
        });
      }
      setShowFormModal(false);
      await loadCurrentLevel();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  /* ---------------- Delete / Restore ---------------- */

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await categoryApi.softDeleteCategory(deleteTarget._id);
      setDeleteTarget(null);
      await loadCurrentLevel();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (row) => {
    try {
      await categoryApi.restoreCategory(row._id);
      await loadCurrentLevel();
    } catch (err) {
      setError(err.message);
    }
  };

  /* ---------------- Type toggle ---------------- */

  const handleToggleType = async () => {
    if (!currentCategory) return;
    const nextType = isLeaf(currentCategory.type) ? CATEGORY_TYPE.GROUP : CATEGORY_TYPE.LEAF;
    setIsToggling(true);
    try {
      await categoryApi.toggleCategoryType(currentCategory._id, nextType);
      await loadCurrentLevel();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsToggling(false);
    }
  };

  /* ---------------- Add product ---------------- */

  const handleAddProduct = () => {
    if (!currentCategory || !isLeaf(currentCategory.type)) return;
    router.push(buildProductCreateUrl(currentCategory._id));
  };

  const parentIsLeaf = !isRoot && !!currentCategory && isLeaf(currentCategory.type);
  const hasChildren = children.length > 0;
  const hasProducts = (currentCategory?.productCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50/40 px-6 py-6 space-y-5">
      <Header
        searchProps={{
          value: searchValue,
          onChange: handleSearchChange,
          onFocus: () => setShowSearchResults(true),
          results: searchResults,
          isSearching,
          showResults: showSearchResults,
          onSelectResult: handleSelectSearchResult,
          onClose: () => setShowSearchResults(false),
        }}
        onOpenTree={openTreeModal}
      />

      <Breadcrumb trail={trail} onNavigate={navigateToBreadcrumb} />

      <ActionBar
        canGoBack={trail.length > 1}
        onBack={navigateBack}
        currentType={currentCategory?.type}
        onCreateClick={openCreateModal}
        onAddProduct={handleAddProduct}
        onToggleType={handleToggleType}
        isToggling={isToggling}
        isRoot={isRoot}
        hasChildren={hasChildren}
        hasProducts={hasProducts}
      />

      {!isRoot && <CategoryInfoCard category={currentCategory} />}

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <LoadingSkeleton />
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <ErrorState message={error} onRetry={loadCurrentLevel} />
        </div>
      ) : children.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <EmptyState message="No child categories found." />
        </div>
      ) : (
        <CategoryTable
          rows={children}
          onView={navigateInto}
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
          onRestore={handleRestore}
        />
      )}

      <CategoryFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmittingForm}
        parentIsLeaf={parentIsLeaf}
        initialData={editingCategory}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        category={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      <CategoryTreeStructureModal
        isOpen={showTreeModal}
        onClose={() => setShowTreeModal(false)}
        tree={treeData}
        isLoading={treeLoading}
        onNavigate={navigateFromTree}
      />
    </div>
  );
};

export default Category;