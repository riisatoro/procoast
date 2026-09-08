import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  createMaterial,
  fetchMaterials,
  fetchWarehouses,
  updateMaterial,
} from "./api";
import { useI18n } from "./i18n";
import { MaterialsTaken } from "./tools-materials";

const emptyForm = { name: "", color: "", unit: "kg", per_m2: "", warehouse: "", stock: "0" };

const MaterialForm = ({ title, initial, warehouses, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({
    ...emptyForm,
    ...initial,
    warehouse: initial?.warehouse || warehouses[0]?.id || "",
    per_m2: initial?.per_m2 ?? "",
    stock: initial?.stock ?? "0",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.warehouse) {
      setErr(t("materialsPage.fillBoth"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        name: form.name.trim(),
        color: form.color.trim(),
        unit: form.unit.trim() || "kg",
        per_m2: form.per_m2 === "" ? null : form.per_m2,
        warehouse: Number(form.warehouse),
        stock: form.stock === "" ? "0" : form.stock,
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
            <div className="modal-eyebrow">{t("materialsPage.modalEyebrow")}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
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

const MaterialsCatalog = ({ onBack }) => {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    const [mats, wh] = await Promise.all([fetchMaterials(), fetchWarehouses()]);
    setItems(mats);
    setWarehouses(wh);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("materialsPage.eyebrow")}</div>
          <h1 className="page-title">{t("materialsPage.title")}</h1>
          <p className="page-sub">{t("materialsPage.sub")}</p>
        </div>
        <div className="page-actions">
          {onBack && (
            <button className="btn btn-ghost" onClick={onBack}>
              <Icon name="chevronLeft" size={15} /> {t("takenMaterials.title")}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })} disabled={!warehouses.length}>
            <Icon name="plus" size={15} /> {t("materialsPage.new")}
          </button>
        </div>
      </header>

      {!warehouses.length && !loading && (
        <section className="card muted">{t("materialsPage.needWarehouse")}</section>
      )}

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : items.length === 0 ? (
        <section className="card muted">{t("materialsPage.empty")}</section>
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.material")}</th>
                <th>{t("materialsPage.colorType")}</th>
                <th>{t("materialsPage.warehouse")}</th>
                <th>{t("materialsPage.kgM2")}</th>
                <th>{t("materialsPage.stock")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="dt-name">{m.name}</td>
                  <td className="muted">{m.color || "—"}</td>
                  <td>{m.warehouse_name}{m.warehouse_location ? <div className="muted small">{m.warehouse_location}</div> : null}</td>
                  <td className="mono">{m.per_m2 ?? "—"}</td>
                  <td className="mono">{m.stock} {m.unit}</td>
                  <td className="ta-r">
                    <button className="icon-btn sm" onClick={() => setModal({ mode: "edit", item: m })}>
                      <Icon name="edit" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {modal?.mode === "create" && (
        <MaterialForm
          title={t("materialsPage.new")}
          initial={emptyForm}
          warehouses={warehouses}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await createMaterial(payload);
            setModal(null);
            await load();
            showToast(t("materialsPage.created"));
          }}
        />
      )}
      {modal?.mode === "edit" && (
        <MaterialForm
          title={t("materialsPage.edit")}
          initial={modal.item}
          warehouses={warehouses}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await updateMaterial(modal.item.id, payload);
            setModal(null);
            await load();
            showToast(t("materialsPage.saved"));
          }}
        />
      )}
      {toast && <div className="toast"><Icon name="check" size={14} /> {toast}</div>}
    </div>
  );
};

const MaterialsPage = ({ user }) => {
  const isAdmin = user?.role === "ADMINISTRATORS";
  const [view, setView] = useState("taken");
  if (view === "catalog" && isAdmin) {
    return <MaterialsCatalog onBack={() => setView("taken")} />;
  }
  return <MaterialsTaken user={user} onOpenCatalog={isAdmin ? () => setView("catalog") : undefined} />;
};

export default MaterialsPage;
