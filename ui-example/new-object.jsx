// Modal for adding a new object — system picker auto-fills materials
const NewObjectModal = ({ onClose, onSave, nextId }) => {
  const SYSTEMS = window.PROCOAT_SYSTEMS;
  const [systemIdx, setSystemIdx] = React.useState(0);
  const [client, setClient] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [totalM2, setTotalM2] = React.useState(100);
  const [color, setColor] = React.useState("#2C5F2E");
  const [colorRal, setColorRal] = React.useState("");
  const [startDate, setStartDate] = React.useState("2026-05-12");
  const [endDate, setEndDate] = React.useState("2026-06-12");
  const [overrides, setOverrides] = React.useState({}); // layerIdx -> { include: bool, perM2 }
  const [step, setStep] = React.useState(1);

  const sys = SYSTEMS[systemIdx];
  const palette = ["#2C5F2E", "#5B7DB1", "#F4A442", "#A66A8E", "#6E5B8A", "#7A8B5C", "#B85C5C", "#5C8B8B", "#1E4220", "#D97757"];

  // reset overrides when system changes
  React.useEffect(() => { setOverrides({}); }, [systemIdx]);

  const layerEnabled = (i, layer) => overrides[i]?.include ?? !layer.optional;
  const layerPerM2 = (i, layer) => overrides[i]?.perM2 ?? layer.perM2;
  const setLayer = (i, patch) => setOverrides({ ...overrides, [i]: { ...overrides[i], ...patch } });

  const previewMaterials = sys.layers.map((l, i) => ({
    layer: l,
    enabled: layerEnabled(i, l),
    perM2: layerPerM2(i, l),
    needed: Math.round(layerPerM2(i, l) * totalM2 * 10) / 10,
  }));

  const totalKg = previewMaterials.filter(m => m.enabled).reduce((s, m) => s + m.needed, 0);
  const layerCount = previewMaterials.filter(m => m.enabled).length;

  const valid = client.trim() && address.trim() && totalM2 > 0 && layerCount > 0;

  const save = () => {
    if (!valid) return;
    // Build materials list — collapse same name + color into single line
    const grouped = {};
    previewMaterials.filter(m => m.enabled).forEach(m => {
      const key = m.layer.name + (sys.needsColor && m.layer.name.toLowerCase().includes("color") ? "|" + colorRal : "");
      if (!grouped[key]) {
        grouped[key] = {
          name: m.layer.name,
          color: m.layer.name.toLowerCase().includes("color") && colorRal ? colorRal : (m.layer.name.toLowerCase().includes("smilts") || m.layer.name.toLowerCase().includes("pārslas") ? "—" : "—"),
          needed: 0, taken: 0, perM2: m.perM2,
        };
      }
      grouped[key].needed += m.needed;
    });

    const tasks = [
      { name: "Virsmas sagatavošana / slīpēšana", unit: "m²", done: 0, total: totalM2 },
      ...previewMaterials.filter(m => m.enabled).map((m, i) => ({
        name: `${m.layer.name} ${m.layer.role || ""}`.trim(),
        unit: "m²", done: 0, total: totalM2,
      })),
    ];

    const newObj = {
      id: nextId,
      client: client.trim(),
      address: address.trim(),
      system: sys.name,
      totalM2,
      doneM2: 0,
      status: "planned",
      color,
      startDate, endDate,
      tasks,
      materials: Object.values(grouped),
    };
    onSave(newObj);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">PIEVIENOT JAUNU OBJEKTU · #{nextId}</div>
            <h3 className="modal-title">Reģistrēt objektu sistēmā</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="no-steps">
          <button className={`no-step ${step === 1 ? "on" : ""}`} onClick={() => setStep(1)}>
            <span className="no-step-num mono">01</span> Klients un sistēma
          </button>
          <span className="no-step-line" />
          <button className={`no-step ${step === 2 ? "on" : ""}`} onClick={() => setStep(2)}>
            <span className="no-step-num mono">02</span> Materiāli un apjomi
          </button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <>
              <div className="field-row two">
                <label className="field">
                  <span className="field-label">Klients</span>
                  <input className="input" placeholder="Piem. SIA BūveLat / Vārds Uzvārds" value={client} onChange={e => setClient(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Adrese</span>
                  <input className="input" placeholder="Iela, pilsēta" value={address} onChange={e => setAddress(e.target.value)} />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Sistēma (uzklāšanas tehnoloģija)</span>
                <div className="sys-grid">
                  {SYSTEMS.map((s, i) => (
                    <button key={s.code} type="button"
                      className={`sys-card ${systemIdx === i ? "on" : ""}`}
                      onClick={() => setSystemIdx(i)}>
                      <span className="sys-code mono">{s.code}</span>
                      <span className="sys-name">{s.name}</span>
                      <span className="sys-meta">{s.layers.length} slāņi · {s.needsColor ? "krāsa" : "bez krāsas"}</span>
                    </button>
                  ))}
                </div>
              </label>

              <div className="field-row">
                <label className="field">
                  <span className="field-label">Apjoms (m²)</span>
                  <input className="input mono" type="number" value={totalM2} onChange={e => setTotalM2(Math.max(0, +e.target.value || 0))} />
                </label>
                <label className="field">
                  <span className="field-label">Datums no</span>
                  <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Plānotais beigas</span>
                  <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </label>
              </div>

              <div className="field-row two">
                <div className="field">
                  <span className="field-label">Krāsa kalendārā / dashboard</span>
                  <div className="color-row">
                    {palette.map(c => (
                      <button key={c} type="button" className={`color-dot ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
                    ))}
                  </div>
                </div>
                {sys.needsColor && (
                  <label className="field">
                    <span className="field-label">Materiāla tonis (RAL)</span>
                    <input className="input" placeholder="RAL7001, RAL7035..." value={colorRal} onChange={e => setColorRal(e.target.value)} />
                  </label>
                )}
              </div>

              <div className="info-strip">
                <Icon name="alert" size={14} />
                <span>Visas sistēmas <strong>vienmēr sākas ar virsmas sagatavošanu</strong> — tā tiks pievienota automātiski kā pirmais darba veids.</span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="layer-head">
                <div>
                  <div className="layer-title">{sys.name}</div>
                  <div className="muted small">Atzīmē kuras kārtas iekļauj un, ja vajag, mainīt patēriņu uz m².</div>
                </div>
                <div className="layer-stat">
                  <div><span className="muted small">Aktīvas kārtas</span> <strong className="mono">{layerCount}/{sys.layers.length}</strong></div>
                  <div><span className="muted small">Apjoms</span> <strong className="mono">{totalM2} m²</strong></div>
                  <div><span className="muted small">Kopā materiāls</span> <strong className="mono accent-up">{totalKg.toFixed(1)} kg</strong></div>
                </div>
              </div>

              <div className="layers-table">
                <div className="lt-head">
                  <div></div>
                  <div>#</div>
                  <div>Slānis / loma</div>
                  <div>Materiāls</div>
                  <div className="ta-r">kg/m²</div>
                  <div className="ta-r">Vajadzīgs</div>
                </div>
                <div className="lt-row prep-row">
                  <div><span className="layer-toggle on locked"><Icon name="check" size={11} /></span></div>
                  <div className="mono">00</div>
                  <div><strong>Virsmas sagatavošana</strong> <span className="muted small">obligāts</span></div>
                  <div className="muted">Slīpēšana, putekļu sūkšana</div>
                  <div className="ta-r mono muted">—</div>
                  <div className="ta-r mono">{totalM2} m²</div>
                </div>
                {sys.layers.map((l, i) => {
                  const enabled = layerEnabled(i, l);
                  const perM2 = layerPerM2(i, l);
                  return (
                    <div key={i} className={`lt-row ${!enabled ? "off" : ""}`}>
                      <div>
                        <button className={`layer-toggle ${enabled ? "on" : ""}`} onClick={() => setLayer(i, { include: !enabled })}>
                          {enabled && <Icon name="check" size={11} />}
                        </button>
                      </div>
                      <div className="mono">{String(i + 1).padStart(2, "0")}</div>
                      <div>
                        <strong>{l.role || "Slānis"}</strong>
                        {l.optional && <span className="opt-pill">izvēles</span>}
                        {l.note && <div className="muted tiny">{l.note}</div>}
                      </div>
                      <div>{l.name}</div>
                      <div className="ta-r">
                        <input type="number" step="0.1" className="mini-input mono" value={perM2}
                          onChange={e => setLayer(i, { perM2: +e.target.value || 0 })} />
                      </div>
                      <div className="ta-r mono">{enabled ? (perM2 * totalM2).toFixed(1) + " kg" : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <footer className="modal-foot">
          <div className="foot-summary">
            <span className="foot-color" style={{ background: color }} />
            <span className="mono small muted">#{nextId}</span>
            <span className="small"><strong>{client || "(klients)"}</strong> · {sys.name} · <span className="mono">{totalM2} m²</span></span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Atcelt</button>
            {step === 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!client || !address}>
                Tālāk: materiāli <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <>
                <button className="btn btn-outline" onClick={() => setStep(1)}>← Atpakaļ</button>
                <button className="btn btn-primary" disabled={!valid} onClick={save}>
                  <Icon name="save" size={15} /> Reģistrēt objektu
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

window.NewObjectModal = NewObjectModal;
