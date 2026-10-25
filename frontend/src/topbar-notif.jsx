import { useEffect, useState } from "react";
import Icon from "./icons";
import { fetchNotifications, markNotificationsRead } from "./api";
import { useI18n } from "./i18n";
import { loadNotifSeen, markAllNotifsRead, markNotifsRead, unreadItems } from "./notif-seen";

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

const NotificationsPop = ({ items: initialItems, seen: seenProp, onClose, onSeenChange, onLoaded, onOpenReport, onSelectObject }) => {
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState(initialItems || []);
  const seen = seenProp || loadNotifSeen();
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

  const visible = unreadItems(items, seen);
  const unread = visible.length;

  const applySeen = (next) => {
    onSeenChange && onSeenChange(next);
  };

  const syncFromServer = (data) => {
    const next = normalizeItems(data);
    setItems(next);
    if (onLoaded) onLoaded(next);
  };

  const markAll = () => {
    applySeen(markAllNotifsRead(visible, seen));
    markNotificationsRead({ all: true }).then(syncFromServer).catch(() => {});
  };

  const markOne = (n) => {
    applySeen(markNotifsRead([n], seen));
    if (n?.id) {
      markNotificationsRead({ ids: [n.id] }).then(syncFromServer).catch(() => {});
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={onClose} />
      <div className="notif-pop" onClick={(e) => e.stopPropagation()}>
        <div className="notif-head">
          <span>{t("notif.title", { n: unread })}</span>
          {unread > 0 && (
            <button className="link" style={{ fontSize: 11, letterSpacing: 0.04, textTransform: "none" }} onClick={markAll}>
              {t("notif.markAll")}
            </button>
          )}
        </div>
        <div className="notif-list">
          {err && <div className="muted small" style={{ padding: 12 }}>{err}</div>}
          {!visible.length && !err && <div className="muted small" style={{ padding: 16 }}>{t("notif.empty")}</div>}
          {visible.map((n) => {
            const isInfo = n.kind === "info" || n.source === "schedule" || n.code === "planned_days_exceeded";
            const copy = notifCopy(n, t);
            const iconKind = n.kind === "green" ? "green" : n.kind === "warn" ? "warn" : n.kind === "danger" ? "danger" : isInfo ? "info" : "";
            const navigates = Boolean(n.report_id || n.project_id);
            const open = () => {
              markOne(n);
              if (n.report_id && onOpenReport) onOpenReport(n.report_id);
              else if (n.project_id && onSelectObject) onSelectObject(n.project_id);
              if (navigates) onClose && onClose();
            };
            return (
              <div
                key={n.id}
                className={`notif-item unread ${isInfo ? "info" : ""} clickable`}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
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

const MobileTopbar = ({ onOpenSidebar, children }) => {
  const { t } = useI18n();
  return (
    <header className="app-chrome">
      <button className="menu-btn chrome-mobile" onClick={onOpenSidebar} aria-label={t("mobile.menu")}>
        <Icon name="moreH" size={18} />
      </button>
      <div className="mobile-topbar-brand chrome-mobile">
        <div className="mobile-topbar-logo">P</div>
        <span>PROCOAT</span>
      </div>
      <div className="app-chrome-actions">
        {children}
      </div>
    </header>
  );
};

export { NotificationsPop, MobileTopbar, normalizeItems };
