import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";
import { fetchProductDefinitions } from "@/modules/stock/shared/lookupsApi";

const EP = API_ENDPOINTS.inventory.transferRequests;

// Branch pickers for every transfer screen. Served by the transfer-requests
// module rather than /branches/active, so branch staff don't need the
// Master > Branch permission just to name a branch.
//
// `branches` is every active branch (a transfer's counterparty is by
// definition another branch); `defaultBranchId` is the caller's own branch,
// the only branch they may raise a request on behalf of.
export async function fetchTransferBranches() {
  const json = await api.get(EP.branches, { fallback: "Failed to load branches" });
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
  const json = await api.get(EP.board, {
    query: {
      page,
      limit,
      branchId,
      role: branchId ? role : undefined,
      status,
      search: search?.trim(),
    },
    fallback: "Failed to fetch transfer requests",
  });
  return {
    rows: json.data?.rows || [],
    counts: json.data?.counts || { ALL: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0 },
    total: json.pagination?.total ?? 0,
  };
}

export const fetchTransferDetail = async (id) =>
  (await api.get(EP.byId(id), { fallback: "Failed to load transfer request" })).data;

// Free, approved units of one product at the branch that will send them.
export const fetchAvailableUnits = async (branchId, productDefinitionId) =>
  (
    await api.get(API_ENDPOINTS.inventory.inventoryItems.list, {
      query: { branchId, productDefinitionId, status: "AVAILABLE", approvalStatus: "APPROVED", limit: 200 },
      fallback: "Failed to load available units",
    })
  ).data || [];

export const fetchAllProducts = () => fetchProductDefinitions({ limit: 1000 });

export const createTransferRequest = (payload) =>
  api.post(EP.list, payload, { fallback: "Failed to create transfer request" });

export const processTransferRequest = (id, body) =>
  api.patch(EP.process(id), body, { fallback: "Failed to process transfer request" });
