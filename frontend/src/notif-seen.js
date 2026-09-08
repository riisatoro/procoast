const KEY = "procoast-notif-seen";

export function loadNotifSeen() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function saveNotifSeen(iso) {
  try {
    localStorage.setItem(KEY, iso || new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function unreadCount(items, seen) {
  if (!seen) return items.length;
  return items.filter((item) => String(item.created_at || "") > seen).length;
}
