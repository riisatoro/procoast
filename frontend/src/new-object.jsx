import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { fetchMaterials, fetchSystems, fetchUsers } from "./api";
import { AssigneePicker, isAdminUser, projectAssignees } from "./assignees";
import { useI18n } from "./i18n";

const CUSTOM_CODE = "CUSTOM";
const LAYER_ROLES = [
  "Grunts",
  "Papildu grunts",
  "2. kārta",
  "Izlīdzinošais slānis",
  "Finišs",
  "Apbēršana",
  "Papildu",
];

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

function catalogColorsForName(catalog, name) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return [];
  return [...new Set(
    (catalog || [])
      .filter((mat) => (mat.name || "").trim().toLowerCase() === key)
      .map((mat) => String(mat.color || "").trim())
      .filter(Boolean)
  )];
}

function defaultColorForLayer(layer, catalog, colorRal, needsColor) {
  const colors = catalogColorsForName(catalog, layer?.name);
  if (colors.length === 1) return colors[0];
  if (needsColor && String(layer?.name || "").toLowerCase().includes("color") && colorRal) {
    return colorRal;
  }
  return "";
}

function layerTaskName(name, role) {
  return `${name || ""} ${role || ""}`.trim();
}

function splitTaskName(raw, roles = LAYER_ROLES) {
  const text = (raw || "").trim();
  const lower = text.toLowerCase();
  const sorted = [...roles].sort((a, b) => b.length - a.length);
  for (const role of sorted) {
    const needle = ` ${role.toLowerCase()}`;
    if (lower.endsWith(needle)) {
      return { name: text.slice(0, text.length - role.length).trim(), role };
    }
    if (lower === role.toLowerCase()) return { name: text, role };
  }
  return { name: text, role: "Papildu" };
}

function isPrepTask(name, prepLabel) {
  const value = (name || "").trim().toLowerCase();
  if (!value) return false;
  if (value === (prepLabel || "").trim().toLowerCase()) return true;
  return value.startsWith("virsmas sagatavošana") || value.startsWith("surface preparation");
}

function overridesFromProject(sys, project) {
  const rows = project?.needed_materials || [];
  const byName = {};
  rows.forEach((row) => {
    const name = (row.material_detail?.name || "").trim().toLowerCase();
    if (name) byName[name] = row;
  });
  const tasks = new Set(
    (project?.tasks || []).map((task) => (task.name || "").trim().toLowerCase()).filter(Boolean)
  );
  const next = {};
  (sys?.layers || []).forEach((layer, i) => {
    const row = byName[(layer.name || "").trim().toLowerCase()];
    const hasTask = tasks.has(layerTaskName(layer.name, layer.role).toLowerCase());
    if (layer.optional && tasks.size) {
      if (!hasTask) {
        next[i] = { include: false };
        return;
      }
    } else if (layer.optional && !row) {
      next[i] = { include: false };
      return;
    }
    if (row || hasTask) {
      const perM2 = Number(row?.material_detail?.per_m2);
      next[i] = {
        include: true,
        perM2: perM2 > 0 ? perM2 : layer.perM2,
        color: row?.material_detail?.color || "",
      };
    }
  });
  return next;
}

function extraCoatsFromProject(sys, project, prepLabel) {
  const templateNames = new Set(
    (sys?.layers || [])
      .map((layer) => layerTaskName(layer.name, layer.role).toLowerCase())
      .filter(Boolean)
  );
  const materials = project?.needed_materials || [];
  const area = Number(project?.total_m2) || 0;
  return (project?.tasks || [])
    .filter((task) => {
      const name = (task.name || "").trim();
      if (!name || isPrepTask(name, prepLabel)) return false;
      return !templateNames.has(name.toLowerCase());
    })
    .map((task, i) => {
      const parsed = splitTaskName(task.name);
      const mat = materials.find(
        (row) => (row.material_detail?.name || "").trim().toLowerCase() === parsed.name.toLowerCase()
      );
      const detail = mat?.material_detail || {};
      const perM2 = Number(detail.per_m2) || 0;
      const qty = Number(mat?.quantity_needed) || 0;
      return {
        key: `coat-${task.id || i}`,
        materialId: mat?.material,
        name: parsed.name,
        role: parsed.role,
        color: detail.color || "",
        unit: detail.unit || "kg",
        perM2: perM2 > 0 ? perM2 : (area > 0 ? Math.round((qty / area) * 1000) / 1000 : 0),
      };
    });
}

