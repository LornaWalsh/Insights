import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/pages/auth/LoginPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import PlatformAdminPage from '@/pages/platform/PlatformAdminPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground text-sm mt-2">Coming soon</p>
      </div>
    </div>
  )
}

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
        <p className="text-muted-foreground text-sm mt-2">You don't have permission to view this page.</p>
      </div>
    </div>
  )
}

function Protected({ roles, children }: { roles: Parameters<typeof RequireAuth>[0]['allowedRoles'], children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={roles}>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Onboarding — admin only, no AppShell */}
            <Route path="/onboarding" element={
              <RequireAuth allowedRoles={['admin']}>
                <OnboardingPage />
              </RequireAuth>
            } />

            {/* Admin + Manager */}
            <Route path="/dashboard" element={<Protected roles={['admin', 'manager']}><ComingSoon title="Dashboard" /></Protected>} />
            <Route path="/reports"   element={<Protected roles={['admin', 'manager']}><ComingSoon title="Reports" /></Protected>} />

            {/* Admin only */}
            <Route path="/forecasts" element={<Protected roles={['admin']}><ComingSoon title="Forecasts" /></Protected>} />
            <Route path="/import"    element={<Protected roles={['admin']}><ComingSoon title="Import" /></Protected>} />
            <Route path="/users"     element={<Protected roles={['admin']}><ComingSoon title="Users" /></Protected>} />
            <Route path="/settings"  element={<Protected roles={['admin']}><ComingSoon title="Settings" /></Protected>} />

            {/* All authenticated users */}
            <Route path="/daily-input" element={<Protected roles={['admin', 'manager', 'staff']}><ComingSoon title="Daily Input" /></Protected>} />

            {/* Platform admin — no AppShell, its own minimal UI */}
            <Route path="/platform" element={
              <RequireAuth allowedRoles={['platform_admin']}>
                <PlatformAdminPage />
              </RequireAuth>
            } />

            {/* Default */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
