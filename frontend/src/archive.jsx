import { useEffect, useState } from "react";
import Icon from "./icons";
import PeriodPicker from "./period-picker";
import { fetchArchivedProjects, fetchReports, purgeProject, restoreProject } from "./api";
import { OBJECT_STATUS_LABEL, objectStatusClass } from "./object-status";
import { useI18n } from "./i18n";
import ReportEntry from "./report-entry";

const num = (v) => Number(v || 0);

const Archive = ({ user, onSelectObject, onOpenReport, onProjectsChanged }) => {
  const { t, dateLocale } = useI18n();
  const [items, setItems] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("completed");
  const [period, setPeriod] = useState(null);
  const [err, setErr] = useState("");

  const loadProjects = async () => setItems(await fetchArchivedProjects());

  const loadReports = async (range) => {
    const params = range ? { from: range.from, to: range.to } : {};
    setReports(await fetchReports(params));
  };

  useEffect(() => {
    (async () => {
      try {
        await loadProjects();
      } catch (error) {
        setErr(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadReports(period).catch((error) => setErr(error.message));
  }, [period]);

  const completed = items.filter((p) => (p.archive_reason || p.status) !== "deleted" && p.status !== "deleted");
  const deleted = items.filter((p) => p.archive_reason === "deleted" || p.status === "deleted");
  const all = items;

  const inPeriod = (p) => {
    if (!period) return true;
    const d = (p.closed_at || p.updated_at || "").slice(0, 10);
    return d && d >= period.from && d <= period.to;
  };

  const source = tab === "completed" ? completed : tab === "deleted" ? deleted : all;
  const list = source.filter(inPeriod);

  const spentOf = (p) =>
    Object.values(p.spent_by_material || {}).reduce((s, v) => s + num(v), 0)
    + (p.spendings || []).reduce((s, row) => s + num(row.quantity), 0);

  const totalArchivedM2 = all.reduce((s, p) => s + num(p.total_m2), 0);
  const totalKgUsed = all.reduce((s, p) => s + spentOf(p), 0);

  const restore = async (p) => {
    try {
      await restoreProject(p.id);
      await loadProjects();
      onProjectsChanged && onProjectsChanged();
    } catch (error) {
      setErr(error.message);
    }
  };

  const purge = async (p) => {
    const client = p.client || p.name;
    if (!window.confirm(t("archive.purgeConfirm", { id: p.id, client }))) return;
    try {
      await purgeProject(p.id);
      await loadProjects();
    } catch (error) {
      setErr(error.message);
    }
  };

  const showReports = tab === "reports";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("archive.eyebrow")}</div>
          <h1 className="page-title">{t("archive.title")}</h1>
          <p className="page-sub">{t("archive.sub")}</p>
        </div>
        <div className="page-actions">
          <PeriodPicker value={period} onChange={setPeriod} />
          {period && <button className="btn btn-ghost" onClick={() => setPeriod(null)}>{t("archive.clearPeriod")}</button>}
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t("archive.closedProjects")}</div>
          <div className="kpi-value mono">{completed.length}</div>
          <div className="kpi-meta">{t("archive.completedMeta")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("archive.deleted")}</div>
          <div className="kpi-value mono">{deleted.length}</div>
          <div className="kpi-meta">{t("archive.deletedMeta")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("archive.totalVolume")}</div>
          <div className="kpi-value mono">{totalArchivedM2}<span className="kpi-unit">m²</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("archive.materialUsed")}</div>
          <div className="kpi-value mono">{totalKgUsed.toFixed(0)}<span className="kpi-unit">kg</span></div>
        </div>
      </section>

      <section className="card">
        <div className="seg" style={{ marginBottom: 16 }}>
          <button className={`seg-btn ${tab === "completed" ? "on" : ""}`} onClick={() => setTab("completed")}>
            {t("archive.tabCompleted", { n: completed.length })}
          </button>
          <button className={`seg-btn ${tab === "deleted" ? "on" : ""}`} onClick={() => setTab("deleted")}>
            {t("archive.tabDeleted", { n: deleted.length })}
          </button>
          <button className={`seg-btn ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>
            {t("archive.tabAll", { n: all.length })}
          </button>
          <button className={`seg-btn ${tab === "reports" ? "on" : ""}`} onClick={() => setTab("reports")}>
            {t("archive.tabReports", { n: reports.length })}
          </button>
        </div>

        {loading ? (
          <div className="muted small">{t("common.loading")}</div>
        ) : showReports ? (
          !reports.length ? (
            <div className="muted small ta-c" style={{ padding: 30 }}>{t("archive.reportsEmpty")}</div>
          ) : (
            <div className="reports-feed">
              {reports.map((row) => (
                <ReportEntry
                  key={row.id}
                  row={row}
                  onSelectProject={onSelectObject}
                  onOpen={onOpenReport}
                />
              ))}
            </div>
          )
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>{t("archive.project")}</th>
                <th>{t("archive.system")}</th>
                <th>{t("archive.volume")}</th>
                <th>{t("archive.reason")}</th>
                <th>{t("archive.date")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const deletedRow = p.archive_reason === "deleted" || p.status === "deleted";
                const reasonKey = deletedRow ? "deleted" : "completed";
                const archivedAt = (p.closed_at || p.updated_at || "").slice(0, 10);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="obj-dot" style={{ background: p.color || "#2C5F2E", width: 12, height: 12, display: "inline-block" }} />
                    </td>
                    <td>
                      <strong>#{p.id}</strong> {p.client || p.name}
                      <div className="muted small">{p.address}</div>
                    </td>
                    <td>{p.system || t("common.dash")}</td>
                    <td className="mono">{num(p.total_m2)} m²</td>
                    <td>
                      <span className={objectStatusClass(deletedRow ? "deleted" : "closed")}>
                        {t(OBJECT_STATUS_LABEL[reasonKey])}
                      </span>
                    </td>
                    <td className="mono small">
                      {archivedAt ? new Date(archivedAt).toLocaleDateString(dateLocale) : t("common.dash")}
                    </td>
                    <td className="ta-r">
                      {deletedRow ? (
                        <button className="icon-btn sm" title={t("archive.restore")} onClick={() => restore(p)}>
                          <Icon name="arrowRight" size={13} />
                        </button>
                      ) : (
                        <button className="icon-btn sm" title={t("common.view")} onClick={() => onSelectObject && onSelectObject(p.id)}>
                          <Icon name="edit" size={13} />
                        </button>
                      )}
                      <button className="icon-btn sm danger" title={t("archive.purge")} onClick={() => purge(p)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan="7" className="muted small ta-c" style={{ padding: 30 }}>{t("archive.empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default Archive;
