import { useAuth } from '../context/AuthContext'
import AdminDashboard from './dashboards/AdminDashboard'
import VendorDashboard from './dashboards/VendorDashboard'
import HubDashboard from './dashboards/HubDashboard'
import CustomerDashboard from './dashboards/CustomerDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  switch (user.role) {
    case 'vendor':
      return <VendorDashboard />
    case 'hub':
    case 'warehouse':
      return <HubDashboard />
    case 'customer':
    case 'consumer':
      return <CustomerDashboard />
    case 'admin':
    case 'regulator':
    case 'operator':
    default:
      return <AdminDashboard />
  }
}
