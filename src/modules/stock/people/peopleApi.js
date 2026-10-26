import { API_BACKEND_URL } from "@/config/getEnvVariables";

/*
  People Directory — one search over employees and subscribers (the people
  API, plus anyone added by hand). `module` is the screen asking
  ("opening-issued-stock" | "employee-items"); the server checks the caller's
  permission on it.
*/
const BASE = `${API_BACKEND_URL}/stock/people`;

const json = async (res, fallback) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || fallback);
  return body.data;
};

export const searchPeople = async (q, { kind, module }) => {
  const params = new URLSearchParams({ q, module });
  if (kind) params.set("kind", kind);
  return json(await fetch(`${BASE}/search?${params}`, { credentials: "include" }), "Failed to search people");
};

const post = async (url, body, fallback) =>
  json(
    await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    fallback
  );

// A search result → the stored directory person (fetched again from the
// people API on the server when it came from there).
export const selectPerson = (result, module) =>
  post(
    `${BASE}/select?${new URLSearchParams({ module })}`,
    result.source === "EXTERNAL" && result.externalId ? { kind: result.kind, externalId: result.externalId } : { personId: result.personId },
    "Failed to choose this person"
  );

export const createPerson = (body, module) => post(`${BASE}?${new URLSearchParams({ module })}`, body, "Failed to add the person");
