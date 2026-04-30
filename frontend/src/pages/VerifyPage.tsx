import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { verifyApi } from '../api'
import {
  ShieldCheck, ShieldX, Search, CheckCircle2,
  AlertTriangle, XCircle, User, MapPin, Clock,
  FileCheck, Link2, Thermometer,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ── */
interface Handoff {
  id: string
  sequence: number
  from_party: string
  to_party: string
  location: string
  timestamp: string
  temp_min: number | null
  temp_max: number | null
  signed_by: string | null
  signer_role: string | null
  handoff_hash: string | null
  notes: string | null
}

interface Anomaly {
  id: string
  handoff_id: string | null
  anomaly_type: string
  severity: string
  description: string
  resolved: boolean
}

interface VerifyData {
  shipment_id: string
  name: string
  batch_no: string
  category: string
  origin: string
  destination: string
  status: string
  integrity_score: number
  freshness_score: number
  risk_score: number
  created_at: string
  eta: string | null
  consumer_safe: boolean
  verified_blockchain: boolean
  handoffs: Handoff[]
  documents: any[]
  blockchain_logs: any[]
  anomalies: Anomaly[]
}

/* ── Helpers ── */
type NodeState = 'ok' | 'warn' | 'breach'

function getHandoffState(h: Handoff, anomalies: Anomaly[]): NodeState {
  const related = anomalies.filter(a => a.handoff_id === h.id)
  if (related.some(a => a.severity === 'critical' || a.anomaly_type === 'chain_break')) return 'breach'
  if (related.some(a => a.severity === 'high')) return 'breach'
  if (related.some(a => a.severity === 'medium')) return 'warn'
  return 'ok'
}

const STATE_COLOR = { ok: '#16a34a', warn: '#d97706', breach: '#dc2626' }
const STATE_BG = { ok: '#f0fdf4', warn: '#fffbeb', breach: '#fff1f2' }
const STATE_BORDER = { ok: '#86efac', warn: '#fcd34d', breach: '#fca5a5' }

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */
export default function VerifyPage() {
  const { id: paramId } = useParams<{ id?: string }>()
  const [input, setInput] = useState(paramId || '')
  const [result, setResult] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    try {
      const res = await verifyApi.get(input.trim())
      setResult(res.data)
    } catch { toast.error('Shipment not found') }
    setLoading(false)
  }

  return (
    <div className="verify-page">
      {/* Hero / search */}
      <div className="verify-hero" style={{ padding: '80px 0 100px' }}>
        <div className="verify-container">
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div className="flex-center" style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.1)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <ShieldCheck size={32} color="#60a5fa" />
            </div>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 12, color: '#fff', letterSpacing: '-1px' }}>
            Verify Your Shipment
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 40, fontWeight: 400 }}>
            Enter your batch number to verify blockchain authenticity and cold chain history.
          </p>
          <form onSubmit={handleVerify} style={{ display: 'flex', gap: 0, maxWidth: 600, margin: '0 auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', borderRadius: 12, overflow: 'hidden' }}>
            <input
              className="form-input"
              style={{ flex: 1, height: 60, padding: '0 24px', background: '#fff', border: 'none', borderRadius: 0, fontSize: 16, color: '#0f172a' }}
              placeholder="e.g. BATCH-2026-X99 or shipment UUID"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" style={{ height: 60, padding: '0 32px', borderRadius: 0, fontSize: 16 }} disabled={loading}>
              {loading ? '...' : <Search size={20} />}
            </button>
          </form>
          {/* Demo shortcuts */}
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Pfizer Vaccine (Flagged)', id: '10000000-0000-0000-0000-000000000001' },
              { label: 'Mango Export (Clean)', id: '20000000-0000-0000-0000-000000000002' },
            ].map(d => (
              <button key={d.id}
                className="btn btn-ghost btn-sm"
                style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,.2)', fontSize: 12, background: 'rgba(255,255,255,0.05)' }}
                onClick={() => setInput(d.id)}
              >{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="verify-container">
        <div className="verify-content">
          {result && <VerifyResult data={result} onBack={() => setResult(null)} />}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Result view
══════════════════════════════════════════════════════════════ */
function VerifyResult({ data, onBack }: { data: VerifyData; onBack: () => void }) {
  const safe = data.consumer_safe

  // Find the first breach node in chain order
  const breachHandoff = data.handoffs
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .find(h => getHandoffState(h, data.anomalies) === 'breach') ?? null

  const breachAnomalies = breachHandoff
    ? data.anomalies.filter(a => a.handoff_id === breachHandoff.id)
    : []

  return (
    <div style={{ paddingBottom: 60 }}>

      {/* ── Trust status header ── */}
      <div className="card" style={{
        padding: 40, marginBottom: 24, textAlign: 'center',
        borderTop: `6px solid ${safe ? '#16a34a' : '#dc2626'}`,
      }}>
        <div className="flex-center" style={{ marginBottom: 20 }}>
          {safe ? (
            <div style={{ width: 80, height: 80, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={40} color="#16a34a" />
            </div>
          ) : (
            <div style={{ width: 80, height: 80, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldX size={40} color="#dc2626" />
            </div>
          )}
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: safe ? '#15803d' : '#dc2626' }}>
          {safe ? 'Authentic & Safe' : 'Security Warning'}
        </h2>
        <p className="text-secondary" style={{ fontSize: 16, marginBottom: 24 }}>
          {data.name} · Batch {data.batch_no}
        </p>
        <div className="flex-center gap-12">
          {data.verified_blockchain && <span className="chain-badge">Blockchain Verified</span>}
          <span className={`badge badge-${safe ? 'green' : 'red'}`} style={{ padding: '6px 16px', fontSize: 13 }}>
            {data.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ── Breach Point callout — only shown when chain is broken ── */}
      {breachHandoff && (
        <div style={{
          marginBottom: 24, padding: '20px 24px',
          background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
          border: '2px solid #fca5a5', borderRadius: 16,
          borderLeft: '6px solid #dc2626',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, background: '#dc2626', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <XCircle size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#991b1b', marginBottom: 4 }}>
                ⚠ Chain Integrity Broken
              </div>
              <div style={{ fontSize: 14, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 8 }}>
                <strong>Breach Point:</strong> {breachHandoff.location} — Handoff #{breachHandoff.sequence}
                {' · '}
                <strong>Actor:</strong>{' '}
                {breachHandoff.signed_by
                  ? `${breachHandoff.signed_by} (${breachHandoff.signer_role ?? 'unknown role'})`
                  : '⚠ Unsigned — no actor recorded'}
              </div>
              {breachAnomalies.length > 0 && (
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#991b1b' }}>
                  {breachAnomalies.map(a => (
                    <li key={a.id}>{a.description}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scores + quick checks ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Shipment Information</span></div>
          <div className="card-body">
            {[
              ['Batch Number', data.batch_no],
              ['Origin', data.origin],
              ['Destination', data.destination],
              ['Created', new Date(data.created_at).toLocaleDateString()],
              ['ETA', data.eta ? new Date(data.eta).toLocaleDateString() : '—'],
              ['Integrity Score', data.integrity_score.toFixed(1) + '/100'],
              ['Freshness Score', data.freshness_score.toFixed(1) + '/100'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Verification Checks</span></div>
          <div className="card-body">
            {[
              { label: 'Blockchain Integrity', ok: data.integrity_score > 90, label2: data.integrity_score > 90 ? 'Pass' : 'Warning', icon: Link2 },
              { label: 'Cold Chain Compliance', ok: data.freshness_score > 80, label2: data.freshness_score > 80 ? 'Pass' : 'Fail', icon: Thermometer },
              { label: 'Provenance History', ok: data.verified_blockchain, label2: data.verified_blockchain ? 'Authentic' : 'Unknown', icon: ShieldCheck },
              { label: 'Chain of Custody', ok: !breachHandoff, label2: breachHandoff ? 'BROKEN' : 'Intact', icon: breachHandoff ? XCircle : CheckCircle2 },
              { label: 'All Handoffs Signed', ok: data.handoffs.every(h => h.signed_by), label2: data.handoffs.every(h => h.signed_by) ? 'Yes' : 'Missing signatures', icon: User },
              { label: 'Documents Present', ok: data.documents.length > 0, label2: data.documents.length > 0 ? `${data.documents.length} docs` : 'None', icon: FileCheck },
            ].map(({ label, ok, label2, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-12" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="flex items-center gap-12">
                  <Icon size={14} color={ok ? '#16a34a' : '#dc2626'} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                </div>
                <span className={`badge badge-${ok ? 'green' : 'red'}`}>{label2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chain-of-Custody Timeline ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Chain of Custody Timeline</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{data.handoffs.length} handoffs recorded</span>
        </div>
        <div className="card-body" style={{ padding: '24px 28px' }}>
          {data.handoffs.length === 0 ? (
            <div className="alert alert-critical">
              <p>No handoffs recorded — the full custody chain is missing.</p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Vertical spine */}
              <div style={{
                position: 'absolute', left: 19, top: 24, bottom: 24,
                width: 2, background: 'linear-gradient(to bottom, #e2e8f0 0%, #e2e8f0 100%)',
                zIndex: 0,
              }} />

              {data.handoffs
                .slice()
                .sort((a, b) => a.sequence - b.sequence)
                .map((h, idx) => {
                  const state = getHandoffState(h, data.anomalies)
                  const related = data.anomalies.filter(a => a.handoff_id === h.id)
                  const isBreachPoint = breachHandoff?.id === h.id

                  return (
                    <div key={h.id} style={{ position: 'relative', paddingLeft: 52, marginBottom: idx < data.handoffs.length - 1 ? 24 : 0 }}>
                      {/* Circle node */}
                      <div style={{
                        position: 'absolute', left: 0, top: 14,
                        width: 40, height: 40, borderRadius: '50%',
                        background: STATE_BG[state],
                        border: `3px solid ${STATE_COLOR[state]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1,
                        boxShadow: isBreachPoint ? `0 0 0 4px ${STATE_BORDER[state]}` : 'none',
                      }}>
                        {state === 'ok' && <CheckCircle2 size={18} color={STATE_COLOR[state]} />}
                        {state === 'warn' && <AlertTriangle size={18} color={STATE_COLOR[state]} />}
                        {state === 'breach' && <XCircle size={18} color={STATE_COLOR[state]} />}
                      </div>

                      {/* Card */}
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: `2px solid ${isBreachPoint ? STATE_COLOR[state] : STATE_BORDER[state]}`,
                        background: isBreachPoint ? STATE_BG[state] : '#fff',
                        boxShadow: isBreachPoint ? `0 4px 16px ${STATE_BORDER[state]}` : '0 1px 3px rgba(0,0,0,0.04)',
                      }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                #{h.sequence} — {h.from_party} → {h.to_party}
                              </span>
                              {isBreachPoint && (
                                <span style={{
                                  fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
                                  background: '#dc2626', color: '#fff',
                                  padding: '2px 8px', borderRadius: 20,
                                }}>BREACH POINT</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={11} /> {h.location}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} /> {fmt(h.timestamp)}
                              </span>
                              {(h.temp_min != null || h.temp_max != null) && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Thermometer size={11} />
                                  {h.temp_min != null ? `${h.temp_min}°C` : '—'}
                                  {' – '}
                                  {h.temp_max != null ? `${h.temp_max}°C` : '—'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Signer chip */}
                          <div style={{
                            flexShrink: 0, padding: '6px 10px', borderRadius: 8,
                            background: h.signed_by ? '#f0fdf4' : '#fff1f2',
                            border: `1px solid ${h.signed_by ? '#86efac' : '#fca5a5'}`,
                            fontSize: 11, textAlign: 'right',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: h.signed_by ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                              <User size={11} />
                              {h.signed_by ?? 'Unsigned'}
                            </div>
                            {h.signer_role && (
                              <div style={{ color: '#64748b', marginTop: 2, textTransform: 'capitalize' }}>
                                {h.signer_role}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Anomalies */}
                        {related.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {related.map(a => (
                              <div key={a.id} style={{
                                fontSize: 12, padding: '6px 10px', borderRadius: 6,
                                background: a.severity === 'critical' || a.severity === 'high' ? '#fff1f2' : '#fffbeb',
                                border: `1px solid ${a.severity === 'critical' || a.severity === 'high' ? '#fca5a5' : '#fcd34d'}`,
                                color: a.severity === 'critical' || a.severity === 'high' ? '#991b1b' : '#92400e',
                              }}>
                                <strong style={{ textTransform: 'capitalize' }}>
                                  {a.anomaly_type.replace(/_/g, ' ')}
                                </strong>
                                {' — '}{a.description}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Hash */}
                        {h.handoff_hash && (
                          <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Link2 size={9} />
                            {h.handoff_hash.slice(0, 48)}…
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Documents ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Verified Certificates & Documents</span></div>
        <div className="card-body">
          {data.documents.length === 0
            ? <div className="alert alert-critical"><p>No documents found — this is a risk indicator</p></div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {data.documents.map((d: any) => (
                  <div key={d.id} style={{
                    padding: 14,
                    border: `1px solid ${d.tampered ? '#fca5a5' : '#86efac'}`,
                    borderRadius: 8,
                    background: d.tampered ? '#fff1f2' : '#f0fdf4',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{d.original_filename || d.filename}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.document_type}</span>
                      <a href={`http://localhost:8000/documents/${d.id}/download`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Download</a>
                    </div>
                    {d.blockchain_tx && (
                      <div style={{ marginBottom: 6, fontSize: 10, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Link2 size={9} /> Anchored on Chain
                      </div>
                    )}
                    <div style={{ color: '#64748b', marginBottom: 8, wordBreak: 'break-all', fontSize: 9, fontFamily: 'monospace' }}>
                      Hash: {d.content_hash.slice(0, 32)}…
                    </div>
                    {d.tampered
                      ? <span className="badge badge-red">Hash Mismatch (Tampered)</span>
                      : <span className="badge badge-green">Hash Verified (Authentic)</span>}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* ── Blockchain records ── */}
      {data.blockchain_logs.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Blockchain Records</span></div>
          <div className="card-body">
            {data.blockchain_logs.slice(0, 5).map((b: any) => (
              <div key={b.id} style={{ marginBottom: 10, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className={`badge badge-${b.status === 'confirmed' ? 'green' : 'amber'}`}>{b.status}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Block #{b.block_number?.toLocaleString()}</span>
                </div>
                <div className="tx-hash" style={{ fontSize: 10 }}>{b.tx_hash.slice(0, 48)}…</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button className="btn btn-ghost" onClick={onBack}>Verify Another Shipment</button>
      </div>
    </div>
  )
}
