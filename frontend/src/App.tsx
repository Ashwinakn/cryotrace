import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ShipmentsPage from './pages/ShipmentsPage'
import ShipmentDetailPage from './pages/ShipmentDetailPage'
import VerifyPage from './pages/VerifyPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AdminPage from './pages/AdminPage'
import ESGPage from './pages/ESGPage'
import ClaimsPage from './pages/ClaimsPage'
import FieldHandoffPage from './pages/FieldHandoffPage'

import StakeholderLogin from './pages/StakeholderLogin'
import StakeholderPortal from './pages/StakeholderPortal'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PortalRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><div className="spinner" /></div>
  if (!user) return <Navigate to="/portal/login" replace />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/portal/login" element={user ? <Navigate to="/portal" /> : <StakeholderLogin />} />
      <Route path="/portal" element={
        <PortalRoute>
          <StakeholderPortal />
        </PortalRoute>
      } />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/verify/:id" element={<VerifyPage />} />
      <Route path="/field" element={<FieldHandoffPage />} />
      <Route path="/field/:shipmentId" element={<FieldHandoffPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="esg" element={<ESGPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}
