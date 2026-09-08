import Icon from "./icons";
import { useI18n } from "./i18n";

// Enhanced Sidebar — supports profile + new sections + mobile dismissal
const Sidebar = ({ user, currentSection, onNavigate, onLogout, mobileOpen, onCloseMobile, onOpenProfile }) => {
  const { t } = useI18n();
  const isAdmin = user.role === "ADMINISTRATORS";
  const items = [
    { id: "dashboard", label: t("nav.dashboard"), icon: "chart", adminOnly: true },
    { id: "projects", label: t("nav.projects"), icon: "clipboard" },
    { id: "calendar", label: t("nav.calendar"), icon: "calendar" },
    { id: "warehouses", label: t("nav.warehouses"), icon: "folder" },
    { id: "materials", label: t("nav.materials"), icon: "package" },
    { id: "tools", label: t("nav.tools"), icon: "wrench" },
    { id: "archive", label: t("nav.archive"), icon: "archive" },
    { id: "users", label: t("nav.users"), icon: "users", adminOnly: true },
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
        <span>{t("nav.dailyReport")}</span>
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
        <div className="sb-account">
          <button
            className="sb-user"
            style={{ width: "100%", border: 0, cursor: "pointer", textAlign: "left" }}
            onClick={() => onOpenProfile && onOpenProfile(user.id)}
            title={t("nav.openProfile")}
          >
            <div className="sb-avatar">{user.initials}</div>
            <div className="sb-user-meta">
              <div className="sb-user-name">{user.name}</div>
              <div className={`sb-user-role ${isAdmin ? "role-admin" : "role-worker"}`}>{user.role}</div>
            </div>
            <span className="sb-logout" onClick={(e) => { e.stopPropagation(); onLogout(); }} title={t("nav.logout")}>
              <Icon name="logout" size={16} />
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
