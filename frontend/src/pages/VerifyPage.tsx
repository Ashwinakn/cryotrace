import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { verifyApi } from '../api'
import { ShieldCheck, ShieldX, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VerifyPage() {
  const { id: paramId } = useParams<{ id?: string }>()
  const [input, setInput] = useState(paramId || '')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
      <div className="verify-hero">
        <div className="verify-container" style={{ color: '#fff' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <ShieldCheck size={48} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>CryoTrace Verify Portal</h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32 }}>
            Verify the authenticity and cold chain integrity of any shipment
          </p>
          <form onSubmit={handleVerify} style={{ display: 'flex', gap: 12, maxWidth: 540, margin: '0 auto' }}>
            <input
              className="form-input"
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff' }}
              placeholder="Enter Shipment ID or Batch Number…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={loading}>
              <Search size={15} /> {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          {/* Demo shortcuts */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Pfizer Vaccine (Flagged)', id: '10000000-0000-0000-0000-000000000001' },
              { label: 'Mango Export (Clean)', id: '20000000-0000-0000-0000-000000000002' },
              { label: 'Hepatitis Vaccine (Quarantined)', id: '30000000-0000-0000-0000-000000000003' },
            ].map(d => (
              <button key={d.id} className="btn btn-ghost btn-sm" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,.2)', fontSize: 12 }}
                onClick={() => { setInput(d.id); }}>
                {d.label}
              </button>
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

function VerifyResult({ data, onBack }: { data: any; onBack: () => void }) {
  const safe = data.consumer_safe
  const blockchain = data.verified_blockchain

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Trust Banner */}
      <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 20, border: `2px solid ${safe ? '#86efac' : '#fca5a5'}`, background: safe ? '#f0fdf4' : '#fff1f2' }}>
        {safe ? <ShieldCheck size={52} color="#16a34a" style={{ margin: '0 auto 12px' }} /> : <ShieldX size={52} color="#dc2626" style={{ margin: '0 auto 12px' }} />}
        <h2 style={{ fontSize: 26, fontWeight: 800, color: safe ? '#15803d' : '#dc2626', marginBottom: 6 }}>
          {safe ? '✅ Verified — Safe for Consumer' : '🚨 FLAGGED — Issues Detected'}
        </h2>
        <p style={{ color: '#475569', fontSize: 14 }}>{data.name}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {blockchain && <span className="chain-badge">⛓ Blockchain Verified</span>}
          <span className={`badge badge-${safe ? 'green' : 'red'}`}>{data.status.replace('_',' ')}</span>
          <span className="badge badge-blue">{data.category}</span>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Shipment Info */}
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

        {/* Blockchain Records */}
        <div className="card">
          <div className="card-header"><span className="card-title">Blockchain Records</span></div>
          <div className="card-body">
            {data.blockchain_logs.slice(0, 4).map((b: any) => (
              <div key={b.id} style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className={`badge badge-${b.status === 'confirmed' ? 'green' : 'amber'}`}>{b.status}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Block #{b.block_number?.toLocaleString()}</span>
                </div>
                <div className="tx-hash" style={{ fontSize: 10 }}>{b.tx_hash.slice(0, 42)}…</div>
              </div>
            ))}
            {data.blockchain_logs.length === 0 && <div className="empty-state" style={{ padding: 20 }}>No blockchain records</div>}
          </div>
        </div>
      </div>

      {/* Certificates */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Verified Certificates & Documents</span></div>
        <div className="card-body">
          {data.documents.length === 0
            ? <div className="alert alert-critical"><span>🚨</span><p>No documents found — this is a risk indicator</p></div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {data.documents.map((d: any) => (
                  <div key={d.id} style={{ padding: 14, border: `1px solid ${d.tampered ? '#fca5a5' : '#86efac'}`, borderRadius: 8, background: d.tampered ? '#fff1f2' : '#f0fdf4' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{d.original_filename || d.filename}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{d.document_type}</div>
                    {d.tampered
                      ? <span className="badge badge-red">🚨 Tampered</span>
                      : <span className="badge badge-green">✓ Verified</span>}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Detected Issues</span></div>
          <div className="card-body">
            {data.anomalies.map((a: any) => (
              <div key={a.id} className={`alert alert-${a.severity}`} style={{ marginBottom: 8 }}>
                <span>{a.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <div>
                  <strong style={{ textTransform: 'capitalize' }}>{a.anomaly_type.replace(/_/g,' ')}</strong>
                  <p style={{ fontSize: 12, marginTop: 2 }}>{a.description}</p>
                </div>
                <span className={`badge badge-${a.resolved ? 'green' : a.severity === 'critical' ? 'red' : 'amber'}`}>
                  {a.resolved ? 'Resolved' : a.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button className="btn btn-ghost" onClick={onBack}>← Verify Another Shipment</button>
      </div>
    </div>
  )
}
