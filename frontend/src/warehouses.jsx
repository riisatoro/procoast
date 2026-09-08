import { useEffect, useState } from "react";
import Icon from "./icons";
import { createWarehouse, fetchWarehouses, updateWarehouse } from "./api";
import { useI18n } from "./i18n";

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

const WarehousesPage = () => {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    setItems(await fetchWarehouses());
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
          <div className="page-eyebrow">{t("warehouses.eyebrow")}</div>
          <h1 className="page-title">{t("warehouses.title")}</h1>
          <p className="page-sub">{t("warehouses.sub")}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
            <Icon name="plus" size={15} /> {t("warehouses.new")}
          </button>
        </div>
      </header>

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : items.length === 0 ? (
        <section className="card muted">{t("warehouses.empty")}</section>
      ) : (
        <section className="users-grid">
          {items.map((w) => (
            <div key={w.id} className="user-card" style={{ cursor: "default" }}>
              <div className="user-card-head">
                <div className="user-card-avatar"><Icon name="folder" size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="user-card-name">{w.name}</div>
                  <div className="user-card-email">{w.location || t("common.dash")}</div>
                </div>
                <button className="icon-btn sm" title={t("common.edit")} onClick={() => setModal({ mode: "edit", item: w })}>
                  <Icon name="edit" size={13} />
                </button>
              </div>
              <div className="muted small">{w.description || t("warehouses.noDesc")}</div>
            </div>
          ))}
        </section>
      )}

      {modal?.mode === "create" && (
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
      {modal?.mode === "edit" && (
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
      {toast && <div className="toast"><Icon name="check" size={14} /> {toast}</div>}
    </div>
  );
};

export default WarehousesPage;
