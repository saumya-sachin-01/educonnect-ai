import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardList, FileText, MessageCircleQuestion,
  Sparkles, Bell, User, LogOut, GraduationCap, Users, FolderPlus, Layers,
  BarChart3, Megaphone, ScrollText, Menu, X, LibraryBig,
} from 'lucide-react';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import { Avatar } from './ui.jsx';

const NAV = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/courses', label: 'My Courses', icon: BookOpen },
    { to: '/student/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/student/notes', label: 'Notes', icon: LibraryBig },
    { to: '/student/doubts', label: 'Doubt Discussion', icon: MessageCircleQuestion },
    { to: '/student/assistant', label: 'Study Assistant', icon: Sparkles },
    { to: '/student/notifications', label: 'Notifications', icon: Bell },
    { to: '/student/profile', label: 'Profile', icon: User },
  ],
  faculty: [
    { to: '/faculty/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/faculty/courses', label: 'My Courses', icon: BookOpen },
    { to: '/faculty/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/faculty/notes', label: 'Notes', icon: LibraryBig },
    { to: '/faculty/doubts', label: 'Student Doubts', icon: MessageCircleQuestion },
    { to: '/faculty/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/faculty/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/faculty/profile', label: 'Profile', icon: User },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/courses', label: 'Courses', icon: FolderPlus },
    { to: '/admin/subjects', label: 'Subjects', icon: Layers },
    { to: '/admin/assignments', label: 'Assignments Overview', icon: ScrollText },
    { to: '/admin/activity', label: 'Activity Overview', icon: BarChart3 },
  ],
};

const TITLES = Object.values(NAV).flat().reduce((acc, item) => {
  acc[item.to] = item.label;
  return acc;
}, {});

function pageTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const hit = Object.keys(TITLES).filter((k) => pathname.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return hit ? TITLES[hit] : 'EduConnect AI';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api('/notifications').then((d) => alive && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const nav = NAV[user.role] || [];
  const close = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><GraduationCap size={21} /></span>
          <span className="brand-name">EduConnect AI<small>ACADEMIC COLLABORATION</small></span>
        </div>
        <nav className="nav" onClick={close}>
          <div className="nav-section">{user.role === 'student' ? 'Student workspace' : user.role === 'faculty' ? 'Faculty workspace' : 'Administration'}</div>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <item.icon size={17} /> {item.label}
              {item.to.endsWith('/notifications') && unread > 0 && <span className="bell-dot" style={{ position: 'static', border: 'none', marginLeft: 'auto' }}>{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="demo-chip">DEMO MODE</span>
          <p style={{ marginTop: 8 }}>Local demo build for presentation. Fictional data only.</p>
        </div>
        <div className="side-user">
          <Avatar name={user.name} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="su-name">{user.name}</div>
            <div className="su-role">{user.role}</div>
          </div>
          <button
            className="icon-btn"
            style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)', color: '#cbd5e1' }}
            title="Log out"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {menuOpen && <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(11,21,48,0.5)', zIndex: 55 }} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
          <span className="topbar-title">{pageTitle(location.pathname)}</span>
          <div className="topbar-right">
            <button className="icon-btn bell-btn" title="Notifications" onClick={() => navigate(`/${user.role}/notifications`)}>
              <Bell size={16} />
              {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <Avatar name={user.name} size={34} />
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
