import { useEffect, useState } from 'react'
import { shipmentsApi, analyticsApi } from '../api'
import { Leaf, Zap, Droplets, TreePine, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function ESGPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [esgData, setEsgData] = useState<Record<string, any>>({})
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      shipmentsApi.list({ limit: 20 }),
      analyticsApi.esgSummary(),
    ]).then(([s, sum]) => {
      const list = s.data
      setShipments(list)
      setSummary(sum.data)
      list.forEach((ship: any) => {
        analyticsApi.esg(ship.id)
          .then(e => setEsgData(prev => ({ ...prev, [ship.id]: e.data })))
          .catch(() => {})
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const summaryCards = summary ? [
    { label: 'Total CO₂ Emitted', value: `${(summary.total_co2_kg / 1000).toFixed(1)}t`, icon: Leaf, color: 'amber', sub: 'Tonnes CO₂ equivalent' },
    { label: 'Waste Prevented', value: `${(summary.total_waste_prevented_kg / 1000).toFixed(1)}t`, icon: Droplets, color: 'green', sub: 'Spoilage avoided' },
    { label: 'Refrigeration Energy', value: `${(summary.total_energy_kwh / 1000).toFixed(1)} MWh`, icon: Zap, color: 'blue', sub: 'Est. usage' },
    { label: 'Carbon Offset Trees', value: summary.total_carbon_offset_trees.toLocaleString(), icon: TreePine, color: 'green', sub: 'Trees equivalent' },
    { label: 'Avg Sustainability', value: `${summary.avg_sustainability_score.toFixed(1)}/100`, icon: BarChart3, color: summary.avg_sustainability_score >= 80 ? 'green' : 'amber', sub: 'Fleet-wide score' },
    { label: 'Cold Chain Compliance', value: `${summary.cold_chain_compliance_pct.toFixed(1)}%`, icon: Leaf, color: 'green', sub: `Across ${summary.shipments_tracked} shipments` },
  ] : []

  const chartData = shipments.map(s => ({
    name: s.batch_no,
    co2: esgData[s.id]?.estimated_co2_kg ?? 0,
    sustainability: esgData[s.id]?.sustainability_score ?? 0,
  }))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>ESG & Carbon Tracking</h1>
          <p>Environmental, Social, and Governance metrics for your cold chain</p>
        </div>
        <Leaf size={28} color="#16a34a" />
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: 300 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {summaryCards.map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className={`stat-card ${color}`}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-sub">{sub}</div>
                <Icon size={38} className="stat-icon" />
              </div>
            ))}
          </div>

          {/* CO2 Chart */}
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">CO₂ by Shipment (kg)</span></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.filter(d => d.co2 > 0).slice(0, 12)}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${(+v).toFixed(1)} kg`, 'CO₂']} />
                    <Bar dataKey="co2" radius={[4, 4, 0, 0]}>
                      {chartData.slice(0, 12).map((_, i) => (
                        <Cell key={i} fill={i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#16a34a' : '#2563eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Sustainability Scores</span></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.filter(d => d.sustainability > 0).slice(0, 12)}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${(+v).toFixed(1)}/100`, 'Sustainability']} />
                    <Bar dataKey="sustainability" radius={[4, 4, 0, 0]}>
                      {chartData.slice(0, 12).map((entry, i) => (
                        <Cell key={i} fill={entry.sustainability >= 80 ? '#16a34a' : entry.sustainability >= 50 ? '#f59e0b' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Shipment ESG Report</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Shipment</th><th>CO₂ (kg)</th><th>Energy (kWh)</th><th>Waste Prevented</th><th>Route Efficiency</th><th>Sustainability</th></tr></thead>
                <tbody>
                  {shipments.map((s: any) => {
                    const e = esgData[s.id]
                    return (
                      <tr key={s.id}>
                        <td><div style={{ fontWeight: 600, fontSize: 13 }}>{s.name.slice(0, 38)}…</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{s.batch_no}</div></td>
                        <td>{e ? e.estimated_co2_kg.toFixed(1) : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td>{e ? e.refrigeration_energy_kwh.toFixed(0) : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td>{e ? `${e.waste_prevented_kg.toFixed(1)} kg` : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                        <td>
                          {e ? (
                            <div className="score-bar" style={{ minWidth: 80 }}>
                              <div className="score-track"><div className="score-fill green" style={{ width: `${e.route_efficiency_pct}%` }} /></div>
                              <span className="score-num">{e.route_efficiency_pct.toFixed(0)}</span>
                            </div>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td>
                          {e ? (
                            <div className="score-bar" style={{ minWidth: 80 }}>
                              <div className="score-track"><div className={`score-fill ${e.sustainability_score >= 80 ? 'green' : e.sustainability_score >= 50 ? 'amber' : 'red'}`} style={{ width: `${e.sustainability_score}%` }} /></div>
                              <span className="score-num">{e.sustainability_score.toFixed(0)}</span>
                            </div>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
