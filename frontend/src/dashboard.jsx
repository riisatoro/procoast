import { useEffect, useState } from "react";
import Icon from "./icons";
import PeriodPicker, { formatPeriod } from "./period-picker";
import { closeProject, discardProject, fetchDashboardStats } from "./api";
import { OBJECT_STATUS_LABEL, objectStatusClass, objectUiStatus } from "./object-status";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];

const currentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
};

const qty = (v, locale) => {
  const n = Number(v || 0);
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
};

const Dashboard = ({ user, onNavigate, onSelectObject }) => {
  const { t, dateLocale } = useI18n();
  const [period, setPeriod] = useState(currentMonth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const periodLabel = formatPeriod(period.from, period.to, t);
  const isAdmin = user?.role === "ADMINISTRATORS";

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      setStats(await fetchDashboardStats(period.from, period.to));
    } catch (error) {
      setStats(null);
      setErr(error.message || t("dashboard.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period.from, period.to, t]);

  const projects = stats?.projects || {};
  const periodStats = stats?.period || {};
  const items = projects.items || [];
  const materials = stats?.material_usage || [];
  const todayReports = stats?.today_reports?.length ? stats.today_reports : stats?.today_jobs || [];
  const monthDelta = Number(periodStats.done_m2_delta || 0);

  const completeObject = async (p) => {
    const client = p.client || p.name;
    if (!window.confirm(t("dashboard.completeConfirm", { id: p.id, client }))) return;
    setBusyId(p.id);
    try {
      await closeProject(p.id);
      await load();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteObject = async (p) => {
    const client = p.client || p.name;
    if (!window.confirm(t("dashboard.deleteConfirm", { id: p.id, client }))) return;
    setBusyId(p.id);
    try {
      await discardProject(p.id);
      await load();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("dashboard.summary", { period: periodLabel.toUpperCase() })}</div>
          <h1 className="page-title">{t("dashboard.hello", { name: user.name.split(" ")[0] })}</h1>
          <p className="page-sub">{t("dashboard.sub")}</p>
        </div>
        <div className="page-actions">
          <PeriodPicker value={period} onChange={setPeriod} />
          <button className="btn btn-primary" onClick={() => onNavigate("calendar")}>
            <Icon name="calendarPlus" size={15} /> {t("dashboard.newEntry")}
          </button>
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t("dashboard.activeProjects")}</div>
          <div className="kpi-value mono">{loading ? "—" : projects.active || 0}</div>
          <div className="kpi-meta">
            {t("dashboard.projectMeta", {
              planned: projects.planned || projects.open || 0,
              completed: projects.closed || 0,
            })}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("dashboard.avgProgress")}</div>
          <div className="kpi-value mono">
            {loading ? "—" : projects.avg_progress || 0}
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-meta">
            {qty(projects.done_m2, dateLocale)} / {qty(projects.total_m2, dateLocale)} m²
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("dashboard.periodDone", { period: periodLabel })}</div>
          <div className="kpi-value mono">
            {loading ? "—" : qty(periodStats.done_m2, dateLocale)}
            <span className="kpi-unit">m²</span>
          </div>
          <div className={`kpi-meta ${monthDelta >= 0 ? "accent-up" : "accent-down"}`}>
            {t("dashboard.vsPrev", { delta: `${monthDelta >= 0 ? "+" : ""}${monthDelta}` })}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("dashboard.totalVolume")}</div>
          <div className="kpi-value mono">
            {loading ? "—" : qty(projects.ever_m2, dateLocale)}
            <span className="kpi-unit">m²</span>
          </div>
          <div className="kpi-meta">{t("dashboard.totalMeta", { n: projects.total || 0 })}</div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("dashboard.projectOverview")}</h2>
            <button type="button" className="link" onClick={() => onNavigate("reports")}>{t("dashboard.allReports")}</button>
          </div>
          {loading ? (
            <div className="muted small">{t("common.loading")}</div>
          ) : items.length === 0 ? (
            <div className="muted small">{t("dashboard.noProjects")}</div>
          ) : (
            <div className="obj-list">
              {items.map((p) => {
                const pct = p.progress_pct || 0;
                const ui = objectUiStatus(p.status);
                const label = p.client || p.name;
                const color = p.color || PALETTE[p.id % PALETTE.length];
                return (
                  <div key={p.id} className="obj-row">
                    <div className="obj-row-head">
                      <span className="obj-dot" style={{ background: color }} />
                      <span className="obj-id mono">#{p.id}</span>
                      <button
                        type="button"
                        className="obj-name"
                        style={{ background: "none", border: 0, padding: 0, textAlign: "left", flex: 1, cursor: "pointer", fontWeight: 600 }}
                        onClick={() => onSelectObject && onSelectObject(p.id)}
                      >
                        {label}
                      </button>
                      <span className={objectStatusClass(p.status)}>{t(OBJECT_STATUS_LABEL[ui])}</span>
                      <span className="obj-pct mono">{pct}%</span>
                      {isAdmin && ui !== "completed" && (
                        <button
                          className="icon-btn sm"
                          title={t("dashboard.completeObject")}
                          disabled={busyId === p.id}
                          onClick={() => completeObject(p)}
                        >
                          <Icon name="check" size={13} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="icon-btn sm danger"
                          title={t("dashboard.deleteObject")}
                          disabled={busyId === p.id}
                          onClick={() => deleteObject(p)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: pct + "%", background: ui === "completed" ? "#4CAF50" : "#2C5F2E" }} />
                    </div>
                    <div className="obj-row-meta">
                      <span>{p.system || p.address || t("common.dash")}</span>
                      <span className="mono">{qty(p.done_m2, dateLocale)} / {qty(p.total_m2, dateLocale)} m²</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("dashboard.jobsToday")}</h2>
            <span className="badge">{t("dashboard.entries", { n: todayReports.length })}</span>
          </div>
          {loading ? (
            <div className="muted small">{t("common.loading")}</div>
          ) : todayReports.length === 0 ? (
            <div className="muted small">{t("dashboard.noJobs")}</div>
          ) : (
            <div className="reports-feed">
              {todayReports.map((row) => (
                <div key={row.id} className="feed-row">
                  <div className="avatar sm">{row.worker || row.initials || "?"}</div>
                  <div className="feed-body">
                    <div className="feed-line">
                      <strong>{row.worker_name || row.assigned_to || row.worker}</strong>
                      <span className="muted">·</span>
                      {row.object_id || row.project_id ? <span className="mono small">#{row.object_id || row.project_id}</span> : null}
                      <span>{row.client || row.project}</span>
                    </div>
                    <div className="feed-sub">{row.summary || t("common.dash")}</div>
                  </div>
                  <div className="feed-time mono">
                    {row.created_at || row.starts_at
                      ? new Date(row.created_at || row.starts_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("dashboard.materialUse")}</h2>
          <span className="muted small">{t("dashboard.neededVsSpent")}</span>
        </div>
        {loading ? (
          <div className="muted small">{t("common.loading")}</div>
        ) : materials.length === 0 ? (
          <div className="muted small">{t("dashboard.noMaterials")}</div>
        ) : (
          <div className="mat-grid">
            {materials.map((m) => {
              const needed = Number(m.needed || 0);
              const spent = Number(m.spent || 0);
              const pct = needed ? Math.min(100, Math.round((spent / needed) * 100)) : 0;
              return (
                <div key={m.id} className="mat-mini">
                  <div className="mat-mini-head">
                    <span className="mat-mini-name">{m.name}{m.color ? ` · ${m.color}` : ""}</span>
                    <span className="mono small">{qty(spent, dateLocale)}/{qty(needed, dateLocale)} {m.unit}</span>
                  </div>
                  <div className="bar sm"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
