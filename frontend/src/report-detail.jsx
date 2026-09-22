import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { fetchProject, fetchReport, updateReport } from "./api";
import { STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";
import ReportEntry from "./report-entry";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const num = (v) => Number(v || 0);
const round2 = (n) => Math.round(n * 100) / 100;

const bump = (state, setState, key, delta) => {
  setState({ ...state, [key]: Math.max(0, round2((state[key] || 0) + delta)) });
};

function taskRows(project, report) {
  const byId = new Map();
  (project?.tasks || []).forEach((task) => {
    byId.set(String(task.id), {
      id: task.id,
      name: task.name,
      unit: task.unit || "m²",
      quantity_total: task.quantity_total,
      quantity_done: task.quantity_done,
    });
  });
  (report?.task_lines || []).forEach((line) => {
    const key = String(line.task);
    if (byId.has(key)) return;
    const detail = line.task_detail || {};
    byId.set(key, {
      id: line.task,
      name: detail.name || "",
      unit: detail.unit || "m²",
      quantity_total: detail.quantity_total,
      quantity_done: detail.quantity_done,
    });
  });
  return [...byId.values()];
}

function materialRows(project, report) {
  const list = [];
  const seen = new Set();
  (project?.needed_materials || []).forEach((row) => {
    const id = String(row.material);
    seen.add(id);
    const detail = row.material_detail || {};
    list.push({
      id: row.material,
      name: detail.name || "",
      color: detail.color || "",
      unit: detail.unit || "kg",
      per_m2: detail.per_m2,
      stock: detail.stock,
    });
  });
  (report?.material_lines || []).forEach((line) => {
    const id = String(line.material);
    if (seen.has(id)) return;
    const detail = line.material_detail || {};
    list.push({
      id: line.material,
      name: detail.name || "",
      color: detail.color || "",
      unit: detail.unit || "kg",
      per_m2: detail.per_m2,
      stock: detail.stock,
    });
  });
  return list;
}

function hydrateEdits(report) {
  const taskAdds = {};
  (report?.task_lines || []).forEach((line) => {
    taskAdds[String(line.task)] = num(line.quantity);
  });
  const matAdds = {};
  (report?.material_lines || []).forEach((line) => {
    matAdds[String(line.material)] = num(line.quantity);
  });
  return { taskAdds, matAdds, notes: report?.notes || "" };
}

const ReportDetail = ({ user, reportId, onBack, onSelectObject }) => {
  const { t, dateLocale } = useI18n();
  const isAdmin = user?.role === "ADMINISTRATORS";
  const [report, setReport] = useState(null);
  const [project, setProject] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [taskAdds, setTaskAdds] = useState({});
  const [matAdds, setMatAdds] = useState({});

  const load = async () => {
    const row = await fetchReport(reportId);
    setReport(row);
    const edits = hydrateEdits(row);
    setNotes(edits.notes);
    setTaskAdds(edits.taskAdds);
    setMatAdds(edits.matAdds);
    if (row?.project?.id) {
      try {
        setProject(await fetchProject(row.project.id));
      } catch {
        setProject(null);
      }
    } else {
      setProject(null);
    }
    return row;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await load();
        if (cancelled) return;
        setErr("");
        if (!row) setErr(t("reportDetail.notFound"));
      } catch (e) {
        if (!cancelled) {
          setReport(null);
          setErr(e.message || t("reportDetail.notFound"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const tasks = useMemo(() => taskRows(project, report), [project, report]);
  const materials = useMemo(() => materialRows(project, report), [project, report]);
  const status = project?.status || report?.project?.status || "";
  const archived = status === "closed" || status === "deleted";
  const isOwner = String(report?.recorded_by?.id) === String(user?.id);
  const canEdit = isAdmin || (isOwner && !archived);
  const color = report?.project?.color || PALETTE[(report?.project?.id || 0) % PALETTE.length];
  const dateLabel = report?.work_date
    ? new Date(`${report.work_date}T12:00:00`).toLocaleDateString(dateLocale, {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const projectTitle = report?.project?.client || report?.project?.name || t("common.dash");

  const startEdit = () => {
    const edits = hydrateEdits(report);
    setNotes(edits.notes);
    setTaskAdds(edits.taskAdds);
    setMatAdds(edits.matAdds);
    setEditing(true);
    setErr("");
  };

  const cancelEdit = () => {
    const edits = hydrateEdits(report);
    setNotes(edits.notes);
    setTaskAdds(edits.taskAdds);
    setMatAdds(edits.matAdds);
    setEditing(false);
    setErr("");
  };

  const save = async () => {
    if (!report || busy || !canEdit) return;
    setBusy(true);
    setErr("");
    try {
      const savedRow = await updateReport(report.id, {
        notes,
        task_lines: tasks.map((task) => ({
          task: task.id,
          quantity: round2(taskAdds[String(task.id)] || 0),
        })),
        material_lines: materials.map((row) => ({
          material: row.id,
          quantity: round2(matAdds[String(row.id)] || 0),
        })),
      });
      setReport(savedRow);
      const edits = hydrateEdits(savedRow);
      setNotes(edits.notes);
      setTaskAdds(edits.taskAdds);
      setMatAdds(edits.matAdds);
      if (savedRow?.project?.id) {
        try {
          setProject(await fetchProject(savedRow.project.id));
        } catch {
          /* keep previous project payload */
        }
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!report) {
    return (
      <div className="page">
        <header className="page-head obj-detail-head">
          <div>
            <button className="back-link" onClick={onBack}>
              <Icon name="chevronLeft" size={13} /> {t("common.back")}
            </button>
            <h1 className="page-title">{t("reportDetail.title")}</h1>
          </div>
        </header>
        <section className="card muted">{err || t("common.loading")}</section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head obj-detail-head">
        <div>
          <button className="back-link" onClick={onBack}>
            <Icon name="chevronLeft" size={13} /> {t("common.back")}
          </button>
          <div className="page-eyebrow">{t("reportDetail.eyebrow")}</div>
          <h1 className="page-title">{t("reportDetail.title")}</h1>
          <p className="page-sub">{dateLabel} · {projectTitle}</p>
        </div>
        <div className="page-actions">
          {report.project?.id && (
            <button className="btn btn-ghost" onClick={() => onSelectObject && onSelectObject(report.project.id)}>
              <Icon name="mapPin" size={15} /> {t("reportDetail.openProject")}
            </button>
          )}
          {canEdit && !editing && (
            <button className="btn btn-primary" onClick={startEdit}>
              <Icon name="edit" size={15} /> {t("common.edit")}
            </button>
          )}
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      <section className="card obj-summary">
        <div className="summary-head">
          <div>
            <div className="summary-eyebrow">
              <span className="obj-dot" style={{ background: color }} />
              #{report.project?.id} — {projectTitle}
            </div>
            <div className="summary-addr">{report.project?.address || t("common.dash")}</div>
          </div>
          {status ? (
            <div className={`status ${statusClass(status)}`}>{t(STATUS_LABEL[status] || status)}</div>
          ) : null}
        </div>
        <div className="summary-grid">
          <div>
            <div className="summary-label">{t("reportDetail.date")}</div>
            <div className="summary-val mono">{dateLabel || t("common.dash")}</div>
          </div>
          <div>
            <div className="summary-label">{t("reportDetail.enteredBy")}</div>
            <div className="summary-val">{report.recorded_by?.name || t("common.dash")}</div>
          </div>
          <div>
            <div className="summary-label">{t("reports.system")}</div>
            <div className="summary-val">{report.project?.system || t("common.dash")}</div>
          </div>
        </div>
      </section>

      {!editing && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("reportDetail.submitted")}</h2>
          </div>
          <ReportEntry row={report} />
        </section>
      )}

      {editing && (
        <>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("reports.tasks")}</h2>
              <span className="muted small">{t("reports.tasksHint")}</span>
            </div>
            {!tasks.length ? (
              <div className="muted small">{t("reports.noTasks")}</div>
            ) : (
              <div className="data-table">
                <div className="dt-head">
                  <div>{t("reports.taskType")}</div>
                  <div className="ta-c">{t("reports.unit")}</div>
                  <div className="ta-c">{t("reports.todayDone")}</div>
                  <div className="ta-r">{t("reports.totalDone")}</div>
                  <div className="ta-r">{t("reports.remain")}</div>
                </div>
                {tasks.map((task) => {
                  const today = taskAdds[String(task.id)] || 0;
                  const done = num(task.quantity_done);
                  const savedToday = num(
                    report?.task_lines?.find((line) => String(line.task) === String(task.id))?.quantity
                  );
                  const prior = round2(Math.max(0, done - savedToday));
                  const total = num(task.quantity_total);
                  const remain = round2(total - prior - today);
                  const max = Math.max(0, total - prior);
                  return (
                    <div key={task.id} className="dt-row">
                      <div className="dt-name">{task.name}</div>
                      <div className="ta-c mono small muted">{task.unit}</div>
                      <div className="ta-c">
                        <div className="step-stack">
                          <div className="stepper">
                            <button type="button" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -1)}>
                              <Icon name="minus" size={12} />
                            </button>
                            <input
                              type="number"
                              className="stepper-input mono"
                              value={today}
                              onChange={(e) => setTaskAdds({ ...taskAdds, [task.id]: Math.max(0, +e.target.value || 0) })}
                            />
                            <button type="button" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 1)}>
                              <Icon name="plus" size={12} />
                            </button>
                          </div>
                          <div className="quick-add">
                            <button type="button" className="qa-sub" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -5)}>−5</button>
                            <button type="button" className="qa-sub" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -50)}>−50</button>
                            <button type="button" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 5)}>+5</button>
                            <button type="button" onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 50)}>+50</button>
                            <button type="button" className="qa-max" onClick={() => setTaskAdds({ ...taskAdds, [task.id]: max })}>MAX</button>
                          </div>
                        </div>
                      </div>
                      <div className="ta-r mono">{round2(prior + today)} {task.unit}</div>
                      <div className={`ta-r mono ${remain < 0 ? "danger" : ""}`}>{remain} {task.unit}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("reports.materials")}</h2>
              <span className="muted small">{t("reports.materialsHint")}</span>
            </div>
            {!materials.length ? (
              <div className="muted small">{t("reports.noMaterials")}</div>
            ) : (
              <div className="table-scroll">
                <div className="data-table">
                  <div className="dt-head mat-head">
                    <div>{t("common.material")}</div>
                    <div>{t("reports.colorType")}</div>
                    <div className="ta-c">{t("reports.perM2")}</div>
                    <div className="ta-c">{t("reports.todayKg")}</div>
                    <div className="ta-r">{t("reports.stockRemain")}</div>
                  </div>
                  {materials.map((row) => {
                    const today = matAdds[String(row.id)] || 0;
                    const stock = num(row.stock);
                    const savedToday = num(
                      report?.material_lines?.find((line) => String(line.material) === String(row.id))?.quantity
                    );
                    const stockBase = stock + savedToday;
                    return (
                      <div key={row.id} className="dt-row mat-row">
                        <div className="dt-name">
                          {row.name}
                          {row.color ? <span className="mat-color"> · {row.color}</span> : null}
                        </div>
                        <div>
                          {row.color ? <span className="mat-color-chip">{row.color}</span> : <span className="muted">{t("common.dash")}</span>}
                        </div>
                        <div className="ta-c mono small">{row.per_m2 != null ? `${row.per_m2} ${row.unit}/m²` : t("common.dash")}</div>
                        <div className="ta-c">
                          <div className="step-stack">
                            <div className="stepper">
                              <button type="button" onClick={() => bump(matAdds, setMatAdds, String(row.id), -1)}>
                                <Icon name="minus" size={12} />
                              </button>
                              <input
                                type="number"
                                className="stepper-input mono"
                                value={today}
                                onChange={(e) => setMatAdds({ ...matAdds, [row.id]: Math.max(0, +e.target.value || 0) })}
                              />
                              <button type="button" onClick={() => bump(matAdds, setMatAdds, String(row.id), 1)}>
                                <Icon name="plus" size={12} />
                              </button>
                            </div>
                            <div className="quick-add">
                              <button type="button" className="qa-sub" onClick={() => bump(matAdds, setMatAdds, String(row.id), -25)}>−25</button>
                              <button type="button" className="qa-sub" onClick={() => bump(matAdds, setMatAdds, String(row.id), -5)}>−5</button>
                              <button type="button" onClick={() => bump(matAdds, setMatAdds, String(row.id), 5)}>+5</button>
                              <button type="button" onClick={() => bump(matAdds, setMatAdds, String(row.id), 25)}>+25</button>
                            </div>
                          </div>
                        </div>
                        <div className="ta-r mono">{round2(stockBase - today)} {row.unit}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <label className="field">
              <span className="field-label">{t("reports.notes")}</span>
              <textarea className="textarea" rows="3" placeholder={t("reports.notesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="form-foot">
              <div className="muted small">{t("reportDetail.editingAs", { name: user.name })}</div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>{t("common.cancel")}</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
                  <Icon name="save" size={15} /> {busy ? t("common.saving") : t("reportDetail.save")}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {saved && <div className="toast"><Icon name="check" size={14} /> {t("reportDetail.saved")}</div>}
    </div>
  );
};

export default ReportDetail;
