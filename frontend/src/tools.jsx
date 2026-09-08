import { useEffect, useState } from "react";
import Icon from "./icons";
import {
  createTool,
  createToolType,
  fetchToolTypes,
  fetchTools,
  fetchWarehouses,
  updateTool,
  updateToolType,
} from "./api";
import { useI18n } from "./i18n";
import { ToolsTaken, TYPE_ICONS } from "./tools-materials";

const emptyType = { name: "", icon: "wrench", description: "" };
const emptyTool = { name: "", tool_type: "", warehouse: "", unit: "gab", stock: "0", recommended: "" };

const TypeForm = ({ title, initial, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({ ...emptyType, ...initial });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr(t("tools.fillType"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({ name: form.name.trim(), icon: form.icon || "wrench", description: form.description.trim() });
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
            <div className="modal-eyebrow">{t("tools.modalEyebrow")}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("common.name")}</span>
                <input className="input" value={form.name} onChange={set("name")} />
              </label>
              <label className="field">
                <span className="field-label">{t("tools.icon")}</span>
                <select className="select" value={form.icon || "wrench"} onChange={set("icon")}>
                  {TYPE_ICONS.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </label>
            </div>
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

const ToolForm = ({ title, initial, types, warehouses, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({
    ...emptyTool,
    ...initial,
    tool_type: initial?.tool_type || types[0]?.id || "",
    warehouse: initial?.warehouse || warehouses[0]?.id || "",
    stock: initial?.stock ?? "0",
    unit: initial?.unit || "gab",
    recommended: initial?.recommended || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.tool_type || !form.warehouse) {
      setErr(t("tools.fillTool"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSave({
        name: form.name.trim(),
        tool_type: Number(form.tool_type),
        warehouse: Number(form.warehouse),
        unit: form.unit.trim() || "gab",
        recommended: form.recommended.trim(),
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
            <div className="modal-eyebrow">{t("tools.modalEyebrow")}</div>
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
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("tools.type")}</span>
                <select className="select" value={form.tool_type} onChange={set("tool_type")}>
                  <option value="">—</option>
                  {types.map((ty) => (
                    <option key={ty.id} value={ty.id}>{ty.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t("tools.warehouse")}</span>
                <select className="select" value={form.warehouse} onChange={set("warehouse")}>
                  <option value="">—</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.location ? `${w.name} · ${w.location}` : w.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("tools.amount")}</span>
                <input className="input" type="number" step="1" min="0" value={form.stock} onChange={set("stock")} />
              </label>
              <label className="field">
                <span className="field-label">{t("tools.unit")}</span>
                <input className="input" value={form.unit} onChange={set("unit")} />
              </label>
            </div>
            <label className="field">
              <span className="field-label">{t("tools.recommended")}</span>
              <input className="input" value={form.recommended} onChange={set("recommended")} placeholder="2/dienā" />
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

const ToolsInventory = ({ onBack }) => {
  const { t } = useI18n();
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    const [toolTypes, tools, wh] = await Promise.all([
      fetchToolTypes(),
      fetchTools(),
      fetchWarehouses(),
    ]);
    setTypes(Array.isArray(toolTypes) ? toolTypes : []);
    setItems(Array.isArray(tools) ? tools : []);
    setWarehouses(Array.isArray(wh) ? wh : []);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (error) {
        setLoadErr(error.message || t("api.loadTools"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const canAddTool = types.length > 0 && warehouses.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("tools.eyebrow")}</div>
          <h1 className="page-title">{t("tools.title")}</h1>
          <p className="page-sub">{t("tools.sub")}</p>
        </div>
        <div className="page-actions">
          {onBack && (
            <button className="btn btn-ghost" onClick={onBack}>
              <Icon name="chevronLeft" size={15} /> {t("takenTools.title")}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setModal({ mode: "type-create" })}>
            <Icon name="plus" size={15} /> {t("tools.newType")}
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ mode: "tool-create" })} disabled={!canAddTool}>
            <Icon name="plus" size={15} /> {t("tools.new")}
          </button>
        </div>
      </header>

      {loadErr && <div className="login-err">{loadErr}</div>}

      {!warehouses.length && !loading && (
        <section className="card muted">{t("tools.needWarehouse")}</section>
      )}

      {loading ? (
        <section className="card muted">{t("common.loading")}</section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">{t("tools.types")}</h2>
            </div>
            {types.length === 0 ? (
              <div className="muted small">{t("tools.noTypes")}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("common.name")}</th>
                    <th>{t("common.description")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((ty) => (
                    <tr key={ty.id}>
                      <td className="dt-name">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Icon name={TYPE_ICONS.includes(ty.icon) ? ty.icon : "wrench"} size={14} />
                          {ty.name}
                        </span>
                      </td>
                      <td className="muted">{ty.description || t("common.dash")}</td>
                      <td className="ta-r">
                        <button className="icon-btn sm" onClick={() => setModal({ mode: "type-edit", item: ty })}>
                          <Icon name="edit" size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {items.length === 0 ? (
            <section className="card muted">{t("tools.empty")}</section>
          ) : (
            <section className="card">
              <div className="card-head">
                <h2 className="card-title">{t("tools.inventory")}</h2>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("tools.tool")}</th>
                    <th>{t("tools.type")}</th>
                    <th>{t("tools.warehouse")}</th>
                    <th>{t("tools.recommended")}</th>
                    <th>{t("tools.amount")}</th>
                    <th>{t("tools.borrowed")}</th>
                    <th>{t("tools.available")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((tool) => (
                    <tr key={tool.id}>
                      <td className="dt-name">{tool.name}</td>
                      <td>{tool.tool_type_name}</td>
                      <td>
                        {tool.warehouse_name}
                        {tool.warehouse_location ? <div className="muted small">{tool.warehouse_location}</div> : null}
                      </td>
                      <td className="muted small">{tool.recommended || t("common.dash")}</td>
                      <td className="mono">{tool.stock} {tool.unit}</td>
                      <td className="mono">{tool.borrowed} {tool.unit}</td>
                      <td className="mono">{tool.available} {tool.unit}</td>
                      <td className="ta-r">
                        <button className="icon-btn sm" onClick={() => setModal({ mode: "tool-edit", item: tool })}>
                          <Icon name="edit" size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {modal?.mode === "type-create" && (
        <TypeForm
          title={t("tools.newType")}
          initial={emptyType}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await createToolType(payload);
            setModal(null);
            await load();
            showToast(t("tools.typeCreated"));
          }}
        />
      )}
      {modal?.mode === "type-edit" && (
        <TypeForm
          title={t("tools.editType")}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await updateToolType(modal.item.id, payload);
            setModal(null);
            await load();
            showToast(t("tools.typeSaved"));
          }}
        />
      )}
      {modal?.mode === "tool-create" && (
        <ToolForm
          title={t("tools.new")}
          initial={emptyTool}
          types={types}
          warehouses={warehouses}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await createTool(payload);
            setModal(null);
            await load();
            showToast(t("tools.created"));
          }}
        />
      )}
      {modal?.mode === "tool-edit" && (
        <ToolForm
          title={t("tools.edit")}
          initial={modal.item}
          types={types}
          warehouses={warehouses}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            await updateTool(modal.item.id, payload);
            setModal(null);
            await load();
            showToast(t("tools.saved"));
          }}
        />
      )}
      {toast && <div className="toast"><Icon name="check" size={14} /> {toast}</div>}
    </div>
  );
};

const ToolsPage = ({ user }) => {
  const isAdmin = user?.role === "ADMINISTRATORS";
  const [view, setView] = useState("taken");
  if (view === "inventory" && isAdmin) {
    return <ToolsInventory onBack={() => setView("taken")} />;
  }
  return <ToolsTaken user={user} onOpenInventory={isAdmin ? () => setView("inventory") : undefined} />;
};

export default ToolsPage;
