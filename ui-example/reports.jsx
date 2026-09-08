// Daily Reports section
const Reports = ({ user }) => {
  const D = window.PROCOAT_DATA;
  const [objectId, setObjectId] = React.useState(D.objects[0].id);
  const [date, setDate] = React.useState("2026-05-06");
  const [search, setSearch] = React.useState("");
  const [taskAdds, setTaskAdds] = React.useState({});
  const [matAdds, setMatAdds] = React.useState({});
  const [notes, setNotes] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const obj = D.objects.find(o => o.id === objectId);
  const pct = Math.round((obj.doneM2 / obj.totalM2) * 100);

  const bump = (state, setState, key, delta) => {
    setState({ ...state, [key]: Math.max(0, (state[key] || 0) + delta) });
  };

  const filtered = D.objects.filter(o =>
    !search || `#${o.id} ${o.client} ${o.system}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">SOLIS 1 · OBJEKTA IZVĒLE</div>
          <h1 className="page-title">Dienas atskaites</h1>
          <p className="page-sub">Reģistrē, kas paveikts un cik materiāla iztērēts.</p>
        </div>
        <div className="page-actions">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max="2026-05-06" className="input input-sm" />
        </div>
      </header>

      <section className="card">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input className="search-input" placeholder="Meklē objektu pēc nr., klienta vai sistēmas..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="obj-picker">
          {filtered.map(o => (
            <button key={o.id} className={`obj-pick ${o.id === objectId ? "on" : ""}`} onClick={() => setObjectId(o.id)}>
              <span className="obj-dot" style={{ background: o.color }} />
              <span className="mono obj-pick-id">#{o.id}</span>
              <span className="obj-pick-name">{o.client}</span>
              <span className="obj-pick-meta mono">{o.totalM2}m²</span>
              <span className="obj-pick-sys">{o.system}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card obj-summary">
        <div className="summary-head">
          <div>
            <div className="summary-eyebrow"><Icon name="mapPin" size={13} /> #{obj.id} — {obj.client}</div>
            <div className="summary-addr">{obj.address}</div>
          </div>
          <div className={`status status-${obj.status}`}>{obj.status === "active" ? "Aktīvs" : obj.status === "completed" ? "Pabeigts" : "Plānots"}</div>
        </div>
        <div className="summary-grid">
          <div><div className="summary-label">Sistēma</div><div className="summary-val">{obj.system}</div></div>
          <div><div className="summary-label">Apjoms</div><div className="summary-val mono">{obj.totalM2} m²</div></div>
          <div><div className="summary-label">Sākums</div><div className="summary-val mono">{obj.startDate}</div></div>
          <div><div className="summary-label">Plānotās beigas</div><div className="summary-val mono">{obj.endDate}</div></div>
        </div>
        <div className="summary-progress">
          <div className="summary-progress-head">
            <span>Progress</span>
            <span className="mono">{pct}% · {obj.doneM2}/{obj.totalM2} m²</span>
          </div>
          <div className="bar lg"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
        </div>
      </section>

      <div className="page-eyebrow step-2">SOLIS 2 · DIENAS IERAKSTS</div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Veicamie darbi</h2>
          <span className="muted small">Ieraksti, cik m² šodien paveikts</span>
        </div>
        <div className="data-table">
          <div className="dt-head">
            <div>Darba veids</div>
            <div className="ta-c">Mērv.</div>
            <div className="ta-c">Šodien veikts</div>
            <div className="ta-r">Kopā veikts</div>
            <div className="ta-r">Atlikums</div>
          </div>
          {obj.tasks.map((t, i) => {
            const today = taskAdds[i] || 0;
            const remain = t.total - t.done - today;
            const max = Math.max(0, t.total - t.done);
            return (
              <div key={i} className="dt-row">
                <div className="dt-name">{t.name}</div>
                <div className="ta-c mono small muted">{t.unit}</div>
                <div className="ta-c">
                  <div className="step-stack">
                    <div className="stepper">
                      <button onClick={() => bump(taskAdds, setTaskAdds, i, -1)}><Icon name="minus" size={12} /></button>
                      <input type="number" className="stepper-input mono" value={today} onChange={e => setTaskAdds({...taskAdds, [i]: +e.target.value || 0})} />
                      <button onClick={() => bump(taskAdds, setTaskAdds, i, 1)}><Icon name="plus" size={12} /></button>
                    </div>
                    <div className="quick-add">
                      <button className="qa-sub" onClick={() => bump(taskAdds, setTaskAdds, i, -5)}>−5</button>
                      <button className="qa-sub" onClick={() => bump(taskAdds, setTaskAdds, i, -50)}>−50</button>
                      <button onClick={() => bump(taskAdds, setTaskAdds, i, 5)}>+5</button>
                      <button onClick={() => bump(taskAdds, setTaskAdds, i, 50)}>+50</button>
                      <button className="qa-max" onClick={() => setTaskAdds({...taskAdds, [i]: max})}>MAX</button>
                    </div>
                  </div>
                </div>
                <div className="ta-r mono">{t.done} {t.unit}</div>
                <div className={`ta-r mono ${remain < 0 ? "danger" : ""}`}>{remain} {t.unit}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Iztērētais materiāls</h2>
          <span className="muted small">Patēriņa norma uz m² — palīdz orientēties</span>
        </div>
        <div className="data-table">
          <div className="dt-head mat-head">
            <div>Materiāls</div>
            <div>Krāsa / Tips</div>
            <div className="ta-c">Patēriņš/m²</div>
            <div className="ta-c">Šodien (kg)</div>
            <div className="ta-r">Atlikums noliktavā</div>
          </div>
          {obj.materials.map((m, i) => {
            const today = matAdds[i] || 0;
            const remain = m.needed - m.taken;
            return (
              <div key={i} className="dt-row mat-row">
                <div className="dt-name">{m.name}</div>
                <div className="muted">{m.color}</div>
                <div className="ta-c mono small">{m.perM2} kg/m²</div>
                <div className="ta-c">
                  <div className="step-stack">
                    <div className="stepper">
                      <button onClick={() => bump(matAdds, setMatAdds, i, -1)}><Icon name="minus" size={12} /></button>
                      <input type="number" className="stepper-input mono" value={today} onChange={e => setMatAdds({...matAdds, [i]: +e.target.value || 0})} />
                      <button onClick={() => bump(matAdds, setMatAdds, i, 1)}><Icon name="plus" size={12} /></button>
                    </div>
                    <div className="quick-add">
                      <button className="qa-sub" onClick={() => bump(matAdds, setMatAdds, i, -25)}>−25</button>
                      <button className="qa-sub" onClick={() => bump(matAdds, setMatAdds, i, -5)}>−5</button>
                      <button onClick={() => bump(matAdds, setMatAdds, i, 5)}>+5</button>
                      <button onClick={() => bump(matAdds, setMatAdds, i, 25)}>+25</button>
                    </div>
                  </div>
                </div>
                <div className="ta-r mono">{remain} kg</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label className="field">
          <span className="field-label">Piezīmes (neobligāts)</span>
          <textarea className="textarea" rows="3" placeholder="Piem. nosacījumi objektā, novērojumi, problēmas..." value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <div className="form-foot">
          <div className="muted small">Atskaite tiks reģistrēta uz {date} · {user.name}</div>
          <div className="form-actions">
            <button className="btn btn-ghost">Notīrīt</button>
            <button className="btn btn-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2200); }}>
              <Icon name="save" size={15} /> Saglabāt atskaiti
            </button>
          </div>
        </div>
      </section>

      {saved && <div className="toast"><Icon name="check" size={14} /> Atskaite saglabāta</div>}

      {user.role === "ADMINISTRATORS" && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Visi šodienas ieraksti (admin)</h2>
            <button className="link">Vēsture pa datumiem →</button>
          </div>
          <table className="table">
            <thead><tr><th>Darbinieks</th><th>Objekts</th><th>Darbi</th><th>Laiks</th><th></th></tr></thead>
            <tbody>
              {D.todayReports.map((r, i) => {
                const o = D.objects.find(x => x.id === r.objectId);
                const wk = D.users.find(u => u.initials === r.worker);
                return (
                  <tr key={i}>
                    <td><div className="cell-user"><span className="avatar xs">{r.worker}</span> {wk?.name}</div></td>
                    <td><span className="mono small muted">#{o.id}</span> {o.client}</td>
                    <td>{r.summary}</td>
                    <td className="mono small">14:32</td>
                    <td className="ta-r"><button className="icon-btn sm"><Icon name="edit" size={13} /></button> <button className="icon-btn sm danger"><Icon name="trash" size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

window.Reports = Reports;
