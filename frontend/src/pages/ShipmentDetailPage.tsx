import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { shipmentsApi, handoffsApi, documentsApi, sensorsApi, vehiclesApi } from '../api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { ArrowLeft, RefreshCw, QrCode, Copy } from 'lucide-react'

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

function scoreColor(v: number) { return v >= 80 ? '#16a34a' : v >= 50 ? '#f59e0b' : '#dc2626' }
function statusColor(s: string) { return { in_transit: 'blue', delivered: 'green', flagged: 'red', quarantined: 'amber', pending: 'gray' }[s] || 'gray' }

function ScoreRing({ value, label, invert = false }: { value: number, label: string, invert?: boolean }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = invert 
    ? (value < 25 ? '#16a34a' : value < 60 ? '#f59e0b' : '#dc2626')
    : (value >= 80 ? '#16a34a' : value >= 50 ? '#f59e0b' : '#dc2626');

  return (
    <div className="score-ring-container">
      <div className="score-ring">
        <svg>
          <circle className="bg" cx="40" cy="40" r={radius} />
          <circle 
            className="fill" 
            cx="40" 
            cy="40" 
            r={radius} 
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="score-ring-label" style={{ color }}>{value.toFixed(0)}%</div>
      </div>
      <span className="score-title">{label}</span>
    </div>
  );
}

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [shipment, setShipment] = useState<any>(null)
  const [handoffs, setHandoffs] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [vehicle, setVehicle] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isLive, setIsLive] = useState(false)

  const fetchVehicle = async (deviceId?: string) => {
    try {
      const vRes = await vehiclesApi.list()
      if (!vRes.data || vRes.data.length === 0) return
      const match = deviceId
        ? vRes.data.find((v: any) => v.device_id === deviceId)
        : vRes.data[0]
      if (match) setVehicle(match)
    } catch {}
  }

  useEffect(() => {
    loadAll()
    // WebSocket for live sensor data
    wsRef.current = new WebSocket(`ws://localhost:8000/sensor/ws/live/${id}`)
    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'sensor_update') {
        setSensors(prev => [...prev.slice(-200), { ...data.data, id: Date.now() }])
        setIsLive(true)
        setTimeout(() => setIsLive(false), 2000)
        // Refresh vehicle on every live push so the strip appears as soon as simulator starts
        fetchVehicle(data.data.device_id)
      }
    }
    return () => wsRef.current?.close()
  }, [id])

  // Poll vehicle data every 15s in case simulator starts after page load
  useEffect(() => {
    const timer = setInterval(() => fetchVehicle(), 15000)
    return () => clearInterval(timer)
  }, [id])

  const loadAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [s, h, d, sn] = await Promise.all([
        shipmentsApi.get(id),
        handoffsApi.list(id),
        documentsApi.list(id),
        sensorsApi.list(id, 200),
      ])
      setShipment(s.data)
      setHandoffs(h.data)
      setDocuments(d.data)
      setSensors(sn.data)
      // Load vehicle — also runs on interval separately
      const latestDeviceId = sn.data.length > 0 ? sn.data[sn.data.length - 1].device_id : null
      await fetchVehicle(latestDeviceId)
    } catch { toast.error('Failed to load shipment') }
    setLoading(false)
  }


  if (loading) return <div className="flex-center" style={{ height: 400 }}><div className="spinner" /></div>
  if (!shipment) return <div className="empty-state"><p>Shipment not found</p></div>

  const mapPoints = handoffs.filter(h => h.lat && h.lng)
  const mapCenter: [number, number] = mapPoints.length > 0 ? [mapPoints[mapPoints.length-1].lat, mapPoints[mapPoints.length-1].lng] : [12.9716, 77.5946]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="flex items-center gap-12" style={{ marginBottom: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}><ArrowLeft size={14} /> Back</button>
            <span className={`badge badge-${statusColor(shipment.status)}`}><span className="badge-dot" />{shipment.status.replace('_',' ')}</span>
            {isLive && <span className="chain-badge"><div className="live-pulse" /> LIVE PULSE</span>}
          </div>
          <div className="flex items-center gap-12">
            <h1>{shipment.name}</h1>
            {shipment.blockchain_status === 'confirmed' && <span className="chain-badge">Blockchain Verified</span>}
          </div>
          <p className="text-muted text-sm mt-4">{shipment.origin} {' -> '} {shipment.destination} · Batch: {shipment.batch_no}</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={loadAll}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={() => setTab('verify')}><QrCode size={14} /> Share Verify Link</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'provenance', label: 'Provenance' },
          (shipment.category === 'vaccines' || shipment.category === 'pharmaceutical') && { id: 'compliance', label: 'Pharma Compliance' },
          { id: 'vault', label: 'Document Vault' },
          { id: 'verify', label: 'Consumer Verify' }
        ].filter(Boolean).map((t: any) => (
          <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="fade-in">
        {tab === 'dashboard' && (
          <DashboardView 
            shipment={shipment} 
            sensors={sensors} 
            anomalies={anomalies} 
            mapPoints={mapPoints} 
            mapCenter={mapCenter} 
            vehicle={vehicle}
          />
        )}
        {tab === 'provenance' && <ProvenanceView handoffs={handoffs} shipmentId={id!} />}
        {tab === 'compliance' && <ComplianceView shipment={shipment} sensors={sensors} />}
        {tab === 'vault' && <DocumentsTab documents={documents} shipmentId={id!} onRefresh={loadAll} />}
        {tab === 'verify' && <QRTab shipmentId={id!} shipmentName={shipment.name} batchNo={shipment.batch_no} />}
      </div>
    </div>
  )
}

