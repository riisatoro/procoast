import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import {
  addProjectMaterial,
  addProjectSpending,
  fetchMaterials,
  fetchProject,
  fetchProjects,
  fetchTools,
  saveProjectToolChecks,
} from "./api";
import { useI18n } from "./i18n";
import { lastProjectId, rememberProject } from "./last-project";

const TYPE_ICONS = ["wrench", "package", "settings", "shield", "clipboard", "folder"];

const num = (v) => Number(v || 0);
const round2 = (n) => Math.round(n * 100) / 100;

const projectLabel = (p) =>
  `#${p.id} — ${p.client || p.name}${p.address ? ` · ${p.address}` : ""}`;

const ToolsTaken = ({ user, onOpenInventory }) => {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [tools, setTools] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState(null);
  const [states, setStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const closed = project?.status === "closed";

  const loadLists = async () => {
    const [plist, toolItems] = await Promise.all([fetchProjects(), fetchTools()]);
    const list = Array.isArray(plist) ? plist : [];
    const catalog = Array.isArray(toolItems) ? toolItems : [];
    setProjects(list);
    setTools(catalog);
    setProjectId((cur) => {
      if (cur && list.some((p) => String(p.id) === String(cur))) return cur;
      return lastProjectId(list);
    });
  };

  useEffect(() => {
    (async () => {
      try {
        await loadLists();
      } catch (error) {
        setErr(error.message || t("api.loadTools"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setStates({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (cancelled) return;
        setProject(p);
        const next = {};
        (p.tool_checks || []).forEach((row) => {
          next[String(row.tool)] = row.status;
        });
        setStates(next);
        setErr("");
      } catch (error) {
        if (!cancelled) setErr(error.message || t("api.loadProject"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const categories = useMemo(() => {
    const byType = new Map();
    tools.forEach((tool) => {
      const typeId = tool.tool_type || "none";
      if (!byType.has(typeId)) {
        byType.set(typeId, {
          id: typeId,
          title: tool.tool_type_name || t("tools.type"),
          icon: TYPE_ICONS.includes(tool.tool_type_icon) ? tool.tool_type_icon : "wrench",
          tools: [],
        });
      }
      byType.get(typeId).tools.push(tool);
    });
    return Array.from(byType.values());
  }, [tools, t]);

  const counts = { is: 0, nav: 0, nevaj: 0 };
  Object.values(states).forEach((v) => {
    if (v === "is") counts.is++;
    else if (v === "nav") counts.nav++;
    else if (v === "nevaj") counts.nevaj++;
  });

  const setState = (id, val) => setStates((prev) => ({ ...prev, [id]: val }));

  const save = async () => {
    if (!project || closed || busy) return;
    const items = Object.entries(states)
      .filter(([, status]) => status)
      .map(([tool, status]) => ({ tool: Number(tool), status }));
    if (!items.length) {
      setErr(t("takenTools.markFirst"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const result = await saveProjectToolChecks(project.id, { items });
      const next = {};
      (result.items || []).forEach((row) => {
        next[String(row.tool)] = row.status;
      });
      setStates(next);
      const [toolItems, p] = await Promise.all([fetchTools(), fetchProject(project.id)]);
      setTools(Array.isArray(toolItems) ? toolItems : []);
      setProject(p);
      const failed = result.errors || [];
      if (failed.length) {
        setErr(failed.map((e) => e.detail).join(" "));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      }
    } catch (error) {
      setErr(error.message || t("api.saveToolChecks"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("takenTools.eyebrow")}</div>
          <h1 className="page-title">{t("takenTools.title")}</h1>
          <p className="page-sub">{t("takenTools.sub")}</p>
        </div>
        {onOpenInventory && (
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={onOpenInventory}>
              <Icon name="wrench" size={15} /> {t("tools.inventory")}
            </button>
          </div>
        )}
      </header>

      {err && <div className="login-err">{err}</div>}

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : !projects.length ? (
        <section className="card muted">{t("takenTools.noProjects")}</section>
      ) : (
        <>
          <section className="card">
            <label className="field">
              <span className="field-label">{t("common.object")}</span>
              <select value={projectId} onChange={(e) => { rememberProject(e.target.value); setProjectId(e.target.value); }} className="select">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{projectLabel(p)}</option>
                ))}
              </select>
            </label>
            <div className="tool-counters">
              <div className="tc"><span className="tc-dot tc-is" /> {t("takenTools.taken")} <span className="mono">{counts.is}</span></div>
              <div className="tc"><span className="tc-dot tc-nav" /> {t("takenTools.missing")} <span className="mono">{counts.nav}</span></div>
              <div className="tc"><span className="tc-dot tc-nevaj" /> {t("takenTools.notNeeded")} <span className="mono">{counts.nevaj}</span></div>
            </div>
          </section>

          {!tools.length ? (
            <section className="card muted">{t("takenTools.noTools")}</section>
          ) : (
            categories.map((cat) => (
              <section key={cat.id} className="card cat-card">
                <div className="cat-head">
                  <div className="cat-icon"><Icon name={cat.icon} size={18} /></div>
                  <h2 className="cat-title">{cat.title}</h2>
                  <span className="muted small">{t("takenTools.positions", { n: cat.tools.length })}</span>
                </div>
                <div className="tool-list">
                  {cat.tools.map((tool) => {
                    const v = states[String(tool.id)];
                    return (
                      <div key={tool.id} className="tool-row">
                        <div className="tool-name">
                          <span className="tool-bullet" />
                          <span>{tool.name}</span>
                          {tool.recommended ? <span className="tool-rec mono">{tool.recommended}</span> : null}
                          <span className="muted small">{t("takenTools.available", { n: tool.available, unit: tool.unit })}</span>
                        </div>
                        <div className="tri-btns">
                          <button type="button" className={`tri ${v === "is" ? "tri-is on" : ""}`} disabled={closed} onClick={() => setState(tool.id, "is")}>
                            <Icon name="check" size={12} /> {t("takenTools.is")}
                          </button>
                          <button type="button" className={`tri ${v === "nav" ? "tri-nav on" : ""}`} disabled={closed} onClick={() => setState(tool.id, "nav")}>
                            <Icon name="x" size={12} /> {t("takenTools.nav")}
                          </button>
                          <button type="button" className={`tri ${v === "nevaj" ? "tri-nevaj on" : ""}`} disabled={closed} onClick={() => setState(tool.id, "nevaj")}>
                            <Icon name="minus" size={12} /> {t("takenTools.nevaj")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          <div className="sticky-foot">
            <div className="muted small">
              {closed ? t("takenTools.closed") : `${user.name} · ${project?.client || project?.name || ""}`}
            </div>
            <button className="btn btn-primary" disabled={closed || busy || !project} onClick={save}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("takenTools.save")}
            </button>
          </div>
        </>
      )}
      {saved && <div className="toast"><Icon name="check" size={14} /> {t("takenTools.saved")}</div>}
    </div>
  );
};

const AddNeededModal = ({ materials, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({ material: materials[0]?.id || "", quantity_needed: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.material || !form.quantity_needed) {
      setErr(t("takenMaterials.fillBoth"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({ material: Number(form.material), quantity_needed: form.quantity_needed });
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
            <div className="modal-eyebrow">{t("takenMaterials.eyebrow")}</div>
            <h3 className="modal-title">{t("takenMaterials.add")}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field">
              <span className="field-label">{t("common.material")}</span>
              <select className="select" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
                <option value="">—</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.color ? ` · ${m.color}` : ""} · {m.warehouse_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t("takenMaterials.needed")}</span>
              <input className="input" type="number" min="0.01" step="0.01" value={form.quantity_needed} onChange={(e) => setForm({ ...form, quantity_needed: e.target.value })} />
            </label>
            {err && <div className="login-err">{err}</div>}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("common.add")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

const MaterialsTaken = ({ user, onOpenCatalog }) => {
  const { t } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const [projects, setProjects] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState(null);
  const [taken, setTaken] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const closed = project?.status === "closed";
  const rows = project?.needed_materials || [];
  const spentMap = project?.spent_by_material || {};

  const loadLists = async () => {
    const [plist, mats] = await Promise.all([fetchProjects(), fetchMaterials()]);
    const list = Array.isArray(plist) ? plist : [];
    setProjects(list);
    setCatalog(Array.isArray(mats) ? mats : []);
    setProjectId((cur) => {
      if (cur && list.some((p) => String(p.id) === String(cur))) return cur;
      return lastProjectId(list);
    });
  };

  useEffect(() => {
    (async () => {
      try {
        await loadLists();
      } catch (error) {
        setErr(error.message || t("api.loadMaterials"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applyProject = (p) => {
    setProject(p);
    const next = {};
    (p.needed_materials || []).forEach((row) => {
      next[String(row.material)] = num((p.spent_by_material || {})[String(row.material)]);
    });
    setTaken(next);
  };

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setTaken({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (cancelled) return;
        applyProject(p);
        setErr("");
      } catch (error) {
        if (!cancelled) setErr(error.message || t("api.loadProject"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const currentTaken = (row) => {
    const key = String(row.material);
    return taken[key] != null ? num(taken[key]) : num(spentMap[key]);
  };

  const maxTaken = (row) => {
    const used = num(spentMap[String(row.material)]);
    const stock = num(row.material_detail?.stock);
    return round2(used + stock);
  };

  const setVal = (row, v) => {
    const key = String(row.material);
    const next = Math.max(0, round2(v));
    setTaken((prev) => ({ ...prev, [key]: Math.min(next, maxTaken(row)) }));
  };

  const bump = (row, delta) => setVal(row, currentTaken(row) + delta);

  const confirm = async () => {
    if (!project || closed || busy) return;
    const changes = rows
      .map((row) => {
        const used = num(spentMap[String(row.material)]);
        const cur = currentTaken(row);
        return { material: Number(row.material), quantity: round2(cur - used) };
      })
      .filter((row) => row.quantity);
    if (!changes.length) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      for (const row of changes) {
        await addProjectSpending(project.id, { material: row.material, quantity: row.quantity.toFixed(2) });
      }
      const p = await fetchProject(project.id);
      applyProject(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      setErr(error.message || t("api.addSpend"));
      try {
        const p = await fetchProject(project.id);
        applyProject(p);
      } catch {
        /* keep local */
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("takenMaterials.eyebrow")}</div>
          <h1 className="page-title">{t("takenMaterials.title")}</h1>
          <p className="page-sub">{t("takenMaterials.sub")}</p>
        </div>
        <div className="page-actions">
          {onOpenCatalog && (
            <button className="btn btn-ghost" onClick={onOpenCatalog}>
              <Icon name="package" size={15} /> {t("materialsPage.title")}
            </button>
          )}
          {isAdmin && project && !closed && (
            <button className="btn btn-ghost" onClick={() => setShowAdd(true)} disabled={!catalog.length}>
              <Icon name="plus" size={15} /> {t("takenMaterials.add")}
            </button>
          )}
        </div>
      </header>

      {err && <div className="login-err">{err}</div>}

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : !projects.length ? (
        <section className="card muted">{t("takenMaterials.noProjects")}</section>
      ) : (
        <>
          <section className="card">
            <label className="field">
              <span className="field-label">{t("common.object")}</span>
              <select value={projectId} onChange={(e) => { rememberProject(e.target.value); setProjectId(e.target.value); }} className="select">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{projectLabel(p)}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("takenMaterials.list", { id: project?.id || "—", client: project?.client || project?.name || "" })}</h2>
              <span className="muted small">{t("takenMaterials.fromAnalysis")}</span>
            </div>
            {!rows.length ? (
              <div className="muted small">{t("takenMaterials.noMaterials")}</div>
            ) : (
              <div className="mat-table">
                <div className="mt-head">
                  <div>{t("common.material")}</div>
                  <div>{t("reports.colorType")}</div>
                  <div className="ta-r">{t("takenMaterials.needed")}</div>
                  <div>{t("takenMaterials.taken")}</div>
                  <div className="ta-r">{t("takenMaterials.remain")}</div>
                  <div>{t("takenMaterials.progress")}</div>
                </div>
                {rows.map((row) => {
                  const m = row.material_detail || {};
                  const needed = num(row.quantity_needed);
                  const cur = currentTaken(row);
                  const remain = round2(needed - cur);
                  const pct = needed ? Math.min(100, Math.round((cur / needed) * 100)) : 0;
                  const done = remain <= 0;
                  const unit = m.unit || "kg";
                  return (
                    <div key={row.id} className={`mt-row ${done ? "mt-done" : ""}`}>
                      <div className="dt-name">{m.name}</div>
                      <div className="muted">{m.color || t("common.dash")}</div>
                      <div className="ta-r mono" data-label={`${t("takenMaterials.needed")}: `}>{needed} {unit}</div>
                      <div>
                        {closed ? (
                          <span className="mono">{cur} {unit}</span>
                        ) : (
                          <div className="step-stack">
                            <div className="stepper">
                              <button type="button" disabled={busy || cur <= 0} onClick={() => bump(row, -1)}><Icon name="minus" size={12} /></button>
                              <input
                                type="number"
                                className="stepper-input mono"
                                value={cur}
                                onChange={(e) => setVal(row, +e.target.value || 0)}
                              />
                              <button type="button" disabled={busy || cur >= maxTaken(row)} onClick={() => bump(row, 1)}><Icon name="plus" size={12} /></button>
                              <span className="mono small muted unit">{unit}</span>
                            </div>
                            <div className="quick-add">
                              <button type="button" className="qa-sub" disabled={busy} onClick={() => bump(row, -25)}>−25</button>
                              <button type="button" className="qa-sub" disabled={busy} onClick={() => bump(row, -5)}>−5</button>
                              <button type="button" disabled={busy} onClick={() => bump(row, 5)}>+5</button>
                              <button type="button" disabled={busy} onClick={() => bump(row, 25)}>+25</button>
                              <button type="button" className="qa-max" disabled={busy} onClick={() => setVal(row, needed)}>MAX</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`ta-r mono ${done ? "ok" : ""}`} data-label={`${t("takenMaterials.remain")}: `}>
                        {done ? t("takenMaterials.remainDone") : t("takenMaterials.remainQty", { n: remain, unit })}
                      </div>
                      <div>
                        <div className="bar"><div className="bar-fill" style={{ width: pct + "%", background: done ? "#4CAF50" : "#2C5F2E" }} /></div>
                        <div className="mono tiny muted">{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="sticky-foot">
            <div className="muted small">
              {closed ? t("takenMaterials.closed") : t("takenMaterials.addFor", { name: user.name })}
            </div>
            <button className="btn btn-primary" disabled={closed || busy || !project} onClick={confirm}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("takenMaterials.confirm")}
            </button>
          </div>
        </>
      )}

      {showAdd && (
        <AddNeededModal
          materials={catalog}
          onClose={() => setShowAdd(false)}
          onSave={async (payload) => {
            await addProjectMaterial(project.id, payload);
            setShowAdd(false);
            const p = await fetchProject(project.id);
            applyProject(p);
            setSaved(true);
            setTimeout(() => setSaved(false), 2200);
          }}
        />
      )}
      {saved && <div className="toast"><Icon name="check" size={14} /> {t("takenMaterials.saved")}</div>}
    </div>
  );
};

export { ToolsTaken, MaterialsTaken, TYPE_ICONS };
