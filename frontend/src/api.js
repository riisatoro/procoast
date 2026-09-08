import { t } from "./i18n";

const API = import.meta.env.VITE_API_URL || "";

const unauthorizedListeners = new Set();

export function getToken() {
  return localStorage.getItem("access");
}

export function clearSession() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function handleUnauthorized() {
  clearSession();
  unauthorizedListeners.forEach((listener) => listener());
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const isLogin = String(path).includes("/api/auth/login/");
  if (!isLogin && (res.status === 401 || res.status === 403)) {
    handleUnauthorized();
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
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);
  return data.user;
}

export async function fetchMe() {
  const res = await api("/api/auth/me/");
  if (!res.ok) return null;
  return res.json();
}

export async function fetchDashboard() {
  const res = await api("/api/dashboard/");
  if (!res.ok) throw new Error(t("api.loadData"));
  return res.json();
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
export const saveReport = (payload) =>
  jsonCall("/api/reports/", { method: "POST", body: JSON.stringify(payload) }, t("api.saveReport"));
export const deleteReport = (id) =>
  jsonCall(`/api/reports/${id}/`, { method: "DELETE" }, t("api.deleteReport"));
export const fetchNotifications = () => jsonCall("/api/notifications/", {}, t("api.loadNotif"));
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
