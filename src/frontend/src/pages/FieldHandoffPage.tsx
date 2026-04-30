/**
 * CryoTrace Field Handoff Page
 *
 * A purpose-built, minimal 3-step UI for non-technical actors:
 * warehouse staff, drivers, and customs agents.
 *
 * Designed for phone use, one-handed, in poor lighting conditions.
 * Works fully offline — queues the handoff and syncs when connectivity returns.
 *
 * Route: /field/:shipmentId  (no auth required for the handoff form itself,
 *         but shipment data requires auth — it gracefully degrades)
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Wifi, WifiOff, ChevronRight, RotateCcw, Thermometer } from 'lucide-react'
import toast from 'react-hot-toast'
import { offlineQueue } from '../lib/offlineQueue'
import { shipmentsApi, sensorsApi } from '../api'

type Step = 'scan' | 'check' | 'sign'
type Role = 'warehouse' | 'driver' | 'customs' | 'other'

const ROLE_LABELS: Record<Role, string> = {
  warehouse: '🏭 Warehouse',
  driver: '🚛 Driver',
  customs: '🛂 Customs Agent',
  other: '👤 Other',
}

export default function FieldHandoffPage() {
  const { shipmentId: paramId } = useParams<{ shipmentId?: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(paramId ? 'check' : 'scan')
  const [shipmentId, setShipmentId] = useState(paramId || '')
  const [shipment, setShipment] = useState<any>(null)
  const [latestSensor, setLatestSensor] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(offlineQueue.getPendingCount())
  const [submitted, setSubmitted] = useState(false)

  // Signer form state
  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState<Role>('warehouse')
  const [location, setLocation] = useState('')
  const [tempMin, setTempMin] = useState('')
  const [tempMax, setTempMax] = useState('')
  const [notes, setNotes] = useState('')
  const [flagged, setFlagged] = useState(false)

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); setPendingCount(offlineQueue.getPendingCount()) }
    const onOffline = () => setIsOnline(false)
    const onFlushed = () => {
      setPendingCount(offlineQueue.getPendingCount())
      toast.success('Offline handoffs synced!')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('offlineQueueFlushed', onFlushed)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('offlineQueueFlushed', onFlushed)
    }
  }, [])

  useEffect(() => {
    if (paramId) loadShipment(paramId)
  }, [paramId])

  const loadShipment = async (id: string) => {
    setLoading(true)
    try {
      const [sRes, snRes] = await Promise.all([
        shipmentsApi.get(id),
        sensorsApi.list(id, 1),
      ])
      setShipment(sRes.data)
      if (snRes.data.length > 0) setLatestSensor(snRes.data[snRes.data.length - 1])
      setStep('check')
    } catch {
      toast.error('Shipment not found. Check the ID and try again.')
    }
    setLoading(false)
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shipmentId.trim()) return
    await loadShipment(shipmentId.trim())
  }

  const isTempOk = latestSensor && shipment?.temp_min_required != null && shipment?.temp_max_required != null
    ? latestSensor.temperature >= shipment.temp_min_required && latestSensor.temperature <= shipment.temp_max_required
    : null

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast.error('Please enter your name before signing off.')
      return
    }
    if (!location.trim()) {
      toast.error('Please enter the handoff location.')
      return
    }

    const payload = {
      shipment_id: shipmentId,
      from_party: shipment?.destination ? 'Previous Custodian' : 'Unknown',
      to_party: `${ROLE_LABELS[signerRole].replace(/^\S+\s/, '')} — ${signerName}`,
      location: location,
      temp_min: tempMin ? parseFloat(tempMin) : latestSensor?.temperature ?? null,
      temp_max: tempMax ? parseFloat(tempMax) : latestSensor?.temperature ?? null,
      signed_by: signerName.trim(),
      signer_role: signerRole,
      notes: flagged
        ? `⚠️ FLAGGED BY ${signerName}: ${notes || 'Issue noted at handoff'}`
        : notes || null,
    }

    if (!isOnline) {
      offlineQueue.enqueue({
        url: '/handoffs',
        method: 'POST',
        body: payload,
        label: `Handoff at ${location} by ${signerName}`,
      })
      setPendingCount(offlineQueue.getPendingCount())
      toast('Saved offline. Will sync when connected.', { icon: '📡' })
      setSubmitted(true)
      return
    }

    try {
      const token = localStorage.getItem('ct_token')
      const res = await fetch('/api/handoffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(flagged ? '⚠️ Handoff recorded with flag' : '✅ Handoff recorded')
      setSubmitted(true)
    } catch {
      // Fall back to offline queue
      offlineQueue.enqueue({
        url: '/handoffs',
        method: 'POST',
        body: payload,
        label: `Handoff at ${location} by ${signerName}`,
      })
      setPendingCount(offlineQueue.getPendingCount())
      toast('Network error — saved offline. Will sync automatically.', { icon: '📡' })
      setSubmitted(true)
    }
  }

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{flagged ? '⚠️' : '✅'}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: flagged ? '#f59e0b' : '#16a34a', marginBottom: 8 }}>
            {flagged ? 'Issue Flagged' : 'Handoff Recorded'}
          </div>
          <div style={{ fontSize: 16, color: '#64748b', marginBottom: 40, lineHeight: 1.6 }}>
            {isOnline
              ? 'Your handoff has been saved to the blockchain record.'
              : 'Saved locally. Will sync to the system when connectivity returns.'}
          </div>
          {pendingCount > 0 && (
            <div style={{ ...styles.offlineBanner, marginBottom: 24 }}>
              <WifiOff size={16} /> {pendingCount} handoff(s) pending sync
            </div>
          )}
          <button style={styles.btnPrimary} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <button style={{ ...styles.btnGhost, marginTop: 12 }} onClick={() => {
            setSubmitted(false); setStep('scan'); setShipment(null); setShipmentId('')
          }}>
            Record Another Handoff
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>CryoTrace</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pendingCount > 0 && (
            <span style={styles.pendingBadge}>{pendingCount} pending</span>
          )}
          {isOnline
            ? <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><Wifi size={14} /> Online</span>
            : <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><WifiOff size={14} /> Offline</span>}
        </div>
      </div>

      {/* Step indicators */}
      <div style={styles.stepper}>
        {(['scan', 'check', 'sign'] as Step[]).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              ...styles.stepDot,
              background: step === s ? '#2563eb' : (
                ['scan', 'check', 'sign'].indexOf(step) > i ? '#16a34a' : '#e2e8f0'
              ),
              color: step === s || ['scan', 'check', 'sign'].indexOf(step) > i ? '#fff' : '#94a3b8',
            }}>{i + 1}</div>
            <span style={{ fontSize: 12, color: step === s ? '#2563eb' : '#94a3b8', fontWeight: step === s ? 700 : 400 }}>
              {s === 'scan' ? 'Identify' : s === 'check' ? 'Inspect' : 'Sign Off'}
            </span>
            {i < 2 && <ChevronRight size={14} color="#cbd5e1" />}
          </div>
        ))}
      </div>

      <div style={styles.body}>
        {/* ── Step 1: Identify ── */}
        {step === 'scan' && (
          <div>
            <div style={styles.sectionTitle}>Enter Shipment ID</div>
            <p style={styles.hint}>Scan the QR code on the package or type the batch number below.</p>
            <form onSubmit={handleScan}>
              <input
                style={styles.bigInput}
                placeholder="e.g. PFZ-2024-MUM-001 or UUID"
                value={shipmentId}
                onChange={e => setShipmentId(e.target.value)}
                autoFocus
              />
              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? 'Looking up...' : 'Find Shipment →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Inspect ── */}
        {step === 'check' && shipment && (
          <div>
            <div style={styles.sectionTitle}>{shipment.name}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              {shipment.origin} → {shipment.destination} · Batch: {shipment.batch_no}
            </div>

            {/* Temperature status — the most important indicator */}
            <div style={{
              ...styles.statusBlock,
              borderColor: isTempOk === false ? '#fca5a5' : isTempOk === true ? '#86efac' : '#e2e8f0',
              background: isTempOk === false ? '#fff1f2' : isTempOk === true ? '#f0fdf4' : '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Thermometer size={28} color={isTempOk === false ? '#dc2626' : isTempOk === true ? '#16a34a' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Current Temperature</div>
                  <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: isTempOk === false ? '#dc2626' : isTempOk === true ? '#16a34a' : '#0f172a' }}>
                    {latestSensor ? `${latestSensor.temperature.toFixed(1)}°C` : '--'}
                  </div>
                  {shipment.temp_min_required != null && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Required: {shipment.temp_min_required}°C – {shipment.temp_max_required}°C
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {isTempOk === true && <CheckCircle size={40} color="#16a34a" />}
                  {isTempOk === false && <XCircle size={40} color="#dc2626" />}
                </div>
              </div>
            </div>

            {isTempOk === false && (
              <div style={{ ...styles.alertBlock, borderColor: '#fca5a5', background: '#fff1f2' }}>
                <strong>⚠️ Temperature Breach Detected</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  This shipment is outside the required temperature range.
                  You can still accept it, but the system will flag this handoff for review.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Humidity', value: latestSensor ? `${latestSensor.humidity?.toFixed(0) ?? '--'}%` : '--' },
                { label: 'Battery', value: latestSensor ? `${latestSensor.battery?.toFixed(0) ?? '--'}%` : '--' },
                { label: 'Door', value: latestSensor?.door_open ? '🔓 Open' : '🔒 Sealed' },
                { label: 'Status', value: shipment.status.replace('_', ' ').toUpperCase() },
              ].map(item => (
                <div key={item.label} style={styles.metricBox}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <button style={styles.btnPrimary} onClick={() => setStep('sign')}>
              Proceed to Sign Off →
            </button>
            <button style={styles.btnGhost} onClick={() => { setStep('scan'); setShipment(null) }}>
              <RotateCcw size={14} /> Wrong shipment
            </button>
          </div>
        )}

        {/* ── Step 3: Sign Off ── */}
        {step === 'sign' && shipment && (
          <div>
            <div style={styles.sectionTitle}>Record Handoff</div>
            <p style={styles.hint}>Your name and role will be permanently recorded on this shipment's chain of custody.</p>

            <label style={styles.label}>Your Full Name *</label>
            <input
              style={styles.bigInput}
              placeholder="e.g. Ravi Kumar"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              autoFocus
            />

            <label style={styles.label}>Your Role *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {(Object.keys(ROLE_LABELS) as Role[]).map(role => (
                <button key={role} style={{
                  ...styles.roleBtn,
                  borderColor: signerRole === role ? '#2563eb' : '#e2e8f0',
                  background: signerRole === role ? '#eff6ff' : '#fff',
                  color: signerRole === role ? '#2563eb' : '#475569',
                }} onClick={() => setSignerRole(role)}>
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>

            <label style={styles.label}>Handoff Location *</label>
            <input
              style={styles.input}
              placeholder="e.g. Nairobi JKIA Customs Hall 3"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />

            <label style={styles.label}>Measured Temperature (°C) — optional</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              <input style={styles.input} type="number" placeholder="Min °C" value={tempMin} onChange={e => setTempMin(e.target.value)} />
              <input style={styles.input} type="number" placeholder="Max °C" value={tempMax} onChange={e => setTempMax(e.target.value)} />
            </div>

            <label style={styles.label}>Notes — optional</label>
            <textarea
              style={{ ...styles.input, height: 80, resize: 'vertical' }}
              placeholder="Any observations, seal numbers, vehicle plate, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            {/* Accept or Flag */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <button
                style={{ ...styles.btnAccept, opacity: flagged ? 0.5 : 1 }}
                onClick={() => { setFlagged(false); handleSubmit() }}
              >
                <CheckCircle size={22} />
                <span>Accept<br /><small>All good</small></span>
              </button>
              <button
                style={{ ...styles.btnFlag }}
                onClick={() => { setFlagged(true); handleSubmit() }}
              >
                <XCircle size={22} />
                <span>Flag Issue<br /><small>Record a problem</small></span>
              </button>
            </div>

            {!isOnline && (
              <div style={{ ...styles.offlineBanner, marginTop: 16 }}>
                <WifiOff size={14} /> You're offline — this handoff will sync when you reconnect.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Styles ── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
    maxWidth: 480,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 20px',
    background: '#fff',
    borderBottom: '1px solid #f1f5f9',
  },
  stepDot: {
    width: 26, height: 26, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
  },
  body: { padding: '24px 20px' },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 },
  bigInput: {
    width: '100%', boxSizing: 'border-box',
    padding: '16px', fontSize: 18, fontWeight: 600,
    border: '2px solid #e2e8f0', borderRadius: 12, marginBottom: 16,
    outline: 'none', background: '#fff',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '12px', fontSize: 15,
    border: '2px solid #e2e8f0', borderRadius: 10, marginBottom: 16,
    outline: 'none', background: '#fff',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 },
  btnPrimary: {
    width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12,
    cursor: 'pointer', marginBottom: 10,
  },
  btnGhost: {
    width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
    background: 'transparent', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: 12,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  roleBtn: {
    padding: '12px', fontSize: 14, fontWeight: 600,
    border: '2px solid', borderRadius: 10, cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnAccept: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '20px', fontSize: 16, fontWeight: 700,
    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12,
    cursor: 'pointer', textAlign: 'center',
  },
  btnFlag: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '20px', fontSize: 16, fontWeight: 700,
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12,
    cursor: 'pointer', textAlign: 'center',
  },
  statusBlock: {
    padding: '20px', borderRadius: 12, border: '2px solid',
    marginBottom: 20,
  },
  alertBlock: {
    padding: '14px', borderRadius: 10, border: '1px solid',
    marginBottom: 20, fontSize: 13,
  },
  metricBox: {
    padding: '14px', background: '#fff', borderRadius: 10,
    border: '1px solid #e2e8f0',
  },
  offlineBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', background: '#fef3c7',
    border: '1px solid #fcd34d', borderRadius: 8,
    fontSize: 13, color: '#92400e',
  },
  pendingBadge: {
    padding: '3px 8px', background: '#fef3c7', border: '1px solid #fcd34d',
    borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#92400e',
  },
}
