import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { fetchMaterials, fetchSystems, fetchUsers } from "./api";
import { AssigneePicker, isAdminUser, projectAssignees } from "./assignees";
import { useI18n } from "./i18n";

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
const todayStr = () => ymd(new Date());
const plusMonths = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return ymd(d);
};

function overridesFromProject(sys, project) {
  const rows = project?.needed_materials || [];
  const byName = {};
  rows.forEach((row) => {
    const name = (row.material_detail?.name || "").trim().toLowerCase();
    if (name) byName[name] = row;
  });
  const next = {};
  (sys?.layers || []).forEach((layer, i) => {
    const row = byName[(layer.name || "").trim().toLowerCase()];
    if (row) {
      const perM2 = Number(row.material_detail?.per_m2);
      next[i] = {
        include: true,
        perM2: perM2 > 0 ? perM2 : layer.perM2,
      };
    } else if (layer.optional) {
      next[i] = { include: false };
    }
  });
  return next;
}

function extrasFromProject(sys, project) {
  const layerNames = new Set(
    (sys?.layers || []).map((layer) => (layer.name || "").trim().toLowerCase()).filter(Boolean)
  );
  return (project?.needed_materials || [])
    .map((row) => {
      const detail = row.material_detail || {};
      const name = (detail.name || "").trim();
      if (!name || layerNames.has(name.toLowerCase())) return null;
      return {
        key: `pm-${row.id}`,
        materialId: row.material,
        name,
        color: detail.color || "",
        unit: detail.unit || "kg",
        perM2: Number(detail.per_m2) || 0,
        needed: Number(row.quantity_needed) || 0,
      };
    })
    .filter(Boolean);
}

function ralFromProject(project) {
  const rows = project?.needed_materials || [];
  for (const row of rows) {
    const shade = (row.material_detail?.color || "").trim();
    if (shade) return shade;
  }
  return "";
}

