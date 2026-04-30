import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldCheck, Search, FileCheck, ArrowRight, Activity, Box } from 'lucide-react'
import { verifyApi } from '../api'
import toast from 'react-hot-toast'

export default function StakeholderPortal() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) return toast.error('Enter at least 2 characters')
    setSearching(true)
    try {
      const res = await verifyApi.search(query.trim())
      setResults(res.data)
      if (res.data.length === 0) toast('No shipments found matching that batch number', { icon: 'ℹ️' })
    } catch {
      toast.error('Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Portal Header */}
      <header style={{ background: '#0f172a', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck color="#4f46e5" size={28} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>Stakeholder Portal</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Independent Verification</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.name || 'Guest'}</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>{user?.company || 'External Auditor'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => { logout(); navigate('/portal/login') }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Verify Shipment Provenance</h1>
          <p style={{ fontSize: 16, color: '#475569', maxWidth: 600, margin: '0 auto' }}>
            Enter a Batch Number, Product Name, or scan a QR code to view the cryptographic audit trail, temperature history, and compliance certificates.
          </p>
        </div>

        {/* Search Box */}
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: 40 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: 16, top: 18 }} />
              <input 
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter Batch No (e.g., PFZ-2024-MUM-001)" 
                style={{ width: '100%', padding: '16px 16px 16px 48px', fontSize: 16, borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
            <button className="btn btn-primary" style={{ padding: '0 32px', fontSize: 15 }} disabled={searching}>
              {searching ? 'Searching...' : 'Lookup Ledger'}
            </button>
          </form>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 16 }}>Search Results ({results.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map(s => (
                <div key={s.id} style={{ background: '#fff', padding: '20px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} 
                  onClick={() => navigate(`/verify/${s.id}`)}
                  className="hover-card">
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box size={24} color="#64748b" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748b' }}>
                      <span><strong>Batch:</strong> {s.batch_no}</span>
                      <span><strong>Route:</strong> {s.origin.split(',')[0]} {'->'} {s.destination.split(',')[0]}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className={`badge badge-${s.status === 'delivered' ? 'green' : s.status === 'flagged' ? 'red' : 'blue'}`}>
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                  <ArrowRight size={20} color="#cbd5e1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features / Why Verify */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <FileCheck size={24} color="#16a34a" style={{ marginBottom: 12 }} />
            <h4 style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Cryptographic Document Verification</h4>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>All customs and quality certificates are hashed and anchored to Hyperledger Fabric. You can independently upload a document to verify its hash against the on-chain record.</p>
          </div>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Activity size={24} color="#ea580c" style={{ marginBottom: 12 }} />
            <h4 style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Continuous Temperature Logs</h4>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>View the continuous sensor data payload from the IoT tags. Any excursions outside the permitted range automatically flag the shipment and record the anomaly.</p>
          </div>
        </div>
      </div>
      
      <style>{`
        .hover-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          border-color: #cbd5e1 !important;
        }
      `}</style>
    </div>
  )
}
