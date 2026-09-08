import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { fetchJobs, fetchProject } from "./api";
import { STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const num = (v) => Number(v || 0);
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

const ObjectDetail = ({ user, objectId, onBack, onNavigate }) => {
  const { t, dateLocale } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [project, setProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, jobRows] = await Promise.all([
          fetchProject(objectId),
          fetchJobs({ project: objectId }),
        ]);
        if (cancelled) return;
        setProject(p);
        setJobs(Array.isArray(jobRows) ? jobRows : []);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectId]);

  const color = project?.color || PALETTE[(project?.id || 0) % PALETTE.length];
  const volume = num(project?.total_m2);
  const doneM2 = num(project?.done_m2);
  const pct = volume ? Math.min(100, Math.round((doneM2 / volume) * 100)) : 0;
  const needed = (project?.needed_materials || []).reduce((s, row) => s + num(row.quantity_needed), 0);
  const spentMap = project?.spent_by_material || {};
  const taken = Object.values(spentMap).reduce((s, v) => s + num(v), 0);
  const matPct = needed ? Math.min(100, Math.round((taken / needed) * 100)) : 0;
  const today = day(new Date().toISOString());

  const timeline = useMemo(() => {
    if (!project) return [];
    const items = [
      {
        date: day(project.start_date) || day(project.created_at),
        title: t("object.started"),
        desc: t("object.startedDesc"),
        workers: [],
        status: "done",
      },
    ];
    jobs
      .slice()
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
      .forEach((job) => {
        const start = day(job.starts_at);
        const end = day(job.ends_at) || start;
        let status = "planned";
        if (end < today) status = "done";
        else if (start <= today && end >= today) status = "current";
        items.push({
          date: start,
          dateEnd: end !== start ? end : "",
          title: job.project?.system || project.system || job.project?.name || project.name,
          desc: `${start}${end !== start ? ` → ${end}` : ""}`,
          workers: job.assigned_to?.initials ? [job.assigned_to.initials] : [],
          status,
        });
      });
    if (project.status === "closed") {
      items.push({
        date: day(project.closed_at) || day(project.end_date),
        title: t("object.completed"),
        desc: t("object.completedDesc"),
        workers: [],
        status: "done",
      });
    } else if (project.end_date) {
      items.push({
        date: project.end_date,
        title: t("object.plannedHandover"),
        desc: t("object.plannedHandoverDesc"),
        workers: [],
        status: "planned",
      });
    }
    return items;
  }, [project, jobs, t, today]);

  if (!project) {
    return <div className="page"><section className="card muted">{err || t("common.loading")}</section></div>;
  }

  const spendings = project.spendings || [];

  return (
    <div className="page">
      <header className="page-head obj-detail-head">
        <div>
          <button className="back-link" onClick={onBack}>
            <Icon name="chevronLeft" size={13} /> {t("common.back")}
          </button>
          <div className="obj-detail-id-row">
            <span className="obj-dot" style={{ background: color }} />
            <span className="obj-detail-id">#{project.id}</span>
            <span className={`status ${statusClass(project.status)}`}>{t(STATUS_LABEL[project.status] || project.status)}</span>
          </div>
          <h1 className="page-title">{project.client || project.name}</h1>
          <p className="page-sub"><Icon name="mapPin" size={12} /> {project.address || t("common.dash")}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => onNavigate("reports")}>
            <Icon name="clipboard" size={15} /> {t("object.report")}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate("materials")}>
            <Icon name="package" size={15} /> {t("object.materials")}
          </button>
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      <section className="obj-stats-grid">
        <div className="obj-stat">
          <div className="obj-stat-label">{t("object.progress")}</div>
          <div className="obj-stat-val">{pct}<span className="obj-stat-unit">%</span></div>
          <div className="bar sm" style={{ marginTop: 8 }}>
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">{t("object.volume")}</div>
          <div className="obj-stat-val">{doneM2}<span className="obj-stat-unit">/ {volume || 0} m²</span></div>
          <div className="obj-stat-meta">{t("object.remaining", { n: Math.max(0, round(volume - doneM2)) })}</div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">{t("object.material")}</div>
          <div className="obj-stat-val">{matPct}<span className="obj-stat-unit">%</span></div>
          <div className="obj-stat-meta">{t("object.taken", { taken: round(taken), needed: round(needed) })}</div>
        </div>
        <div className="obj-stat">
          <div className="obj-stat-label">{t("object.deadline")}</div>
          <div className="obj-stat-val mono" style={{ fontSize: 18 }}>{project.end_date || t("common.dash")}</div>
          <div className="obj-stat-meta">{t("object.from", { date: project.start_date || day(project.created_at) })}</div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("object.timeline")}</h2>
            <span className="muted small">{t("object.timelineSub")}</span>
          </div>
          <div className="timeline">
            {timeline.map((item, i) => (
              <div key={i} className="tl-item">
                <div className={`tl-bullet ${item.status}`}>
                  {item.status === "done" && <Icon name="check" size={11} />}
                  {item.status === "current" && <Icon name="clock" size={11} />}
                  {item.status === "planned" && <Icon name="calendar" size={11} />}
                </div>
                <div className="tl-row-meta">
                  <span className="tl-date">{item.date}{item.dateEnd ? ` → ${item.dateEnd}` : ""}</span>
                  <span className={`tl-status-tag ${item.status}`}>
                    {item.status === "done" ? t("object.tlDone") : item.status === "current" ? t("object.tlCurrent") : t("object.tlPlanned")}
                  </span>
                </div>
                <div className="tl-title">{item.title}</div>
                <div className="tl-desc">
                  <span>{item.desc}</span>
                  {item.workers?.length > 0 && (
                    <span className="tl-workers">
                      <Icon name="users" size={11} /> {item.workers.join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("object.taskProgress")}</h2>
            <button className="link" onClick={() => onNavigate("reports")}>{t("object.register")}</button>
          </div>
          <div className="task-progress-list">
            {(project.tasks || []).map((task) => {
              const total = num(task.quantity_total);
              const done = num(task.quantity_done);
              const tp = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
              return (
                <div key={task.id} className="task-progress-row">
                  <div>
                    <div className="task-progress-name">{task.name}</div>
                    <div className="task-progress-vals">{done} / {total} {task.unit}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>{tp}%</div>
                  <div className="task-progress-bar">
                    <div className="bar"><div className="bar-fill" style={{ width: tp + "%" }} /></div>
                  </div>
                </div>
              );
            })}
            {!(project.tasks || []).length && <div className="muted small">{t("reports.noTasks")}</div>}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("object.materials")}</h2>
          <button className="link" onClick={() => onNavigate("materials")}>{t("object.openList")}</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("common.material")}</th>
              <th>{t("object.colorType")}</th>
              <th>{t("object.norma")}</th>
              <th>{t("object.needed")}</th>
              <th>{t("object.takenCol")}</th>
              <th>{t("object.remain")}</th>
              <th>{t("object.progress")}</th>
            </tr>
          </thead>
          <tbody>
            {(project.needed_materials || []).map((row) => {
              const m = row.material_detail || {};
              const need = num(row.quantity_needed);
              const took = num(spentMap[String(row.material)]);
              const remain = round(need - took);
              const mp = need ? Math.min(100, Math.round((took / need) * 100)) : 0;
              return (
                <tr key={row.id}>
                  <td><strong>{m.name}</strong></td>
                  <td className="muted small">{m.color || t("common.dash")}</td>
                  <td className="mono small">{m.per_m2 != null ? `${m.per_m2} ${m.unit}/m²` : t("common.dash")}</td>
                  <td className="mono">{need} {m.unit}</td>
                  <td className="mono">{took} {m.unit}</td>
                  <td className={`mono ${remain <= 0 ? "ok" : ""}`}>{remain <= 0 ? t("object.remainDone") : `${remain} ${m.unit}`}</td>
                  <td style={{ minWidth: 140 }}>
                    <div className="bar sm"><div className="bar-fill" style={{ width: mp + "%" }} /></div>
                    <div className="mono tiny muted" style={{ marginTop: 3 }}>{mp}%</div>
                  </td>
                </tr>
              );
            })}
            {!(project.needed_materials || []).length && (
              <tr><td colSpan="7" className="muted small ta-c">{t("reports.noMaterials")}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("object.activity")}</h2>
          <span className="badge">{t("object.entries", { n: spendings.length })}</span>
        </div>
        <div className="activity-list">
          {spendings.slice(0, 12).map((s) => (
            <div key={s.id} className="activity-row">
              <div className="activity-date">{new Date(s.created_at).toLocaleString(dateLocale)}</div>
              <div>
                <div className="activity-title">{t("object.takenKg", { qty: s.quantity })} <span className="muted">— {s.material_detail?.name}</span></div>
                <div className="activity-sub">
                  <span className="avatar xs" style={{ display: "inline-grid", marginRight: 6, verticalAlign: "middle" }}>{s.recorded_by?.initials}</span>
                  {s.recorded_by?.name}
                </div>
              </div>
              <div className="activity-hours mono">+{s.quantity} {s.material_detail?.unit}</div>
            </div>
          ))}
          {!spendings.length && <div className="muted small">{t("object.noActivity")}</div>}
        </div>
      </section>
    </div>
  );
};

function round(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export default ObjectDetail;
