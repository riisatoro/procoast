import { useEffect, useState } from "react";
import Login from "./login";
import Sidebar from "./sidebar";
import { MobileTopbar, NotificationsPop, normalizeItems } from "./topbar-notif";
import Dashboard from "./dashboard";
import CalendarView from "./calendar";
import Reports from "./reports";
import ToolsPage from "./tools";
import MaterialsPage from "./materials";
import WarehousesPage from "./warehouses";
import UsersPage from "./users";
import ProjectsPage from "./projects";
import Archive from "./archive";
import ObjectDetail from "./object-detail";
import WorkerProfile from "./worker-profile";
import NewObjectModal from "./new-object";
import Icon from "./icons";
import { clearSession, createProject, fetchArchivedProjects, fetchMe, fetchNotifications, fetchProjects, getToken, onUnauthorized } from "./api";
import { LanguageSwitch, useI18n } from "./i18n";
import { rememberProject } from "./last-project";
import { loadNotifSeen, saveNotifSeen, unreadCount } from "./notif-seen";

const NAV_KEY = "procoast-nav";
const MAIN_SECTIONS = new Set([
  "dashboard",
  "projects",
  "calendar",
  "warehouses",
  "materials",
  "tools",
  "archive",
  "users",
  "reports",
  "object-detail",
  "profile",
]);
const ADMIN_ONLY_SECTIONS = new Set(["dashboard", "users", "archive"]);

function defaultSection(user) {
  return user?.role === "ADMINISTRATORS" ? "dashboard" : "calendar";
}

