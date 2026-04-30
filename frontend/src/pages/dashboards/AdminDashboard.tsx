import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsApi, aiApi } from '../../api'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Package, Truck, CheckCircle, AlertTriangle,
  Shield, Activity, FileCheck, DollarSign, Zap, TrendingDown
} from 'lucide-react'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']

function ScoreBar({ value, className }: { value: number; className: string }) {
  return (
    <div className="score-bar">
      <div className="score-track">
        <div className={`score-fill ${className}`} style={{ width: `${value}%` }} />
      </div>
      <span className="score-num">{value.toFixed(0)}</span>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [monthly, setMonthly] = useState<any[]>([])
  const [tempData, setTempData] = useState<any[]>([])
  const [anomalies, setAnomalies] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard(),
      analyticsApi.anomaliesTrend(30),
      analyticsApi.byCategory(),
      analyticsApi.monthlyStats(),
      analyticsApi.tempExcursions(7),
      aiApi.anomalies({ resolved: false, limit: 5 }),
    ]).then(([s, t, c, m, te, an]) => {
      setStats(s.data)
      setTrend(t.data)
      setCategories(c.data)
      setMonthly(m.data)
      setTempData(te.data)
      setAnomalies(an.data)
    }).catch(() => {})
  }, [])

  if (!stats) return <div className="flex-center" style={{ height: 400 }}><div className="spinner" /></div>

  const statCards = [
    { label: 'Total Shipments', value: stats.total_shipments, icon: Package, color: 'blue', sub: 'All time' },
    { label: 'In Transit', value: stats.in_transit, icon: Truck, color: 'blue', sub: 'Active now' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'green', sub: 'Completed' },
    { label: 'Flagged', value: stats.flagged, icon: AlertTriangle, color: 'red', sub: 'Need review' },
    { label: 'Quarantined', value: stats.quarantined, icon: Shield, color: 'amber', sub: 'Held' },
    { label: 'Active Sensors', value: stats.active_sensors, icon: Activity, color: 'purple', sub: 'Live feeds' },
    { label: 'Verified Docs', value: stats.verified_docs, icon: FileCheck, color: 'green', sub: 'Authenticated' },
    { label: 'Revenue Protected', value: `$${(stats.revenue_protected_usd / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'green', sub: 'Est. value' },
    { label: 'Spoilage Prevented', value: `${stats.spoilage_prevented_pct.toFixed(1)}%`, icon: TrendingDown, color: 'green', sub: 'Avg freshness' },
    { label: 'Blockchain Verified', value: stats.blockchain_verified, icon: Zap, color: 'purple', sub: 'On-chain records' },
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Operations Dashboard</h1>
          <p>Real-time cold chain intelligence across all shipments</p>
        </div>
        <div className="flex gap-8">
          <span className="badge badge-green"><span className="badge-dot" />Live</span>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shipments')}>View All Shipments</button>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        {statCards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className={`stat-card ${color}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
            <Icon size={38} className="stat-icon" />
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Monthly Delivery Stats</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#dbeafe" radius={[4,4,0,0]} />
                <Bar dataKey="delivered" name="Delivered" fill="#2563eb" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Shipments by Category</span>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Temperature Excursions (7 days)</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tempData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="°C" />
                <Tooltip />
                <Area type="monotone" dataKey="max_temp" name="Max °C" stroke="#dc2626" fill="#fee2e2" strokeWidth={2} />
                <Area type="monotone" dataKey="avg_temp" name="Avg °C" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                <Area type="monotone" dataKey="min_temp" name="Min °C" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Anomaly Trend (30 days)</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Anomalies" fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Anomalies */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Anomalies</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shipments')}>View All</button>
        </div>
        <div className="card-body">
          {anomalies.length === 0
            ? <div className="empty-state"><p>No active anomalies</p></div>
            : anomalies.map((a: any) => (
              <div key={a.id} className={`alert alert-${a.severity}`} style={{ marginBottom: 8 }}>
                <div>
                  <strong style={{ textTransform: 'capitalize' }}>{a.anomaly_type.replace(/_/g, ' ')}</strong>
                  <p style={{ marginTop: 2, fontSize: 12 }}>{a.description}</p>
                </div>
                <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'amber' : 'blue'}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  {a.severity}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
