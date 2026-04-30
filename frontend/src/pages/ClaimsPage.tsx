import { useEffect, useState } from 'react'
import { shipmentsApi, claimsApi } from '../api'
import { FileText, Plus, CheckCircle, Clock, XCircle, DollarSign, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  open: 'amber',
  under_review: 'blue',
  approved: 'green',
  rejected: 'red',
  settled: 'green',
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [shipments, setShipments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    shipment_id: '',
    claimant_name: '',
    claimant_email: '',
    reason: '',
    estimated_loss_usd: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [c, st, fl, ql] = await Promise.all([
        claimsApi.list(),
        claimsApi.stats(),
        shipmentsApi.list({ status: 'flagged' }),
        shipmentsApi.list({ status: 'quarantined' }),
      ])
      setClaims(c.data)
      setStats(st.data)
      setShipments([...fl.data, ...ql.data])
    } catch { toast.error('Failed to load claims') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await claimsApi.create({
        ...form,
        estimated_loss_usd: form.estimated_loss_usd ? +form.estimated_loss_usd : 0,
      })
      toast.success('Claim submitted successfully')
      setShowForm(false)
      setForm({ shipment_id: '', claimant_name: '', claimant_email: '', reason: '', estimated_loss_usd: '' })
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to submit claim') }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await claimsApi.update(id, { status })
      toast.success(`Claim marked as ${status.replace('_', ' ')}`)
      load()
    } catch { toast.error('Update failed') }
  }

  const statCards = stats ? [
    { label: 'Total Claims', value: stats.total, icon: FileText, color: 'blue' },
    { label: 'Open Claims', value: stats.open, icon: AlertTriangle, color: 'amber' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'green' },
    { label: 'Total Exposure', value: `$${(stats.total_exposure_usd / 1000).toFixed(1)}K`, icon: DollarSign, color: 'red' },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Insurance Claims</h1>
          <p>Submit, track and manage cold chain spoilage & fraud claims</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> New Claim
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`stat-card ${color}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <Icon size={38} className="stat-icon" />
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        {/* Claims list */}
        <div className="card">
          <div className="card-header"><span className="card-title">All Claims</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div>
            ) : claims.length === 0 ? (
              <div className="empty-state">
                <p>No claims yet. Submit your first claim using flagged/quarantined shipments.</p>
              </div>
            ) : (
              <div>
                {claims.map((c: any) => (
                  <div
                    key={c.id}
                    style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected?.id === c.id ? '#f8fafc' : undefined }}
                    onClick={() => setSelected(c)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono' }}>{c.claim_ref}</div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{c.claimant_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.reason.slice(0, 60)}…</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge badge-${STATUS_COLORS[c.status] || 'gray'}`}>{c.status.replace('_', ' ')}</span>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>${c.estimated_loss_usd.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Claim detail / evidence */}
        <div>
          {selected ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Claim {selected.claim_ref}</span>
                <span className={`badge badge-${STATUS_COLORS[selected.status] || 'gray'}`}>{selected.status.replace('_', ' ')}</span>
              </div>
              <div className="card-body">
                {[
                  ['Claimant', selected.claimant_name],
                  ['Email', selected.claimant_email || '—'],
                  ['Submitted', new Date(selected.created_at).toLocaleString()],
                  ['Est. Loss', `$${selected.estimated_loss_usd.toLocaleString()}`],
                  ['Resolved', selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Reason</div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: '#475569' }}>{selected.reason}</p>
                </div>

                {selected.evidence_summary && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Auto-Generated Evidence</div>
                    <pre style={{ fontSize: 11, background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', color: '#475569', lineHeight: 1.8 }}>{selected.evidence_summary}</pre>
                  </div>
                )}

                {selected.resolution_notes && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Resolution Notes</div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#475569' }}>{selected.resolution_notes}</p>
                  </div>
                )}

                {['open', 'under_review'].includes(selected.status) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                    {selected.status === 'open' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(selected.id, 'under_review')}>
                        <Clock size={13} /> Mark Under Review
                      </button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(selected.id, 'approved')}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => handleStatusChange(selected.id, 'rejected')}>
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header"><span className="card-title">Eligible for Claims</span></div>
              <div className="card-body">
                {shipments.length === 0 ? (
                  <div className="empty-state"><p>No flagged/quarantined shipments</p></div>
                ) : shipments.map((s: any) => (
                  <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name.slice(0, 44)}…</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.batch_no}</div>
                      <span className={`badge badge-${s.status === 'flagged' ? 'red' : 'amber'}`} style={{ marginTop: 4 }}>{s.status}</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setForm(f => ({ ...f, shipment_id: s.id })); setShowForm(true) }}>
                      File Claim
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Claim Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 520, padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Submit Insurance Claim</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Shipment *</label>
                <select className="form-select" required value={form.shipment_id} onChange={e => setForm(f => ({ ...f, shipment_id: e.target.value }))}>
                  <option value="">Select a shipment…</option>
                  {shipments.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.batch_no})</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Claimant Name *</label><input className="form-input" required value={form.claimant_name} onChange={e => setForm(f => ({ ...f, claimant_name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Claimant Email</label><input className="form-input" type="email" value={form.claimant_email} onChange={e => setForm(f => ({ ...f, claimant_email: e.target.value }))} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Loss (USD)</label>
                <input className="form-input" type="number" placeholder="Leave blank to auto-calculate" value={form.estimated_loss_usd} onChange={e => setForm(f => ({ ...f, estimated_loss_usd: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Claim *</label>
                <textarea className="form-input" rows={3} required placeholder="Describe the spoilage, loss, or fraud event…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
