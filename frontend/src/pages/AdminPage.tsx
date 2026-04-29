import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    adminApi.users().then(r => setUsers(r.data)).catch(() => toast.error('Admin access required'))
    adminApi.stats().then(r => setStats(r.data)).catch(() => {})
  }, [])

  const toggleUser = async (id: string) => {
    await adminApi.toggleUser(id)
    adminApi.users().then(r => setUsers(r.data))
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    await adminApi.deleteUser(id)
    setUsers(users.filter(u => u.id !== id))
    toast.success('User deleted')
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Administration</h1>
          <p>User management and system configuration</p>
        </div>
      </div>

      {stats && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: stats.total_users, color: 'blue' },
            { label: 'Total Shipments', value: stats.total_shipments, color: 'green' },
            { label: 'Total Anomalies', value: stats.total_anomalies, color: 'amber' },
            { label: 'Unresolved', value: stats.unresolved_anomalies, color: 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`stat-card ${color}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">User Management</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Company</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                        {u.name[0]}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'red' : u.role === 'regulator' ? 'purple' : 'blue'}`}>{u.role}</span></td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{u.company || '—'}</td>
                  <td><span className={`badge badge-${u.is_active !== false ? 'green' : 'gray'}`}>{u.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(u.id)}>Toggle</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
