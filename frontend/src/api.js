import { t } from "./i18n";

const API = import.meta.env.VITE_API_URL || "";
const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";
const USER_KEY = "procoast-user";

const unauthorizedListeners = new Set();
let refreshInFlight = null;

export function getToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function handleUnauthorized() {
  clearSession();
  unauthorizedListeners.forEach((listener) => listener());
}

function isAuthPath(path) {
  const value = String(path);
  return value.includes("/api/auth/login/") || value.includes("/api/auth/refresh/");
}

function buildHeaders(options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return false;
    const res = await fetch(`${API}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access) return false;
    localStorage.setItem(ACCESS_KEY, data.access);
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function api(path, options = {}) {
  let res = await fetch(`${API}${path}`, { ...options, headers: buildHeaders(options) });
  if (res.status === 401 && !isAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API}${path}`, { ...options, headers: buildHeaders(options) });
    }
    if (res.status === 401) handleUnauthorized();
  }
  return res;
}

export async function loginRequest(login, password) {
  const res = await api("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || t("api.loginFailed"));
  }
  localStorage.setItem(ACCESS_KEY, data.access);
  localStorage.setItem(REFRESH_KEY, data.refresh);
  storeUser(data.user);
  return data.user;
}

export async function fetchMe() {
  const res = await api("/api/auth/me/");
  if (!res.ok) return null;
  const me = await res.json();
  storeUser(me);
  return me;
}

export async function fetchDashboardStats(from, to) {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ from, to }).filter(([, v]) => v != null && v !== "")
    )
  ).toString();
  return jsonCall(`/api/dashboard/stats/${query ? `?${query}` : ""}`, {}, t("api.loadStats"));
}

function errorFromResponse(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === "string") return first;
  return fallback;
}

export async function fetchUsers() {
  const res = await api("/api/auth/users/");
  if (!res.ok) throw new Error(t("api.loadUsers"));
  return res.json();
}

