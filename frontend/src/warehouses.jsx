import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  createWarehouse,
  fetchMaterials,
  fetchWarehouses,
  updateMaterial,
  updateWarehouse,
} from "./api";
import { useI18n } from "./i18n";
import { MaterialForm } from "./material-form";

const emptyForm = { name: "", location: "", description: "" };

const byIncoming = (rows) =>
  (Array.isArray(rows) ? rows : []).slice().sort((a, b) => Number(a.id) - Number(b.id));

const warehouseLabel = (w) => (w.location ? `${w.name} · ${w.location}` : w.name);

const WarehouseForm = ({ title, initial, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({ ...emptyForm, ...initial });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr(t("warehouses.fillName"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        name: form.name.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
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
            <div className="modal-eyebrow">{t("warehouses.modalEyebrow")}</div>
            <h3 className="modal-title">{title}</h3>
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
              <span className="field-label">{t("warehouses.location")}</span>
              <input className="input" value={form.location} onChange={set("location")} />
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
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

const WarehousesPage = ({ user }) => {
  const { t } = useI18n();
  const isAdmin = user?.role === "ADMINISTRATORS";
  const [warehouses, setWarehouses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    const [wh, mats] = await Promise.all([fetchWarehouses(), fetchMaterials()]);
    const list = byIncoming(wh);
    setWarehouses(list);
    setMaterials(Array.isArray(mats) ? mats : []);
    setWarehouseId((cur) => {
      if (cur && list.some((row) => String(row.id) === String(cur))) return cur;
      return list[0] ? String(list[0].id) : "";
    });
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

  const selected = warehouses.find((row) => String(row.id) === String(warehouseId));
  const rows = materials.filter((row) => String(row.warehouse) === String(warehouseId));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("warehouses.eyebrow")}</div>
          <h1 className="page-title">{t("warehouses.title")}</h1>
          <p className="page-sub">{t("warehouses.sub")}</p>
        </div>
        <div className="page-actions">
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => setModal({ mode: "warehouse-create" })}>
              <Icon name="plus" size={15} /> {t("warehouses.new")}
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : !warehouses.length ? (
        <section className="card muted">{t("warehouses.empty")}</section>
      ) : (
        <>
          <section className="card">
            <label className="field">
              <span className="field-label">{t("warehouses.select")}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={{ flex: 1 }}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{warehouseLabel(w)}</option>
                  ))}
                </select>
                {isAdmin && selected && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModal({ mode: "warehouse-edit", item: selected })}
                  >
                    <Icon name="edit" size={14} /> {t("common.edit")}
                  </button>
                )}
              </div>
            </label>
            {selected?.description ? (
              <div className="muted small" style={{ marginTop: 8 }}>{selected.description}</div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("materialsPage.title")}</h2>
              <span className="muted small">{t("warehouses.materialCount", { n: rows.length })}</span>
            </div>
            {!rows.length ? (
              <div className="muted small">{t("warehouses.noMaterials")}</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("common.material")}</th>
                      <th>{t("materialsPage.colorType")}</th>
                      <th>{t("common.object")}</th>
                      <th>{t("materialsPage.kgM2")}</th>
                      <th>{t("materialsPage.stock")}</th>
                      <th>{t("materialsPage.reserved")}</th>
                      <th>{t("materialsPage.available")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => {
                      const linked = m.linked_projects || [];
                      return (
                        <tr key={m.id}>
                          <td className="dt-name">{m.name}</td>
                          <td className="muted">{m.color || "—"}</td>
                          <td>
                            {linked.length ? linked.map((p) => (
                              <div key={p.id} className="muted small">
                                #{p.id} {p.client || p.name}
                              </div>
                            )) : t("common.dash")}
                          </td>
                          <td className="mono">{m.per_m2 ?? "—"}</td>
                          <td className="mono">{m.stock} {m.unit}</td>
                          <td className="mono">{m.reserved ?? "0"} {m.unit}</td>
                          <td className="mono">{m.available ?? m.stock} {m.unit}</td>
                          <td className="ta-r">
                            {isAdmin && (
                              <button className="icon-btn sm" onClick={() => setModal({ mode: "material-edit", item: m })}>
                                <Icon name="edit" size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {modal?.mode === "warehouse-create" && (
        <WarehouseForm
          title={t("warehouses.new")}
          initial={emptyForm}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            const created = await createWarehouse(payload);
            setModal(null);
            await load();
            if (created?.id) setWarehouseId(String(created.id));
            showToast(t("warehouses.created"));
          }}
        />
      )}
      {modal?.mode === "warehouse-edit" && (
        <WarehouseForm
          title={t("warehouses.edit")}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await updateWarehouse(modal.item.id, payload);
            setModal(null);
            await load();
            showToast(t("warehouses.saved"));
          }}
        />
      )}
      {modal?.mode === "material-edit" && (
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

export default WarehousesPage;
