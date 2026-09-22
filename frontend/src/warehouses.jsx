import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  createMaterial,
  createWarehouse,
  fetchMaterials,
  fetchProjects,
  fetchWarehouses,
  updateMaterial,
  updateWarehouse,
} from "./api";
import { useI18n } from "./i18n";
import { lastProjectId } from "./last-project";
import { emptyMaterialForm, MaterialForm } from "./material-form";

const emptyForm = { name: "", location: "", description: "" };

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
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    const [wh, mats, plist] = await Promise.all([
      fetchWarehouses(),
      fetchMaterials(),
      fetchProjects(),
    ]);
    setWarehouses(Array.isArray(wh) ? wh : []);
    setMaterials(Array.isArray(mats) ? mats : []);
    setProjects(Array.isArray(plist) ? plist : []);
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

  const countByWarehouse = {};
  materials.forEach((m) => {
    countByWarehouse[m.warehouse] = (countByWarehouse[m.warehouse] || 0) + 1;
  });

  const canRegister = warehouses.length > 0 && projects.length > 0;

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
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: "material-create" })}
            disabled={!canRegister}
          >
            <Icon name="plus" size={15} /> {t("materialsPage.new")}
          </button>
        </div>
      </header>

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : (
        <>
          {!warehouses.length ? (
            <section className="card muted">{t("warehouses.empty")}</section>
          ) : (
            <section className="users-grid">
              {warehouses.map((w) => (
                <div key={w.id} className="user-card" style={{ cursor: "default" }}>
                  <div className="user-card-head">
                    <div className="user-card-avatar"><Icon name="warehouse" size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="user-card-name">{w.name}</div>
                      <div className="user-card-email">{w.location || t("common.dash")}</div>
                    </div>
                    {isAdmin && (
                      <button className="icon-btn sm" title={t("common.edit")} onClick={() => setModal({ mode: "warehouse-edit", item: w })}>
                        <Icon name="edit" size={13} />
                      </button>
                    )}
                  </div>
                  <div className="muted small">{w.description || t("warehouses.noDesc")}</div>
                  <div className="muted small">{t("warehouses.materialCount", { n: countByWarehouse[w.id] || 0 })}</div>
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("materialsPage.title")}</h2>
              <span className="muted small">{t("warehouses.materialsHint")}</span>
            </div>
            {!warehouses.length ? (
              <div className="muted small">{t("materialsPage.needWarehouse")}</div>
            ) : !projects.length ? (
              <div className="muted small">{t("warehouses.needProject")}</div>
            ) : !materials.length ? (
              <div className="muted small">{t("materialsPage.empty")}</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("common.material")}</th>
                      <th>{t("materialsPage.colorType")}</th>
                      <th>{t("materialsPage.warehouse")}</th>
                      <th>{t("common.object")}</th>
                      <th>{t("materialsPage.kgM2")}</th>
                      <th>{t("materialsPage.stock")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => {
                      const linked = m.linked_projects || [];
                      return (
                        <tr key={m.id}>
                          <td className="dt-name">{m.name}</td>
                          <td className="muted">{m.color || "—"}</td>
                          <td>
                            {m.warehouse_name}
                            {m.warehouse_location ? <div className="muted small">{m.warehouse_location}</div> : null}
                          </td>
                          <td>
                            {linked.length ? linked.map((p) => (
                              <div key={p.id} className="muted small">
                                #{p.id} {p.client || p.name}
                              </div>
                            )) : t("common.dash")}
                          </td>
                          <td className="mono">{m.per_m2 ?? "—"}</td>
                          <td className="mono">{m.stock} {m.unit}</td>
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
            await createWarehouse(payload);
            setModal(null);
            await load();
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
      {modal?.mode === "material-create" && (
        <MaterialForm
          title={t("materialsPage.new")}
          initial={emptyMaterialForm}
          warehouses={warehouses}
          projects={projects}
          defaultProjectId={lastProjectId(projects)}
          linkProject
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await createMaterial(payload);
            setModal(null);
            await load();
            showToast(t("materialsPage.createdLinked"));
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
