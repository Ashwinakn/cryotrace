import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageCheck, ShieldCheck, Clock, Hash, AlertCircle, CheckCircle2, Thermometer, ClipboardList } from 'lucide-react'
import { shipmentsApi, handoffsApi, analyticsApi } from '../../api'

export default function HubDashboard() {
  const [shipments, setShipments] = useState<any[]>([])
  const [pendingVerify, setPendingVerify] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [tempData, setTempData] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    shipmentsApi.list({ status: 'in_transit' }).then(r => {
      setShipments(r.data)
      setPendingVerify(r.data.slice(0, 5))
    }).catch(() => {})
    analyticsApi.dashboard().then(r => setStats(r.data)).catch(() => {})
    analyticsApi.tempExcursions(7).then(r => setTempData(r.data)).catch(() => {})
  }, [])

  const handleVerify = (shipmentId: string) => {
    navigate(`/shipments/${shipmentId}`)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Distributor Hub Dashboard</h1>
          <p>Verify incoming shipments, check temperature compliance, and record handoffs</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/shipments')}>
          View All Shipments
        </button>
      </div>

      {/* KPI strip */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'In Transit', value: stats.in_transit, icon: PackageCheck, color: 'blue', sub: 'Awaiting arrival' },
            { label: 'Delivered Today', value: stats.delivered, icon: CheckCircle2, color: 'green', sub: 'Completed' },
            { label: 'Flagged', value: stats.flagged, icon: AlertCircle, color: 'red', sub: 'Require action' },
            { label: 'Active Sensors', value: stats.active_sensors, icon: Thermometer, color: 'purple', sub: 'Live feeds' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className={`stat-card ${color}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-sub">{sub}</div>
              <Icon size={38} className="stat-icon" />
            </div>
          ))}
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Pending verification queue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pending Verification Queue</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{pendingVerify.length} in transit</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {pendingVerify.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>No shipments pending verification</p>
              </div>
            ) : pendingVerify.map(s => (
              <div key={s.id} style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                <PackageCheck size={20} color="#7c3aed" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span><Hash size={10} className="inline" /> {s.id.split('-')[0]}…</span>
                    <span>{s.origin.split(',')[0]} {' -> '} {s.destination.split(',')[0]}</span>
                  </div>
                  {s.temp_min_required != null && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Required: {s.temp_min_required}°C – {s.temp_max_required}°C
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px', color: '#7c3aed', borderColor: '#e9d5ff' }}
                    onClick={() => navigate(`/field/${s.id}`)}
                    title="Open field handoff form (for phone use)"
                  >
                    <ClipboardList size={12} style={{ marginRight: 4 }} />
                    Handoff
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleVerify(s.id)}>
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Tamper & Document Status</span></div>
            <div className="card-body">
              {stats && [
                { label: 'Verified Documents', value: stats.verified_docs, icon: ShieldCheck, ok: true },
                { label: 'Blockchain Records', value: stats.blockchain_verified, icon: Hash, ok: true },
                { label: 'Unresolved Anomalies', value: stats.unresolved_anomalies, icon: AlertCircle, ok: stats.unresolved_anomalies === 0 },
              ].map(({ label, value, icon: Icon, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Icon size={18} color={ok ? '#16a34a' : '#dc2626'} />
                  <span style={{ fontSize: 13, flex: 1, color: '#475569' }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: ok ? '#16a34a' : '#dc2626' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Hub Operations</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <Clock size={18} color="#2563eb" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Auto-Timestamp Sync</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>IoT sensor timestamps are auto-recorded on package arrival</div>
                </div>
                <span className="badge badge-green"><span className="badge-dot" />Live</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <Thermometer size={18} color="#7c3aed" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Temperature Logging</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Continuous monitoring with automatic anomaly detection</div>
                </div>
                <span className="badge badge-green"><span className="badge-dot" />Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Temperature excursion summary */}
      {tempData.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Temperature Log (Last 7 Days)</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {tempData.map((d: any) => (
                <div key={d.date} style={{ flex: 1, minWidth: 100, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{d.date}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: d.max_temp > 8 ? '#dc2626' : '#16a34a' }}>{d.max_temp.toFixed(1)}°</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>max</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>{d.avg_temp.toFixed(1)}°</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>avg</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
