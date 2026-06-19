import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, PenLine, BarChart2, TrendingUp,
  Upload, Users, Settings, LogOut, Menu, X, ChevronRight
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const adminNav: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: <LayoutDashboard size={18} /> },
  { label: 'Daily Input', href: '/daily-input',  icon: <PenLine size={18} /> },
  { label: 'Reports',     href: '/reports',      icon: <BarChart2 size={18} /> },
]

const adminOnlyNav: NavItem[] = [
  { label: 'Forecasts',   href: '/forecasts',    icon: <TrendingUp size={18} /> },
  { label: 'Import',      href: '/import',       icon: <Upload size={18} /> },
  { label: 'Users',       href: '/users',        icon: <Users size={18} /> },
  { label: 'Settings',    href: '/settings',     icon: <Settings size={18} /> },
]

const managerNav: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: <LayoutDashboard size={18} /> },
  { label: 'Daily Input', href: '/daily-input',  icon: <PenLine size={18} /> },
  { label: 'Reports',     href: '/reports',      icon: <BarChart2 size={18} /> },
]

const staffNav: NavItem[] = [
  { label: 'Daily Input', href: '/daily-input',  icon: <PenLine size={18} /> },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!profile) return <>{children}</>

  const role = profile.role

  const navItems = role === 'admin'
    ? [...adminNav, ...adminOnlyNav]
    : role === 'manager'
    ? managerNav
    : staffNav

  const showAdminDivider = role === 'admin'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b">
        <span className="text-lg font-bold text-foreground">Insight Hub</span>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.full_name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item, i) => {
          const isAdminSection = showAdminDivider && i === adminNav.length
          return (
            <div key={item.href}>
              {isAdminSection && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-1">
                  Administration
                </p>
              )}
              <NavLink
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`
                }
              >
                {item.icon}
                {item.label}
                <ChevronRight size={14} className="ml-auto opacity-40" />
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r bg-card shrink-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-60 h-full bg-card border-r z-50">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">Insight Hub</span>
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-muted-foreground">
            {mobileOpen ? <X size={20} /> : null}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
