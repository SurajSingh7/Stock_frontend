import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

const EP = API_ENDPOINTS.inventory.repairs;

export const fetchRepairs = async (query) => {
  const j = await api.get(EP.list, { query, fallback: "Failed to load" });
  return { rows: j.data || [], total: j.pagination?.total ?? 0 };
};
export const fetchRepairCounts = async (query = {}) => (await api.get(EP.counts, { query, fallback: "Failed to load counts" })).data || {};
export const fetchRepairVendors = async () => (await api.get(EP.vendors, { fallback: "Failed to load vendors" })).data || [];

const step = (path, fallback) => async (id, body) => (await api.patch(EP.step(id, path), body || {}, { fallback })).data;
export const reportFaulty = step("report-faulty", "Failed to report the fault");
export const sendForRepair = step("send-repair", "Failed to send for repair");
export const repairResult = step("repair-result", "Failed to save the repair result");
export const oldUnitReturned = step("old-unit-returned", "Failed to take the old unit back");
export const markOk = step("mark-ok", "Failed to mark it working");
