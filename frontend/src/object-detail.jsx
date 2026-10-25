import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { fetchJobs, fetchProject, fetchReports, purgeProject } from "./api";
import { STATUS_LABEL, statusClass } from "./projects";
import { assigneeNames, projectAssignees } from "./assignees";
import { useI18n } from "./i18n";
import ReportEntry from "./report-entry";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const num = (v) => Number(v || 0);
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

const ObjectDetail = ({ user, objectId, onBack, onNavigate, onOpenReport, onEdit }) => {
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [reports, setReports] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === "ADMINISTRATORS";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, jobRows, reportRows] = await Promise.all([
          fetchProject(objectId),
          fetchJobs({ project: objectId }),
          fetchReports({ project: objectId }),
        ]);
        if (cancelled) return;
        setProject(p);
        setJobs(Array.isArray(jobRows) ? jobRows : []);
        setReports(Array.isArray(reportRows) ? reportRows : []);
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

  const archived = project?.status === "closed" || project?.status === "deleted";

  const purge = async () => {
    const client = project.client || project.name;
    if (!window.confirm(t("archive.purgeConfirm", { id: project.id, client }))) return;
    setBusy(true);
    setErr("");
    try {
      await purgeProject(project.id);
      onBack();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return <div className="page"><section className="card muted">{err || t("common.loading")}</section></div>;
  }

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
          {projectAssignees(project).length > 0 && (
            <p className="page-sub">{t("projects.assignee", { name: assigneeNames(project) })}</p>
          )}
          {isAdmin && !archived && onEdit && (
            <p className="page-sub muted small">{t("object.editHint")}</p>
          )}
        </div>
        <div className="page-actions">
          {isAdmin && !archived && onEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(project)}>
              <Icon name="edit" size={15} /> {t("common.edit")}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => onNavigate("reports")}>
            <Icon name="clipboard" size={15} /> {t("object.report")}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate("materials")}>
            <Icon name="package" size={15} /> {t("object.materials")}
          </button>
          {isAdmin && archived && (
            <button className="btn btn-danger" disabled={busy} onClick={purge}>
              <Icon name="trash" size={15} /> {t("archive.purge")}
            </button>
          )}
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      {project.planned_days_exceeded && (
        <div className="info-strip" style={{ marginBottom: 16 }}>
          <Icon name="clock" size={14} />
          <span>{t("object.overdueBanner", { planned: project.planned_days, elapsed: project.elapsed_days, overdue: project.overdue_days })}</span>
        </div>
      )}

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
        <div className={`obj-stat ${project.planned_days_exceeded ? "warn" : ""}`}>
          <div className="obj-stat-label">{t("object.deadline")}</div>
          <div className="obj-stat-val mono" style={{ fontSize: 18 }}>{project.end_date || t("common.dash")}</div>
          <div className="obj-stat-meta">
            {project.planned_days
              ? t("object.plannedDaysMeta", { n: project.planned_days, date: project.start_date || day(project.created_at) })
              : t("object.from", { date: project.start_date || day(project.created_at) })}
          </div>
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
        <div className="table-scroll">
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
                  <td data-label={t("common.material")}><strong>{m.name}</strong></td>
                  <td className="muted small" data-label={t("object.colorType")}>{m.color || t("common.dash")}</td>
                  <td className="mono small" data-label={t("object.norma")}>{m.per_m2 != null ? `${m.per_m2} ${m.unit}/m²` : t("common.dash")}</td>
                  <td className="mono" data-label={t("object.needed")}>{need} {m.unit}</td>
                  <td className="mono" data-label={t("object.takenCol")}>{took} {m.unit}</td>
                  <td className={`mono ${remain <= 0 ? "ok" : ""}`} data-label={t("object.remain")}>{remain <= 0 ? t("object.remainDone") : `${remain} ${m.unit}`}</td>
                  <td data-label={t("object.progress")}>
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
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("object.activity")}</h2>
          <span className="badge">{t("object.entries", { n: reports.length })}</span>
        </div>
        {!reports.length ? (
          <div className="muted small">{t("object.noActivity")}</div>
        ) : (
          <div className="reports-feed">
            {reports.slice(0, 12).map((row) => (
              <ReportEntry key={row.id} row={row} hideProject onOpen={onOpenReport} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function round(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export default ObjectDetail;
