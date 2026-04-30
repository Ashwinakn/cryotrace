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
      <div className="verify-hero" style={{ padding: '80px 0 100px' }}>
        <div className="verify-container">
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div className="flex-center" style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.1)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
               <ShieldCheck size={32} color="#60a5fa" />
            </div>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 12, color: '#fff', letterSpacing: '-1px' }}>Verify Your Shipment</h1>
          <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 40, fontWeight: 400 }}>
            Enter your batch number to verify blockchain authenticity and cold chain history.
          </p>
          <form onSubmit={handleVerify} style={{ display: 'flex', gap: 0, maxWidth: 600, margin: '0 auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', borderRadius: 12, overflow: 'hidden' }}>
            <input
              className="form-input"
              style={{ flex: 1, height: 60, padding: '0 24px', background: '#fff', border: 'none', borderRadius: 0, fontSize: 16, color: '#0f172a' }}
              placeholder="e.g. BATCH-2026-X99"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" style={{ height: 60, padding: '0 32px', borderRadius: 0, fontSize: 16 }} disabled={loading}>
              {loading ? '...' : <Search size={20} />}
            </button>
          </form>          {/* Demo shortcuts */}
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Pfizer Vaccine (Flagged)', id: '10000000-0000-0000-0000-000000000001' },
              { label: 'Mango Export (Clean)', id: '20000000-0000-0000-0000-000000000002' },
            ].map(d => (
              <button key={d.id} className="btn btn-ghost btn-sm" style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,.2)', fontSize: 12, background: 'rgba(255,255,255,0.05)' }}
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
      {/* Trust Status Header */}
      <div className="card" style={{ padding: 40, marginBottom: 24, textAlign: 'center', borderTop: `6px solid ${safe ? '#16a34a' : '#dc2626'}` }}>
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
        <p className="text-secondary" style={{ fontSize: 16, marginBottom: 24 }}>{data.name} · Batch {data.batch_no}</p>
        
        <div className="flex-center gap-12">
          {blockchain && <span className="chain-badge">Blockchain Verified</span>}
          <span className={`badge badge-${safe ? 'green' : 'red'}`} style={{ padding: '6px 16px', fontSize: 13 }}>{data.status.replace('_',' ')}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="flex flex-direction-column gap-24">
          {/* Detailed Checks */}
          <div className="card">
            <div className="card-header"><span className="card-title">Verification Checks</span></div>
            <div className="card-body">
              {[
                { label: 'Blockchain Integrity', status: data.integrity_score > 90 ? 'Pass' : 'Warning' },
                { label: 'Cold Chain Compliance', status: data.freshness_score > 80 ? 'Pass' : 'Fail' },
                { label: 'Provenance History', status: data.verified_blockchain ? 'Authentic' : 'Unknown' },
              ].map(check => (
                <div key={check.label} className="flex items-center justify-between py-12" style={{ borderBottom: '1px solid #f1f5f9' }}>
                   <div className="flex items-center gap-12">
                     <span style={{ fontWeight: 600, fontSize: 14 }}>{check.label}</span>
                   </div>
                   <span className={`badge badge-${check.status === 'Pass' || check.status === 'Authentic' ? 'green' : 'red'}`}>{check.status}</span>
                </div>
              ))}
            </div>
          </div>
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
            ? <div className="alert alert-critical"><p>No documents found — this is a risk indicator</p></div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {data.documents.map((d: any) => (
                  <div key={d.id} style={{ padding: 14, border: `1px solid ${d.tampered ? '#fca5a5' : '#86efac'}`, borderRadius: 8, background: d.tampered ? '#fff1f2' : '#f0fdf4' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{d.original_filename || d.filename}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.document_type}</span>
                      <a href={`http://localhost:8000/documents/${d.id}/download`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Download</a>
                    </div>
                    {d.blockchain_tx && (
                      <div style={{ marginBottom: 8, fontSize: 10, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Anchored on Chain
                      </div>
                    )}
                    <div className="font-mono text-xs" style={{ color: '#64748b', marginBottom: 8, wordBreak: 'break-all', fontSize: 9 }}>
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

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Detected Issues</span></div>
          <div className="card-body">
            {data.anomalies.map((a: any) => (
              <div key={a.id} className={`alert alert-${a.severity}`} style={{ marginBottom: 8 }}>
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
        <button className="btn btn-ghost" onClick={onBack}>Verify Another Shipment</button>
      </div>
    </div>
  )
}
