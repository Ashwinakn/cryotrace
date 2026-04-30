import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { ShieldCheck, Search, Users } from 'lucide-react'

export default function StakeholderLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('verify123')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Access Granted to Stakeholder Portal')
      navigate('/portal')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const demoAccounts = [
    { label: 'Retailer', email: 'retailer@example.com' },
    { label: 'Regulator (FDA)', email: 'fda@example.com' },
    { label: 'End Consumer', email: 'consumer@example.com' },
  ]

  return (
    <div className="login-page" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
      <div className="login-left" style={{ background: 'transparent' }}>
        <div style={{ maxWidth: 520, color: '#fff' }}>
          <div className="logo-mark" style={{ marginBottom: 32 }}>
            <div className="logo-icon" style={{ width: 48, height: 48, background: '#4f46e5' }}><ShieldCheck size={24} fill="#fff" /></div>
            <div>
              <div className="logo-text" style={{ fontSize: 24, color: '#fff' }}>CryoTrace Portal</div>
              <div className="logo-sub" style={{ color: '#a5b4fc' }}>Stakeholder Verification Access</div>
            </div>
          </div>
          <h1 className="login-hero-title" style={{ color: '#fff' }}>
            Independent<br />Transparency &<br />Provenance
          </h1>
          <p style={{ color: '#c7d2fe', fontSize: 16, lineHeight: 1.7, marginTop: 20 }}>
            Retailers, regulators, and consumers can independently verify the complete lifecycle of cold-chain shipments without relying on centralized records.
          </p>
          <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
            <div style={{ flex: 1, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Search size={24} color="#818cf8" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Cryptographic Proof</h3>
              <p style={{ fontSize: 12, color: '#a5b4fc', lineHeight: 1.6 }}>Verify the exact conditions and sign-offs of your delivery on the blockchain.</p>
            </div>
            <div style={{ flex: 1, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Users size={24} color="#34d399" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Decentralized Access</h3>
              <p style={{ fontSize: 12, color: '#a5b4fc', lineHeight: 1.6 }}>Public-facing portal ensures zero-trust architecture for supply chain actors.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right" style={{ background: '#fff', borderRadius: '32px 0 0 32px' }}>
        <div className="login-form">
          <h2 className="login-title">Stakeholder Login</h2>
          <p className="login-sub">Access the independent verification portal</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
            <div className="form-group">
              <label className="form-label">Stakeholder Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your.email@domain.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Access Token / Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 12, padding: '14px', fontSize: 15 }} disabled={loading}>
              {loading ? 'Authenticating…' : 'Secure Login'}
            </button>
          </form>

          <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Demo Stakeholder Personas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {demoAccounts.map(a => (
                <button key={a.email} className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  onClick={() => { setEmail(a.email); setPassword('verify123') }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{a.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.email}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <a href="/verify" style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>Continue as Anonymous Guest (Scan QR)</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
