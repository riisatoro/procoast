import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  addProjectExpense,
  addProjectMaterial,
  addProjectSpending,
  borrowProjectTool,
  closeProject,
  createProject,
  fetchMaterials,
  fetchProject,
  fetchProjects,
  fetchSystems,
  fetchTools,
  fetchUsers,
  setProjectStatus,
  updateProject,
} from "./api";
import { AssigneePicker, assigneeNames, projectAssignees } from "./assignees";
import { useI18n } from "./i18n";

const PALETTE = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B"];

const ymd = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const parseDay = (s) => new Date(`${s}T12:00:00`);
const addDays = (s, n) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const diffDaysInclusive = (from, to) => {
  if (!from || !to) return "";
  return Math.round((parseDay(to) - parseDay(from)) / 86400000) + 1;
};

const STATUS_LABEL = {
  open: "projectStatus.open",
  in_progress: "projectStatus.in_progress",
  in_review: "projectStatus.in_review",
  closed: "projectStatus.closed",
};

const statusClass = (s) =>
  s === "closed" ? "status-completed" : s === "in_review" ? "status-planned" : "status-active";

const ProjectForm = ({ users, onClose, onSave }) => {
  const { t } = useI18n();
  const [systems, setSystems] = useState([]);
  const [form, setForm] = useState({
    name: "",
    client: "",
    address: "",
    description: "",
    system: "",
    color: PALETTE[0],
    total_m2: "",
    start_date: "",
    end_date: "",
    planned_days: "",
    assigned_to_ids: users[0]?.id ? [Number(users[0].id)] : [],
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    fetchSystems()
      .then(setSystems)
      .catch(() => setSystems([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.assigned_to_ids.length) {
      setErr(t("projects.fillRequired"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        name: form.name.trim(),
        client: form.client.trim(),
        address: form.address.trim(),
        description: form.description.trim(),
        system: form.system.trim(),
        color: form.color || PALETTE[0],
        total_m2: form.total_m2 === "" ? null : Number(form.total_m2),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        planned_days: form.planned_days === "" ? null : Number(form.planned_days),
        assigned_to_ids: form.assigned_to_ids,
      });
    } catch (error) {
      setErr(error.message || t("common.saveFailed"));
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">{t("projects.modalEyebrow")}</div>
            <h3 className="modal-title">{t("projects.new")}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field">
              <span className="field-label">{t("common.name")}</span>
              <input className="input" value={form.name} onChange={set("name")} />
            </label>
            <label className="field">
              <span className="field-label">{t("common.client")}</span>
              <input className="input" value={form.client} onChange={set("client")} />
            </label>
            <label className="field">
              <span className="field-label">{t("projects.assigneeField")}</span>
              <AssigneePicker
                users={users}
                value={form.assigned_to_ids}
                onChange={(assigned_to_ids) => setForm((f) => ({ ...f, assigned_to_ids }))}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("common.address")}</span>
              <input className="input" value={form.address} onChange={set("address")} />
            </label>
            <label className="field">
              <span className="field-label">{t("newObject.system")}</span>
              <select className="select" value={form.system} onChange={set("system")}>
                <option value="">{t("common.dash")}</option>
                {systems.map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("newObject.volume")}</span>
                <input className="input" type="number" min="0" step="0.01" value={form.total_m2} onChange={set("total_m2")} />
              </label>
              <label className="field">
                <span className="field-label">{t("newObject.calColor")}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" className="input" value={form.color} onChange={set("color")} style={{ padding: 2, height: 38, width: 52 }} />
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="obj-dot"
                        style={{ background: c, width: 16, height: 16, border: form.color === c ? "2px solid #111" : "none" }}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                      />
                    ))}
                  </div>
                </div>
              </label>
            </div>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("newObject.dateFrom")}</span>
                <input
                  className="input"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => {
                    const start_date = e.target.value;
                    setForm((f) => {
                      const next = { ...f, start_date };
                      if (start_date && f.planned_days) next.end_date = addDays(start_date, Number(f.planned_days) - 1);
                      else if (start_date && f.end_date) {
                        const days = diffDaysInclusive(start_date, f.end_date);
                        if (days >= 1) next.planned_days = days;
                      }
                      return next;
                    });
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("newObject.plannedDays")}</span>
                <input
                  className="input mono"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="5"
                  value={form.planned_days}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setForm((f) => {
                      if (raw === "") return { ...f, planned_days: "" };
                      const planned_days = Math.max(1, parseInt(raw, 10) || 1);
                      const next = { ...f, planned_days };
                      if (f.start_date) next.end_date = addDays(f.start_date, planned_days - 1);
                      return next;
                    });
                  }}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">{t("newObject.plannedEnd")}</span>
              <input
                className="input"
                type="date"
                value={form.end_date}
                onChange={(e) => {
                  const end_date = e.target.value;
                  setForm((f) => {
                    const next = { ...f, end_date };
                    if (f.start_date && end_date) {
                      const days = diffDaysInclusive(f.start_date, end_date);
                      if (days >= 1) next.planned_days = days;
                    }
                    return next;
                  });
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("common.description")}</span>
              <textarea className="textarea" value={form.description} onChange={set("description")} rows={3} />
            </label>
            {err && <div className="login-err">{err}</div>}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("common.create")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

const ProjectDetail = ({ user, projectId, onBack, readOnly }) => {
  const { t, dateLocale } = useI18n();
  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [tools, setTools] = useState([]);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [need, setNeed] = useState({ material: "", quantity_needed: "" });
  const [expense, setExpense] = useState({ title: "", amount: "", note: "" });
  const [spend, setSpend] = useState({ material: "", quantity: "" });
  const [borrow, setBorrow] = useState({ tool: "", quantity: "" });
  const [spendBusy, setSpendBusy] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [people, setPeople] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const isAdmin = user?.role === "ADMINISTRATORS";
  const closed = project?.status === "closed" || readOnly;

  const load = async () => {
    const [p, mats, toolItems] = await Promise.all([
      fetchProject(projectId),
      fetchMaterials(),
      fetchTools(),
    ]);
    setProject(p);
    setAssigneeIds(projectAssignees(p).map((person) => Number(person.id)));
    setMaterials(Array.isArray(mats) ? mats : []);
    setTools(Array.isArray(toolItems) ? toolItems : []);
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers()
      .then((rows) => setPeople((rows || []).filter((u) => u.is_active !== false)))
      .catch(() => setPeople([]));
  }, [isAdmin]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const run = async (fn, ok) => {
    setErr("");
    try {
      await fn();
      await load();
      showToast(ok);
    } catch (e) {
      setErr(e.message);
    }
  };

  const round2 = (n) => Math.round(n * 100) / 100;

  const bumpSpend = async (row, delta) => {
    if (!project || spendBusy || !delta) return;
    const used = Number((project.spent_by_material || {})[String(row.material)] || 0);
    const stock = Number(row.material_detail?.stock || 0);
    const next = delta > 0 ? used + Math.min(delta, stock) : Math.max(0, used + delta);
    const qty = round2(next - used);
    if (!qty) return;
    setSpendBusy(true);
    try {
      await run(
        () => addProjectSpending(project.id, { material: Number(row.material), quantity: qty.toFixed(2) }),
        qty > 0 ? t("projects.spendAdded") : t("projects.spendReduced")
      );
    } finally {
      setSpendBusy(false);
    }
  };

  const bumpExpense = async (row, delta) => {
    if (!project || expenseBusy || !delta) return;
    const cur = Number(row.amount || 0);
    const next = Math.max(0, round2(cur + delta));
    const qty = round2(next - cur);
    if (!qty) return;
    setExpenseBusy(true);
    try {
      await run(
        () => addProjectExpense(project.id, { id: row.id, title: row.title, amount: qty.toFixed(2) }),
        qty > 0 ? t("projects.expenseAdded") : t("projects.expenseReduced")
      );
    } finally {
      setExpenseBusy(false);
    }
  };

  if (!project) {
    return <div className="page"><section className="card muted">{err || t("common.loading")}</section></div>;
  }

  const spentMap = project.spent_by_material || {};

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="back-link" onClick={onBack}><Icon name="chevronLeft" size={13} /> {t("projects.back")}</button>
          <div className="page-eyebrow">{t("projects.projectNum", { id: project.id })}</div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-sub">
            {project.client || t("common.dash")} · {project.address || t("projects.noAddress")}
            {assigneeNames(project) ? ` · ${assigneeNames(project)}` : ""}
          </p>
        </div>
        <div className="page-actions">
          <span className={`status ${statusClass(project.status)}`}>{t(STATUS_LABEL[project.status])}</span>
          {!closed && (
            <>
              <button className="btn btn-ghost" onClick={() => run(() => setProjectStatus(project.id, "in_progress"), t("projects.toastInProgress"))}>
                {t("projects.inProgress")}
              </button>
              <button className="btn btn-ghost" onClick={() => run(() => setProjectStatus(project.id, "in_review"), t("projects.toastInReview"))}>
                {t("projects.inReview")}
              </button>
              {isAdmin && (
                <button className="btn btn-primary" onClick={() => {
                  if (!confirm(t("projects.confirmClose"))) return;
                  run(() => closeProject(project.id), t("projects.toastClosed"));
                }}>
                  {t("projects.close")}
                </button>
              )}
            </>
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
      {project.description && <section className="card">{project.description}</section>}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("projects.assignees")}</h2>
          {isAdmin && !closed && (
            <button
              className="btn btn-outline"
              onClick={() => run(
                () => updateProject(project.id, { assigned_to_ids: assigneeIds }),
                t("projects.assigneesSaved")
              )}
            >
              <Icon name="save" size={14} /> {t("common.save")}
            </button>
          )}
        </div>
        {isAdmin && !closed ? (
          <AssigneePicker users={people} value={assigneeIds} onChange={setAssigneeIds} />
        ) : (
          <div className="assignee-pick">
            {projectAssignees(project).length ? projectAssignees(project).map((person) => (
              <span key={person.id} className="worker-chip on">
                <span className="avatar xs">{person.initials || "?"}</span>
                {person.name}
              </span>
            )) : <div className="muted small">{t("projects.noAssignees")}</div>}
          </div>
        )}
      </section>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t("projects.expenses")}</div>
          <div className="kpi-value mono">{project.expenses_total}<span className="kpi-unit">€</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("projects.materialItems")}</div>
          <div className="kpi-value mono">{project.needed_materials?.length || 0}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("projects.spendEntries")}</div>
          <div className="kpi-value mono">{project.spendings?.length || 0}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t("projects.borrowedTools")}</div>
          <div className="kpi-value mono">
            {(project.borrowed_tools || []).filter((row) => !row.released_at).length}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("projects.neededMaterials")}</h2>
        </div>
        <div className="table-scroll">
        <table className="table">
          <thead>
            <tr><th>{t("common.material")}</th><th>{t("projects.warehouse")}</th><th>{t("projects.need")}</th><th>{t("projects.spent")}</th></tr>
          </thead>
          <tbody>
            {(project.needed_materials || []).map((row) => {
              const used = Number(spentMap[String(row.material)] || 0);
              const m = row.material_detail;
              const stock = Number(m?.stock || 0);
              return (
                <tr key={row.id}>
                  <td>{m?.name} <span className="muted small">{m?.color}</span></td>
                  <td className="muted small">{m?.warehouse_name}</td>
                  <td className="mono">{row.quantity_needed} {m?.unit}</td>
                  <td>
                    {closed ? (
                      <span className="mono">{used} {m?.unit}</span>
                    ) : (
                      <div className="spend-adjust">
                        <button type="button" className="qa-sub" disabled={spendBusy || used <= 0} onClick={() => bumpSpend(row, -100)}>−100</button>
                        <button type="button" className="qa-sub" disabled={spendBusy || used <= 0} onClick={() => bumpSpend(row, -50)}>−50</button>
                        <button type="button" className="qa-sub" disabled={spendBusy || used <= 0} onClick={() => bumpSpend(row, -1)}>−</button>
                        <span className="mono spend-val">{used} {m?.unit}</span>
                        <button type="button" disabled={spendBusy || stock <= 0} onClick={() => bumpSpend(row, 1)}>+</button>
                        <button type="button" disabled={spendBusy || stock <= 0} onClick={() => bumpSpend(row, 50)}>+50</button>
                        <button type="button" disabled={spendBusy || stock <= 0} onClick={() => bumpSpend(row, 100)}>+100</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!project.needed_materials?.length && (
              <tr><td colSpan="4" className="muted small ta-c">{t("projects.noMaterials")}</td></tr>
            )}
          </tbody>
        </table>
        </div>
        {!closed && (
          <div className="field-row two" style={{ marginTop: 14 }}>
            <select className="select" value={need.material} onChange={(e) => setNeed({ ...need, material: e.target.value })}>
              <option value="">{t("common.material")}</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.color && `(${m.color})`} · {m.warehouse_name}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" type="number" min="0.01" step="0.01" placeholder={t("common.quantity")} value={need.quantity_needed} onChange={(e) => setNeed({ ...need, quantity_needed: e.target.value })} />
              <button className="btn btn-primary" onClick={() => {
                if (!need.material || !need.quantity_needed) return;
                run(() => addProjectMaterial(project.id, { material: Number(need.material), quantity_needed: need.quantity_needed }), t("projects.materialAdded"));
                setNeed({ material: "", quantity_needed: "" });
              }}>{t("common.add")}</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{t("projects.borrowedTools")}</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("projects.tool")}</th>
              <th>{t("projects.toolType")}</th>
              <th>{t("common.quantity")}</th>
              <th>{t("projects.toolStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {(project.borrowed_tools || []).map((row) => {
              const tool = row.tool_detail;
              return (
                <tr key={row.id}>
                  <td>{tool?.name}</td>
                  <td className="muted small">{tool?.tool_type_name}</td>
                  <td className="mono">{row.quantity} {tool?.unit}</td>
                  <td>
                    {row.released_at
                      ? <span className="status status-completed">{t("projects.released")}</span>
                      : <span className="status status-active">{t("projects.borrowed")}</span>}
                  </td>
                </tr>
              );
            })}
            {!project.borrowed_tools?.length && (
              <tr><td colSpan="4" className="muted small ta-c">{t("projects.noTools")}</td></tr>
            )}
          </tbody>
        </table>
        {!closed && (
          <div className="field-row two" style={{ marginTop: 14 }}>
            <select className="select" value={borrow.tool} onChange={(e) => setBorrow({ ...borrow, tool: e.target.value })}>
              <option value="">{t("projects.tool")}</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name} · {tool.tool_type_name} · {t("projects.available")} {tool.available} {tool.unit}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder={t("common.quantity")}
                value={borrow.quantity}
                onChange={(e) => setBorrow({ ...borrow, quantity: e.target.value })}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!borrow.tool || !borrow.quantity) return;
                  run(
                    () => borrowProjectTool(project.id, { tool: Number(borrow.tool), quantity: borrow.quantity }),
                    t("projects.toolBorrowed")
                  );
                  setBorrow({ tool: "", quantity: "" });
                }}
              >
                {t("projects.borrow")}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
          <div className="card-head"><h2 className="card-title">{t("projects.expenses")}</h2></div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.note")}</th>
                  <th>{t("projects.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {(project.expenses || []).map((e) => {
                  const amt = Number(e.amount || 0);
                  return (
                    <tr key={e.id}>
                      <td className="dt-name">{e.title}</td>
                      <td className="muted small">{e.note || e.recorded_by?.name || t("common.dash")}</td>
                      <td>
                        {closed ? (
                          <span className="mono">{amt.toFixed(2)} €</span>
                        ) : (
                          <div className="step-stack">
                            <div className="stepper">
                              <button type="button" disabled={expenseBusy || amt <= 0} onClick={() => bumpExpense(e, -1)}>
                                <Icon name="minus" size={12} />
                              </button>
                              <span className="stepper-input mono">{amt.toFixed(2)}</span>
                              <button type="button" disabled={expenseBusy} onClick={() => bumpExpense(e, 1)}>
                                <Icon name="plus" size={12} />
                              </button>
                              <span className="mono small muted unit">€</span>
                            </div>
                            <div className="quick-add">
                              <button type="button" className="qa-sub" disabled={expenseBusy || amt <= 0} onClick={() => bumpExpense(e, -100)}>−100</button>
                              <button type="button" className="qa-sub" disabled={expenseBusy || amt <= 0} onClick={() => bumpExpense(e, -50)}>−50</button>
                              <button type="button" disabled={expenseBusy} onClick={() => bumpExpense(e, 50)}>+50</button>
                              <button type="button" disabled={expenseBusy} onClick={() => bumpExpense(e, 100)}>+100</button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!project.expenses?.length && (
                  <tr><td colSpan="3" className="muted small ta-c">{t("projects.noExpenses")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!closed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <input className="input" placeholder={t("common.name")} value={expense.title} onChange={(e) => setExpense({ ...expense, title: e.target.value })} />
              <input className="input" type="number" min="0.01" step="0.01" placeholder={t("projects.amount")} value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
              <input className="input" placeholder={t("common.note")} value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} />
              <button className="btn btn-outline" onClick={() => {
                if (!expense.title.trim() || !expense.amount) return;
                run(() => addProjectExpense(project.id, { ...expense, title: expense.title.trim() }), t("projects.expenseAdded"));
                setExpense({ title: "", amount: "", note: "" });
              }}>{t("projects.addExpense")}</button>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2 className="card-title">{t("projects.consumption")}</h2></div>
          {(project.spendings || []).map((s) => (
            <div key={s.id} className="feed-row" style={{ marginBottom: 8 }}>
              <div className="feed-body">
                <div className="feed-line"><strong>{s.material_detail?.name}</strong></div>
                <div className="feed-sub">{s.recorded_by?.name} · {new Date(s.created_at).toLocaleString(dateLocale)}</div>
              </div>
              <div className="mono">{s.quantity} {s.material_detail?.unit}</div>
            </div>
          ))}
          {!project.spendings?.length && <div className="muted small">{t("projects.noSpend")}</div>}
          {!closed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <select className="select" value={spend.material} onChange={(e) => setSpend({ ...spend, material: e.target.value })}>
                <option value="">{t("common.material")}</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} · {t("projects.stock")} {m.stock} {m.unit}</option>
                ))}
              </select>
              <input className="input" type="number" step="0.01" placeholder={t("common.quantity")} value={spend.quantity} onChange={(e) => setSpend({ ...spend, quantity: e.target.value })} />
              <button className="btn btn-outline" onClick={() => {
                if (!spend.material || !spend.quantity) return;
                run(() => addProjectSpending(project.id, { material: Number(spend.material), quantity: spend.quantity }), t("projects.spendAdded"));
                setSpend({ material: "", quantity: "" });
              }}>{t("projects.addSpend")}</button>
            </div>
          )}
        </section>
      {toast && <div className="toast"><Icon name="check" size={14} /> {toast}</div>}
    </div>
  );
};

const ProjectsPage = ({ user }) => {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");
  const isAdmin = user?.role === "ADMINISTRATORS";

  const load = async () => setItems(await fetchProjects());

  useEffect(() => {
    (async () => {
      try {
        const [projects, people] = await Promise.all([fetchProjects(), fetchUsers()]);
        setItems(projects);
        setUsers(people.filter((u) => u.is_active !== false));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (selected) {
    return (
      <ProjectDetail
        user={user}
        projectId={selected}
        onBack={() => {
          setSelected(null);
          load().catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("projects.eyebrow")}</div>
          <h1 className="page-title">{t("projects.title")}</h1>
          <p className="page-sub">
            {isAdmin ? t("projects.subAdmin") : t("projects.subWorker")}
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={15} /> {t("projects.new")}
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : items.length === 0 ? (
        <section className="card muted">{t("projects.empty")}</section>
      ) : (
        <section className="users-grid">
          {items.map((p) => {
            const people = projectAssignees(p);
            return (
            <div key={p.id} className={`user-card ${p.planned_days_exceeded ? "overdue" : ""}`} onClick={() => setSelected(p.id)}>
              <div className="user-card-head">
                <div className="user-card-avatar">{people[0]?.initials || "P"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="user-card-name">{p.name}</div>
                  <div className="user-card-email">{p.client || p.address || "—"}</div>
                </div>
                <span className={`status ${statusClass(p.status)}`}>{t(STATUS_LABEL[p.status])}</span>
              </div>
              <div className="muted small">{t("projects.assignee", { name: assigneeNames(p, t("common.dash")) })}</div>
              {p.planned_days ? (
                <div className={`muted small ${p.planned_days_exceeded ? "overdue-note" : ""}`}>
                  {p.planned_days_exceeded
                    ? t("projects.plannedOverdue", { planned: p.planned_days, elapsed: p.elapsed_days, overdue: p.overdue_days })
                    : t("projects.plannedDaysMeta", { n: p.planned_days })}
                </div>
              ) : null}
            </div>
            );
          })}
        </section>
      )}

      {showCreate && (
        <ProjectForm
          users={users}
          onClose={() => setShowCreate(false)}
          onSave={async (payload) => {
            await createProject(payload);
            setShowCreate(false);
            await load();
            setToast(t("projects.created"));
            setTimeout(() => setToast(""), 2400);
          }}
        />
      )}
      {toast && <div className="toast"><Icon name="check" size={14} /> {toast}</div>}
    </div>
  );
};

export default ProjectsPage;
export { ProjectDetail, STATUS_LABEL, statusClass };
