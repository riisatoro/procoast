// Tools and Materials sections + improved Users page (clickable cards → profile)
const Tools = ({ user }) => {
  const D = window.PROCOAT_DATA;
  const [objectId, setObjectId] = React.useState(D.objects[0].id);
  const [states, setStates] = React.useState({});
  const [saved, setSaved] = React.useState(false);

  const setState = (key, val) => setStates({ ...states, [key]: val });
  const obj = D.objects.find(o => o.id === objectId);

  const counts = { is: 0, nav: 0, nevaj: 0 };
  Object.values(states).forEach(v => { if (v === "is") counts.is++; else if (v === "nav") counts.nav++; else if (v === "nevaj") counts.nevaj++; });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">NOLIKTAVAS UZSKAITE</div>
          <h1 className="page-title">Paņemtie instrumenti</h1>
          <p className="page-sub">Atzīmē katram instrumentam — vai paņēmi (IS), vai trūkst (NAV), vai nav vajadzīgs (NEVAJ).</p>
        </div>
      </header>

      <section className="card">
        <label className="field">
          <span className="field-label">Objekts</span>
          <select value={objectId} onChange={e => setObjectId(+e.target.value)} className="select">
            {D.objects.map(o => <option key={o.id} value={o.id}>#{o.id} — {o.client} · {o.system}</option>)}
          </select>
        </label>
        <div className="tool-counters">
          <div className="tc"><span className="tc-dot tc-is" /> Paņemts <span className="mono">{counts.is}</span></div>
          <div className="tc"><span className="tc-dot tc-nav" /> Trūkst <span className="mono">{counts.nav}</span></div>
          <div className="tc"><span className="tc-dot tc-nevaj" /> Nevajag <span className="mono">{counts.nevaj}</span></div>
        </div>
      </section>

      {D.toolCategories.map((cat, ci) => (
        <section key={ci} className="card cat-card">
          <div className="cat-head">
            <div className="cat-icon"><Icon name={cat.icon} size={18} /></div>
            <h2 className="cat-title">{cat.title}</h2>
            <span className="muted small">{cat.tools.length} pozīcijas</span>
          </div>
          <div className="tool-list">
            {cat.tools.map((t, ti) => {
              const key = `${ci}-${ti}`;
              const v = states[key];
              return (
                <div key={ti} className="tool-row">
                  <div className="tool-name">
                    <span className="tool-bullet" />
                    <span>{t.name}</span>
                    {t.recommended && <span className="tool-rec mono">{t.recommended}</span>}
                  </div>
                  <div className="tri-btns">
                    <button className={`tri ${v === "is" ? "tri-is on" : ""}`} onClick={() => setState(key, "is")}>
                      <Icon name="check" size={12} /> IS
                    </button>
                    <button className={`tri ${v === "nav" ? "tri-nav on" : ""}`} onClick={() => setState(key, "nav")}>
                      <Icon name="x" size={12} /> NAV
                    </button>
                    <button className={`tri ${v === "nevaj" ? "tri-nevaj on" : ""}`} onClick={() => setState(key, "nevaj")}>
                      <Icon name="minus" size={12} /> NEVAJ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky-foot">
        <div className="muted small">{user.name} · {obj.client}</div>
        <button className="btn btn-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2200); }}>
          <Icon name="save" size={15} /> Saglabāt sarakstu
        </button>
      </div>
      {saved && <div className="toast"><Icon name="check" size={14} /> Instrumentu saraksts saglabāts</div>}
    </div>
  );
};

const Materials = ({ user }) => {
  const D = window.PROCOAT_DATA;
  const [objectId, setObjectId] = React.useState(D.objects[0].id);
  const [taken, setTaken] = React.useState({});
  const [saved, setSaved] = React.useState(false);
  const obj = D.objects.find(o => o.id === objectId);
  const isAdmin = user.role === "ADMINISTRATORS";

  const setVal = (i, v) => setTaken({ ...taken, [i]: Math.max(0, v) });
  const bump = (i, delta) => {
    const cur = taken[i] != null ? taken[i] : obj.materials[i].taken;
    setVal(i, cur + delta);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">NOLIKTAVAS UZSKAITE</div>
          <h1 className="page-title">Paņemtais materiāls</h1>
          <p className="page-sub">Reģistrē, cik kg materiāla esi paņēmis no krājuma katram objektam.</p>
        </div>
        {isAdmin && <div className="page-actions"><button className="btn btn-ghost"><Icon name="plus" size={15} /> Pievienot materiālu</button></div>}
      </header>

      <section className="card">
        <label className="field">
          <span className="field-label">Objekts</span>
          <select value={objectId} onChange={e => setObjectId(+e.target.value)} className="select">
            {D.objects.map(o => <option key={o.id} value={o.id}>#{o.id} — {o.client} · {o.system}</option>)}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Materiālu saraksts — #{obj.id} {obj.client}</h2>
          <span className="muted small">No resursu analīzes</span>
        </div>
        <div className="mat-table">
          <div className="mt-head">
            <div>Materiāls</div>
            <div>Krāsa / Tips</div>
            <div className="ta-r">Vajadzīgs</div>
            <div>Paņemts</div>
            <div className="ta-r">Atlikums</div>
            <div>Progress</div>
          </div>
          {obj.materials.map((m, i) => {
            const cur = taken[i] != null ? taken[i] : m.taken;
            const remain = m.needed - cur;
            const pct = Math.min(100, Math.round((cur / m.needed) * 100));
            const done = remain <= 0;
            return (
              <div key={i} className={`mt-row ${done ? "mt-done" : ""}`}>
                <div className="dt-name">{m.name}</div>
                <div className="muted">{m.color}</div>
                <div className="ta-r mono">{m.needed} kg</div>
                <div>
                  <div className="step-stack">
                    <div className="stepper">
                      <button onClick={() => bump(i, -1)}><Icon name="minus" size={12} /></button>
                      <input type="number" className="stepper-input mono" value={cur} onChange={e => setVal(i, +e.target.value || 0)} />
                      <button onClick={() => bump(i, 1)}><Icon name="plus" size={12} /></button>
                      <span className="mono small muted unit">kg</span>
                    </div>
                    <div className="quick-add">
                      <button className="qa-sub" onClick={() => bump(i, -25)}>−25</button>
                      <button className="qa-sub" onClick={() => bump(i, -5)}>−5</button>
                      <button onClick={() => bump(i, 5)}>+5</button>
                      <button onClick={() => bump(i, 25)}>+25</button>
                      <button className="qa-max" onClick={() => setVal(i, m.needed)}>MAX</button>
                    </div>
                  </div>
                </div>
                <div className={`ta-r mono ${done ? "ok" : ""}`}>{remain <= 0 ? "0 kg ✓" : `${remain} kg`}</div>
                <div>
                  <div className="bar"><div className="bar-fill" style={{ width: pct + "%", background: done ? "#4CAF50" : "#2C5F2E" }} /></div>
                  <div className="mono tiny muted">{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sticky-foot">
        <div className="muted small">Pievienos uz {user.name} · šodien</div>
        <button className="btn btn-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2200); }}>
          <Icon name="save" size={15} /> Apstiprināt paņemšanu
        </button>
      </div>
      {saved && <div className="toast"><Icon name="check" size={14} /> Materiāla paņemšana reģistrēta</div>}
    </div>
  );
};

// Improved Users page — card grid + clickable profile
const UsersPage = ({ user, onOpenProfile }) => {
  const D = window.PROCOAT_DATA;
  // Mock per-user stats
  const userStats = {
    1: { hours: 156, m2: 412 }, 2: { hours: 148, m2: 380 }, 3: { hours: 132, m2: 295 },
    4: { hours: 140, m2: 320 }, 5: { hours: 98, m2: 210 }, 6: { hours: 64, m2: 80 },
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">PĀRVALDĪBA</div>
          <h1 className="page-title">Lietotāji</h1>
          <p className="page-sub">Pievienot, rediģēt un dzēst sistēmas lietotājus. Klikšķini uz darbinieka, lai redzētu profilu.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary"><Icon name="plus" size={15} /> Jauns lietotājs</button>
        </div>
      </header>

      <section className="users-grid">
        {D.users.map(u => {
          const s = userStats[u.id] || { hours: 0, m2: 0 };
          return (
            <div key={u.id} className="user-card" onClick={() => onOpenProfile && onOpenProfile(u.id)}>
              <div className="user-card-head">
                <div className="user-card-avatar">{u.initials}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div className="user-card-name">{u.name}</div>
                  <div className="user-card-email mono">{u.email}</div>
                </div>
                <span className={`role-pill ${u.role === "ADMINISTRATORS" ? "role-admin" : "role-worker"}`}>
                  {u.role === "ADMINISTRATORS" ? "ADMIN" : "DARB."}
                </span>
              </div>
              <div className="user-card-stats">
                <div>
                  <div className="user-card-stat-label">Šomēnes</div>
                  <div className="user-card-stat-val">{s.hours}h</div>
                </div>
                <div>
                  <div className="user-card-stat-label">Paveikts</div>
                  <div className="user-card-stat-val">{s.m2} m²</div>
                </div>
              </div>
              <div className="user-card-actions">
                <button className="btn btn-sm btn-outline" style={{flex: 1}} onClick={(e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(u.id); }}>
                  <Icon name="users" size={13} /> Profils
                </button>
                <button className="icon-btn sm" title="Rediģēt" onClick={(e) => e.stopPropagation()}>
                  <Icon name="edit" size={13} />
                </button>
                <button className="icon-btn sm danger" title="Dzēst" onClick={(e) => e.stopPropagation()}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

window.Tools = Tools;
window.Materials = Materials;
window.UsersPage = UsersPage;
