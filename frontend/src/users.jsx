import { useEffect, useState } from "react";
import Icon from "./icons";
import { createUser, fetchUsers, updateUser } from "./api";
import { useI18n } from "./i18n";
import PeriodPicker from "./period-picker";
import CsvExportMenu from "./csv-export";

const emptyForm = {
  name: "",
  username: "",
  email: "",
  initials: "",
  user_type: "worker",
  password: "",
};

const currentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
};

const UserFormModal = ({ title, initial, onClose, onSave }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({ ...emptyForm, ...initial, password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(initial?.id);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setErr(t("users.fillRequired"));
      return;
    }
    if (!isEdit && !form.password) {
      setErr(t("users.passwordRequired"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        initials: form.initials.trim(),
        user_type: form.user_type,
      };
      if (form.password) payload.password = form.password;
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
            <div className="modal-eyebrow">{t("users.modalEyebrow")}</div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            <Icon name="x" size={16} />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field">
              <span className="field-label">{t("users.fullName")}</span>
              <input className="input" value={form.name} onChange={set("name")} />
            </label>
            <div className="field-row two">
              <label className="field">
                <span className="field-label">{t("users.username")}</span>
                <input className="input" value={form.username} onChange={set("username")} autoComplete="off" />
              </label>
              <label className="field">
                <span className="field-label">{t("users.initials")}</span>
                <input className="input" value={form.initials} onChange={set("initials")} placeholder="AK" />
              </label>
            </div>
            <label className="field">
              <span className="field-label">{t("users.email")}</span>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </label>
            <label className="field">
              <span className="field-label">{t("users.type")}</span>
              <select className="select" value={form.user_type} onChange={set("user_type")}>
                <option value="worker">{t("users.typeWorker")}</option>
                <option value="admin">{t("users.typeAdmin")}</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">{isEdit ? t("users.newPassword") : t("users.password")}</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                placeholder={isEdit ? t("users.passwordPh") : ""}
              />
            </label>
            {err && <div className="login-err">{err}</div>}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Icon name="save" size={15} /> {busy ? t("common.saving") : t("common.save")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

const UsersPage = ({ user, onOpenProfile }) => {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [period, setPeriod] = useState(currentMonth);
  const isAdmin = user?.role === "ADMINISTRATORS";

  const load = async () => {
    const list = await fetchUsers();
    setUsers(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchUsers();
        if (!cancelled) {
          setUsers(list);
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const handleCreate = async (payload) => {
    await createUser(payload);
    setModal(null);
    await load();
    showToast(t("users.created"));
  };

  const handleEdit = async (payload) => {
    await updateUser(modal.user.id, payload);
    setModal(null);
    await load();
    showToast(t("users.saved"));
  };

  const toggleActive = async (u) => {
    const next = !u.is_active;
    if (!confirm(next ? t("users.confirmActivate", { name: u.name }) : t("users.confirmDeactivate", { name: u.name }))) {
      return;
    }
    try {
      await updateUser(u.id, { is_active: next });
      await load();
      showToast(next ? t("users.toggledOn") : t("users.toggledOff"));
    } catch (error) {
      showToast(error.message || t("users.statusFailed"));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">{t("users.eyebrow")}</div>
          <h1 className="page-title">{t("users.title")}</h1>
          <p className="page-sub">{t("users.sub")}</p>
        </div>
        <div className="page-actions">
          <PeriodPicker value={period} onChange={setPeriod} />
          <CsvExportMenu from={period.from} to={period.to} />
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
              <Icon name="plus" size={15} /> {t("users.new")}
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <section className="card muted">{t("users.loading")}</section>
      ) : users.length === 0 ? (
        <section className="card muted">{t("users.empty")}</section>
      ) : (
        <section className="users-grid">
          {users.map((u) => (
            <div
              key={u.id}
              className={`user-card ${u.is_active ? "" : "inactive"}`}
              onClick={() => onOpenProfile && onOpenProfile(u.id)}
            >
              <div className="user-card-head">
                <div className="user-card-avatar">{u.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="user-card-name">{u.name}</div>
                  <div className="user-card-email mono">{u.email}</div>
                </div>
                <span className={`role-pill ${u.role === "ADMINISTRATORS" ? "role-admin" : "role-worker"}`}>
                  {u.role === "ADMINISTRATORS" ? t("users.admin") : t("users.worker")}
                </span>
              </div>
              <div className="user-card-stats">
                <div>
                  <div className="user-card-stat-label">{t("users.username")}</div>
                  <div className="user-card-stat-val" style={{ fontSize: 13 }}>{u.username}</div>
                </div>
                <div>
                  <div className="user-card-stat-label">{t("users.status")}</div>
                  <div className={`user-card-stat-val ${u.is_active ? "ok" : "danger"}`} style={{ fontSize: 13 }}>
                    {u.is_active ? t("users.active") : t("users.inactive")}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="user-card-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ flex: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile && onOpenProfile(u.id);
                    }}
                  >
                    <Icon name="users" size={13} /> {t("users.profile")}
                  </button>
                  <button
                    className="icon-btn sm"
                    title={t("users.edit")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal({ mode: "edit", user: u });
                    }}
                  >
                    <Icon name="edit" size={13} />
                  </button>
                  <button
                    className={`icon-btn sm ${u.is_active ? "danger" : ""}`}
                    title={u.is_active ? t("users.deactivate") : t("users.activate")}
                    disabled={u.id === user.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActive(u);
                    }}
                  >
                    <Icon name={u.is_active ? "lock" : "check"} size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {modal?.mode === "create" && (
        <UserFormModal title={t("users.new")} initial={emptyForm} onClose={() => setModal(null)} onSave={handleCreate} />
      )}
      {modal?.mode === "edit" && (
        <UserFormModal title={t("users.editTitle")} initial={modal.user} onClose={() => setModal(null)} onSave={handleEdit} />
      )}
      {toast && (
        <div className="toast">
          <Icon name="check" size={14} /> {toast}
        </div>
      )}
    </div>
  );
};

export default UsersPage;