function extrasFromProject(sys, project, extraCoats) {
  const layerNames = new Set(
    [
      ...(sys?.layers || []).map((layer) => (layer.name || "").trim().toLowerCase()),
      ...(extraCoats || []).map((row) => (row.name || "").trim().toLowerCase()),
    ].filter(Boolean)
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

function periodsFromProject(project) {
  const rows = project?.periods;
  if (Array.isArray(rows) && rows.length) {
    return rows.map((row, i) => ({
      key: `p-${row.id || i}`,
      start: row.start_date,
      end: row.end_date || row.start_date,
    }));
  }
  return [{
    key: "p-0",
    start: project?.start_date || todayStr(),
    end: project?.end_date || plusMonths(1),
  }];
}

const NewObjectModal = ({ onClose, onSave, nextId, busy, project }) => {
  const { t } = useI18n();
  const isEdit = Boolean(project?.id);
  const [systems, setSystems] = useState([]);
  const [systemsErr, setSystemsErr] = useState("");
  const [systemIdx, setSystemIdx] = useState(0);
  const [customOn, setCustomOn] = useState(false);
  const [customName, setCustomName] = useState("");
  const [client, setClient] = useState(project?.client || project?.name || "");
  const [address, setAddress] = useState(project?.address || "");
  const [totalM2, setTotalM2] = useState(Number(project?.total_m2) || 100);
  const [color, setColor] = useState(project?.color || "#2C5F2E");
  const [colorRal, setColorRal] = useState("");
  const [periods, setPeriods] = useState(() => periodsFromProject(project));
  const [users, setUsers] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState(
    projectAssignees(project)
      .filter((person) => !isAdminUser(person))
      .map((person) => Number(person.id))
      .filter((id) => id)
  );
  const [overrides, setOverrides] = useState({});
  const [extraCoats, setExtraCoats] = useState([]);
  const [extras, setExtras] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [addMaterialId, setAddMaterialId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addColor, setAddColor] = useState("");
  const [addCoatMaterialId, setAddCoatMaterialId] = useState("");
  const [addCoatRole, setAddCoatRole] = useState("Papildu");
  const [addCoatPerM2, setAddCoatPerM2] = useState("");
  const [addCoatColor, setAddCoatColor] = useState("");
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const skipLayerReset = useRef(isEdit);
  const layersHydrated = useRef(false);

  const catalogSys = systems[systemIdx];
  const sys = customOn
    ? {
      code: CUSTOM_CODE,
      name: customName.trim() || t("newObject.customSystem"),
      needsColor: true,
      layers: [],
      custom: true,
    }
    : catalogSys;

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
    if (idx >= 0) {
      setSystemIdx(idx);
      setCustomOn(false);
    } else {
      setCustomOn(true);
      setCustomName(project.system);
    }
  }, [systems, project?.system]);

  useEffect(() => {
    if (skipLayerReset.current) return;
    setOverrides({});
  }, [systemIdx, customOn]);

  useEffect(() => {
    if (!isEdit || layersHydrated.current || !systems.length || !sys) return;
    if (project?.system) {
      const hasMatch = systems.some(
        (row) => row.name === project.system || row.code === project.system
      );
      if (hasMatch && customOn) return;
      if (hasMatch && sys.name !== project.system && sys.code !== project.system) return;
      if (!hasMatch && !customOn) return;
    }
    setOverrides(overridesFromProject(sys, project));
    const coats = extraCoatsFromProject(sys, project, t("newObject.taskPrep"));
    setExtraCoats(coats);
    setExtras(extrasFromProject(sys, project, coats));
    const shade = ralFromProject(project);
    if (shade) setColorRal(shade);
    layersHydrated.current = true;
    skipLayerReset.current = false;
  }, [isEdit, sys, systems, project, customOn, t]);

  const layerEnabled = (i, layer) => overrides[i]?.include ?? !layer.optional;
  const layerPerM2 = (i, layer) => overrides[i]?.perM2 ?? layer.perM2;
  const layerColor = (i, layer) => {
    if (overrides[i] && Object.prototype.hasOwnProperty.call(overrides[i], "color")) {
      return overrides[i].color;
    }
    return defaultColorForLayer(layer, catalog, colorRal, sys?.needsColor);
  };
  const setLayer = (i, patch) => setOverrides({ ...overrides, [i]: { ...overrides[i], ...patch } });

  const previewMaterials = (sys?.layers || []).map((l, i) => ({
    index: i,
    layer: l,
    enabled: layerEnabled(i, l),
    perM2: layerPerM2(i, l),
    color: layerColor(i, l),
    needed: Math.round(layerPerM2(i, l) * totalM2 * 10) / 10,
  }));

  const extraCoatRows = extraCoats.filter((row) => (row.name || "").trim() && Number(row.perM2) > 0);
  const extraCoatKg = extraCoatRows.reduce(
    (sum, row) => sum + Math.round(Number(row.perM2) * totalM2 * 10) / 10,
    0
  );
  const extraKg = extras.reduce((sum, row) => sum + (Number(row.needed) || 0), 0);
  const totalKg = previewMaterials.filter((m) => m.enabled).reduce((s, m) => s + m.needed, 0) + extraCoatKg + extraKg;
  const layerCount = previewMaterials.filter((m) => m.enabled).length + extraCoatRows.length;
  const materialCount = layerCount + extras.length;
  const listedCoats = (sys?.layers || []).length + extraCoats.length;

  const usedMaterialKeys = new Set([
    ...previewMaterials.filter((m) => m.enabled).map((m) => (m.layer.name || "").trim().toLowerCase()),
    ...extraCoats.map((row) => (row.name || "").trim().toLowerCase()),
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

  const valid = client.trim() && address.trim() && totalM2 > 0 && layerCount > 0;

  const setExtra = (key, patch) => {
    setExtras((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const removeExtra = (key) => setExtras((rows) => rows.filter((row) => row.key !== key));
  const setExtraCoat = (key, patch) => {
    setExtraCoats((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const removeExtraCoat = (key) => setExtraCoats((rows) => rows.filter((row) => row.key !== key));

  const pickAddMaterial = (id) => {
    setAddMaterialId(id);
    const mat = catalog.find((row) => String(row.id) === String(id));
    if (!mat) {
      setAddQty("");
      setAddColor("");
      return;
    }
    setAddColor(mat.color || "");
    const rate = Number(mat.per_m2) || 0;
    if (rate > 0 && totalM2 > 0) {
      setAddQty(String(Math.round(rate * totalM2 * 10) / 10));
    }
  };

  const pickAddCoat = (id) => {
    setAddCoatMaterialId(id);
    const mat = catalog.find((row) => String(row.id) === String(id));
    if (!mat) {
      setAddCoatPerM2("");
      setAddCoatColor("");
      return;
    }
    setAddCoatColor(mat.color || colorRal || "");
    const rate = Number(mat.per_m2) || 0;
    setAddCoatPerM2(rate > 0 ? String(rate) : "");
  };

  const addExtra = () => {
    const mat = catalog.find((row) => String(row.id) === String(addMaterialId));
    const qty = Number(addQty);
    if (!mat || !(qty > 0)) return;
    const name = (mat.name || "").trim();
    const nameKey = name.toLowerCase();
    const layerIdx = (sys?.layers || []).findIndex((layer) => (layer.name || "").trim().toLowerCase() === nameKey);
    const shade = addColor.trim() || mat.color || "";
    if (layerIdx >= 0) {
      setLayer(layerIdx, {
        include: true,
        perM2: totalM2 > 0 ? qty / totalM2 : Number(mat.per_m2) || 0,
        color: shade,
      });
    } else {
      const existing = extras.find((row) =>
        Number(row.materialId) === Number(mat.id)
        || (
          (row.name || "").trim().toLowerCase() === nameKey
          && String(row.color || "").trim().toLowerCase() === shade.toLowerCase()
        )
      );
      if (existing) {
        setExtra(existing.key, { needed: Number(existing.needed || 0) + qty, color: shade });
      } else {
        setExtras((rows) => [
          ...rows,
          {
            key: `new-${Date.now()}`,
            materialId: mat.id,
            name,
            color: shade,
            unit: mat.unit || "kg",
            perM2: Number(mat.per_m2) || 0,
            needed: qty,
          },
        ]);
      }
    }
    setAddMaterialId("");
    setAddQty("");
    setAddColor("");
  };

  const addExtraCoat = () => {
    const mat = catalog.find((row) => String(row.id) === String(addCoatMaterialId));
    const rate = Number(addCoatPerM2);
    if (!mat || !(rate > 0)) return;
    const name = (mat.name || "").trim();
    if (!name) return;
    setExtraCoats((rows) => [
      ...rows,
      {
        key: `coat-${Date.now()}`,
        materialId: mat.id,
        name,
        role: (addCoatRole || "").trim() || "Papildu",
        color: addCoatColor.trim() || mat.color || "",
        unit: mat.unit || "kg",
        perM2: rate,
      },
    ]);
    setAddCoatMaterialId("");
    setAddCoatPerM2("");
    setAddCoatColor("");
    setAddCoatRole("Papildu");
  };

  const setPeriod = (key, patch) => {
    setPeriods((rows) => rows.map((row) => {
      if (row.key !== key) return row;
      const next = { ...row, ...patch };
      if (next.start && next.end && next.end < next.start) next.end = next.start;
      return next;
    }));
  };
  const addPeriodRow = () => {
    const last = periods[periods.length - 1];
    const start = last?.end ? addDays(last.end, 8) : todayStr();
    setPeriods((rows) => [...rows, { key: `p-${Date.now()}`, start, end: addDays(start, 2) }]);
  };
  const removePeriodRow = (key) => {
    setPeriods((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.key !== key)));
  };
  const plannedDaysTotal = periods.reduce((sum, row) => {
    const days = Number(diffDaysInclusive(row.start, row.end));
    return sum + (days >= 1 ? days : 0);
  }, 0);

  const save = async () => {
    if (!sys || !valid || saving || busy) return;
    const grouped = {};
    const addGrouped = (name, shade, needed, perM2, materialId) => {
      const key = `${name}|${shade}`;
      if (!grouped[key]) {
        grouped[key] = {
          name,
          color: shade,
          needed: 0,
          perM2,
          material: materialId || undefined,
        };
      }
      grouped[key].needed += needed;
    };
    previewMaterials.filter((m) => m.enabled).forEach((m) => {
      addGrouped(m.layer.name, String(m.color || "").trim(), m.needed, m.perM2);
    });
    extraCoatRows.forEach((row) => {
      addGrouped(
        row.name.trim(),
        String(row.color || "").trim(),
        Math.round(Number(row.perM2) * totalM2 * 10) / 10,
        Number(row.perM2),
        row.materialId
      );
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
        name: layerTaskName(m.layer.name, m.layer.role),
        unit: "m²",
        quantity_total: totalM2,
      })),
      ...extraCoatRows.map((row) => ({
        name: layerTaskName(row.name, row.role),
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
        periods: periods
          .filter((row) => row.start)
          .map((row) => ({
            start_date: row.start,
            end_date: row.end && row.end >= row.start ? row.end : row.start,
          })),
        assigned_to_ids: assigneeIds,
        tasks,
        materials: [
          ...Object.values(grouped).map((m) => ({
            material: m.material,
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

  const canContinue = Boolean(client.trim() && address.trim() && sys);

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
                <span className="muted small">{t("projects.assigneeHint")}</span>
                <AssigneePicker users={users} value={assigneeIds} onChange={setAssigneeIds} />
              </label>

              <label className="field">
                <span className="field-label">{t("newObject.system")}</span>
                <div className="sys-grid">
                  {systems.map((s, i) => (
                    <button key={s.code} type="button"
                      className={`sys-card ${!customOn && systemIdx === i ? "on" : ""}`}
                      onClick={() => { setCustomOn(false); setSystemIdx(i); }}>
                      <span className="sys-code mono">{s.code}</span>
                      <span className="sys-name">{s.name}</span>
                      <span className="sys-meta">{s.needsColor ? t("newObject.layersColor", { n: s.layers.length }) : t("newObject.layersNoColor", { n: s.layers.length })}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`sys-card custom-sys ${customOn ? "on" : ""}`}
                    onClick={() => setCustomOn(true)}
                  >
                    <span className="sys-code mono">{CUSTOM_CODE}</span>
                    <span className="sys-name">{t("newObject.customSystem")}</span>
                    <span className="sys-meta">{t("newObject.customSystemMeta")}</span>
                  </button>
                </div>
              </label>
              {customOn && (
                <label className="field">
                  <span className="field-label">{t("newObject.customSystemName")}</span>
                  <input
                    className="input"
                    placeholder={t("newObject.customSystemNamePh")}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <span className="muted small">{t("newObject.customSystemHint")}</span>
                </label>
              )}

              <div className="field-row two">
                <label className="field">
                  <span className="field-label">{t("newObject.volume")}</span>
                  <input className="input mono" type="number" value={totalM2} onChange={e => setTotalM2(Math.max(0, +e.target.value || 0))} />
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

              <div className="field">
                <span className="field-label">{t("newObject.periods")}</span>
                <span className="muted small">{t("newObject.periodsHint")}</span>
                <div className="period-list">
                  {periods.map((row) => {
                    const days = Number(diffDaysInclusive(row.start, row.end)) || 0;
                    return (
                      <div key={row.key} className="period-row">
                        <label className="field">
                          <span className="field-label">{t("newObject.periodFrom")}</span>
                          <input
                            className="input"
                            type="date"
                            value={row.start}
                            onChange={(e) => setPeriod(row.key, { start: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">{t("newObject.periodTo")}</span>
                          <input
                            className="input"
                            type="date"
                            min={row.start}
                            value={row.end}
                            onChange={(e) => setPeriod(row.key, { end: e.target.value })}
                          />
                        </label>
                        <div className="field">
                          <span className="field-label">{t("newObject.periodDays")}</span>
                          <div className="period-days readout mono">{days > 0 ? days : "—"}</div>
                        </div>
                        <button
                          type="button"
                          className="icon-btn sm danger"
                          title={t("newObject.removePeriod")}
                          disabled={periods.length <= 1}
                          onClick={() => removePeriodRow(row.key)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="period-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addPeriodRow}>
                    <Icon name="plus" size={13} /> {t("newObject.addPeriod")}
                  </button>
                  <span className="muted small">{t("newObject.plannedDaysTotal", { n: plannedDaysTotal })}</span>
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
                  <div className="muted small">{customOn ? t("newObject.customLayersHint") : t("newObject.layersHint")}</div>
                </div>
                <div className="layer-stat">
                  <div><span className="muted small">{t("newObject.activeLayers")}</span> <strong className="mono">{layerCount}/{listedCoats || layerCount}</strong></div>
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
                  <div><strong>{t("newObject.surfacePrep")}</strong> <span className="opt-pill">{t("newObject.required")}</span></div>
                  <div className="muted">{t("newObject.prepDesc")}</div>
                  <div className="ta-r mono muted">—</div>
                  <div className="ta-r mono">{totalM2} m²</div>
                </div>
                {(sys.layers || []).map((l, i) => {
                  const enabled = layerEnabled(i, l);
                  const perM2 = layerPerM2(i, l);
                  const shade = layerColor(i, l);
                  const colorOptions = catalogColorsForName(catalog, l.name);
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
                      <div className="lt-material">
                        <div>{l.name}</div>
                        <input
                          className="mini-input color-in"
                          list={`layer-color-${i}`}
                          placeholder={t("newObject.materialColorPh")}
                          value={shade}
                          disabled={!enabled}
                          onChange={(e) => setLayer(i, { color: e.target.value })}
                          aria-label={t("newObject.materialColor")}
                        />
                        {colorOptions.length > 0 && (
                          <datalist id={`layer-color-${i}`}>
                            {colorOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      <div className="ta-r">
                        <input type="number" step="0.1" className="mini-input mono" value={perM2}
                          onChange={e => setLayer(i, { perM2: +e.target.value || 0 })} />
                      </div>
                      <div className="ta-r mono">{enabled ? (perM2 * totalM2).toFixed(1) + " kg" : "—"}</div>
                    </div>
                  );
                })}
                {extraCoats.map((row, i) => (
                  <div key={row.key} className="lt-row extra-coat-row">
                    <div>
                      <button type="button" className="icon-btn sm danger" title={t("newObject.removeLayer")} onClick={() => removeExtraCoat(row.key)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <div className="mono">{String((sys.layers || []).length + i + 1).padStart(2, "0")}</div>
                    <div>
                      <input
                        className="mini-input color-in"
                        list={`coat-role-${row.key}`}
                        placeholder={t("newObject.layerRolePh")}
                        value={row.role || ""}
                        onChange={(e) => setExtraCoat(row.key, { role: e.target.value })}
                        aria-label={t("newObject.layerRole")}
                      />
                      <datalist id={`coat-role-${row.key}`}>
                        {LAYER_ROLES.map((role) => (
                          <option key={role} value={role} />
                        ))}
                      </datalist>
                      <span className="opt-pill">{t("newObject.coatAdded")}</span>
                    </div>
                    <div className="lt-material">
                      <div>{row.name}</div>
                      <input
                        className="mini-input color-in"
                        list={`coat-color-${row.key}`}
                        placeholder={t("newObject.materialColorPh")}
                        value={row.color || ""}
                        onChange={(e) => setExtraCoat(row.key, { color: e.target.value })}
                        aria-label={t("newObject.materialColor")}
                      />
                      {catalogColorsForName(catalog, row.name).length > 0 && (
                        <datalist id={`coat-color-${row.key}`}>
                          {catalogColorsForName(catalog, row.name).map((opt) => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      )}
                    </div>
                    <div className="ta-r">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="mini-input mono"
                        value={row.perM2}
                        onChange={(e) => setExtraCoat(row.key, { perM2: +e.target.value || 0 })}
                      />
                    </div>
                    <div className="ta-r mono">{(Number(row.perM2) * totalM2).toFixed(1)} kg</div>
                  </div>
                ))}
                {extras.map((row, i) => (
                  <div key={row.key} className="lt-row extra-row">
                    <div>
                      <button type="button" className="icon-btn sm danger" title={t("newObject.removeMaterial")} onClick={() => removeExtra(row.key)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <div className="mono">{String((sys.layers || []).length + extraCoats.length + i + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{t("newObject.extraMaterial")}</strong>
                      <span className="opt-pill">{t("newObject.added")}</span>
                    </div>
                    <div className="lt-material">
                      <div>{row.name}</div>
                      <input
                        className="mini-input color-in"
                        list={`extra-color-${row.key}`}
                        placeholder={t("newObject.materialColorPh")}
                        value={row.color || ""}
                        onChange={(e) => setExtra(row.key, { color: e.target.value })}
                        aria-label={t("newObject.materialColor")}
                      />
                      {catalogColorsForName(catalog, row.name).length > 0 && (
                        <datalist id={`extra-color-${row.key}`}>
                          {catalogColorsForName(catalog, row.name).map((opt) => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      )}
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
                  <strong>{t("newObject.addLayer")}</strong>
                  <span className="muted small">{t("newObject.addLayerHint")}</span>
                </div>
                <div className="extra-add-row coat-add">
                  <input
                    className="input"
                    list="add-coat-roles"
                    placeholder={t("newObject.layerRolePh")}
                    value={addCoatRole}
                    onChange={(e) => setAddCoatRole(e.target.value)}
                    aria-label={t("newObject.layerRole")}
                  />
                  <datalist id="add-coat-roles">
                    {LAYER_ROLES.map((role) => (
                      <option key={role} value={role} />
                    ))}
                  </datalist>
                  <select className="select" value={addCoatMaterialId} onChange={(e) => pickAddCoat(e.target.value)}>
                    <option value="">{t("newObject.pickMaterial")}</option>
                    {catalog.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name}{mat.color ? ` · ${mat.color}` : ""} · {mat.warehouse_name || mat.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    list="add-coat-colors"
                    placeholder={t("newObject.materialColorPh")}
                    value={addCoatColor}
                    onChange={(e) => setAddCoatColor(e.target.value)}
                    disabled={!addCoatMaterialId}
                    aria-label={t("newObject.materialColor")}
                  />
                  <datalist id="add-coat-colors">
                    {catalogColorsForName(
                      catalog,
                      catalog.find((row) => String(row.id) === String(addCoatMaterialId))?.name
                    ).map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                  <input
                    className="input mono"
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="kg/m²"
                    value={addCoatPerM2}
                    onChange={(e) => setAddCoatPerM2(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!addCoatMaterialId || !(Number(addCoatPerM2) > 0)}
                    onClick={addExtraCoat}
                  >
                    <Icon name="plus" size={14} /> {t("common.add")}
                  </button>
                </div>
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
                  <div>
                    <input
                      className="input"
                      list="add-material-colors"
                      placeholder={t("newObject.materialColorPh")}
                      value={addColor}
                      onChange={(e) => setAddColor(e.target.value)}
                      disabled={!addMaterialId}
                      aria-label={t("newObject.materialColor")}
                    />
                    <datalist id="add-material-colors">
                      {catalogColorsForName(
                        catalog,
                        catalog.find((row) => String(row.id) === String(addMaterialId))?.name
                      ).map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
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
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!canContinue}>
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