export async function createUser(payload) {
  const res = await api("/api/auth/users/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorFromResponse(data, t("api.createUser")));
  return data;
}

export async function updateUser(id, payload) {
  const res = await api(`/api/auth/users/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorFromResponse(data, t("api.saveUser")));
  return data;
}

async function jsonCall(path, options, fallback) {
  const res = await api(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorFromResponse(data, fallback));
  return data;
}

export const fetchWarehouses = () => jsonCall("/api/warehouses/", {}, t("api.loadWarehouses"));
export const createWarehouse = (payload) =>
  jsonCall("/api/warehouses/", { method: "POST", body: JSON.stringify(payload) }, t("api.createWarehouse"));
export const updateWarehouse = (id, payload) =>
  jsonCall(`/api/warehouses/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveWarehouse"));

export const fetchMaterials = () => jsonCall("/api/materials/", {}, t("api.loadMaterials"));
export const createMaterial = (payload) =>
  jsonCall("/api/materials/", { method: "POST", body: JSON.stringify(payload) }, t("api.createMaterial"));
export const updateMaterial = (id, payload) =>
  jsonCall(`/api/materials/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveMaterial"));

export const fetchToolTypes = () => jsonCall("/api/tool-types/", {}, t("api.loadToolTypes"));
export const createToolType = (payload) =>
  jsonCall("/api/tool-types/", { method: "POST", body: JSON.stringify(payload) }, t("api.createToolType"));
export const updateToolType = (id, payload) =>
  jsonCall(`/api/tool-types/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveToolType"));

export const fetchTools = () => jsonCall("/api/instruments/", {}, t("api.loadTools"));
export const createTool = (payload) =>
  jsonCall("/api/instruments/", { method: "POST", body: JSON.stringify(payload) }, t("api.createTool"));
export const updateTool = (id, payload) =>
  jsonCall(`/api/instruments/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveTool"));

export const fetchProjects = () => jsonCall("/api/projects/", {}, t("api.loadProjects"));
export const fetchProject = (id) => jsonCall(`/api/projects/${id}/`, {}, t("api.loadProject"));
export const fetchArchivedProjects = () => jsonCall("/api/projects/archive/", {}, t("api.loadArchive"));
export const createProject = (payload) =>
  jsonCall("/api/projects/", { method: "POST", body: JSON.stringify(payload) }, t("api.createProject"));
export const updateProject = (id, payload) =>
  jsonCall(`/api/projects/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveProject"));
export const closeProject = (id) =>
  jsonCall(`/api/projects/${id}/close/`, { method: "POST" }, t("api.closeProject"));
export const discardProject = (id) =>
  jsonCall(`/api/projects/${id}/discard/`, { method: "POST" }, t("api.discardProject"));
export const restoreProject = (id) =>
  jsonCall(`/api/projects/${id}/restore/`, { method: "POST" }, t("api.restoreProject"));
export const purgeProject = async (id) => {
  const res = await api(`/api/projects/${id}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorFromResponse(data, t("api.purgeProject")));
  }
  return true;
};
export const setProjectStatus = (id, nextStatus) =>
  jsonCall(
    `/api/projects/${id}/set-status/`,
    { method: "POST", body: JSON.stringify({ status: nextStatus }) },
    t("api.changeStatus")
  );
export const addProjectMaterial = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/needed-materials/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.addMaterial")
  );
export const addProjectExpense = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/expenses/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.addExpense")
  );
export const addProjectSpending = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/spendings/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.addSpend")
  );
export const borrowProjectTool = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/borrow-tools/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.borrowTool")
  );
export const saveProjectToolChecks = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/tool-checks/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.saveToolChecks")
  );
export const addProjectTask = (id, payload) =>
  jsonCall(
    `/api/projects/${id}/tasks/`,
    { method: "POST", body: JSON.stringify(payload) },
    t("api.addTask")
  );
export const fetchReports = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return jsonCall(`/api/reports/${query ? `?${query}` : ""}`, {}, t("api.loadReports"));
};
export const fetchReport = (id) => jsonCall(`/api/reports/${id}/`, {}, t("api.loadReport"));
export const saveReport = (payload) =>
  jsonCall("/api/reports/", { method: "POST", body: JSON.stringify(payload) }, t("api.saveReport"));
export const updateReport = (id, payload) =>
  jsonCall(`/api/reports/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveReport"));
export const deleteReport = (id) =>
  jsonCall(`/api/reports/${id}/`, { method: "DELETE" }, t("api.deleteReport"));
export const fetchNotifications = () => jsonCall("/api/notifications/", {}, t("api.loadNotif"));
export const markNotificationsRead = (payload) =>
  jsonCall("/api/notifications/mark-read/", { method: "POST", body: JSON.stringify(payload) }, t("api.markNotif"));
export const fetchActivity = (userId) =>
  jsonCall(`/api/activity/${userId ? `?user=${userId}` : ""}`, {}, t("api.loadLog"));

export const fetchJobs = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return jsonCall(`/api/jobs/${query ? `?${query}` : ""}`, {}, t("api.loadJobs"));
};
export const createJob = (payload) =>
  jsonCall("/api/jobs/", { method: "POST", body: JSON.stringify(payload) }, t("api.createJob"));
export const updateJob = (id, payload) =>
  jsonCall(`/api/jobs/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, t("api.saveJob"));
export const deleteJob = (id) =>
  jsonCall(`/api/jobs/${id}/`, { method: "DELETE" }, t("api.deleteJob"));

function mapSystem(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    needsColor: !!row.needs_color,
    layers: (row.layers || []).map((layer) => ({
      name: layer.name,
      perM2: Number(layer.per_m2) || 0,
      role: layer.role || "",
      optional: !!layer.optional,
      note: layer.note || "",
    })),
  };
}

export async function fetchSystems() {
  const rows = await jsonCall("/api/systems/", {}, t("api.loadSystems"));
  return (Array.isArray(rows) ? rows : []).map(mapSystem);
}

export const fetchCalendarSettings = () =>
  jsonCall("/api/calendar-settings/", {}, t("api.loadCalendarSettings"));
export const saveCalendarSettings = (payload) =>
  jsonCall(
    "/api/calendar-settings/",
    { method: "PUT", body: JSON.stringify(payload) },
    t("api.saveCalendarSettings")
  );

function filenameFromDisposition(header, fallback) {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header || "");
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header || "");
  return plain?.[1] || fallback;
}

export async function downloadExportCsv({ type, from, to, user, lang }) {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ type, from, to, user, lang }).filter(([, v]) => v != null && v !== "")
    )
  ).toString();
  const res = await api(`/api/exports/csv/${query ? `?${query}` : ""}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorFromResponse(data, t("api.exportCsv")));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(res.headers.get("Content-Disposition"), `procoast-${type}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
