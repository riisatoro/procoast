import { useEffect, useState } from "react";
import Login from "./login";
import Sidebar from "./sidebar";
import AdminProjectsSidebar from "./admin-projects-sidebar";
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
import ReportDetail from "./report-detail";
import WorkerProfile from "./worker-profile";
import NewObjectModal from "./new-object";
import Icon from "./icons";
import { clearSession, createProject, fetchArchivedProjects, fetchMe, fetchNotifications, fetchProject, fetchProjects, getStoredUser, getToken, onUnauthorized, updateProject } from "./api";
import { LanguageSwitch, useI18n } from "./i18n";
import { rememberProject } from "./last-project";
import { loadNotifSeen, unreadCount } from "./notif-seen";

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
  "report-detail",
]);
const ADMIN_ONLY_SECTIONS = new Set(["users", "archive"]);

function defaultSection() {
  return "dashboard";
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
  const fallback = { section: defaultSection(user), detailObjectId: null, profileUserId: null, reportId: null, reportReturn: null };
  if (!saved) return fallback;
  if (ADMIN_ONLY_SECTIONS.has(saved.section) && user.role !== "ADMINISTRATORS") return fallback;
  if (saved.section === "object-detail" && saved.detailObjectId == null) return fallback;
  if (saved.section === "profile" && saved.profileUserId == null) return fallback;
  if (saved.section === "report-detail" && saved.reportId == null) return fallback;
  return {
    section: saved.section,
    detailObjectId: saved.section === "object-detail" ? saved.detailObjectId : null,
    profileUserId: saved.section === "profile" ? saved.profileUserId : null,
    reportId: saved.section === "report-detail" ? saved.reportId : null,
    reportReturn: saved.section === "report-detail" ? saved.reportReturn || null : null,
  };
}

