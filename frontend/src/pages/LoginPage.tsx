import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@cryotrace.io')
  const [password, setPassword] = useState('cryotrace123')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back to CryoTrace')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const demoAccounts = [
    { label: 'Vendor', email: 'vendor@cryotrace.io' },
    { label: 'Hub', email: 'hub@cryotrace.io' },
    { label: 'Customer', email: 'customer@cryotrace.io' },
  ]

  return (
    <div className="login-page">
      <div className="login-left">
        <div style={{ maxWidth: 520 }}>
          <div className="logo-mark" style={{ marginBottom: 32 }}>
            <div className="logo-icon" style={{ width: 48, height: 48, fontSize: 26 }}>❄️</div>
            <div>
              <div className="logo-text" style={{ fontSize: 24 }}>CryoTrace</div>
              <div className="logo-sub">Cold Chain Intelligence Platform</div>
            </div>
          </div>
          <h1 className="login-hero-title">
            End-to-End Cold Chain<br />Provenance & Fraud<br />Prevention
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7 }}>
            Blockchain-anchored chain-of-custody. AI-powered risk prediction.
            Real-time IoT monitoring. Regulatory-grade audit trails.
          </p>
          <ul className="login-features">
            {[
              '🔗 Immutable SHA-256 hash chain per handoff',
              '🤖 XGBoost + Isolation Forest risk engine',
              '📡 Live IoT sensor monitoring & alerts',
              '⛓️ Hyperledger Fabric provenance records',
              '🌍 WHO / FDA / EU regulatory compliance',
              '📊 Predictive spoilage & fraud detection',
            ].map(f => (
              <li key={f} className="login-feature">{f}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form">
          <h2 className="login-title">Sign in</h2>
          <p className="login-sub">Access your CryoTrace workspace</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in to CryoTrace →'}
            </button>
          </form>

          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Demo accounts (password: cryotrace123)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {demoAccounts.map(a => (
                <button key={a.email} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                  onClick={() => { setEmail(a.email); setPassword('cryotrace123') }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
