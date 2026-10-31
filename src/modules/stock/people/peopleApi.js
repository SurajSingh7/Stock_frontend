import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

/*
  People Directory — one search over employees and subscribers (the people
  API, plus anyone added by hand). `module` is the screen asking
  ("opening-issued-stock" | "employee-items"); the server checks the caller's
  permission on it.
*/
const EP = API_ENDPOINTS.inventory.people;

export const searchPeople = async (q, { kind, module }) =>
  (await api.get(EP.search, { query: { q, module, kind }, fallback: "Failed to search people" })).data;

// A search result → the stored directory person (fetched again from the
// people API on the server when it came from there).
export const selectPerson = async (result, module) =>
  (
    await api.post(
      EP.select,
      result.source === "EXTERNAL" && result.externalId ? { kind: result.kind, externalId: result.externalId } : { personId: result.personId },
      { query: { module }, fallback: "Failed to choose this person" }
    )
  ).data;

export const createPerson = async (body, module) =>
  (await api.post(EP.base, body, { query: { module }, fallback: "Failed to add the person" })).data;
