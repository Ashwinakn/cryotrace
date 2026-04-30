import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { shipmentsApi } from '../api'
import { Search, Filter, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

function statusColor(s: string) {
  return { in_transit: 'blue', delivered: 'green', flagged: 'red', quarantined: 'amber', pending: 'gray', cancelled: 'gray' }[s] || 'gray'
}
function scoreColor(v: number) { return v >= 80 ? 'green' : v >= 50 ? 'amber' : 'red' }
function categoryLabel(c: string) { return c.replace(/_/g, ' ') }

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '', category: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', batch_no: '', category: 'vaccines', origin: '', destination: '', temp_min_required: '', temp_max_required: '', weight_kg: '', quantity_units: '', unit_value_usd: '', description: '' })
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const res = await shipmentsApi.list({ ...filters })
      setShipments(res.data)
    } catch { toast.error('Failed to load shipments') }
    setLoading(false)
  }

  useEffect(() => { load() }, [filters.status, filters.category])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load() }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await shipmentsApi.create({
        ...form,
        temp_min_required: form.temp_min_required ? +form.temp_min_required : null,
        temp_max_required: form.temp_max_required ? +form.temp_max_required : null,
        weight_kg: form.weight_kg ? +form.weight_kg : null,
        quantity_units: form.quantity_units ? +form.quantity_units : null,
        unit_value_usd: form.unit_value_usd ? +form.unit_value_usd : 0,
      })
      toast.success('Shipment created')
      setShowForm(false)
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Shipment Registry</h1>
          <p>{shipments.length} shipments matching filters</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> New Shipment
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search name, batch…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-ghost btn-sm"><Search size={13} /></button>
        </form>
        <select className="form-select" style={{ width: 160 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {['pending','in_transit','delivered','flagged','quarantined'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select className="form-select" style={{ width: 180 }} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {['vaccines','pharmaceutical','biologics','food','seafood','frozen_goods','perishables'].map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div>
          ) : shipments.length === 0 ? (
            <div className="empty-state"><p>No shipments found</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Route</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Integrity</th>
                  <th>Freshness</th>
                  <th>Risk</th>
                  <th>Handoffs</th>
                  <th>Anomalies</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s: any) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/shipments/${s.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{s.name.length > 45 ? s.name.slice(0, 45) + '…' : s.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>{s.batch_no}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: '#475569' }}>{s.origin.split(',')[0]}</span>
                      <span style={{ color: '#94a3b8', margin: '0 4px' }}>{' -> '}</span>
                      <span style={{ color: '#475569' }}>{s.destination.split(',')[0]}</span>
                    </td>
                    <td><span className="badge badge-blue">{categoryLabel(s.category)}</span></td>
                    <td><span className={`badge badge-${statusColor(s.status)}`}><span className="badge-dot" />{s.status.replace('_',' ')}</span></td>
                    <td>
                      <div className="score-bar" style={{ minWidth: 90 }}>
                        <div className="score-track"><div className={`score-fill ${scoreColor(s.integrity_score)}`} style={{ width: `${s.integrity_score}%` }} /></div>
                        <span className="score-num">{s.integrity_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="score-bar" style={{ minWidth: 90 }}>
                        <div className="score-track"><div className={`score-fill ${scoreColor(s.freshness_score)}`} style={{ width: `${s.freshness_score}%` }} /></div>
                        <span className="score-num">{s.freshness_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td><span className={`font-bold text-${s.risk_score >= 75 ? 'red' : s.risk_score >= 40 ? 'amber' : 'green'}`}>{s.risk_score.toFixed(1)}</span></td>
                    <td style={{ textAlign: 'center' }}>{s.handoff_count}</td>
                    <td style={{ textAlign: 'center' }}>
                      {s.anomaly_count > 0 ? <span className="badge badge-red">{s.anomaly_count}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td><button className="btn btn-ghost btn-sm">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 560, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Create New Shipment</h2>
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Shipment Name *</label><input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Batch No *</label><input className="form-input" required value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Category *</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {['vaccines','pharmaceutical','biologics','food','seafood','frozen_goods','perishables'].map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Origin *</label><input className="form-input" required value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Destination *</label><input className="form-input" required value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Min Temp (°C)</label><input className="form-input" type="number" value={form.temp_min_required} onChange={e => setForm(f => ({ ...f, temp_min_required: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Max Temp (°C)</label><input className="form-input" type="number" value={form.temp_max_required} onChange={e => setForm(f => ({ ...f, temp_max_required: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Weight (kg)</label><input className="form-input" type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Units</label><input className="form-input" type="number" value={form.quantity_units} onChange={e => setForm(f => ({ ...f, quantity_units: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Unit Value (USD)</label><input className="form-input" type="number" value={form.unit_value_usd} onChange={e => setForm(f => ({ ...f, unit_value_usd: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
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
