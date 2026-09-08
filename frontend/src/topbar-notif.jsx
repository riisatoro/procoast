import { useEffect, useState } from "react";
import Icon from "./icons";
import { fetchNotifications } from "./api";
import { useI18n } from "./i18n";
import { loadNotifSeen, saveNotifSeen, unreadCount } from "./notif-seen";

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function notifTime(iso, t, dateLocale) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
  }
  if (d.toDateString() === yest.toDateString()) return t("notif.yesterday");
  const days = Math.max(1, Math.round((now - d) / 86400000));
  if (days < 7) return t("notif.daysAgo", { n: days });
  return d.toLocaleDateString(dateLocale);
}

const NotificationsPop = ({ items: initialItems, onClose, onMarkAll, onLoaded }) => {
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState(initialItems || []);
  const [seen, setSeen] = useState(loadNotifSeen);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then((data) => {
        if (cancelled) return;
        const next = normalizeItems(data);
        setItems(next);
        if (onLoaded) onLoaded(next);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unread = unreadCount(items, seen);

  const markAll = () => {
    const latest = items.reduce((max, item) => {
      const iso = item.created_at || "";
      return iso > max ? iso : max;
    }, new Date().toISOString());
    saveNotifSeen(latest);
    setSeen(latest);
    onMarkAll && onMarkAll(latest);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={onClose} />
      <div className="notif-pop" onClick={(e) => e.stopPropagation()}>
        <div className="notif-head">
          <span>{t("notif.title", { n: unread })}</span>
          <button className="link" style={{ fontSize: 11, letterSpacing: 0.04, textTransform: "none" }} onClick={markAll}>
            {t("notif.markAll")}
          </button>
        </div>
        <div className="notif-list">
          {err && <div className="muted small" style={{ padding: 12 }}>{err}</div>}
          {!items.length && !err && <div className="muted small" style={{ padding: 16 }}>{t("notif.empty")}</div>}
          {items.map((n) => {
            const isUnread = !seen || String(n.created_at || "") > seen;
            return (
              <div key={n.id} className={`notif-item ${isUnread ? "unread" : ""}`}>
                <div className={`notif-icon ${n.kind === "green" ? "green" : n.kind === "warn" ? "warn" : n.kind === "danger" ? "danger" : ""}`}>
                  <Icon name={n.icon || "bell"} size={14} />
                </div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-sub">{n.sub}</div>
                  <div className="notif-time">{notifTime(n.created_at, t, dateLocale)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

const MobileTopbar = ({ onOpenSidebar }) => {
  const { t } = useI18n();
  return (
    <div className="mobile-topbar">
      <button className="menu-btn" onClick={onOpenSidebar} aria-label={t("mobile.menu")}>
        <Icon name="moreH" size={18} />
      </button>
      <div className="mobile-topbar-brand">
        <div className="mobile-topbar-logo">P</div>
        <span>PROCOAT</span>
      </div>
      <span className="live-dot" title={t("mobile.live")}></span>
    </div>
  );
};

export { NotificationsPop, MobileTopbar, normalizeItems };
