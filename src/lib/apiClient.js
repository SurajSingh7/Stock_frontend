import { API_BACKEND_URL } from "@/config/getEnvVariables";

/*
  The one place the app talks HTTP to its backends. Every call:
    - sends the session cookie (credentials: "include")
    - sends JSON, or a FormData body as-is (file uploads)
    - drops empty query values (undefined / null / "")
    - reads the backend's { success, message, data, pagination } envelope and
      throws ApiError when the status is not ok OR success === false — the
      second case is what used to fail silently as an empty page.

  Paths are the constants in @/constants/api. A path is relative to the stock
  backend unless it is already an absolute URL (portal / HRMS endpoints).

  Only this file may call fetch() — see the no-restricted-globals rule in
  eslint.config.mjs.
*/

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const toQueryString = (query) => {
  if (!query) return "";
  const params = query instanceof URLSearchParams ? query : new URLSearchParams();
  if (!(query instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
      else params.append(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
};

/**
 * Full URL for a path — for links the browser opens itself (PDFs, EventSource).
 * `base` "" keeps a path on this origin (the /erp-api rewrite in next.config.mjs).
 */
export const apiUrl = (path, query, base = API_BACKEND_URL) =>
  `${/^https?:\/\//.test(path) ? path : `${base}${path}`}${toQueryString(query)}`;

const SESSION_EXPIRED = "Your session has expired — please log in again.";

const request = async (method, path, { body, query, signal, base, fallback = "Request failed", raw = false } = {}) => {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res;
  try {
    res = await fetch(apiUrl(path, query, base), {
      method,
      credentials: "include",
      signal,
      headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("Could not reach the server", 0, null);
  }

  if (raw) {
    if (res.ok) return res;
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status === 401 ? SESSION_EXPIRED : json.message || fallback, res.status, json);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new ApiError(res.status === 401 ? SESSION_EXPIRED : json.message || fallback, res.status, json);
  }
  return json;
};

/*
  Each method resolves to the whole envelope ({ data, pagination, message, … })
  so callers pick what they need. Options: { query, signal, fallback, base }.
  `raw` resolves to the Response itself, for file downloads (res.blob()).
*/
export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  put: (path, body, opts) => request("PUT", path, { ...opts, body }),
  patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
  delete: (path, opts) => request("DELETE", path, opts),
  raw: (path, opts) => request("GET", path, { ...opts, raw: true }),
};

/** Saves a file response (Content-Disposition name, else `fallbackName`). */
export const saveDownload = async (res, fallbackName) => {
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
