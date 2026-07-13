"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
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
  FolderOpen,
  X,
  AlertTriangle,
  Loader2,
  FolderTree,
  Info,
  Move,
} from "lucide-react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import ProductDefinitionCatComp from "./ProductDefinitionCatComp";


/* =============================================================================
   CONSTANTS
============================================================================= */

const CATEGORY_TYPE = {
  GROUP: "GROUP",
  LEAF: "LEAF",
};

// Centralized display labels — change the wording here anytime without
// touching any component logic.
const CATEGORY_TYPE_LABELS = {
  GROUP: "Sub-Category",
  LEAF: "Last",
};

const CATEGORIES_ENDPOINT = `${API_BACKEND_URL}/stock/categories`;
const TRUNCATE_LENGTH = 25;

// Single source of truth for the category name length limit.
// Increase/decrease this ONE value to change validation everywhere
// (input maxLength, character counter, and submit-blocking check).
const CATEGORY_NAME_MAX_LENGTH = 32;

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

  moveCategory: async (categoryId, newParentId) => {
    const res = await fetch(`${CATEGORIES_ENDPOINT}/${categoryId}/move`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newParentId: newParentId || null }),
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
  return `/master/product-definition?redirect=category&categoryId=${categoryId}`;
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

// SHARED breadcrumb builder — used by BOTH Tree Structure click and Search click,
// so the resulting breadcrumb is always built the exact same way regardless of
// entry point (fixes: search selection was skipping ancestors).
function buildBreadcrumbTrail(tree, targetId, fallbackName) {
  const ancestryTrail = findNodeTrail(tree, targetId);
  return [
    { id: null, name: "Home" },
    ...(ancestryTrail || [{ id: targetId, name: fallbackName }]),
  ];
}

/* =============================================================================
   SMALL UI PRIMITIVES
============================================================================= */