const NewObjectModal = ({ onClose, onSave, nextId, busy, project }) => {
  const { t } = useI18n();
  const isEdit = Boolean(project?.id);
  const [systems, setSystems] = useState([]);
  const [systemsErr, setSystemsErr] = useState("");
  const [systemIdx, setSystemIdx] = useState(0);
  const [client, setClient] = useState(project?.client || project?.name || "");
  const [address, setAddress] = useState(project?.address || "");
  const [totalM2, setTotalM2] = useState(Number(project?.total_m2) || 100);
  const [color, setColor] = useState(project?.color || "#2C5F2E");
  const [colorRal, setColorRal] = useState("");
  const [startDate, setStartDate] = useState(project?.start_date || todayStr);
  const [endDate, setEndDate] = useState(project?.end_date || plusMonths(1));
  const [plannedDays, setPlannedDays] = useState(
    project?.planned_days
      || (project?.start_date && project?.end_date && diffDaysInclusive(project.start_date, project.end_date))
      || diffDaysInclusive(todayStr(), plusMonths(1))
      || ""
  );
  const [users, setUsers] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState(
    projectAssignees(project)
      .filter((person) => !isAdminUser(person))
      .map((person) => Number(person.id))
      .filter((id) => id)
  );
  const [overrides, setOverrides] = useState({});
  const [extras, setExtras] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [addMaterialId, setAddMaterialId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const skipLayerReset = useRef(isEdit);
  const layersHydrated = useRef(false);

  const sys = systems[systemIdx];
  const palette = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B", "#1E4220", "#D97757"];

  useEffect(() => {
    let cancelled = false;
    fetchSystems()
      .then((rows) => {
        if (!cancelled) setSystems(rows);
      })
      .catch((error) => {
        if (!cancelled) setSystemsErr(error.message || t("api.loadSystems"));
      });
    fetchUsers()
      .then((rows) => {
        if (cancelled) return;
        const people = (rows || []).filter((u) => u.is_active !== false);
        setUsers(people);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    fetchMaterials()
      .then((rows) => {
        if (!cancelled) setCatalog(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!systems.length) return;
    if (!project?.system) return;
    const idx = systems.findIndex(
      (row) => row.name === project.system || row.code === project.system
    );
    if (idx >= 0) setSystemIdx(idx);
  }, [systems, project?.system]);

  useEffect(() => {
    if (skipLayerReset.current) return;
    setOverrides({});
  }, [systemIdx]);

  useEffect(() => {
    if (!isEdit || layersHydrated.current || !sys || !systems.length) return;
    if (project?.system) {
      const hasMatch = systems.some(
        (row) => row.name === project.system || row.code === project.system
      );
      const matches = sys.name === project.system || sys.code === project.system;
      if (hasMatch && !matches) return;
    }
    setOverrides(overridesFromProject(sys, project));
    setExtras(extrasFromProject(sys, project));
    const shade = ralFromProject(project);
    if (shade) setColorRal(shade);
    layersHydrated.current = true;
    skipLayerReset.current = false;
  }, [isEdit, sys, systems, project]);

  const layerEnabled = (i, layer) => overrides[i]?.include ?? !layer.optional;
  const layerPerM2 = (i, layer) => overrides[i]?.perM2 ?? layer.perM2;
  const setLayer = (i, patch) => setOverrides({ ...overrides, [i]: { ...overrides[i], ...patch } });

  const previewMaterials = (sys?.layers || []).map((l, i) => ({
    layer: l,
    enabled: layerEnabled(i, l),
    perM2: layerPerM2(i, l),
    needed: Math.round(layerPerM2(i, l) * totalM2 * 10) / 10,
  }));

  const extraKg = extras.reduce((sum, row) => sum + (Number(row.needed) || 0), 0);
  const totalKg = previewMaterials.filter((m) => m.enabled).reduce((s, m) => s + m.needed, 0) + extraKg;
  const layerCount = previewMaterials.filter((m) => m.enabled).length;
  const materialCount = layerCount + extras.length;

  const usedMaterialKeys = new Set([
    ...previewMaterials.filter((m) => m.enabled).map((m) => (m.layer.name || "").trim().toLowerCase()),
    ...extras.map((row) => [
      row.materialId ? `id:${row.materialId}` : "",
      (row.name || "").trim().toLowerCase(),
    ]).flat().filter(Boolean),
  ]);
  const addableCatalog = catalog.filter((mat) => {
    const idKey = `id:${mat.id}`;
    const nameKey = (mat.name || "").trim().toLowerCase();
    return !usedMaterialKeys.has(idKey) && !usedMaterialKeys.has(nameKey);
  });

  const valid = client.trim() && address.trim() && totalM2 > 0 && materialCount > 0;

  const setExtra = (key, patch) => {
    setExtras((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const removeExtra = (key) => setExtras((rows) => rows.filter((row) => row.key !== key));

  const pickAddMaterial = (id) => {
    setAddMaterialId(id);
    const mat = catalog.find((row) => String(row.id) === String(id));
    if (!mat) {
      setAddQty("");
      return;
    }
    const rate = Number(mat.per_m2) || 0;
    if (rate > 0 && totalM2 > 0) {
      setAddQty(String(Math.round(rate * totalM2 * 10) / 10));
    }
  };

  const addExtra = () => {
    const mat = catalog.find((row) => String(row.id) === String(addMaterialId));
    const qty = Number(addQty);
    if (!mat || !(qty > 0)) return;
    const name = (mat.name || "").trim();
    const nameKey = name.toLowerCase();
    const layerIdx = (sys?.layers || []).findIndex((layer) => (layer.name || "").trim().toLowerCase() === nameKey);
    if (layerIdx >= 0) {
      setLayer(layerIdx, { include: true, perM2: totalM2 > 0 ? qty / totalM2 : Number(mat.per_m2) || 0 });
    } else {
      const existing = extras.find((row) => Number(row.materialId) === Number(mat.id) || (row.name || "").trim().toLowerCase() === nameKey);
      if (existing) {
        setExtra(existing.key, { needed: Number(existing.needed || 0) + qty });
      } else {
        setExtras((rows) => [
          ...rows,
          {
            key: `new-${Date.now()}`,
            materialId: mat.id,
            name,
            color: mat.color || "",
            unit: mat.unit || "kg",
            perM2: Number(mat.per_m2) || 0,
            needed: qty,
          },
        ]);
      }
    }
    setAddMaterialId("");
    setAddQty("");
  };

  const save = async () => {
    if (!sys || !valid || saving || busy) return;
    const grouped = {};
    previewMaterials.filter((m) => m.enabled).forEach((m) => {
      const key = m.layer.name + (sys.needsColor && m.layer.name.toLowerCase().includes("color") ? "|" + colorRal : "");
      if (!grouped[key]) {
        grouped[key] = {
          name: m.layer.name,
          color: m.layer.name.toLowerCase().includes("color") && colorRal ? colorRal : "",
          needed: 0,
          perM2: m.perM2,
        };
      }
      grouped[key].needed += m.needed;
    });

    const extraPayload = extras
      .filter((row) => (row.name || "").trim() && Number(row.needed) > 0)
      .map((row) => ({
        material: row.materialId || undefined,
        name: row.name.trim(),
        color: row.color || "",
        per_m2: row.perM2 || null,
        quantity_needed: Number(row.needed),
        unit: row.unit || "kg",
      }));

    const tasks = [
      { name: t("newObject.taskPrep"), unit: "m²", quantity_total: totalM2 },
      ...previewMaterials.filter((m) => m.enabled).map((m) => ({
        name: `${m.layer.name} ${m.layer.role || ""}`.trim(),
        unit: "m²",
        quantity_total: totalM2,
      })),
    ];

    setSaving(true);
    setErr("");
    try {
      await onSave({
        name: client.trim(),
        client: client.trim(),
        address: address.trim(),
        system: sys.name,
        color,
        total_m2: totalM2,
        start_date: startDate || null,
        end_date: endDate || null,
        planned_days: plannedDays === "" ? null : Number(plannedDays),
        assigned_to_ids: assigneeIds,
        tasks,
        materials: [
          ...Object.values(grouped).map((m) => ({
            name: m.name,
            color: m.color,
            per_m2: m.perM2,
            quantity_needed: m.needed,
            unit: "kg",
          })),
          ...extraPayload,
        ],
      });
    } catch (error) {
      setErr(error.message || t(isEdit ? "api.saveProject" : "api.createProject"));
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">
              {t(isEdit ? "newObject.editEyebrow" : "newObject.eyebrow", { id: isEdit ? project.id : nextId })}
            </div>
            <h3 className="modal-title">{t(isEdit ? "newObject.editTitle" : "newObject.title")}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="no-steps">
          <button className={`no-step ${step === 1 ? "on" : ""}`} onClick={() => setStep(1)}>
            <span className="no-step-num mono">01</span> {t("newObject.step1")}
          </button>
          <span className="no-step-line" />
          <button className={`no-step ${step === 2 ? "on" : ""}`} onClick={() => setStep(2)}>
            <span className="no-step-num mono">02</span> {t("newObject.step2")}
          </button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <>
              {systemsErr && <div className="login-err">{systemsErr}</div>}
              <div className="field-row two">
                <label className="field">
                  <span className="field-label">{t("common.client")}</span>
                  <input className="input" placeholder={t("newObject.clientPh")} value={client} onChange={e => setClient(e.target.value)} />
                </label>
              <label className="field">
                <span className="field-label">{t("common.address")}</span>
                <input className="input" placeholder={t("newObject.addressPh")} value={address} onChange={e => setAddress(e.target.value)} />
              </label>
              </div>
              <label className="field">
                <span className="field-label">{t("projects.assigneeField")}</span>
                <AssigneePicker users={users} value={assigneeIds} onChange={setAssigneeIds} />
              </label>

              <label className="field">
                <span className="field-label">{t("newObject.system")}</span>
                <div className="sys-grid">
                  {systems.map((s, i) => (
                    <button key={s.code} type="button"
                      className={`sys-card ${systemIdx === i ? "on" : ""}`}
                      onClick={() => setSystemIdx(i)}>
                      <span className="sys-code mono">{s.code}</span>
                      <span className="sys-name">{s.name}</span>
                      <span className="sys-meta">{s.needsColor ? t("newObject.layersColor", { n: s.layers.length }) : t("newObject.layersNoColor", { n: s.layers.length })}</span>
                    </button>
                  ))}
                </div>
              </label>

              <div className="field-row three">
                <label className="field">
                  <span className="field-label">{t("newObject.volume")}</span>
                  <input className="input mono" type="number" value={totalM2} onChange={e => setTotalM2(Math.max(0, +e.target.value || 0))} />
                </label>
                <label className="field">
                  <span className="field-label">{t("newObject.dateFrom")}</span>
                  <input
                    className="input"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartDate(next);
                      if (next && plannedDays) setEndDate(addDays(next, Number(plannedDays) - 1));
                      else if (next && endDate) {
                        const days = diffDaysInclusive(next, endDate);
                        if (days >= 1) setPlannedDays(days);
                      }
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
                    value={plannedDays}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setPlannedDays("");
                        return;
                      }
                      const n = Math.max(1, parseInt(raw, 10) || 1);
                      setPlannedDays(n);
                      if (startDate) setEndDate(addDays(startDate, n - 1));
                    }}
                  />
                </label>
              </div>
              <div className="field-row two">
                <label className="field">
                  <span className="field-label">{t("newObject.plannedEnd")}</span>
                  <input
                    className="input"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEndDate(next);
                      if (startDate && next) {
                        const days = diffDaysInclusive(startDate, next);
                        if (days >= 1) setPlannedDays(days);
                      }
                    }}
                  />
                </label>
                <div className="field">
                  <span className="field-label">{t("newObject.calColor")}</span>
                  <div className="color-row">
                    {palette.map(c => (
                      <button key={c} type="button" className={`color-dot ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
                    ))}
                  </div>
                </div>
              </div>

              {sys?.needsColor && (
                <label className="field">
                  <span className="field-label">{t("newObject.ral")}</span>
                  <input className="input" placeholder="RAL7001, RAL7035..." value={colorRal} onChange={e => setColorRal(e.target.value)} />
                </label>
              )}

              <div className="info-strip">
                <Icon name="alert" size={14} />
                <span>{t("newObject.prepNote")}</span>
              </div>
            </>
          )}

          {step === 2 && sys && (
            <>
              <div className="layer-head">
                <div>
                  <div className="layer-title">{sys.name}</div>
                  <div className="muted small">{t("newObject.layersHint")}</div>
                </div>
                <div className="layer-stat">
                  <div><span className="muted small">{t("newObject.activeLayers")}</span> <strong className="mono">{materialCount}/{sys.layers.length + extras.length}</strong></div>
                  <div><span className="muted small">{t("newObject.volumeLabel")}</span> <strong className="mono">{totalM2} m²</strong></div>
                  <div><span className="muted small">{t("newObject.totalMat")}</span> <strong className="mono accent-up">{totalKg.toFixed(1)} kg</strong></div>
                </div>
              </div>

              <div className="layers-table">
                <div className="lt-head">
                  <div></div>
                  <div>#</div>
                  <div>{t("newObject.layerRole")}</div>
                  <div>{t("newObject.material")}</div>
                  <div className="ta-r">kg/m²</div>
                  <div className="ta-r">{t("newObject.needed")}</div>
                </div>
                <div className="lt-row prep-row">
                  <div><span className="layer-toggle on locked"><Icon name="check" size={11} /></span></div>
                  <div className="mono">00</div>
                  <div><strong>{t("newObject.surfacePrep")}</strong> <span className="muted small">{t("newObject.required")}</span></div>
                  <div className="muted">{t("newObject.prepDesc")}</div>
                  <div className="ta-r mono muted">—</div>
                  <div className="ta-r mono">{totalM2} m²</div>
                </div>
                {sys.layers.map((l, i) => {
                  const enabled = layerEnabled(i, l);
                  const perM2 = layerPerM2(i, l);
                  return (
                    <div key={i} className={`lt-row ${!enabled ? "off" : ""}`}>
                      <div>
                        <button className={`layer-toggle ${enabled ? "on" : ""}`} onClick={() => setLayer(i, { include: !enabled })}>
                          {enabled && <Icon name="check" size={11} />}
                        </button>
                      </div>
                      <div className="mono">{String(i + 1).padStart(2, "0")}</div>
                      <div>
                        <strong>{l.role || t("newObject.layer")}</strong>
                        {l.optional && <span className="opt-pill">{t("newObject.optional")}</span>}
                        {l.note && <div className="muted tiny">{l.note}</div>}
                      </div>
                      <div>{l.name}</div>
                      <div className="ta-r">
                        <input type="number" step="0.1" className="mini-input mono" value={perM2}
                          onChange={e => setLayer(i, { perM2: +e.target.value || 0 })} />
                      </div>
                      <div className="ta-r mono">{enabled ? (perM2 * totalM2).toFixed(1) + " kg" : "—"}</div>
                    </div>
                  );
                })}
                {extras.map((row, i) => (
                  <div key={row.key} className="lt-row extra-row">
                    <div>
                      <button type="button" className="icon-btn sm danger" title={t("newObject.removeMaterial")} onClick={() => removeExtra(row.key)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <div className="mono">{String(sys.layers.length + i + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{t("newObject.extraMaterial")}</strong>
                      <span className="opt-pill">{t("newObject.added")}</span>
                    </div>
                    <div>
                      {row.name}
                      {row.color ? <span className="muted small"> · {row.color}</span> : null}
                    </div>
                    <div className="ta-r mono muted">{row.perM2 ? Number(row.perM2).toFixed(2) : "—"}</div>
                    <div className="ta-r">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="mini-input mono"
                        value={row.needed}
                        onChange={(e) => setExtra(row.key, { needed: Math.max(0, +e.target.value || 0) })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="extra-add">
                <div className="extra-add-head">
                  <strong>{t("newObject.addMaterial")}</strong>
                  <span className="muted small">{t("newObject.addMaterialHint")}</span>
                </div>
                <div className="extra-add-row">
                  <select className="select" value={addMaterialId} onChange={(e) => pickAddMaterial(e.target.value)}>
                    <option value="">{t("newObject.pickMaterial")}</option>
                    {addableCatalog.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name}{mat.color ? ` · ${mat.color}` : ""} · {mat.warehouse_name || mat.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input mono"
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder={t("common.quantity")}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!addMaterialId || !(Number(addQty) > 0)}
                    onClick={addExtra}
                  >
                    <Icon name="plus" size={14} /> {t("common.add")}
                  </button>
                </div>
                {!catalog.length && <div className="muted small">{t("newObject.noCatalog")}</div>}
              </div>
            </>
          )}
          {err && <div className="login-err">{err}</div>}
        </div>

        <footer className="modal-foot">
          <div className="foot-summary">
            <span className="foot-color" style={{ background: color }} />
            <span className="mono small muted">#{isEdit ? project.id : nextId}</span>
            <span className="small"><strong>{client || t("newObject.clientPlaceholder")}</strong> · {sys?.name || t("common.dash")} · <span className="mono">{totalM2} m²</span></span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            {step === 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!client || !address || !sys}>
                {t("newObject.next")} <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <>
                <button className="btn btn-outline" onClick={() => setStep(1)}>{t("newObject.back")}</button>
                <button className="btn btn-primary" disabled={!valid || saving || busy} onClick={save}>
                  <Icon name="save" size={15} /> {saving || busy ? t("common.saving") : t(isEdit ? "newObject.saveChanges" : "newObject.register")}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default NewObjectModal;
