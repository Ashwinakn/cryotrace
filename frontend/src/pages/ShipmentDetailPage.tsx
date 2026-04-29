import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { shipmentsApi, handoffsApi, documentsApi, sensorsApi, aiApi } from '../api'
import { analyticsApi } from '../api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'
import { ArrowLeft, RefreshCw, Zap } from 'lucide-react'

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

function scoreColor(v: number) { return v >= 80 ? '#16a34a' : v >= 50 ? '#f59e0b' : '#dc2626' }
function statusColor(s: string) { return { in_transit: 'blue', delivered: 'green', flagged: 'red', quarantined: 'amber', pending: 'gray' }[s] || 'gray' }

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [shipment, setShipment] = useState<any>(null)
  const [handoffs, setHandoffs] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [aiResult, setAiResult] = useState<any>(null)
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAI, setRunningAI] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    loadAll()
    // WebSocket for live sensor data
    wsRef.current = new WebSocket(`ws://localhost:8000/sensor/ws/live/${id}`)
    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'sensor_update') {
        setSensors(prev => [...prev.slice(-200), { ...data.data, id: Date.now() }])
      }
    }
    return () => wsRef.current?.close()
  }, [id])

  const loadAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [s, h, d, sn, an] = await Promise.all([
        shipmentsApi.get(id),
        handoffsApi.list(id),
        documentsApi.list(id),
        sensorsApi.list(id, 200),
        aiApi.anomalies({ shipment_id: id }),
      ])
      setShipment(s.data)
      setHandoffs(h.data)
      setDocuments(d.data)
      setSensors(sn.data)
      setAnomalies(an.data)
      // Get latest AI result
      const hist = await aiApi.history(id)
      if (hist.data.length > 0) setAiResult(hist.data[0])
    } catch { toast.error('Failed to load shipment') }
    setLoading(false)
  }

  const runAI = async () => {
    if (!id) return
    setRunningAI(true)
    try {
      const res = await aiApi.predict(id)
      setAiResult(res.data)
      toast.success('AI analysis complete')
    } catch { toast.error('AI prediction failed') }
    setRunningAI(false)
  }

  if (loading) return <div className="flex-center" style={{ height: 400 }}><div className="spinner" /></div>
  if (!shipment) return <div className="empty-state"><p>Shipment not found</p></div>

  const mapPoints = handoffs.filter(h => h.lat && h.lng)
  const mapCenter: [number, number] = mapPoints.length > 0 ? [mapPoints[0].lat, mapPoints[0].lng] : [20, 0]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="flex items-center gap-12" style={{ marginBottom: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}><ArrowLeft size={14} /> Back</button>
            <span className={`badge badge-${statusColor(shipment.status)}`}><span className="badge-dot" />{shipment.status.replace('_',' ')}</span>
            <span className="badge badge-gray">{shipment.category.replace('_',' ')}</span>
          </div>
          <h1 style={{ fontSize: 20 }}>{shipment.name}</h1>
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{shipment.batch_no} · {shipment.origin} → {shipment.destination}</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={loadAll}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={runAI} disabled={runningAI}>
            <Zap size={13} /> {runningAI ? 'Analyzing…' : 'Run AI Analysis'}
          </button>
        </div>
      </div>

      {/* Score Banner */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: 20, display: 'flex', gap: 32, alignItems: 'center' }}>
        {[
          { label: 'Integrity Score', value: shipment.integrity_score },
          { label: 'Freshness Score', value: shipment.freshness_score },
          { label: 'Risk Score', value: shipment.risk_score, invert: true },
        ].map(({ label, value, invert }) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div className="score-bar">
              <div className="score-track" style={{ height: 8 }}>
                <div className={`score-fill ${invert ? (value < 25 ? 'green' : value < 60 ? 'amber' : 'red') : (value >= 80 ? 'green' : value >= 50 ? 'amber' : 'red')}`} style={{ width: `${value}%` }} />
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(invert ? (100 - value) : value), minWidth: 42 }}>{value.toFixed(0)}</span>
            </div>
          </div>
        ))}
        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Handoffs</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{handoffs.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Anomalies</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: anomalies.filter(a => !a.resolved).length > 0 ? '#dc2626' : '#16a34a' }}>
            {anomalies.filter(a => !a.resolved).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview','custody','documents','sensors','blockchain','ai','map'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t === 'ai' ? 'AI Insights' : t === 'custody' ? 'Chain of Custody' : t}</div>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab shipment={shipment} anomalies={anomalies} />}
      {tab === 'custody' && <CustodyTab handoffs={handoffs} />}
      {tab === 'documents' && <DocumentsTab documents={documents} shipmentId={id!} onRefresh={loadAll} />}
      {tab === 'sensors' && <SensorsTab sensors={sensors} shipment={shipment} />}
      {tab === 'blockchain' && <BlockchainTab shipmentId={id!} />}
      {tab === 'ai' && <AITab aiResult={aiResult} anomalies={anomalies} onRunAI={runAI} />}
      {tab === 'map' && <MapTab handoffs={mapPoints} center={mapCenter} />}
    </div>
  )
}

