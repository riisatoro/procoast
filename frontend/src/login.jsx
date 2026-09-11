import { useState } from "react";
import Icon from "./icons";
import { loginRequest } from "./api";
import { LanguageSwitch, useI18n } from "./i18n";

const Login = ({ onLogin }) => {
  const { t } = useI18n();
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!ident || !password) {
      setErr(t("login.fillAll"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const user = await loginRequest(ident, password);
      onLogin(user);
    } catch (error) {
      setErr(error.message || t("login.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-pattern" />
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <span className="login-logo-mark">P</span>
          </div>
          <div>
            <div className="login-title">PROCOAT S1</div>
            <div className="login-sub">{t("login.subtitle")}</div>
          </div>
          <LanguageSwitch variant="light" />
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span className="field-label">{t("login.ident")}</span>
            <div className="field-wrap">
              <Icon name="mail" size={16} />
              <input
                type="text"
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
                placeholder={t("login.identPlaceholder")}
                autoComplete="username"
              />
            </div>
          </label>
          <label className="field">
            <span className="field-label">{t("login.password")}</span>
            <div className="field-wrap">
              <Icon name="lock" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </label>
          {err && <div className="login-err">{err}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
            {busy ? t("login.submitting") : t("login.submit")} <Icon name="arrowRight" size={16} />
          </button>
          <div className="login-note">{t("login.note")}</div>
        </form>

        <div className="login-foot">
          <div className="login-demo">{t("login.demo")}</div>
          <div className="login-demo-list">
            <button type="button" className="chip" onClick={() => { setIdent("admin"); setPassword("admin"); }}>
              {t("login.adminChip")}
            </button>
            <button type="button" className="chip" onClick={() => { setIdent("kristians"); setPassword("demo"); }}>
              {t("login.workerChip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
