import { useEffect, useState } from "react";
import Icon from "./icons";
import { fetchSystems, fetchUsers } from "./api";
import { AssigneePicker } from "./assignees";
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

const NewObjectModal = ({ onClose, onSave, nextId, busy }) => {
  const { t } = useI18n();
  const [systems, setSystems] = useState([]);
  const [systemsErr, setSystemsErr] = useState("");
  const [systemIdx, setSystemIdx] = useState(0);
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [totalM2, setTotalM2] = useState(100);
  const [color, setColor] = useState("#2C5F2E");
  const [colorRal, setColorRal] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(() => plusMonths(1));
  const [plannedDays, setPlannedDays] = useState(() => diffDaysInclusive(todayStr(), plusMonths(1)) || "");
  const [users, setUsers] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, [t]);

  // reset overrides when system changes
  useEffect(() => { setOverrides({}); }, [systemIdx]);

  const layerEnabled = (i, layer) => overrides[i]?.include ?? !layer.optional;
  const layerPerM2 = (i, layer) => overrides[i]?.perM2 ?? layer.perM2;
  const setLayer = (i, patch) => setOverrides({ ...overrides, [i]: { ...overrides[i], ...patch } });

  const previewMaterials = (sys?.layers || []).map((l, i) => ({
    layer: l,
    enabled: layerEnabled(i, l),
    perM2: layerPerM2(i, l),
    needed: Math.round(layerPerM2(i, l) * totalM2 * 10) / 10,
  }));

  const totalKg = previewMaterials.filter(m => m.enabled).reduce((s, m) => s + m.needed, 0);
  const layerCount = previewMaterials.filter(m => m.enabled).length;

  const valid = client.trim() && address.trim() && totalM2 > 0 && layerCount > 0;

  const save = async () => {
    if (!sys || !valid || saving || busy) return;
    const grouped = {};
    previewMaterials.filter(m => m.enabled).forEach(m => {
      const key = m.layer.name + (sys.needsColor && m.layer.name.toLowerCase().includes("color") ? "|" + colorRal : "");
      if (!grouped[key]) {
        grouped[key] = {
          name: m.layer.name,
          color: m.layer.name.toLowerCase().includes("color") && colorRal ? colorRal : "",
          needed: 0, perM2: m.perM2,
        };
      }
      grouped[key].needed += m.needed;
    });

    const tasks = [
      { name: t("newObject.taskPrep"), unit: "m²", quantity_total: totalM2 },
      ...previewMaterials.filter(m => m.enabled).map((m) => ({
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
        materials: Object.values(grouped).map((m) => ({
          name: m.name,
          color: m.color,
          per_m2: m.perM2,
          quantity_needed: m.needed,
          unit: "kg",
        })),
      });
    } catch (error) {
      setErr(error.message || t("api.createProject"));
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">{t("newObject.eyebrow", { id: nextId })}</div>
            <h3 className="modal-title">{t("newObject.title")}</h3>
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
                  <div><span className="muted small">{t("newObject.activeLayers")}</span> <strong className="mono">{layerCount}/{sys.layers.length}</strong></div>
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
              </div>
            </>
          )}
          {err && <div className="login-err">{err}</div>}
        </div>

        <footer className="modal-foot">
          <div className="foot-summary">
            <span className="foot-color" style={{ background: color }} />
            <span className="mono small muted">#{nextId}</span>
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
                  <Icon name="save" size={15} /> {saving || busy ? t("common.saving") : t("newObject.register")}
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
