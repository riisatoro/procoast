import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  addProjectTask,
  deleteReport,
  fetchProject,
  fetchProjects,
  fetchReports,
  saveReport,
} from "./api";
import { STATUS_LABEL, statusClass } from "./projects";
import { useI18n } from "./i18n";
import { lastProjectId, rememberProject } from "./last-project";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];
const num = (v) => Number(v || 0);
const round2 = (n) => Math.round(n * 100) / 100;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const Reports = ({ user }) => {
  const { t, dateLocale } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState(null);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState("");
  const [taskAdds, setTaskAdds] = useState({});
  const [matAdds, setMatAdds] = useState({});
  const [notes, setNotes] = useState("");
  const [mine, setMine] = useState(null);
  const [todayList, setTodayList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [taskName, setTaskName] = useState("");

  const closed = project?.status === "closed";
  const tasks = project?.tasks || [];
  const materials = project?.needed_materials || [];
  const volume = num(project?.total_m2);
  const doneM2 = num(project?.done_m2);
  const pct = volume ? Math.min(100, Math.round((doneM2 / volume) * 100)) : 0;

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        const rows = Array.isArray(list) ? list : [];
        setProjects(rows);
        setProjectId((cur) => {
          if (cur && rows.some((p) => String(p.id) === String(cur))) return cur;
          return lastProjectId(rows);
        });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    fetchProject(projectId)
      .then((p) => {
        if (!cancelled) {
          setProject(p);
          setErr("");
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !date) return;
    let cancelled = false;
    (async () => {
      try {
        const [mineRows, allRows] = await Promise.all([
          fetchReports({ project: projectId, date, recorded_by: user.id }),
          isAdmin ? fetchReports({ date }) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const row = Array.isArray(mineRows) && mineRows[0] ? mineRows[0] : null;
        setMine(row);
        setNotes(row?.notes || "");
        const nextTasks = {};
        (row?.task_lines || []).forEach((line) => {
          nextTasks[String(line.task)] = num(line.quantity);
        });
        setTaskAdds(nextTasks);
        const nextMats = {};
        (row?.material_lines || []).forEach((line) => {
          nextMats[String(line.material)] = num(line.quantity);
        });
        setMatAdds(nextMats);
        setTodayList(Array.isArray(allRows) ? allRows : []);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, date, user.id, isAdmin]);

  const bump = (state, setState, key, delta) => {
    setState({ ...state, [key]: Math.max(0, round2((state[key] || 0) + delta)) });
  };

  const filtered = projects.filter((p) => {
    if (!search) return true;
    return `#${p.id} ${p.client} ${p.name} ${p.system || ""}`.toLowerCase().includes(search.toLowerCase());
  });

  const clear = () => {
    setTaskAdds({});
    setMatAdds({});
    setNotes("");
  };

  const save = async () => {
    if (!project || closed || busy) return;
    setBusy(true);
    setErr("");
    try {
      await saveReport({
        project_id: project.id,
        work_date: date,
        notes,
        task_lines: tasks.map((task) => ({
          task: task.id,
          quantity: round2(taskAdds[String(task.id)] || 0),
        })),
        material_lines: materials.map((row) => ({
          material: row.material,
          quantity: round2(matAdds[String(row.material)] || 0),
        })),
      }).then(async (savedRow) => {
        setMine(savedRow);
        setProject(await fetchProject(project.id));
        if (isAdmin) setTodayList(await fetchReports({ date }));
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    if (!project || !taskName.trim()) return;
    try {
      await addProjectTask(project.id, { name: taskName.trim(), unit: "m²", quantity_total: volume || 1 });
      setTaskName("");
      setProject(await fetchProject(project.id));
    } catch (e) {
      setErr(e.message);
    }
  };

  const removeReport = async (id) => {
    if (!confirm(t("reports.confirmDelete"))) return;
    try {
      await deleteReport(id);
      if (isAdmin) setTodayList(await fetchReports({ date }));
      if (project) setProject(await fetchProject(project.id));
      if (mine?.id === id) {
        clear();
        setMine(null);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("reports.eyebrow")}</div>
          <h1 className="page-title">{t("reports.title")}</h1>
          <p className="page-sub">{t("reports.sub")}</p>
        </div>
        <div className="page-actions">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} className="input input-sm" />
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : !projects.length ? (
        <section className="card muted">{t("reports.noProjects")}</section>
      ) : (
        <>
          <section className="card">
            <div className="search-wrap">
              <Icon name="search" size={16} />
              <input className="search-input" placeholder={t("reports.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="obj-picker">
              {filtered.map((p) => (
                <button key={p.id} className={`obj-pick ${String(p.id) === String(projectId) ? "on" : ""}`} onClick={() => { rememberProject(p.id); setProjectId(String(p.id)); }}>
                  <span className="obj-dot" style={{ background: p.color || PALETTE[p.id % PALETTE.length] }} />
                  <span className="mono obj-pick-id">#{p.id}</span>
                  <span className="obj-pick-name">{p.client || p.name}</span>
                  <span className="obj-pick-meta mono">{p.total_m2 ? `${num(p.total_m2)}m²` : ""}</span>
                  <span className="obj-pick-sys">{p.system || p.name}</span>
                </button>
              ))}
            </div>
          </section>

          {project && (
            <>
              <section className="card obj-summary">
                <div className="summary-head">
                  <div>
                    <div className="summary-eyebrow"><Icon name="mapPin" size={13} /> #{project.id} — {project.client || project.name}</div>
                    <div className="summary-addr">{project.address || t("common.dash")}</div>
                  </div>
                  <div className={`status ${statusClass(project.status)}`}>{t(STATUS_LABEL[project.status] || project.status)}</div>
                </div>
                <div className="summary-grid">
                  <div><div className="summary-label">{t("reports.system")}</div><div className="summary-val">{project.system || t("common.dash")}</div></div>
                  <div><div className="summary-label">{t("reports.volume")}</div><div className="summary-val mono">{volume ? `${volume} m²` : t("common.dash")}</div></div>
                  <div><div className="summary-label">{t("reports.start")}</div><div className="summary-val mono">{project.start_date || t("common.dash")}</div></div>
                  <div><div className="summary-label">{t("reports.plannedEnd")}</div><div className="summary-val mono">{project.end_date || t("common.dash")}</div></div>
                </div>
                <div className="summary-progress">
                  <div className="summary-progress-head">
                    <span>{t("reports.progress")}</span>
                    <span className="mono">{pct}% · {doneM2}/{volume || 0} m²</span>
                  </div>
                  <div className="bar lg"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                </div>
              </section>

              <div className="page-eyebrow step-2">{t("reports.step2")}</div>

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
                        mine?.task_lines?.find((line) => String(line.task) === String(task.id))?.quantity
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
                                <button type="button" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -1)}><Icon name="minus" size={12} /></button>
                                <input type="number" className="stepper-input mono" value={today} onChange={(e) => setTaskAdds({ ...taskAdds, [task.id]: Math.max(0, +e.target.value || 0) })} />
                                <button type="button" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 1)}><Icon name="plus" size={12} /></button>
                              </div>
                              <div className="quick-add">
                                <button type="button" className="qa-sub" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -5)}>−5</button>
                                <button type="button" className="qa-sub" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), -50)}>−50</button>
                                <button type="button" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 5)}>+5</button>
                                <button type="button" disabled={closed} onClick={() => bump(taskAdds, setTaskAdds, String(task.id), 50)}>+50</button>
                                <button type="button" className="qa-max" disabled={closed} onClick={() => setTaskAdds({ ...taskAdds, [task.id]: max })}>MAX</button>
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
                {!closed && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <input className="input" placeholder={t("reports.taskType")} value={taskName} onChange={(e) => setTaskName(e.target.value)} />
                    <button className="btn btn-outline" onClick={addTask}>{t("common.add")}</button>
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
                  <div className="data-table">
                    <div className="dt-head mat-head">
                      <div>{t("common.material")}</div>
                      <div>{t("reports.colorType")}</div>
                      <div className="ta-c">{t("reports.perM2")}</div>
                      <div className="ta-c">{t("reports.todayKg")}</div>
                      <div className="ta-r">{t("reports.stockRemain")}</div>
                    </div>
                    {materials.map((row) => {
                      const m = row.material_detail || {};
                      const today = matAdds[String(row.material)] || 0;
                      const stock = num(m.stock);
                      const savedToday = num(
                        mine?.material_lines?.find((line) => String(line.material) === String(row.material))?.quantity
                      );
                      const stockBase = stock + savedToday;
                      return (
                        <div key={row.id} className="dt-row mat-row">
                          <div className="dt-name">{m.name}</div>
                          <div className="muted">{m.color || t("common.dash")}</div>
                          <div className="ta-c mono small">{m.per_m2 != null ? `${m.per_m2} ${m.unit}/m²` : t("common.dash")}</div>
                          <div className="ta-c">
                            <div className="step-stack">
                              <div className="stepper">
                                <button type="button" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), -1)}><Icon name="minus" size={12} /></button>
                                <input type="number" className="stepper-input mono" value={today} onChange={(e) => setMatAdds({ ...matAdds, [row.material]: Math.max(0, +e.target.value || 0) })} />
                                <button type="button" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), 1)}><Icon name="plus" size={12} /></button>
                              </div>
                              <div className="quick-add">
                                <button type="button" className="qa-sub" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), -25)}>−25</button>
                                <button type="button" className="qa-sub" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), -5)}>−5</button>
                                <button type="button" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), 5)}>+5</button>
                                <button type="button" disabled={closed} onClick={() => bump(matAdds, setMatAdds, String(row.material), 25)}>+25</button>
                              </div>
                            </div>
                          </div>
                          <div className="ta-r mono">{round2(stockBase - today)} {m.unit}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="card">
                <label className="field">
                  <span className="field-label">{t("reports.notes")}</span>
                  <textarea className="textarea" rows="3" placeholder={t("reports.notesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
                <div className="form-foot">
                  <div className="muted small">{t("reports.registered", { date, name: user.name })}</div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={clear}>{t("reports.clear")}</button>
                    <button type="button" className="btn btn-primary" disabled={closed || busy} onClick={save}>
                      <Icon name="save" size={15} /> {busy ? t("common.saving") : t("reports.save")}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {saved && <div className="toast"><Icon name="check" size={14} /> {t("reports.saved")}</div>}

      {isAdmin && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">{t("reports.adminToday")}</h2>
            <span className="muted small">{date}</span>
          </div>
          {!todayList.length ? (
            <div className="muted small">{t("reports.noToday")}</div>
          ) : (
            <table className="table">
              <thead><tr><th>{t("reports.worker")}</th><th>{t("reports.object")}</th><th>{t("reports.works")}</th><th>{t("reports.time")}</th><th></th></tr></thead>
              <tbody>
                {todayList.map((r) => (
                  <tr key={r.id}>
                    <td><div className="cell-user"><span className="avatar xs">{r.recorded_by?.initials}</span> {r.recorded_by?.name}</div></td>
                    <td><span className="mono small muted">#{r.project?.id}</span> {r.project?.client || r.project?.name}</td>
                    <td>{r.summary || t("common.dash")}</td>
                    <td className="mono small">{r.updated_at ? new Date(r.updated_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" }) : ""}</td>
                    <td className="ta-r"><button className="icon-btn sm danger" onClick={() => removeReport(r.id)}><Icon name="trash" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
};

export default Reports;
