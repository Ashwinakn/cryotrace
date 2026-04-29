import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Package, BarChart3, Leaf, FileText,
  ShieldCheck, Settings, LogOut, Bell, Search, Zap
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/shipments', icon: Package, label: 'Shipments' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/esg', icon: Leaf, label: 'ESG & Carbon' },
  { to: '/claims', icon: FileText, label: 'Insurance Claims' },
  { to: '/verify', icon: ShieldCheck, label: 'Verify Portal' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">❄️</div>
            <div>
              <div className="logo-text">CryoTrace</div>
              <div className="logo-sub">Cold Chain Intelligence</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Platform</div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-icon" size={17} />
              {label}
            </NavLink>
          ))}

          {user?.role === 'admin' || user?.role === 'regulator' ? (
            <>
              <div className="nav-section-label" style={{ marginTop: 20 }}>Admin</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <Settings className="nav-icon" size={17} />
                Administration
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card" onClick={logout}>
            <div className="user-avatar">{user?.name?.[0] ?? 'U'}</div>
            <div style={{ flex: 1 }}>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <LogOut size={15} color="#64748b" />
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <Zap size={16} color="#2563eb" style={{ marginRight: 6 }} />
          </div>
          <div className="topbar-search">
            <Search size={14} />
            Search shipments, batches...
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments?status=flagged')}>
            <Bell size={14} /> Alerts
            <span className="nav-badge">3</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shipments')}>
            + New Shipment
          </button>
        </header>

        <main className="page-body fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
