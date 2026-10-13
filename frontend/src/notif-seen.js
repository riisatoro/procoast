const KEY = "procoast-notif-seen";
const MAX_IDS = 400;

function emptySeen() {
  return { until: "", ids: [] };
}

function normalizeSeen(value) {
  if (!value) return emptySeen();
  if (typeof value === "string") {
    if (value.startsWith("{")) {
      try {
        return normalizeSeen(JSON.parse(value));
      } catch {
        return emptySeen();
      }
    }
    return { until: value, ids: [] };
  }
  const until = typeof value.until === "string" ? value.until : "";
  const ids = Array.isArray(value.ids) ? value.ids.map(String).filter(Boolean) : [];
  return { until, ids };
}

export function loadNotifSeen() {
  try {
    return normalizeSeen(localStorage.getItem(KEY) || "");
  } catch {
    return emptySeen();
  }
}

export function saveNotifSeen(seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeSeen(seen)));
  } catch {
    /* ignore */
  }
}

export function isNotifUnread(item, seen) {
  const state = normalizeSeen(seen);
  const id = String(item?.id || "");
  if (id && state.ids.includes(id)) return false;
  if (state.until && String(item?.created_at || "") <= state.until) return false;
  return true;
}

export function unreadItems(items, seen) {
  return (items || []).filter((item) => isNotifUnread(item, seen));
}

export function unreadCount(items, seen) {
  return unreadItems(items, seen).length;
}

export function markNotifsRead(items, seen) {
  const state = normalizeSeen(seen);
  const ids = new Set(state.ids);
  for (const item of items || []) {
    if (item?.id != null && String(item.id)) ids.add(String(item.id));
  }
  const next = { until: state.until, ids: [...ids].slice(-MAX_IDS) };
  saveNotifSeen(next);
  return next;
}

export function markAllNotifsRead(items, seen) {
  const state = normalizeSeen(seen);
  const ids = new Set(state.ids);
  let until = state.until;
  for (const item of items || []) {
    if (item?.id != null && String(item.id)) ids.add(String(item.id));
    const iso = String(item?.created_at || "");
    if (iso > until) until = iso;
  }
  const next = { until, ids: [...ids].slice(-MAX_IDS) };
  saveNotifSeen(next);
  return next;
}
