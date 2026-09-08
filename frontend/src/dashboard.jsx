import { useEffect, useState } from "react";
import Icon from "./icons";
import PeriodPicker, { formatPeriod } from "./period-picker";
import { fetchDashboardStats } from "./api";
import { useI18n } from "./i18n";
import { STATUS_LABEL, statusClass } from "./projects";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];

const currentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
};

const money = (v, locale) =>
  Number(v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const periodLabel = formatPeriod(period.from, period.to, t);

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
  const inventory = stats?.inventory || {};
  const periodStats = stats?.period || {};
  const items = projects.items || [];
  const materials = stats?.material_usage || [];
  const activity = stats?.activity || [];
  const todayJobs = stats?.today_jobs || [];
  const expenseDelta = Number(periodStats.expenses_delta || 0);

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
        <button type="button" className="kpi kpi-btn" onClick={() => onNavigate("projects")}>
          <div className="kpi-label">{t("dashboard.activeProjects")}</div>
          <div className="kpi-value mono">{loading ? "—" : projects.active || 0}</div>
          <div className="kpi-meta">
            {t("dashboard.projectMeta", {
              open: projects.open || 0,
              progress: projects.in_progress || 0,
              review: projects.in_review || 0,
            })}
          </div>
        </button>
        <div className="kpi">
          <div className="kpi-label">{t("dashboard.periodExpenses", { period: periodLabel })}</div>
          <div className="kpi-value mono">
            {loading ? "—" : money(periodStats.expenses, dateLocale)}
            <span className="kpi-unit">€</span>
          </div>
          <div className={`kpi-meta ${expenseDelta >= 0 ? "accent-up" : "accent-down"}`}>
            {t("dashboard.vsPrev", { delta: `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}` })}
          </div>
        </div>
        <button type="button" className="kpi kpi-btn" onClick={() => onNavigate("tools")}>
          <div className="kpi-label">{t("dashboard.toolsInUse")}</div>
          <div className="kpi-value mono">{loading ? "—" : qty(inventory.tools_borrowed, dateLocale)}</div>
          <div className="kpi-meta">
            {t("dashboard.toolsMeta", {
              available: qty(inventory.tools_available, dateLocale),
              stock: qty(inventory.tools_stock, dateLocale),
            })}
          </div>
        </button>
        <button type="button" className="kpi kpi-btn" onClick={() => onNavigate("materials")}>
          <div className="kpi-label">{t("dashboard.materials")}</div>
          <div className="kpi-value mono">{loading ? "—" : inventory.materials || 0}</div>
          <div className="kpi-meta">
            {t("dashboard.materialsMeta", {
              warehouses: inventory.warehouses || 0,
              low: inventory.shortages || 0,
            })}
          </div>
        </button>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("dashboard.projectOverview")}</h2>
            <button type="button" className="link" onClick={() => onNavigate("projects")}>{t("dashboard.allProjects")}</button>
          </div>
          {loading ? (
            <div className="muted small">{t("common.loading")}</div>
          ) : items.length === 0 ? (
            <div className="muted small">{t("dashboard.noProjects")}</div>
          ) : (
            <div className="obj-list">
              {items.map((p) => {
                const pct = p.material_pct || 0;
                return (
                  <div key={p.id} className="obj-row clickable" onClick={() => onSelectObject && onSelectObject(p.id)}>
                    <div className="obj-row-head">
                      <span className="obj-dot" style={{ background: PALETTE[p.id % PALETTE.length] }} />
                      <span className="obj-id mono">#{p.id}</span>
                      <span className="obj-name">{p.name}</span>
                      <span className={`status ${statusClass(p.status)}`}>{t(STATUS_LABEL[p.status])}</span>
                      <span className="obj-pct mono">{pct}%</span>
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: pct + "%" }} />
                    </div>
                    <div className="obj-row-meta">
                      <span>{p.assigned_to?.name || t("common.dash")} · {p.client || p.address || t("common.dash")}</span>
                      <span className="mono">{money(p.expenses_total, dateLocale)} €</span>
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
            <span className="badge">{t("dashboard.entries", { n: todayJobs.length })}</span>
          </div>
          {loading ? (
            <div className="muted small">{t("common.loading")}</div>
          ) : todayJobs.length === 0 ? (
            <div className="muted small">{t("dashboard.noJobs")}</div>
          ) : (
            <div className="reports-feed">
              {todayJobs.map((job) => (
                <div key={job.id} className="feed-row">
                  <div className="avatar sm">{job.initials || "?"}</div>
                  <div className="feed-body">
                    <div className="feed-line">
                      <strong>{job.assigned_to}</strong>
                      <span className="muted">·</span>
                      <span>{job.project}</span>
                    </div>
                    <div className="feed-sub">{job.client || t("common.dash")}</div>
                  </div>
                  <div className="feed-time mono">
                    {new Date(job.starts_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
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
                  <div className="muted tiny">{t("dashboard.stock", { n: `${qty(m.stock, dateLocale)} ${m.unit}` })}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("dashboard.recentActivity")}</h2>
          <span className="badge">{t("dashboard.entries", { n: activity.length })}</span>
        </div>
        {loading ? (
          <div className="muted small">{t("common.loading")}</div>
        ) : activity.length === 0 ? (
          <div className="muted small">{t("dashboard.noActivity")}</div>
        ) : (
          <div className="activity-list">
            {activity.map((a) => (
              <div key={a.id} className="activity-row">
                <div className="activity-date">{new Date(a.created_at).toLocaleString(dateLocale)}</div>
                <div>
                  <div className="activity-title">{a.summary}</div>
                  <div className="activity-sub">{a.user?.name || t("common.dash")} · {a.entity_type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