function readNav() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(NAV_KEY) || "null");
    if (!parsed || !MAIN_SECTIONS.has(parsed.section)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeNav(state) {
  sessionStorage.setItem(NAV_KEY, JSON.stringify(state));
}

function clearNav() {
  sessionStorage.removeItem(NAV_KEY);
}

function navForUser(user, saved) {
  const fallback = { section: defaultSection(user), detailObjectId: null, profileUserId: null };
  if (!saved) return fallback;
  if (ADMIN_ONLY_SECTIONS.has(saved.section) && user.role !== "ADMINISTRATORS") return fallback;
  if (saved.section === "object-detail" && saved.detailObjectId == null) return fallback;
  if (saved.section === "profile" && saved.profileUserId == null) return fallback;
  return {
    section: saved.section,
    detailObjectId: saved.section === "object-detail" ? saved.detailObjectId : null,
    profileUserId: saved.section === "profile" ? saved.profileUserId : null,
  };
}

const App = () => {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [savedToast, setSavedToast] = useState(null);
  const [showNewObj, setShowNewObj] = useState(false);
  const [nextId, setNextId] = useState(1);
  const [creating, setCreating] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [detailObjectId, setDetailObjectId] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  const [notifItems, setNotifItems] = useState([]);
  const [notifSeen, setNotifSeen] = useState(loadNotifSeen);
  const [rev, setRev] = useState(0);

  const isAdmin = user?.role === "ADMINISTRATORS";

  useEffect(() => {
    document.body.style.overflow = mobileNav ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNav]);

  useEffect(() => {
    return onUnauthorized(() => {
      clearNav();
      setUser(null);
      setSection("dashboard");
      setDetailObjectId(null);
      setProfileUserId(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    writeNav({ section, detailObjectId, profileUserId });
  }, [user, section, detailObjectId, profileUserId]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications()
      .then((data) => setNotifItems(normalizeItems(data)))
      .catch(() => setNotifItems([]));
  }, [user, showNotif]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const me = await fetchMe();
        if (me && !cancelled) {
          setUser(me);
          const nav = navForUser(me, readNav());
          setSection(nav.section);
          setDetailObjectId(nav.detailObjectId);
          setProfileUserId(nav.profileUserId);
        }
      } catch {
        clearSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (u) => {
    setUser(u);
    const home = defaultSection(u);
    setSection(home);
    setDetailObjectId(null);
    setProfileUserId(null);
    writeNav({ section: home, detailObjectId: null, profileUserId: null });
    setRev((r) => r + 1);
  };

  const handleLogout = () => {
    clearSession();
    clearNav();
    setUser(null);
    setSection("dashboard");
    setDetailObjectId(null);
    setProfileUserId(null);
  };

  const navigateSection = (s) => {
    if ((s === "reports" || s === "materials" || s === "tools") && detailObjectId) {
      rememberProject(detailObjectId);
    }
    setDetailObjectId(null);
    setProfileUserId(null);
    setSection(s);
  };

  const openObjectDetail = (id) => {
    rememberProject(id);
    setProfileUserId(null);
    setDetailObjectId(id);
    setSection("object-detail");
    setMobileNav(false);
  };

  const openProfile = (id) => {
    setDetailObjectId(null);
    setProfileUserId(id);
    setSection("profile");
    setMobileNav(false);
  };

  if (!ready) {
    return (
      <div className="login-bg">
        <div className="login-pattern" />
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  let content;
  if (section === "object-detail" && detailObjectId) {
    content = (
      <ObjectDetail
        user={user}
        objectId={detailObjectId}
        onBack={() => navigateSection(isAdmin ? "dashboard" : "calendar")}
        onNavigate={navigateSection}
      />
    );
  } else if (section === "profile" && profileUserId) {
    content = (
      <WorkerProfile
        user={user}
        profileUserId={profileUserId}
        onBack={() => navigateSection("users")}
        onNavigate={navigateSection}
        onSelectObject={openObjectDetail}
      />
    );
  } else {
    const sections = {
      dashboard: <Dashboard key={rev} user={user} onNavigate={navigateSection} onSelectObject={openObjectDetail} />,
      calendar: <CalendarView user={user} onSelectObject={openObjectDetail} />,
      reports: <Reports user={user} />,
      tools: <ToolsPage user={user} />,
      warehouses: <WarehousesPage user={user} />,
      materials: <MaterialsPage user={user} />,
      projects: <ProjectsPage user={user} />,
      archive: <Archive user={user} onSelectObject={openObjectDetail} />,
      users: <UsersPage user={user} onOpenProfile={openProfile} />,
    };
    content = sections[section] || sections.calendar;
  }

  const navSection = section === "object-detail" ? "dashboard" : section === "profile" ? "users" : section;

  return (
    <div className="app">
      <Sidebar
        user={user}
        currentSection={navSection}
        onNavigate={navigateSection}
        onLogout={handleLogout}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        onOpenProfile={openProfile}
      />
      {mobileNav && <div className="sidebar-backdrop show" onClick={() => setMobileNav(false)} />}

      <main className="main" data-screen-label={section}>
        <MobileTopbar onOpenSidebar={() => setMobileNav(true)} />

        <div style={{ position: "absolute", top: 24, right: 24, zIndex: 30, display: "flex", alignItems: "center", gap: 10 }}>
          <LanguageSwitch variant="light" />
          <div className="bell-wrap">
            <button className="bell-btn" onClick={() => setShowNotif((s) => !s)} title={t("app.notifications")}>
              <Icon name="bell" size={16} />
              {unreadCount(notifItems, notifSeen) > 0 && (
                <span className="bell-badge">{unreadCount(notifItems, notifSeen)}</span>
              )}
            </button>
            {showNotif && (
              <NotificationsPop
                items={notifItems}
                onClose={() => setShowNotif(false)}
                onLoaded={setNotifItems}
                onMarkAll={(iso) => {
                  saveNotifSeen(iso);
                  setNotifSeen(iso);
                }}
              />
            )}
          </div>
        </div>

        {content}
      </main>

      {isAdmin && (
        <button
          className="fab"
          onClick={async () => {
            try {
              const [live, archived] = await Promise.all([fetchProjects(), fetchArchivedProjects()]);
              const ids = [...(live || []), ...(archived || [])].map((p) => p.id);
              setNextId((Math.max(0, ...ids) || 0) + 1);
            } catch {
              setNextId(1);
            }
            setShowNewObj(true);
          }}
          title={t("app.newObject")}
        >
          <Icon name="plus" size={18} />
          <span>{t("app.newObject")}</span>
        </button>
      )}

      {showNewObj && (
        <NewObjectModal
          nextId={nextId}
          busy={creating}
          onClose={() => setShowNewObj(false)}
          onSave={async (payload) => {
            setCreating(true);
            try {
              const created = await createProject(payload);
              setShowNewObj(false);
              setSavedToast(t("app.objectAdded", { id: created.id, client: created.client || created.name }));
              setTimeout(() => setSavedToast(null), 2600);
              setRev((r) => r + 1);
            } finally {
              setCreating(false);
            }
          }}
        />
      )}

      {savedToast && (
        <div className="toast">
          <Icon name="check" size={14} /> {savedToast}
        </div>
      )}
    </div>
  );
};

export default App;