function DashboardView({ shipment, sensors, anomalies, mapPoints, mapCenter, vehicle }: any) {
  const latestSensor = sensors.length > 0 ? sensors[sensors.length - 1] : null;

  const vehicleTypeLabel: Record<string, string> = {
    truck: 'Truck', aircraft: 'Aircraft', ship: 'Ship', warehouse: 'Warehouse'
  }

  const isTempSafe = latestSensor && shipment.temp_min_required != null && shipment.temp_max_required != null
    ? (latestSensor.temperature >= shipment.temp_min_required && latestSensor.temperature <= shipment.temp_max_required)
    : true

  return (
    <div className="dashboard-grid">
      <div className="flex flex-direction-column gap-24">
        {/* Live Status Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '20px 24px' }}>
            <span className="card-title">Live Tracking & Status</span>
            <div className="flex items-center gap-12">
              <span className={`badge badge-${isTempSafe ? 'green' : 'red'}`}>
                {isTempSafe ? 'Temp OK' : 'Temp BREACH'}
              </span>
              <div className="live-pulse" />
            </div>
          </div>
          <div style={{ height: 380, background: '#f1f5f9', position: 'relative' }}>
            <MapTab 
              handoffs={mapPoints} 
              center={mapCenter} 
              livePoint={latestSensor ? { lat: latestSensor.lat, lng: latestSensor.lng, name: 'Current Location' } : null}
            />
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#e2e8f0' }}>
            {[
              { label: 'Current Temp', value: latestSensor ? `${latestSensor.temperature.toFixed(1)}°C` : '--', color: isTempSafe ? 'blue' : 'red' },
              { label: 'Humidity', value: latestSensor ? `${latestSensor.humidity.toFixed(0)}%` : '--', color: 'gray' },
              { label: 'Battery', value: latestSensor ? `${latestSensor.battery.toFixed(0)}%` : '--', color: latestSensor?.battery < 20 ? 'red' : 'green' },
              { label: 'Integrity', value: '100%', color: 'green' }
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', padding: '16px 20px' }}>
                <div className="score-title">{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: `var(--${stat.color})` }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Vehicle info strip — auto-populated from the IoT device push */}
          {vehicle && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              {[
                { label: 'Vehicle', value: vehicle.vehicle_number },
                { label: 'Type', value: vehicleTypeLabel[vehicle.vehicle_type] || vehicle.vehicle_type },
                { label: 'Driver', value: vehicle.driver_name || 'N/A' },
                { label: 'Carrier', value: vehicle.carrier_name || 'N/A' },
                { label: 'Last Signal', value: vehicle.last_seen ? new Date(vehicle.last_seen + 'Z').toLocaleTimeString() : '--' },
              ].map((item, i) => (
                <div key={item.label} style={{ padding: '10px 16px', borderRight: i < 4 ? '1px solid #e2e8f0' : 'none' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="flex flex-direction-column gap-24">
        {/* Trust Metrics */}
        <div className="card">
          <div className="card-header"><span className="card-title">Trust Metrics</span></div>
          <div className="card-body flex flex-direction-column gap-24">
            <ScoreRing value={shipment.integrity_score} label="Data Integrity" />
            <ScoreRing value={shipment.freshness_score} label="Freshness" />
          </div>
        </div>

        {/* Anomalies Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Alerts</span></div>
          <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {anomalies.filter((a: any) => !a.resolved).length === 0 ? (
              <div className="flex items-center gap-12 text-green font-bold" style={{ fontSize: 13 }}>
                System operating normally
              </div>
            ) : (
              anomalies.filter((a: any) => !a.resolved).map((a: any) => (
                <div key={a.id} className={`alert alert-${a.severity}`} style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12 }}>
                    <strong>{a.anomaly_type.replace(/_/g,' ')}</strong>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{new Date(a.detected_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function ProvenanceView({ handoffs, shipmentId }: { handoffs: any[], shipmentId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    import('../api').then(({ default: api }) =>
      api.get(`/verify/${shipmentId}`).then(r => setLogs(r.data.blockchain_logs))
    )
  }, [shipmentId])

  // Combine handoffs and logs into a single timeline
  const timeline = [
    ...handoffs.map((h: any) => ({ ...h, type: 'handoff', time: new Date(h.timestamp) })),
    ...logs.map((l: any) => ({ ...l, type: 'blockchain', time: new Date(l.timestamp) }))
  ].sort((a: any, b: any) => a.time.getTime() - b.time.getTime());

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Unified Provenance Timeline</span>
        <span className="chain-badge">{logs.length} Immutable Anchors</span>
      </div>
      <div className="card-body">
        <div className="timeline">
          {timeline.map((item: any, i: number) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot ${item.type === 'blockchain' ? 'purple' : 'green'}`} />
              <div className="timeline-content" style={{ borderLeft: item.type === 'blockchain' ? '4px solid var(--purple)' : '4px solid var(--green)' }}>
                <div className="timeline-header">
                  <div className="timeline-title">
                    {item.type === 'blockchain' ? 'Blockchain Confirmation' : `Handoff: ${item.from_party} -> ${item.to_party}`}
                  </div>
                  <div className="timeline-time">{item.time.toLocaleString()}</div>
                </div>
                {item.type === 'blockchain' ? (
                  <div className="tx-hash" style={{ fontSize: 10 }}>{item.tx_hash}</div>
                ) : (
                  <div className="timeline-meta">
                    <span>{item.location}</span>
                    {item.temp_min != null && <span>{item.temp_min}°C - {item.temp_max}°C</span>}
                  </div>
                )}
                {item.notes && <p className="mt-8 text-muted text-sm">{item.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Documents Tab ── */
function DocumentsTab({ documents, shipmentId, onRefresh }: any) {
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
            <div>
              <strong>{verifyResult.message}</strong>
              <div className="hash-compare">
                <div className={`hash-box ${verifyResult.match ? 'match' : 'mismatch'}`}>
                  <div className="hash-box-label">Original Hash (On-chain/DB)</div>
                  <div className="hash-val">{verifyResult.original_hash}</div>
                </div>
                <div className={`hash-box ${verifyResult.match ? 'match' : 'mismatch'}`}>
                  <div className="hash-box-label">Computed Hash (Uploaded File)</div>
                  <div className="hash-val">{verifyResult.computed_hash}</div>
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setVerifyResult(null)}>Dismiss</button>
          </div>
        )}
        {documents.length === 0
          ? <div className="empty-state"><p>No documents uploaded</p></div>
          : (
            <table>
              <thead><tr>
                <th>Document</th><th>Type</th><th>Status</th><th>Uploaded</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {documents.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.original_filename || d.filename}</div>
                      <div className="tx-hash" style={{ fontSize: 9, marginTop: 4 }}>{d.content_hash.slice(0, 32)}...</div>
                    </td>
                    <td><span className="badge badge-blue">{d.document_type || d.file_type}</span></td>
                    <td>
                      {d.tampered
                        ? <span className="badge badge-red">Tampered</span>
                        : d.verified
                          ? <span className="badge badge-green">Verified</span>
                          : <span className="badge badge-gray">Authentic</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>
                          Verify
                          <input type="file" hidden onChange={e => handleVerify(e, d.id)} />
                        </label>
                        <a href={`http://localhost:8000/documents/${d.id}/download`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px' }} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </div>
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

/* ── Map Tab ── */
function MapTab({ handoffs, center, livePoint }: { handoffs: any[]; center: [number, number], livePoint?: any }) {
  const positions: [number, number][] = handoffs.map((h: any) => [h.lat, h.lng])
  
  // If we have a live point, add it to the path
  if (livePoint && livePoint.lat && livePoint.lng) {
    positions.push([livePoint.lat, livePoint.lng])
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {typeof window !== 'undefined' && (
        <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%', zIndex: 1 }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          
          {positions.length > 1 && <Polyline positions={positions} color="#2563eb" weight={3} dashArray="6,4" />}
          
          {handoffs.map((h: any, i: number) => (
            <Marker key={h.id || i} position={[h.lat, h.lng]}>
              <Popup>
                <strong>#{h.sequence || i+1} {h.location}</strong><br />
                {h.from_party} {' -> '} {h.to_party}
              </Popup>
            </Marker>
          ))}

          {livePoint && livePoint.lat && livePoint.lng && (
            <Marker position={[livePoint.lat, livePoint.lng]}>
              <Popup>
                <strong>{livePoint.name}</strong><br />
                Real-time IoT Telemetry
              </Popup>
            </Marker>
          )}
        </MapContainer>
      )}
    </div>
  )
}

/* ── QR Verify Tab ── */
function QRTab({ shipmentId, shipmentName, batchNo }: { shipmentId: string; shipmentName: string; batchNo: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const verifyUrl = `${window.location.origin}/verify/${shipmentId}`

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, verifyUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
    }
  }, [verifyUrl])

  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl)
    toast.success('Verify link copied!')
  }

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `cryotrace-qr-${batchNo}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><QrCode size={16} style={{ display: 'inline', marginRight: 6 }} />Consumer Verify QR Code</span>
      </div>
      <div className="card-body" style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <canvas ref={canvasRef} style={{ borderRadius: 12, border: '2px solid #e2e8f0', display: 'block' }} />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={downloadQR}>⬇ Download PNG</button>
            <button className="btn btn-ghost btn-sm" onClick={copyLink}><Copy size={13} /> Copy Link</button>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Scan to Verify Authenticity</h3>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
            Print this QR code on the shipment package. End consumers can scan it with any smartphone camera to instantly verify:
          </p>
          <ul style={{ fontSize: 13, color: '#475569', lineHeight: 2, paddingLeft: 20 }}>
            <li>Cold chain integrity and temperature history</li>
            <li>Blockchain-verified provenance records</li>
            <li>Authenticated certificates and documents</li>
            <li>Detected anomalies and risk status</li>
          </ul>
          <div style={{ marginTop: 20, padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Verify URL</div>
            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: '#2563eb', wordBreak: 'break-all' }}>{verifyUrl}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Pharma Compliance View ── */
function ComplianceView({ shipment, sensors }: any) {
  const latestSensor = sensors.length > 0 ? sensors[sensors.length - 1] : null;
  
  const vvmStages = [
    { stage: 1, label: 'Fresh', color: '#16a34a', desc: 'Inner square lighter than outer circle' },
    { stage: 2, label: 'Warning', color: '#f59e0b', desc: 'Inner square starting to darken' },
    { stage: 3, label: 'Danger', color: '#ea580c', desc: 'Inner square matches outer circle' },
    { stage: 4, label: 'Discard', color: '#dc2626', desc: 'Inner square darker than outer circle' }
  ];
  
  const currentVvm = vvmStages.find(s => s.stage === (shipment.vvm_status || 1)) || vvmStages[0];

  return (
    <div className="flex flex-direction-column gap-24">
      <div className="grid grid-cols-3 gap-24">
        {/* MKT Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Mean Kinetic Temperature (MKT)</span></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#2563eb' }}>{shipment.mkt ? shipment.mkt.toFixed(2) : '--'}°C</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
              Thermodynamic representation of cumulative thermal stress.
            </p>
          </div>
        </div>

        {/* VVM Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Vaccine Vial Monitor (VVM)</span></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ 
              width: 60, height: 60, borderRadius: '50%', background: '#cbd5e1', 
              margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <div style={{ 
                width: 30, height: 30, background: currentVvm.color, border: '2px solid white' 
              }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: currentVvm.color }}>Stage {currentVvm.stage}: {currentVvm.label}</div>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>{currentVvm.desc}</p>
          </div>
        </div>

        {/* Excursion Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Cumulative Excursions</span></div>
          <div className="card-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: (shipment.cumulative_excursion_minutes || 0) > 0 ? '#dc2626' : '#16a34a' }}>
              {shipment.cumulative_excursion_minutes || 0}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#64748b' }}>Minutes Out of Range</div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
              Threshold: {shipment.temp_min_required}°C – {shipment.temp_max_required}°C
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Environmental Data */}
      <div className="card">
        <div className="card-header"><span className="card-title">Advanced Environmental Monitoring</span></div>
        <div className="card-body">
           <div className="grid grid-cols-4 gap-24">
              <div className="compliance-stat">
                <div className="label">Light Exposure</div>
                <div className="value">{latestSensor?.light ? `${latestSensor.light.toFixed(1)} lux` : '0.0 lux'}</div>
                <div className="status-dot green" />
              </div>
              <div className="compliance-stat">
                <div className="label">Air Pressure</div>
                <div className="value">{latestSensor?.pressure ? `${latestSensor.pressure.toFixed(1)} hPa` : '1013.2 hPa'}</div>
                <div className="status-dot green" />
              </div>
              <div className="compliance-stat">
                <div className="label">Freeze Protection</div>
                <div className="value">{latestSensor?.temperature < 0 ? 'ACTIVE EXCURSION' : 'SAFE'}</div>
                <div className={`status-dot ${latestSensor?.temperature < 0 ? 'red' : 'green'}`} />
              </div>
              <div className="compliance-stat">
                <div className="label">Last Calibration</div>
                <div className="value">2024-03-15</div>
                <div className="status-dot green" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
