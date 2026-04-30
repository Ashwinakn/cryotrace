import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, AlertCircle, Thermometer, Plus, TrendingUp, Package, CheckCircle } from 'lucide-react'
import { shipmentsApi, aiApi, analyticsApi } from '../../api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function VendorDashboard() {
  const [shipments, setShipments] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [monthly, setMonthly] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', batch_no: '', category: 'vaccines', origin: '', destination: '', temp_min_required: '', temp_max_required: '', weight_kg: '', quantity_units: '', unit_value_usd: '', description: '' })
  const navigate = useNavigate()

  useEffect(() => {
    shipmentsApi.list().then(res => setShipments(res.data)).catch(() => {})
    aiApi.anomalies({ limit: 5, resolved: false }).then(res => setAlerts(res.data)).catch(() => {})
    analyticsApi.monthlyStats().then(res => setMonthly(res.data)).catch(() => {})
    analyticsApi.dashboard().then(res => setStats(res.data)).catch(() => {})
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await shipmentsApi.create({ ...form, temp_min_required: form.temp_min_required ? +form.temp_min_required : null, temp_max_required: form.temp_max_required ? +form.temp_max_required : null, weight_kg: form.weight_kg ? +form.weight_kg : null, quantity_units: form.quantity_units ? +form.quantity_units : null, unit_value_usd: form.unit_value_usd ? +form.unit_value_usd : 0 })
      setShowForm(false)
      shipmentsApi.list().then(res => setShipments(res.data))
    } catch { }
  }

  const inTransit = shipments.filter(s => s.status === 'in_transit').length
  const delivered = shipments.filter(s => s.status === 'delivered').length
  const flagged = shipments.filter(s => s.status === 'flagged').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Vendor Dashboard</h1>
          <p>Manage your shipments, monitor temperature alerts, and track performance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Create Shipment</button>
      </div>

      {/* KPI strip */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Shipments', value: shipments.length, icon: Package, color: 'blue' },
          { label: 'In Transit', value: inTransit, icon: Thermometer, color: 'blue' },
          { label: 'Delivered', value: delivered, icon: CheckCircle, color: 'green' },
          { label: 'Flagged', value: flagged, icon: AlertCircle, color: 'red' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`stat-card ${color}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <Icon size={38} className="stat-icon" />
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Monthly trend chart */}
        <div className="card">
          <div className="card-header"><span className="card-title">Monthly Shipment Volume</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Shipments" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Alerts</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All</button>
          </div>
          <div className="card-body">
            {alerts.length === 0 ? (
              <div className="empty-state"><p>No active anomalies</p></div>
            ) : alerts.map(a => (
              <div key={a.id} className={`alert alert-${a.severity}`} style={{ marginBottom: 8 }}>
                <AlertCircle size={16} />
                <div>
                  <strong style={{ fontSize: 12, textTransform: 'capitalize' }}>{a.anomaly_type.replace(/_/g, ' ')}</strong>
                  <p style={{ fontSize: 11, marginTop: 2 }}>{a.description}</p>
                </div>
                <span className={`badge badge-${a.severity === 'critical' ? 'red' : 'amber'}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>{a.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shipments table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">My Shipments</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Shipment</th><th>Route</th><th>Status</th><th>Integrity</th><th>Temp Range</th><th></th></tr></thead>
            <tbody>
              {shipments.slice(0, 8).map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/shipments/${s.id}`)}>
                  <td><div style={{ fontWeight: 600, fontSize: 13 }}>{s.name.slice(0, 38)}…</div><div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>{s.batch_no}</div></td>
                  <td style={{ fontSize: 12 }}>{s.origin.split(',')[0]} {' -> '} {s.destination.split(',')[0]}</td>
                  <td><span className={`badge badge-${{ in_transit: 'blue', delivered: 'green', flagged: 'red', quarantined: 'amber', pending: 'gray' }[s.status] || 'gray'}`}>{s.status.replace('_', ' ')}</span></td>
                  <td>
                    <div className="score-bar" style={{ minWidth: 80 }}>
                      <div className="score-track"><div className={`score-fill ${s.integrity_score >= 80 ? 'green' : s.integrity_score >= 50 ? 'amber' : 'red'}`} style={{ width: `${s.integrity_score}%` }} /></div>
                      <span className="score-num">{s.integrity_score.toFixed(0)}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{s.temp_min_required != null ? `${s.temp_min_required}°C – ${s.temp_max_required}°C` : '—'}</td>
                  <td><button className="btn btn-ghost btn-sm">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Shipment Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 560, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Create New Shipment</h2>
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Batch No *</label><input className="form-input" required value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{['vaccines','pharmaceutical','biologics','food','seafood','frozen_goods','perishables'].map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Origin *</label><input className="form-input" required value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Destination *</label><input className="form-input" required value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Min Temp (°C)</label><input className="form-input" type="number" value={form.temp_min_required} onChange={e => setForm(f => ({ ...f, temp_min_required: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Max Temp (°C)</label><input className="form-input" type="number" value={form.temp_max_required} onChange={e => setForm(f => ({ ...f, temp_max_required: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} /></div>
              </div>
              <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Shipment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
