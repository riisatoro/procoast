import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { fetchProjects } from "./api";
import { STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";

const PAGE_SIZE = 10;
const STATUS_ORDER = { in_progress: 0, in_review: 1, open: 2 };

const AdminProjectsSidebar = ({ currentProjectId, onSelect, refreshKey, section }) => {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (cancelled) return;
        const sorted = [...(rows || [])].sort((a, b) => {
          const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          if (byStatus) return byStatus;
          return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        });
        setItems(sorted);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, section]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = useMemo(
    () => items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [items, safePage]
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const from = items.length ? safePage * PAGE_SIZE + 1 : 0;
  const to = Math.min(items.length, (safePage + 1) * PAGE_SIZE);

  return (
    <aside className="projects-rail">
      <div className="pr-head">
        <div className="pr-title">{t("rail.title")}</div>
        <div className="pr-count mono">{items.length}</div>
      </div>
      <div className="pr-list">
        {loading ? (
          <div className="pr-empty">{t("common.loading")}</div>
        ) : slice.length === 0 ? (
          <div className="pr-empty">{t("rail.empty")}</div>
        ) : (
          slice.map((p) => {
            const active = Number(currentProjectId) === Number(p.id);
            const label = p.client || p.name;
            return (
              <button
                key={p.id}
                type="button"
                className={`pr-item${active ? " active" : ""}${p.planned_days_exceeded ? " overdue" : ""}`}
                onClick={() => onSelect && onSelect(p.id)}
              >
                <span className="obj-dot" style={{ background: p.color || "#2C5F2E", marginTop: 4 }} />
                <span className="pr-item-body">
                  <span className="pr-item-name">
                    <span className="pr-item-id mono">#{p.id}</span> {label}
                  </span>
                  <span className="pr-item-meta">
                    {p.address || p.system || t("common.dash")}
                  </span>
                  <span className={`status ${statusClass(p.status)}`}>{t(STATUS_LABEL[p.status] || p.status)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
      {items.length > PAGE_SIZE && (
        <div className="pr-pager">
          <button
            type="button"
            className="icon-btn sm pr-page-btn"
            disabled={safePage <= 0}
            title={t("rail.prev")}
            onClick={() => setPage((n) => Math.max(0, n - 1))}
          >
            <Icon name="chevronLeft" size={14} />
          </button>
          <span className="pr-pager-info">
            {t("rail.page", { from, to, total: items.length })}
          </span>
          <button
            type="button"
            className="icon-btn sm pr-page-btn"
            disabled={safePage >= pageCount - 1}
            title={t("rail.next")}
            onClick={() => setPage((n) => Math.min(pageCount - 1, n + 1))}
          >
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </aside>
  );
};

export default AdminProjectsSidebar;
