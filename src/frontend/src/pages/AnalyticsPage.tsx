import { useEffect, useState } from 'react'
import { analyticsApi } from '../api'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<any[]>([])
  const [tempData, setTempData] = useState<any[]>([])
  const [monthly, setMonthly] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    analyticsApi.anomaliesTrend(30).then(r => setTrend(r.data))
    analyticsApi.tempExcursions(14).then(r => setTempData(r.data))
    analyticsApi.monthlyStats().then(r => setMonthly(r.data))
    analyticsApi.byCategory().then(r => setCategories(r.data))
  }, [])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Analytics & Intelligence</h1>
          <p>Deep visibility across your entire cold chain network</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Anomaly Trend (30 days)</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Anomalies" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Temperature Monitoring (14 days)</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} unit="°C" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="max_temp" name="Max °C" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg_temp" name="Avg °C" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="min_temp" name="Min °C" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Monthly Shipment Volume</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total" name="Total" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={2} />
                <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Shipments by Category</span></div>
          <div className="card-body">
            <table>
              <thead><tr><th>Category</th><th>Count</th><th>Share</th></tr></thead>
              <tbody>
                {categories.map((c: any) => {
                  const total = categories.reduce((s, x) => s + x.count, 0)
                  return (
                    <tr key={c.category}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.category.replace('_',' ')}</td>
                      <td>{c.count}</td>
                      <td>
                        <div className="score-bar">
                          <div className="score-track"><div className="score-fill blue" style={{ width: `${(c.count/total)*100}%`, background: '#2563eb' }} /></div>
                          <span className="score-num">{((c.count/total)*100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
