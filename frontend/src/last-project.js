const KEY = "procoast-last-project";

export function rememberProject(id) {
  if (id == null || id === "") return;
  try {
    sessionStorage.setItem(KEY, String(id));
  } catch {
    /* ignore */
  }
}

export function lastProjectId(list) {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved && list.some((p) => String(p.id) === saved)) return saved;
  } catch {
    /* ignore */
  }
  return list[0] ? String(list[0].id) : "";
}
