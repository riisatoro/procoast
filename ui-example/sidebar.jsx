// Enhanced Sidebar — supports profile + new sections + mobile dismissal
const Sidebar = ({ user, currentSection, onNavigate, onLogout, mobileOpen, onCloseMobile, onOpenProfile }) => {
  const isAdmin = user.role === "ADMINISTRATORS";
  const items = [
    { id: "dashboard", label: "Sākums", icon: "chart", adminOnly: true },
    { id: "calendar", label: "Kalendārs", icon: "calendar" },
    { id: "tools", label: "Instrumenti", icon: "wrench" },
    { id: "materials", label: "Materiāls", icon: "package" },
    { id: "archive", label: "Arhīvs", icon: "archive", adminOnly: true },
    { id: "users", label: "Lietotāji", icon: "users", adminOnly: true },
  ];
  const visible = items.filter(i => !i.adminOnly || isAdmin);

  const nav = (id) => {
    onNavigate(id);
    onCloseMobile && onCloseMobile();
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sb-brand">
        <div className="sb-logo"><span>P</span></div>
        <div>
          <div className="sb-name">PROCOAT</div>
          <div className="sb-sub">S1 · v1.0</div>
        </div>
      </div>

      <button
        className={`sb-cta ${currentSection === "reports" ? "active" : ""}`}
        onClick={() => nav("reports")}
      >
        <Icon name="clipboard" size={16} />
        <span>Dienas atskaite</span>
        <span className="sb-cta-arrow"><Icon name="arrowRight" size={13} /></span>
      </button>

      <nav className="sb-nav">
        {visible.map(item => (
          <button
            key={item.id}
            className={`sb-item ${currentSection === item.id ? "active" : ""}`}
            onClick={() => nav(item.id)}
          >
            <span className="sb-item-bar" />
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-footer">
        <button
          className="sb-user"
          style={{ width: "100%", border: 0, cursor: "pointer", textAlign: "left" }}
          onClick={() => onOpenProfile && onOpenProfile(user.id)}
          title="Atvērt profilu"
        >
          <div className="sb-avatar">{user.initials}</div>
          <div className="sb-user-meta">
            <div className="sb-user-name">{user.name}</div>
            <div className={`sb-user-role ${isAdmin ? "role-admin" : "role-worker"}`}>{user.role}</div>
          </div>
          <span className="sb-logout" onClick={(e) => { e.stopPropagation(); onLogout(); }} title="Iziet">
            <Icon name="logout" size={16} />
          </span>
        </button>
      </div>
    </aside>
  );
};

window.Sidebar = Sidebar;
