import { useState } from "react";
import Icon from "./icons";
import { useI18n } from "./i18n";
import { lastProjectId } from "./last-project";

export const emptyMaterialForm = {
  name: "",
  color: "",
  unit: "kg",
  per_m2: "",
  warehouse: "",
  stock: "0",
  project: "",
  quantity_needed: "",
};

const projectLabel = (p) =>
  `#${p.id} — ${p.client || p.name}${p.address ? ` · ${p.address}` : ""}`;

const suggestedNeed = (perM2, project) => {
  const rate = Number(perM2);
  const area = Number(project?.total_m2 || 0);
  if (!rate || !area) return "";
  return String(Math.round(rate * area * 100) / 100);
};

export const MaterialForm = ({
  title,
  initial,
  warehouses,
  projects = [],
  defaultProjectId = "",
  lockProject = false,
  linkProject = false,
  onClose,
  onSave,
}) => {
  const { t } = useI18n();
  const initialProject = initial?.project || defaultProjectId || lastProjectId(projects) || projects[0]?.id || "";
  const [form, setForm] = useState({
    ...emptyMaterialForm,
    ...initial,
    warehouse: initial?.warehouse || warehouses[0]?.id || "",
    per_m2: initial?.per_m2 ?? "",
    stock: initial?.stock ?? "0",
    project: initialProject,
    quantity_needed: initial?.quantity_needed ?? "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const selectedProject = projects.find((p) => String(p.id) === String(form.project));
  const hintNeed = suggestedNeed(form.per_m2, selectedProject);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.warehouse) {
      setErr(t("materialsPage.fillBoth"));
      return;
    }
    if (linkProject && !form.project) {
      setErr(t("materialsPage.fillProject"));
      return;
    }
    const qty = form.quantity_needed || hintNeed;
    if (linkProject && !qty) {
      setErr(t("materialsPage.fillNeed"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        color: form.color.trim(),
        unit: form.unit.trim() || "kg",
        per_m2: form.per_m2 === "" ? null : form.per_m2,
        warehouse: Number(form.warehouse),
        stock: form.stock === "" ? "0" : form.stock,
      };
      if (linkProject) {
        payload.project = Number(form.project);
        payload.quantity_needed = qty;
      }
      await onSave(payload);
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
            <div className="modal-eyebrow">{t("materialsPage.modalEyebrow")}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            {linkProject && (
              <label className="field">
                <span className="field-label">{t("common.object")}</span>
                {lockProject && selectedProject ? (
                  <input className="input" value={projectLabel(selectedProject)} readOnly />
                ) : (
                  <select className="select" value={form.project} onChange={set("project")}>
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{projectLabel(p)}</option>
                    ))}
                  </select>
                )}
              </label>
            )}
            <label className="field">
              <span className="field-label">{t("common.name")}</span>
              <input className="input" value={form.name} onChange={set("name")} placeholder="EP02 Color" />
            </label>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("materialsPage.colorType")}</span>
                <input className="input" value={form.color} onChange={set("color")} placeholder="RAL7001" />
              </label>
              <label className="field">
                <span className="field-label">{t("materialsPage.unit")}</span>
                <input className="input" value={form.unit} onChange={set("unit")} />
              </label>
            </div>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("materialsPage.kgM2")}</span>
                <input className="input" type="number" step="0.001" value={form.per_m2} onChange={set("per_m2")} />
              </label>
              <label className="field">
                <span className="field-label">{t("materialsPage.stock")}</span>
                <input className="input" type="number" step="0.01" value={form.stock} onChange={set("stock")} />
              </label>
            </div>
            {linkProject && (
              <label className="field">
                <span className="field-label">{t("takenMaterials.needed")}</span>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity_needed}
                  onChange={set("quantity_needed")}
                  placeholder={hintNeed || ""}
                />
                {hintNeed && !form.quantity_needed && (
                  <span className="muted small">{t("materialsPage.needHint", { n: hintNeed, unit: form.unit || "kg" })}</span>
                )}
              </label>
            )}
            <label className="field">
              <span className="field-label">{t("materialsPage.warehouse")}</span>
              <select className="select" value={form.warehouse} onChange={set("warehouse")}>
                <option value="">—</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.location ? `${w.name} · ${w.location}` : w.name}</option>
                ))}
              </select>
            </label>
            {err && <div className="login-err">{err}</div>}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
