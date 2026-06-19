import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { RequireAuth } from '@/components/auth/RequireAuth'
import LoginPage from '@/pages/auth/LoginPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Admin + Manager */}
            <Route path="/dashboard" element={
              <RequireAuth allowedRoles={['admin', 'manager']}>
                <ComingSoon title="Dashboard" />
              </RequireAuth>
            } />
            <Route path="/reports" element={
              <RequireAuth allowedRoles={['admin', 'manager']}>
                <ComingSoon title="Reports" />
              </RequireAuth>
            } />

            {/* Admin only */}
            <Route path="/forecasts" element={
              <RequireAuth allowedRoles={['admin']}>
                <ComingSoon title="Forecasts" />
              </RequireAuth>
            } />
            <Route path="/import" element={
              <RequireAuth allowedRoles={['admin']}>
                <ComingSoon title="Import" />
              </RequireAuth>
            } />
            <Route path="/users" element={
              <RequireAuth allowedRoles={['admin']}>
                <ComingSoon title="Users" />
              </RequireAuth>
            } />
            <Route path="/settings" element={
              <RequireAuth allowedRoles={['admin']}>
                <ComingSoon title="Settings" />
              </RequireAuth>
            } />

            {/* All authenticated users */}
            <Route path="/daily-input" element={
              <RequireAuth allowedRoles={['admin', 'manager', 'staff']}>
                <ComingSoon title="Daily Input" />
              </RequireAuth>
            } />

            {/* Platform admin */}
            <Route path="/platform" element={
              <RequireAuth allowedRoles={['platform_admin']}>
                <ComingSoon title="Platform Admin" />
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
