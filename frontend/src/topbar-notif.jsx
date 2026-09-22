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

function notifCopy(n, t) {
  if (n.code === "planned_days_exceeded") {
    return {
      title: t("notif.plannedDaysExceeded"),
      sub: t("notif.plannedDaysExceededSub", {
        id: n.project_id,
        name: n.project_name || "",
        planned: n.planned_days,
        elapsed: n.elapsed_days,
        overdue: n.overdue_days,
      }),
    };
  }
  return { title: n.title, sub: n.sub };
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

const NotificationsPop = ({ items: initialItems, onClose, onMarkAll, onLoaded, onOpenReport, onSelectObject }) => {
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
            const isInfo = n.kind === "info" || n.source === "schedule" || n.code === "planned_days_exceeded";
            const copy = notifCopy(n, t);
            const iconKind = n.kind === "green" ? "green" : n.kind === "warn" ? "warn" : n.kind === "danger" ? "danger" : isInfo ? "info" : "";
            const clickable = Boolean(n.report_id || n.project_id);
            const open = () => {
              if (n.report_id && onOpenReport) onOpenReport(n.report_id);
              else if (n.project_id && onSelectObject) onSelectObject(n.project_id);
              onClose && onClose();
            };
            return (
              <div
                key={n.id}
                className={`notif-item ${isUnread ? "unread" : ""} ${isInfo ? "info" : ""} ${clickable ? "clickable" : ""}`}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? open : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                } : undefined}
              >
                <div className={`notif-icon ${iconKind}`}>
                  <Icon name={n.icon || "bell"} size={14} />
                </div>
                <div className="notif-body">
                  <div className="notif-title-row">
                    <div className="notif-title">{copy.title}</div>
                    {isInfo && <span className="notif-info-pill">{t("notif.info")}</span>}
                  </div>
                  <div className="notif-sub">{copy.sub}</div>
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
