import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ShieldCheck, FileCheck, RefreshCw, Truck, CheckCircle, AlertTriangle, QrCode } from 'lucide-react'
import { shipmentsApi } from '../../api'

export default function CustomerDashboard() {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    shipmentsApi.list().then(res => setShipments(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const inTransit = shipments.filter(s => s.status === 'in_transit')
  const delivered = shipments.filter(s => s.status === 'delivered')
  const flagged = shipments.filter(s => ['flagged', 'quarantined'].includes(s.status))

  function statusIcon(status: string) {
    if (status === 'delivered') return <CheckCircle size={16} color="#16a34a" />
    if (status === 'in_transit') return <Truck size={16} color="#2563eb" />
    if (['flagged', 'quarantined'].includes(status)) return <AlertTriangle size={16} color="#dc2626" />
    return <Package size={16} color="#94a3b8" />
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customer Portal</h1>
          <p>Track your orders, verify quality certificates, and manage IoT tag returns</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/verify')}>
          <ShieldCheck size={15} /> Verify a Product
        </button>
      </div>

      {/* KPI strip */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Active Orders', value: inTransit.length, icon: Truck, color: 'blue', sub: 'In transit now' },
          { label: 'Delivered', value: delivered.length, icon: CheckCircle, color: 'green', sub: 'Completed' },
          { label: 'Issues', value: flagged.length, icon: AlertTriangle, color: flagged.length > 0 ? 'red' : 'green', sub: flagged.length > 0 ? 'Need attention' : 'All clear' },
          { label: 'Total Orders', value: shipments.length, icon: Package, color: 'blue', sub: 'All time' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className={`stat-card ${color}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
            <Icon size={38} className="stat-icon" />
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Active Orders */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Orders</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? <div className="flex-center" style={{ padding: 40 }}><div className="spinner" /></div>
              : inTransit.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <p>No active shipments in transit</p>
                </div>
              ) : inTransit.map(s => (
                <div key={s.id} style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate(`/shipments/${s.id}`)}>
                  {statusIcon(s.status)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.origin.split(',')[0]} {' -> '} {s.destination.split(',')[0]}</div>
                    {s.eta && <div style={{ fontSize: 11, color: '#64748b' }}>ETA: {new Date(s.eta).toLocaleDateString()}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="score-bar" style={{ minWidth: 70 }}>
                      <div className="score-track"><div className={`score-fill ${s.freshness_score >= 80 ? 'green' : s.freshness_score >= 50 ? 'amber' : 'red'}`} style={{ width: `${s.freshness_score}%` }} /></div>
                      <span className="score-num">{s.freshness_score.toFixed(0)}</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>freshness</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Verification + Trust */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* QR Verify shortcut */}
          <div className="card">
            <div className="card-header"><span className="card-title">Verify Product Authenticity</span></div>
            <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <QrCode size={48} color="#2563eb" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 1.5 }}>
                Scan the QR code on your package or enter the shipment ID to verify cold chain integrity and document authenticity.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/verify')}><ShieldCheck size={14} /> Open Verify Portal</button>
            </div>
          </div>

          {/* Document transparency */}
          <div className="card">
            <div className="card-header"><span className="card-title">Document Transparency</span></div>
            <div className="card-body">
              {[
                { icon: FileCheck, label: 'All documents hashed on Hyperledger Fabric', ok: true },
                { icon: ShieldCheck, label: 'Tamper detection active on all uploads', ok: true },
                { icon: RefreshCw, label: 'Return IoT tags after delivery to earn ESG credits', ok: null },
              ].map(({ icon: Icon, label, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Icon size={18} color={ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#7c3aed'} />
                  <span style={{ fontSize: 12, color: '#475569', flex: 1 }}>{label}</span>
                  {ok !== null && <span className={`badge badge-${ok ? 'green' : 'red'}`}>{ok ? 'Active' : 'Issue'}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Issues section */}
      {flagged.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Orders Requiring Attention</span></div>
          <div className="card-body">
            {flagged.map(s => (
              <div key={s.id} className="alert alert-critical" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => navigate(`/shipments/${s.id}`)}>
                <AlertTriangle size={16} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{s.name.slice(0, 50)}</strong>
                  <p style={{ fontSize: 11, marginTop: 2 }}>{s.origin} {' -> '} {s.destination} · {s.anomaly_count} anomalies detected</p>
                </div>
                <span className={`badge badge-${s.status === 'flagged' ? 'red' : 'amber'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
