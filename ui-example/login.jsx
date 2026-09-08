// Login screen
const Login = ({ onLogin }) => {
  const [email, setEmail] = React.useState("arturs@procoat.lv");
  const [password, setPassword] = React.useState("demo");
  const [err, setErr] = React.useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!email || !password) { setErr("Aizpildi visus laukus"); return; }
    const user = window.PROCOAT_DATA.users.find(u => u.email === email) || window.PROCOAT_DATA.users[0];
    onLogin(user);
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
            <div className="login-sub">Iekšējā pārvaldības platforma</div>
          </div>
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span className="field-label">E-pasts</span>
            <div className="field-wrap">
              <Icon name="mail" size={16} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vards@procoat.lv" />
            </div>
          </label>
          <label className="field">
            <span className="field-label">Parole</span>
            <div className="field-wrap">
              <Icon name="lock" size={16} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </label>
          {err && <div className="login-err">{err}</div>}
          <button type="submit" className="btn btn-primary btn-full">
            Pieteikties <Icon name="arrowRight" size={16} />
          </button>
          <div className="login-note">Piekļuve tikai autorizētiem darbiniekiem.</div>
        </form>

        <div className="login-foot">
          <div className="login-demo">DEMO · jebkurš e-pasts un parole tiks pieņemts</div>
          <div className="login-demo-list">
            <button type="button" className="chip" onClick={() => setEmail("arturs@procoat.lv")}>Admin (AK)</button>
            <button type="button" className="chip" onClick={() => setEmail("kristians@procoat.lv")}>Darbinieks (KF)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Login = Login;
