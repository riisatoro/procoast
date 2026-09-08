// Notifications popover + mobile topbar
const NotificationsPop = ({ onClose }) => {
  const items = [
    { kind: "green", icon: "check", title: "Atskaite saglabāta", sub: "#75 Terēze Bērzupe · 45m² EP22", time: "14:32", unread: true },
    { kind: "warn", icon: "alert", title: "Materiāls beidzas", sub: "EP11 — atlikuši 75 kg, vajag 375 kg", time: "11:08", unread: true },
    { kind: "default", icon: "calendar", title: "Jauns ieraksts kalendārā", sub: "BūveLat SIA · 2026-05-20 → 2026-05-29", time: "09:14", unread: true },
    { kind: "green", icon: "package", title: "Materiāla paņemšana", sub: "DB · 100 kg Kvarca smilts (#75)", time: "vakar" },
    { kind: "danger", icon: "x", title: "Trūkstošs instruments", sub: "Lielā lāpstiņa nav pieejama #76", time: "vakar" },
    { kind: "default", icon: "users", title: "Pievienots darbinieks", sub: "Jānis Roze — DARBINIEKS", time: "2 d." },
  ];
  const unreadCount = items.filter(i => i.unread).length;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={onClose} />
      <div className="notif-pop" onClick={e => e.stopPropagation()}>
        <div className="notif-head">
          <span>Paziņojumi · {unreadCount} jauni</span>
          <button className="link" style={{fontSize: 11, letterSpacing: 0.04, textTransform: "none"}}>Atzīmēt visus</button>
        </div>
        <div className="notif-list">
          {items.map((n, i) => (
            <div key={i} className={`notif-item ${n.unread ? "unread" : ""}`}>
              <div className={`notif-icon ${n.kind === "green" ? "green" : n.kind === "warn" ? "warn" : n.kind === "danger" ? "danger" : ""}`}>
                <Icon name={n.icon} size={14} />
              </div>
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                <div className="notif-sub">{n.sub}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const MobileTopbar = ({ onOpenSidebar }) => (
  <div className="mobile-topbar">
    <button className="menu-btn" onClick={onOpenSidebar} aria-label="Izvēlne">
      <Icon name="moreH" size={18} />
    </button>
    <div className="mobile-topbar-brand">
      <div className="mobile-topbar-logo">P</div>
      <span>PROCOAT</span>
    </div>
    <span className="live-dot" title="Aktīvs"></span>
  </div>
);

window.NotificationsPop = NotificationsPop;
window.MobileTopbar = MobileTopbar;
