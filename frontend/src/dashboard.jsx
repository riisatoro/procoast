import { useEffect, useState } from "react";
import Icon from "./icons";
import PeriodPicker, { formatPeriod } from "./period-picker";
import { closeProject, discardProject, fetchDashboardStats } from "./api";
import { OBJECT_STATUS_LABEL, objectStatusClass, objectUiStatus } from "./object-status";
import { useI18n } from "./i18n";
import CsvExportMenu from "./csv-export";

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

const dayLabel = (iso, locale) => {
  if (!iso) return "";
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const jobRangeLabel = (job, locale) => {
  const start = job.work_date || String(job.starts_at || "").slice(0, 10);
  const end = job.end_date || String(job.ends_at || job.starts_at || "").slice(0, 10);
  const a = dayLabel(start, locale);
  const b = dayLabel(end, locale);
  if (!a) return "";
  return a === b ? a : `${a} – ${b}`;
};

const Dashboard = ({ user, onNavigate, onSelectObject, onOpenReport, onEditProject, onProjectsChanged }) => {
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
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await fetchDashboardStats(period.from, period.to);
        if (!cancelled) setStats(data);
      } catch (error) {
        if (!cancelled) {
          setStats(null);
          setErr(error.message || t("dashboard.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period.from, period.to, t]);

  const projects = stats?.projects || {};
  const periodStats = stats?.period || {};
  const items = projects.items || [];
  const materials = stats?.material_usage || [];
  const periodJobs = stats?.period_jobs || [];
  const monthDelta = Number(periodStats.done_m2_delta || 0);

  const completeObject = async (p) => {
    if (!isAdmin) return;
    const client = p.client || p.name;
    if (!window.confirm(t("dashboard.completeConfirm", { id: p.id, client }))) return;
    setBusyId(p.id);
    try {
      await closeProject(p.id);
      await load();
      onProjectsChanged && onProjectsChanged();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteObject = async (p) => {
    if (!isAdmin) return;
    const client = p.client || p.name;
    if (!window.confirm(t("dashboard.deleteConfirm", { id: p.id, client }))) return;
    setBusyId(p.id);
    try {
      await discardProject(p.id);
      await load();
      onProjectsChanged && onProjectsChanged();
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
          {isAdmin && <CsvExportMenu from={period.from} to={period.to} />}
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => onNavigate("calendar")}>
              <Icon name="calendarPlus" size={15} /> {t("dashboard.newEntry")}
            </button>
          )}
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
                  <div key={p.id} className={`obj-row ${p.planned_days_exceeded ? "overdue" : ""}`}>
                    <div className="obj-row-head">
                      <span className="obj-dot" style={{ background: color }} />
                      <span className="obj-id mono">#{p.id}</span>
                      <button
                        type="button"
                        className="obj-name"
                        style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600 }}
                        onClick={() => onSelectObject && onSelectObject(p.id)}
                      >
                        {label}
                      </button>
                      {p.planned_days_exceeded && (
                        <span className="notif-info-pill" title={t("object.overdueBanner", { planned: p.planned_days, elapsed: p.elapsed_days, overdue: p.overdue_days })}>
                          {t("notif.info")}
                        </span>
                      )}
                      <span className={objectStatusClass(p.status)}>{t(OBJECT_STATUS_LABEL[ui])}</span>
                      <span className="obj-pct mono">{pct}%</span>
                      {isAdmin && ui !== "completed" && onEditProject && (
                        <button
                          className="btn btn-sm btn-ghost"
                          title={t("common.edit")}
                          disabled={busyId === p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(p);
                          }}
                        >
                          <Icon name="edit" size={13} /> {t("common.edit")}
                        </button>
                      )}
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
            <span className="badge">{t("dashboard.entries", { n: periodJobs.length })}</span>
          </div>
          {loading ? (
            <div className="muted small">{t("common.loading")}</div>
          ) : periodJobs.length === 0 ? (
            <div className="muted small">{t("dashboard.noJobs")}</div>
          ) : (
            <div className="reports-feed">
              {periodJobs.map((job) => {
                const color = job.color || PALETTE[(job.project_id || job.id) % PALETTE.length];
                const title = job.client || job.project_name || job.project || t("common.dash");
                return (
                  <article key={job.id} className="entry-card" style={{ "--entry-color": color }}>
                    <header className="entry-card-head">
                      <div className="entry-ident">
                        <div
                          className={`entry-project ${onSelectObject && (job.project_id || job.object_id) ? "clickable" : ""}`}
                          role={onSelectObject && (job.project_id || job.object_id) ? "button" : undefined}
                          onClick={() => {
                            const id = job.project_id || job.object_id;
                            if (id && onSelectObject) onSelectObject(id);
                          }}
                        >
                          <span className="obj-dot" style={{ background: color }} />
                          {job.project_id || job.object_id ? (
                            <span className="mono small">#{job.project_id || job.object_id}</span>
                          ) : null}
                          <span className="entry-project-name">{title}</span>
                          {job.address ? <span className="entry-project-addr">{job.address}</span> : null}
                        </div>
                        <div className="entry-person">
                          <span className="avatar sm">{job.initials || job.worker || "?"}</span>
                          <div>
                            <div className="entry-person-name">{job.worker_name || job.assigned_to || t("common.dash")}</div>
                          </div>
                        </div>
                        <div className="entry-when muted small">{jobRangeLabel(job, dateLocale)}</div>
                      </div>
                    </header>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
            <h2 className="card-title">{t("dashboard.materialUsePeriod", { period: periodLabel })}</h2>
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