const App = () => {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState("dashboard");
  const [savedToast, setSavedToast] = useState(null);
  const [showNewObj, setShowNewObj] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [nextId, setNextId] = useState(1);
  const [creating, setCreating] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [detailObjectId, setDetailObjectId] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [reportReturn, setReportReturn] = useState(null);
  const [notifItems, setNotifItems] = useState([]);
  const [notifSeen, setNotifSeen] = useState(loadNotifSeen);
  const [rev, setRev] = useState(0);
  const [listRev, setListRev] = useState(0);
  const [objectReturn, setObjectReturn] = useState(null);

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
      setReportId(null);
      setReportReturn(null);
      setObjectReturn(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    writeNav({ section, detailObjectId, profileUserId, reportId, reportReturn });
  }, [user, section, detailObjectId, profileUserId, reportId, reportReturn]);

  useEffect(() => {
    if (!user || user.role !== "ADMINISTRATORS") {
      setNotifItems([]);
      setShowNotif(false);
      return;
    }
    fetchNotifications()
      .then((data) => setNotifItems(normalizeItems(data)))
      .catch(() => setNotifItems([]));
  }, [user, showNotif]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken() && !getStoredUser()) {
        if (!cancelled) setReady(true);
        return;
      }
      const applyUser = (person) => {
        setUser(person);
        const nav = navForUser(person, readNav());
        setSection(nav.section);
        setDetailObjectId(nav.detailObjectId);
        setProfileUserId(nav.profileUserId);
        setReportId(nav.reportId);
        setReportReturn(nav.reportReturn);
      };
      const cached = getStoredUser();
      if (cached && !cancelled) {
        applyUser(cached);
        setReady(true);
      }
      try {
        const me = await fetchMe();
        if (me && !cancelled) {
          if (cached) setUser(me);
          else applyUser(me);
        }
      } catch {
        // Keep the cached session if the network is down or the access token is being refreshed.
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
    setReportId(null);
    setReportReturn(null);
    setObjectReturn(null);
    writeNav({ section: home, detailObjectId: null, profileUserId: null, reportId: null, reportReturn: null });
    setRev((r) => r + 1);
  };

  const handleLogout = () => {
    clearSession();
    clearNav();
    setUser(null);
    setSection("dashboard");
    setDetailObjectId(null);
    setProfileUserId(null);
    setReportId(null);
    setReportReturn(null);
    setObjectReturn(null);
  };

  const navigateSection = (s) => {
    if ((s === "reports" || s === "materials" || s === "tools" || s === "warehouses") && detailObjectId) {
      rememberProject(detailObjectId);
    }
    setDetailObjectId(null);
    setProfileUserId(null);
    setReportId(null);
    setReportReturn(null);
    setSection(s);
    setMobileNav(false);
  };

  const openObjectDetail = (id) => {
    rememberProject(id);
    if (
      section
      && MAIN_SECTIONS.has(section)
      && section !== "object-detail"
      && section !== "report-detail"
      && section !== "profile"
    ) {
      setObjectReturn(section);
    }
    setProfileUserId(null);
    setReportId(null);
    setReportReturn(null);
    setDetailObjectId(id);
    setSection("object-detail");
    setMobileNav(false);
    setShowNotif(false);
  };

  const closeNewObject = () => {
    setShowNewObj(false);
    setEditingProject(null);
  };

  const openEditProject = async (projectOrId) => {
    const id = typeof projectOrId === "object" ? projectOrId?.id : projectOrId;
    if (id == null) return;
    try {
      const detail = await fetchProject(id);
      setEditingProject(detail);
      setNextId(detail.id);
      setShowNewObj(true);
    } catch (error) {
      setSavedToast(error.message || t("api.loadProject"));
      setTimeout(() => setSavedToast(null), 2600);
    }
  };

  const openProfile = (id) => {
    setDetailObjectId(null);
    setReportId(null);
    setReportReturn(null);
    setProfileUserId(id);
    setSection("profile");
    setMobileNav(false);
    setShowNotif(false);
  };

  const openReport = (id) => {
    if (id == null) return;
    setReportReturn(
      section === "report-detail"
        ? reportReturn
        : { section, detailObjectId, profileUserId }
    );
    setDetailObjectId(null);
    setProfileUserId(null);
    setReportId(id);
    setSection("report-detail");
    setMobileNav(false);
    setShowNotif(false);
  };

  const closeReport = () => {
    const back = reportReturn && typeof reportReturn === "object" ? reportReturn : { section: reportReturn };
    if (back.section === "object-detail" && back.detailObjectId) {
      openObjectDetail(back.detailObjectId);
      return;
    }
    if (back.section === "profile" && back.profileUserId) {
      openProfile(back.profileUserId);
      return;
    }
    const dest = back.section && MAIN_SECTIONS.has(back.section) && back.section !== "report-detail"
      ? back.section
      : (isAdmin ? "archive" : "reports");
    navigateSection(dest);
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
        key={`${detailObjectId}-${rev}`}
        user={user}
        objectId={detailObjectId}
        onBack={() => navigateSection(objectReturn || defaultSection(user))}
        onNavigate={navigateSection}
        onOpenReport={openReport}
        onEdit={isAdmin ? openEditProject : undefined}
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
        onOpenReport={openReport}
      />
    );
  } else if (section === "report-detail" && reportId) {
    content = (
      <ReportDetail
        user={user}
        reportId={reportId}
        onBack={closeReport}
        onSelectObject={openObjectDetail}
      />
    );
  } else {
    const sections = {
      dashboard: (
        <Dashboard
          key={rev}
          user={user}
          onNavigate={navigateSection}
          onSelectObject={openObjectDetail}
          onOpenReport={openReport}
          onEditProject={isAdmin ? openEditProject : undefined}
          onProjectsChanged={isAdmin ? () => setListRev((r) => r + 1) : undefined}
        />
      ),
      calendar: <CalendarView key={rev} user={user} onSelectObject={openObjectDetail} />,
      reports: <Reports user={user} onOpenReport={openReport} />,
      tools: <ToolsPage user={user} />,
      warehouses: <WarehousesPage user={user} />,
      materials: <MaterialsPage user={user} onOpenWarehouse={() => navigateSection("warehouses")} />,
      projects: <ProjectsPage key={rev} user={user} onEditProject={openEditProject} />,
      archive: <Archive user={user} onSelectObject={openObjectDetail} onOpenReport={openReport} onProjectsChanged={() => setListRev((r) => r + 1)} />,
      users: <UsersPage user={user} onOpenProfile={openProfile} />,
    };
    content = sections[section] || sections.calendar;
  }

  const returnSection = reportReturn && typeof reportReturn === "object" ? reportReturn.section : reportReturn;
  const navSection = section === "object-detail"
    ? (objectReturn || defaultSection(user))
    : section === "profile"
      ? "users"
      : section === "report-detail"
        ? (returnSection === "reports" || returnSection === "dashboard" || returnSection === "archive"
          ? returnSection
          : (isAdmin ? "archive" : "reports"))
        : section;

  return (
    <div className={`app ${mobileNav ? "nav-open" : ""}`}>
      <div className={`side-stack ${mobileNav ? "open" : ""}`}>
        <Sidebar
          user={user}
          currentSection={navSection}
          onNavigate={navigateSection}
          onLogout={handleLogout}
          mobileOpen={mobileNav}
          onCloseMobile={() => setMobileNav(false)}
          onOpenProfile={openProfile}
        />
        {isAdmin && (
          <AdminProjectsSidebar
            currentProjectId={detailObjectId}
            onSelect={openObjectDetail}
            refreshKey={`${rev}-${listRev}`}
            section={section}
          />
        )}
      </div>
      {mobileNav && <div className="sidebar-backdrop show" onClick={() => setMobileNav(false)} />}

      <main className="main" data-screen-label={section}>
        <MobileTopbar onOpenSidebar={() => setMobileNav(true)}>
          <LanguageSwitch variant="light" />
          {isAdmin && (
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
                  seen={notifSeen}
                  onClose={() => setShowNotif(false)}
                  onLoaded={setNotifItems}
                  onOpenReport={openReport}
                  onSelectObject={openObjectDetail}
                  onSeenChange={setNotifSeen}
                />
              )}
            </div>
          )}
        </MobileTopbar>

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
            setEditingProject(null);
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
          key={editingProject?.id || "new"}
          nextId={nextId}
          busy={creating}
          project={editingProject}
          onClose={closeNewObject}
          onSave={async (payload) => {
            setCreating(true);
            try {
              if (editingProject?.id) {
                const saved = await updateProject(editingProject.id, payload);
                closeNewObject();
                setSavedToast(t("app.objectUpdated", { id: saved.id, client: saved.client || saved.name }));
              } else {
                const created = await createProject(payload);
                closeNewObject();
                setSavedToast(t("app.objectAdded", { id: created.id, client: created.client || created.name }));
              }
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
