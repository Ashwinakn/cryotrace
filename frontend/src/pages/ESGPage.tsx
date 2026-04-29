import { useEffect, useState } from 'react'
import { shipmentsApi, analyticsApi } from '../api'
import { Leaf } from 'lucide-react'

export default function ESGPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [esgData, setEsgData] = useState<Record<string, any>>({})

  useEffect(() => {
    shipmentsApi.list({ limit: 20 }).then(r => {
      setShipments(r.data)
      r.data.forEach((s: any) => {
        analyticsApi.esg(s.id).then(e => setEsgData(prev => ({ ...prev, [s.id]: e.data }))).catch(() => {})
      })
    })
  }, [])

  const totals = Object.values(esgData).reduce(
    (acc: any, e: any) => ({
      co2: acc.co2 + (e.estimated_co2_kg || 0),
      waste: acc.waste + (e.waste_prevented_kg || 0),
      energy: acc.energy + (e.refrigeration_energy_kwh || 0),
      trees: acc.trees + (e.carbon_offset_trees || 0),
    }),
    { co2: 0, waste: 0, energy: 0, trees: 0 }
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>ESG & Carbon Tracking</h1>
          <p>Environmental, Social, and Governance metrics for your cold chain</p>
        </div>
        <Leaf size={28} color="#16a34a" />
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total CO₂ Emitted', value: `${(totals.co2/1000).toFixed(1)}t`, color: 'amber', sub: 'kg CO₂ equivalent' },
          { label: 'Waste Prevented', value: `${totals.waste.toFixed(0)}kg`, color: 'green', sub: 'Spoilage avoided' },
          { label: 'Refrigeration Energy', value: `${(totals.energy/1000).toFixed(1)}MWh`, color: 'blue', sub: 'Estimated usage' },
          { label: 'Carbon Offset Trees', value: totals.trees.toLocaleString(), color: 'green', sub: 'Equivalent trees needed' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className={`stat-card ${color}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

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
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{s.name.slice(0, 40)}…</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{s.batch_no}</div></td>
                    <td>{e ? e.estimated_co2_kg.toFixed(1) : '—'}</td>
                    <td>{e ? e.refrigeration_energy_kwh.toFixed(0) : '—'}</td>
                    <td>{e ? `${e.waste_prevented_kg.toFixed(1)} kg` : '—'}</td>
                    <td>
                      {e ? (
                        <div className="score-bar" style={{ minWidth: 80 }}>
                          <div className="score-track"><div className="score-fill green" style={{ width: `${e.route_efficiency_pct}%` }} /></div>
                          <span className="score-num">{e.route_efficiency_pct.toFixed(0)}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      {e ? (
                        <div className="score-bar" style={{ minWidth: 80 }}>
                          <div className="score-track"><div className={`score-fill ${e.sustainability_score >= 80 ? 'green' : e.sustainability_score >= 50 ? 'amber' : 'red'}`} style={{ width: `${e.sustainability_score}%` }} /></div>
                          <span className="score-num">{e.sustainability_score.toFixed(0)}</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