/* ── Overview Tab ── */
function OverviewTab({ shipment, anomalies }: any) {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header"><span className="card-title">Shipment Details</span></div>
        <div className="card-body">
          {[
            ['Product', shipment.name],
            ['Batch No', shipment.batch_no],
            ['Category', shipment.category.replace('_',' ')],
            ['Origin', shipment.origin],
            ['Destination', shipment.destination],
            ['Status', shipment.status.replace('_',' ')],
            ['ETA', shipment.eta ? new Date(shipment.eta).toLocaleDateString() : '—'],
            ['Weight', shipment.weight_kg ? `${shipment.weight_kg} kg` : '—'],
            ['Units', shipment.quantity_units?.toLocaleString() ?? '—'],
            ['Unit Value', shipment.unit_value_usd ? `$${shipment.unit_value_usd}` : '—'],
            ['Temp Range', shipment.temp_min_required != null ? `${shipment.temp_min_required}°C to ${shipment.temp_max_required}°C` : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Genesis Hash</span></div>
          <div className="card-body">
            <div className="tx-hash">{shipment.genesis_hash || '—'}</div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>SHA-256 root hash anchoring this shipment's chain of custody</p>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Active Anomalies</span></div>
          <div className="card-body">
            {anomalies.filter((a: any) => !a.resolved).length === 0
              ? <div style={{ color: '#16a34a', fontWeight: 600, fontSize: 14 }}>✅ No active anomalies</div>
              : anomalies.filter((a: any) => !a.resolved).map((a: any) => (
                <div key={a.id} className={`alert alert-${a.severity}`}>
                  <span className="alert-icon">⚠</span>
                  <div>
                    <strong style={{ textTransform: 'capitalize', fontSize: 13 }}>{a.anomaly_type.replace(/_/g,' ')}</strong>
                    <p style={{ fontSize: 12, marginTop: 2 }}>{a.description}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Chain of Custody Tab ── */
function CustodyTab({ handoffs }: { handoffs: any[] }) {
  return (
    <div className="card">
      <div className="card-body">
        {handoffs.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">🔗</div><p>No handoffs recorded</p></div>
          : (
            <div className="timeline">
              {handoffs.map((h: any, i: number) => (
                <div key={h.id} className="timeline-item">
                  <div className={`timeline-dot ${i === handoffs.length - 1 ? 'blue' : 'green'}`} />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <div>
                        <div className="timeline-title">Handoff #{h.sequence} — {h.from_party} → {h.to_party}</div>
                        <div className="timeline-meta">
                          <span>📍 {h.location}</span>
                          {h.temp_min != null && <span>🌡 {h.temp_min}°C – {h.temp_max}°C</span>}
                          {h.humidity != null && <span>💧 {h.humidity?.toFixed(0)}% RH</span>}
                        </div>
                      </div>
                      <div className="timeline-time">{new Date(h.timestamp).toLocaleString()}</div>
                    </div>
                    {h.notes && <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{h.notes}</p>}
                    <div className="timeline-hash">
                      <span style={{ color: '#94a3b8' }}>hash: </span>{h.handoff_hash}
                    </div>
                    <div className="timeline-hash" style={{ marginTop: 2 }}>
                      <span style={{ color: '#94a3b8' }}>prev: </span>{h.prev_hash}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

/* ── Documents Tab ── */
function DocumentsTab({ documents, shipmentId, onRefresh }: any) {
  const [verifyDoc, setVerifyDoc] = useState<any>(null)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    setUploading(true)
    const form = new FormData()
    form.append('shipment_id', shipmentId)
    form.append('file', e.target.files[0])
    form.append('document_type', 'certificate')
    try {
      await documentsApi.upload(form)
      toast.success('Document uploaded')
      onRefresh()
    } catch { toast.error('Upload failed') }
    setUploading(false)
  }

  const handleVerify = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (!e.target.files?.[0]) return
    const form = new FormData()
    form.append('file', e.target.files[0])
    try {
      const res = await documentsApi.verify(docId, form)
      setVerifyResult(res.data)
    } catch { toast.error('Verification failed') }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Document Vault</span>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Upload Document'}
          <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.csv,.xml" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <div className="card-body">
        {verifyResult && (
          <div className={`alert ${verifyResult.match ? 'alert-low' : 'alert-critical'}`} style={{ marginBottom: 16 }}>
            <span>{verifyResult.match ? '✅' : '🚨'}</span>
            <div>
              <strong>{verifyResult.message}</strong>
              <div className="hash-compare">
                <div className={`hash-box ${verifyResult.match ? 'match' : 'mismatch'}`}>
                  <div className="hash-box-label">Original Hash</div>
                  <div className="hash-val">{verifyResult.original_hash}</div>
                </div>
                <div className={`hash-box ${verifyResult.match ? 'match' : 'mismatch'}`}>
                  <div className="hash-box-label">Computed Hash</div>
                  <div className="hash-val">{verifyResult.computed_hash}</div>
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setVerifyResult(null)}>Dismiss</button>
          </div>
        )}
        {documents.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">📄</div><p>No documents uploaded</p></div>
          : (
            <table>
              <thead><tr>
                <th>Document</th><th>Type</th><th>Hash</th><th>Status</th><th>Uploaded</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {documents.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.original_filename || d.filename}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{(d.file_size / 1024).toFixed(0)} KB</div>
                    </td>
                    <td><span className="badge badge-blue">{d.document_type || d.file_type}</span></td>
                    <td><span className="font-mono text-xs" style={{ color: '#64748b' }}>{d.content_hash.slice(0,16)}…</span></td>
                    <td>
                      {d.tampered
                        ? <span className="badge badge-red">🚨 Tampered</span>
                        : d.verified
                          ? <span className="badge badge-green">✓ Verified</span>
                          : <span className="badge badge-gray">Pending</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 11 }}>
                        🔍 Verify
                        <input type="file" hidden onChange={e => handleVerify(e, d.id)} />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

/* ── Sensors Tab ── */
function SensorsTab({ sensors, shipment }: any) {
  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {sensors.length > 0 && (() => {
          const latest = sensors[sensors.length - 1]
          return [
            { label: 'Temperature', value: `${latest.temperature?.toFixed(1)}°C`, alert: shipment.temp_max_required && latest.temperature > shipment.temp_max_required },
            { label: 'Humidity', value: `${latest.humidity?.toFixed(0)}%` },
            { label: 'Battery', value: `${latest.battery?.toFixed(0)}%`, alert: latest.battery < 20 },
            { label: 'Door', value: latest.door_open ? 'OPEN 🚨' : 'Closed ✓', alert: latest.door_open },
          ].map(({ label, value, alert }) => (
            <div key={label} className={`stat-card ${alert ? 'red' : 'blue'}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{value}</div>
            </div>
          ))
        })()}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Temperature History</span></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sensors.slice(-100)}>
              <XAxis dataKey="timestamp" tickFormatter={v => new Date(v).toLocaleTimeString()} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="°C" />
              <Tooltip labelFormatter={v => new Date(v).toLocaleString()} formatter={(v: any) => [`${(+v).toFixed(1)}°C`, 'Temp']} />
              {shipment.temp_max_required && <Area type="monotone" dataKey={() => shipment.temp_max_required} name="Max Allowed" stroke="#dc2626" strokeDasharray="4 2" fill="none" strokeWidth={1.5} />}
              <Area type="monotone" dataKey="temperature" name="Temperature" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ── Blockchain Tab ── */
function BlockchainTab({ shipmentId }: { shipmentId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    import('../api').then(({ default: api }) =>
      api.get(`/verify/${shipmentId}`).then(r => setLogs(r.data.blockchain_logs))
    )
  }, [shipmentId])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Blockchain Provenance Records</span>
        {logs.length > 0 && <span className="chain-badge">⛓ {logs.length} On-Chain Records</span>}
      </div>
      <div className="card-body">
        <table>
          <thead><tr><th>#</th><th>TX Hash</th><th>Block</th><th>Network</th><th>Status</th><th>Timestamp</th></tr></thead>
          <tbody>
            {logs.map((b: any, i: number) => (
              <tr key={b.id}>
                <td>{i + 1}</td>
                <td><div className="tx-hash" style={{ maxWidth: 200 }}>{b.tx_hash.slice(0, 20)}…</div></td>
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{b.block_number?.toLocaleString()}</td>
                <td><span className="badge badge-purple">{b.network}</span></td>
                <td><span className={`badge badge-${b.status === 'confirmed' ? 'green' : 'amber'}`}>{b.status}</span></td>
                <td style={{ fontSize: 12 }}>{new Date(b.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── AI Tab ── */
function AITab({ aiResult, anomalies, onRunAI }: any) {
  if (!aiResult) return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <p>No AI analysis yet</p>
          <button className="btn btn-primary mt-16" onClick={onRunAI}><Zap size={14} /> Run AI Analysis</button>
        </div>
      </div>
    </div>
  )

  const risks = [
    { label: 'Overall Risk', value: aiResult.risk_score, color: '#dc2626' },
    { label: 'Spoilage Risk', value: aiResult.spoilage_risk, color: '#f59e0b' },
    { label: 'Fraud Risk', value: aiResult.fraud_risk, color: '#7c3aed' },
    { label: 'Delay Risk', value: aiResult.delay_risk, color: '#0891b2' },
    { label: 'Theft Risk', value: aiResult.theft_risk, color: '#dc2626' },
    { label: 'Customs Risk', value: aiResult.customs_delay_risk, color: '#f59e0b' },
  ]

  return (
    <div className="grid-2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Risk Breakdown</span><span style={{ fontSize: 12, color: '#94a3b8' }}>Confidence: {aiResult.confidence.toFixed(1)}%</span></div>
          <div className="card-body">
            {risks.map(({ label, value, color }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{value.toFixed(1)}</span>
                </div>
                <div className="score-track" style={{ height: 7 }}>
                  <div className="score-fill" style={{ width: `${value}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Recommended Action</span></div>
          <div className="card-body">
            <div className={`alert ${aiResult.risk_score >= 75 ? 'alert-critical' : aiResult.risk_score >= 50 ? 'alert-high' : 'alert-low'}`}>
              <span>{aiResult.risk_score >= 75 ? '🚨' : aiResult.risk_score >= 50 ? '⚠️' : '✅'}</span>
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>{aiResult.recommended_action}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Top Risk Factors</span></div>
          <div className="card-body">
            {(aiResult.top_reasons || []).map((r: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#94a3b8', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ color: '#475569' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Map Tab ── */
function MapTab({ handoffs, center }: { handoffs: any[]; center: [number, number] }) {
  const positions: [number, number][] = handoffs.map(h => [h.lat, h.lng])
  return (
    <div className="card">
      <div className="card-body" style={{ padding: 0 }}>
        <div className="map-container">
          {typeof window !== 'undefined' && (
            <MapContainer center={center} zoom={3} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
              {positions.length > 1 && <Polyline positions={positions} color="#2563eb" weight={3} dashArray="6,4" />}
              {handoffs.map((h, i) => (
                <Marker key={h.id} position={[h.lat, h.lng]}>
                  <Popup>
                    <strong>#{h.sequence} {h.location}</strong><br />
                    {h.from_party} → {h.to_party}<br />
                    {h.temp_min}°C – {h.temp_max}°C
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  )
}