function TypeBadge({ type }) {
  const isLeafType = isLeaf(type);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ring-inset ${isLeafType
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-violet-50 text-violet-700 ring-violet-200"
        }`}
    >
      {CATEGORY_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function IconButton({ icon: Icon, onClick, title, variant = "default", disabled = false }) {
  const variants = {
    default: "text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:shadow-sm",
    danger: "text-gray-500 hover:text-red-600 hover:bg-red-50 hover:shadow-sm",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-2 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mb-4 shadow-sm ring-1 ring-gray-100">
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
          <div className="h-4 bg-gray-200 rounded-md w-1/5" />
          <div className="h-4 bg-gray-200 rounded-md w-2/5" />
          <div className="h-4 bg-gray-200 rounded-md w-1/5" />
          <div className="h-4 bg-gray-200 rounded-md w-16" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4 shadow-sm ring-1 ring-red-100">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm text-gray-800 font-semibold mb-1">Couldn't load categories</p>
      <p className="text-sm text-gray-500 mb-5">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl shadow-sm hover:bg-gray-800 hover:shadow-md transition-all duration-150"
      >
        Try again
      </button>
    </div>
  );
}

/* =============================================================================
   TEXT TRUNCATION — "35 chars then …more" with a popup showing full text
============================================================================= */

function TextPopupModal({ label, text, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{text}</p>
        </div>
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Generic truncated cell for description / full path columns.
function TruncatedCell({ text, label, maxLength = TRUNCATE_LENGTH, className = "" }) {
  const [showFull, setShowFull] = useState(false);

  if (!text) return <span className="text-gray-300">—</span>;

  const isTruncated = text.length > maxLength;
  const displayText = isTruncated ? text.slice(0, maxLength).trimEnd() : text;

  return (
    <>
      <span className={className}>
        {displayText}
        {isTruncated && (
          <>
            <span className="text-gray-400">...</span>{" "}
            <button
              type="button"
              onClick={() => setShowFull(true)}
              className="text-violet-600 hover:text-violet-700 font-medium hover:underline"
            >
              more
            </button>
          </>
        )}
      </span>
      {showFull && <TextPopupModal label={label} text={text} onClose={() => setShowFull(false)} />}
    </>
  );
}

// Name column: keeps the "click to view" behaviour, adds a separate "more"
// affordance (that doesn't trigger navigation) when the name is long.
function NameCell({ row, onView, maxLength = TRUNCATE_LENGTH }) {
  const [showFull, setShowFull] = useState(false);
  const isTruncated = row.name.length > maxLength;
  const displayName = isTruncated ? row.name.slice(0, maxLength).trimEnd() : row.name;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        onClick={() => onView(row)}
        className="text-sm font-semibold text-gray-800 hover:text-violet-600 text-left transition-colors"
      >
        {displayName}
        {isTruncated && <span className="text-gray-400">...</span>}
      </button>
      {isTruncated && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(true);
          }}
          className="text-xs text-violet-600 hover:text-violet-700 font-medium hover:underline flex-shrink-0"
        >
          more
        </button>
      )}
      {showFull && (
        <TextPopupModal label="Category Name" text={row.name} onClose={() => setShowFull(false)} />
      )}
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
    <div ref={containerRef} className="relative w-full sm:w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="category-search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="Search categories..."
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all shadow-sm"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5 bg-white shadow-sm">
          /
        </kbd>
      </div>
      {showResults && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl ring-1 ring-black/5 max-h-80 overflow-y-auto">
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
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{cat.name}</p>
                      <p className="text-xs text-gray-400 truncate">{cat.displayPath}</p>
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
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-gray-50/60 transition-colors"
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
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-violet-600 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-900">Tree Structure</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
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
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700 transition-colors"
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
   MOVE CATEGORY (modal) — used when moving a LEAF category to a different GROUP
============================================================================= */

function MoveTreeNode({ node, depth = 0, currentId, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelectable = node.type === CATEGORY_TYPE.GROUP && node._id !== currentId;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-gray-50/60 transition-colors"
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
          disabled={!isSelectable}
          onClick={() => isSelectable && onSelect(node._id)}
          className={`flex items-center gap-2 text-sm rounded px-1 -mx-1 transition-colors ${isSelectable ? "text-gray-700 hover:text-violet-600 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"
            }`}
        >
          {node.name}
        </button>
        <TypeBadge type={node.type} />
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <MoveTreeNode key={child._id} node={child} depth={depth + 1} currentId={currentId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function MoveCategoryModal({ isOpen, onClose, category, tree, isLoading, isMoving, onSelectParent }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Move Category</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose a GROUP category to move <span className="font-medium text-gray-600">"{category?.name}"</span> into
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div>
              <button
                type="button"
                disabled={isMoving}
                onClick={() => onSelectParent(null)}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-violet-600 transition-colors disabled:opacity-50"
              >
                <Home className="w-3.5 h-3.5 text-gray-400" />
                Move to Home (root level)
              </button>
              {tree.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No GROUP categories available.</p>
              ) : (
                tree.map((node) => (
                  <MoveTreeNode key={node._id} node={node} depth={1} currentId={category?._id} onSelect={onSelectParent} />
                ))
              )}
            </div>
          )}
        </div>

        {isMoving && (
          <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Moving category...
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   BREADCRUMB
============================================================================= */

function Breadcrumb({ trail, onNavigate }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-5 py-3.5 bg-white/70 border border-gray-100 rounded-2xl shadow-sm text-sm">
      {trail.map((crumb, idx) => {
        const isLast = idx === trail.length - 1;
        return (
          <React.Fragment key={crumb.id ?? "home"}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
            <button
              type="button"
              disabled={isLast}
              onClick={() => onNavigate(idx)}
              className={`flex items-center gap-1.5 transition-colors ${isLast
                  ? "text-violet-600 font-semibold cursor-default"
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
      <button
        type="button"
        disabled={!!disabledReason || isToggling}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner disabled:cursor-not-allowed disabled:opacity-50 ${isLeafType ? "bg-emerald-500" : "bg-gray-300"
          }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isLeafType ? "translate-x-6" : "translate-x-1"
            }`}
        />
      </button>
      <span className={`text-xs font-semibold ${isLeafType ? "text-emerald-600" : "text-gray-400"}`}>Last</span>
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
      <div className="flex items-center gap-3 flex-wrap">
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md shadow-sm transition-all duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {!createDisabled ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl hover:from-gray-700 hover:to-gray-800 shadow-sm hover:shadow-md transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            Create Category
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-gray-400 italic" />
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {!addProductDisabled && (
          <button
            type="button"
            onClick={onAddProduct}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 hover:shadow-md shadow-sm transition-all duration-150"
          >
            <Package className="w-4 h-4" />
            Add Product
          </button>
        )}

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
   CATEGORY TABLE
============================================================================= */

function CategoryTableRow({ row, onView, onEdit, onDelete, onRestore, onMove }) {
  const isInactive = row.isActive === false;
  const isLeafType = row.type === CATEGORY_TYPE.LEAF;
  const hasChildren = (row.childCount ?? 0) > 0;
  const canDelete = !isInactive && !isLeafType && !hasChildren;

  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-violet-50/30 transition-colors">
      <td className="px-6 py-4 align-top">
        <NameCell row={row} onView={onView} />
      </td>
      <td className="px-6 py-4 align-top text-sm text-gray-500 max-w-xs">
        <TruncatedCell text={row.description} label="Description" />
      </td>
      <td className="px-6 py-4 align-top text-xs text-gray-400 font-mono max-w-xs">
        <TruncatedCell text={row.displayPath || row.name} label="Full Path" />
      </td>
      <td className="px-6 py-4 align-top">
        <TypeBadge type={row.type} />
      </td>
      <td className="px-6 py-4 align-top">
        <div className="flex items-center gap-1">
          <IconButton icon={Pencil} title="Edit" onClick={() => onEdit(row)} />
          {isInactive ? (
            <IconButton icon={RotateCcw} title="Restore" onClick={() => onRestore(row)} />
          ) : isLeafType ? (
            <IconButton icon={Move} title="Move" onClick={() => onMove(row)} />
          ) : canDelete ? (
            <IconButton icon={Trash2} title="Delete" variant="danger" onClick={() => onDelete(row)} />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CategoryTable({ rows, onView, onEdit, onDelete, onRestore, onMove }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Path</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
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
                onMove={onMove}
              />
            ))}
          </tbody>
        </table>
      </div>
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

  const trimmedNameLength = name.trim().length;
  const isNameTooLong = trimmedNameLength > CATEGORY_NAME_MAX_LENGTH;

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (formError) setFormError("");
  };

  const handleSubmit = () => {
    if (parentIsLeaf) {
      setFormError("You cannot create a category inside a LEAF category.");
      return;
    }
    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }
    if (name.trim().length > CATEGORY_NAME_MAX_LENGTH) {
      setFormError(`Category name cannot exceed ${CATEGORY_NAME_MAX_LENGTH} characters.`);
      return;
    }
    setFormError("");
    // Type selector removed from UI — always create as GROUP.
    // Convert to LEAF afterward via the GROUP/LEAF toggle switch in ActionBar.
    onSubmit({ name: name.trim(), description: description.trim(), type: CATEGORY_TYPE.GROUP });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {isEditMode ? "Edit Category" : "Create Category"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {parentIsLeaf && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              You cannot create a category inside a LEAF category.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-600">
                Category Name <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs font-medium ${isNameTooLong ? "text-red-500" : "text-gray-400"}`}>
                {name.trim().length}/{CATEGORY_NAME_MAX_LENGTH}
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Phones"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all shadow-sm ${isNameTooLong
                  ? "border-red-300 focus:ring-red-500/20 focus:border-red-400"
                  : "border-gray-200 focus:ring-violet-500/20 focus:border-violet-300"
                }`}
            />
            {isNameTooLong && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Category name cannot exceed {CATEGORY_NAME_MAX_LENGTH} characters.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 resize-none transition-all shadow-sm"
            />
          </div>

          {formError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {formError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || parentIsLeaf || isNameTooLong}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-150"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">Delete category</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-700">{category?.name}</span>? This action cannot be undone
          directly — you can restore it later from the inactive list.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 shadow-sm hover:shadow-md transition-all duration-150"
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
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center shadow-md ring-1 ring-black/5">
          <Home className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Category Management</h1>
          <p className="text-sm text-gray-500">Organize your products using categories.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchCategory {...searchProps} />
        <button
          type="button"
          onClick={onOpenTree}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-violet-600 bg-white border border-violet-200 rounded-xl hover:bg-violet-50 hover:shadow-md shadow-sm transition-all duration-150"
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

  const [moveTarget, setMoveTarget] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTreeData, setMoveTreeData] = useState([]);
  const [moveTreeLoading, setMoveTreeLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

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
      toast.error(err.message);
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

  // Search selection now reuses buildBreadcrumbTrail (same helper used by the
  // Tree Structure modal) so the full ancestor chain is always shown, not just
  // "Home > D". If treeData is already loaded (Tree modal opened before), we
  // reuse it to avoid an extra API call; otherwise we fetch the root tree fresh.
  const handleSelectSearchResult = async (cat) => {
    setShowSearchResults(false);
    setSearchValue("");
    try {
      const tree = treeData.length ? treeData : await categoryApi.getRootCategories();
      if (!treeData.length) setTreeData(tree);
      setTrail(buildBreadcrumbTrail(tree, cat._id, cat.name));
    } catch (err) {
      // Fallback: at least land on the selected category if tree fetch fails.
      setTrail([{ id: null, name: "Home" }, { id: cat._id, name: cat.name }]);
      toast.error(err.message || "Couldn't resolve full category path.");
    }
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

  const navigateFromTree = (node) => {
    setShowTreeModal(false);
    if (!node) {
      setTrail([{ id: null, name: "Home" }]);
      return;
    }
    setTrail(buildBreadcrumbTrail(treeData, node._id, node.name));
  };

  /* ---------------- Tree modal ---------------- */

  const openTreeModal = async () => {
    setShowTreeModal(true);
    setTreeLoading(true);
    try {
      const rootNodes = await categoryApi.getRootCategories();
      setTreeData(rootNodes);
    } catch (err) {
      setTreeData([]);
      toast.error(err.message || "Couldn't load tree structure.");
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
        toast.success(`"${payload.name}" updated successfully`);
      } else {
        await categoryApi.createCategory({
          ...payload,
          parentId: isRoot ? null : currentCategoryId,
        });
        toast.success(`"${payload.name}" created successfully`);
      }
      setShowFormModal(false);
      await loadCurrentLevel();
    } catch (err) {
      toast.error(err.message);
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
      toast.success(`"${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
      await loadCurrentLevel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (row) => {
    try {
      await categoryApi.restoreCategory(row._id);
      toast.success(`"${row.name}" restored successfully`);
      await loadCurrentLevel();
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ---------------- Move (LEAF categories only) ---------------- */

  const openMoveModal = async (row) => {
    setMoveTarget(row);
    setShowMoveModal(true);
    setMoveTreeLoading(true);
    try {
      const rootNodes = await categoryApi.getRootCategories();
      setMoveTreeData(rootNodes);
    } catch (err) {
      setMoveTreeData([]);
      toast.error(err.message || "Couldn't load categories.");
    } finally {
      setMoveTreeLoading(false);
    }
  };

  const closeMoveModal = () => {
    setShowMoveModal(false);
    setMoveTarget(null);
    setMoveTreeData([]);
  };

  const handleMoveConfirm = async (newParentId) => {
    if (!moveTarget) return;
    setIsMoving(true);
    try {
      await categoryApi.moveCategory(moveTarget._id, newParentId);
      toast.success(`"${moveTarget.name}" moved successfully`);
      closeMoveModal();
      await loadCurrentLevel();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsMoving(false);
    }
  };

  /* ---------------- Type toggle ---------------- */

  const handleToggleType = async () => {
    if (!currentCategory) return;
    const nextType = isLeaf(currentCategory.type) ? CATEGORY_TYPE.GROUP : CATEGORY_TYPE.LEAF;
    setIsToggling(true);
    try {
      await categoryApi.toggleCategoryType(currentCategory._id, nextType);
      toast.success(`Category type changed to ${nextType}`);
      await loadCurrentLevel();
    } catch (err) {
      toast.error(err.message);
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/60 px-4 sm:px-6 py-6 space-y-5">

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

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden">
          <LoadingSkeleton />
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-md">
          <ErrorState message={error} onRetry={loadCurrentLevel} />
        </div>
      ) : children.length === 0 ? (
        !isRoot && isLeaf(currentCategory?.type) && hasProducts ? (
          <ProductDefinitionCatComp categoryId={currentCategory._id} />
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-md">
            <EmptyState message="No child categories found." />
          </div>
        )
      ) : (
        <CategoryTable
          rows={children}
          onView={navigateInto}
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
          onRestore={handleRestore}
          onMove={openMoveModal}
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

      <MoveCategoryModal
        isOpen={showMoveModal}
        onClose={closeMoveModal}
        category={moveTarget}
        tree={moveTreeData}
        isLoading={moveTreeLoading}
        isMoving={isMoving}
        onSelectParent={handleMoveConfirm}
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