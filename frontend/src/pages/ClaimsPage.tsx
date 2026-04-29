import { useEffect, useState } from 'react'
import { shipmentsApi } from '../api'
import { FileText, Download } from 'lucide-react'

export default function ClaimsPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [report, setReport] = useState<any>(null)

  useEffect(() => {
    shipmentsApi.list({ status: 'flagged' }).then(r => setShipments(r.data)).catch(() => {})
    shipmentsApi.list({ status: 'quarantined' }).then(r => setShipments(prev => [...prev, ...r.data])).catch(() => {})
  }, [])

  const generateReport = async (id: string) => {
    setSelected(id)
    const [s, h, d, an] = await Promise.all([
      shipmentsApi.get(id),
      import('../api').then(m => m.handoffsApi.list(id)),
      import('../api').then(m => m.documentsApi.list(id)),
      import('../api').then(m => m.aiApi.anomalies({ shipment_id: id })),
    ])
    setReport({ shipment: s.data, handoffs: h.data, documents: d.data, anomalies: an.data })
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Insurance Claims Automation</h1>
          <p>Generate evidence packages for spoilage and fraud claims</p>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Eligible Shipments</span></div>
            <div className="card-body">
              {shipments.length === 0
                ? <div className="empty-state"><div className="empty-state-icon">📋</div><p>No flagged or quarantined shipments</p></div>
                : shipments.map((s: any) => (
                  <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name.slice(0, 40)}…</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.batch_no}</div>
                      <span className={`badge badge-${s.status === 'flagged' ? 'red' : 'amber'}`} style={{ marginTop: 4 }}>{s.status}</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => generateReport(s.id)}>
                      <FileText size={12} /> Generate Report
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div>
          {report && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Insurance Claim Report</span>
                <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                  <Download size={13} /> Export PDF
                </button>
              </div>
              <div className="card-body">
                <div className="section-title">Shipment Summary</div>
                {[
                  ['Product', report.shipment.name],
                  ['Batch', report.shipment.batch_no],
                  ['Route', `${report.shipment.origin} → ${report.shipment.destination}`],
                  ['Status', report.shipment.status],
                  ['Integrity', `${report.shipment.integrity_score}/100`],
                  ['Risk Score', `${report.shipment.risk_score}/100`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}

                <div className="section-title" style={{ marginTop: 16 }}>Confirmed Anomalies ({report.anomalies.length})</div>
                {report.anomalies.map((a: any) => (
                  <div key={a.id} className={`alert alert-${a.severity}`} style={{ marginBottom: 6 }}>
                    <span>{a.severity === 'critical' ? '🚨' : '⚠️'}</span>
                    <div>
                      <strong style={{ fontSize: 12, textTransform: 'capitalize' }}>{a.anomaly_type.replace(/_/g,' ')}</strong>
                      <p style={{ fontSize: 11, marginTop: 2 }}>{a.description}</p>
                    </div>
                  </div>
                ))}

                <div className="section-title" style={{ marginTop: 16 }}>Evidence Documents ({report.documents.length})</div>
                {report.documents.map((d: any) => (
                  <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{d.original_filename || d.filename}</span>
                    <span className={`badge badge-${d.tampered ? 'red' : 'green'}`}>{d.tampered ? 'Tampered' : 'Verified'}</span>
                  </div>
                ))}

                <div className="section-title" style={{ marginTop: 16 }}>Custody Chain ({report.handoffs.length} handoffs)</div>
                {report.handoffs.map((h: any) => (
                  <div key={h.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                    <strong>#{h.sequence}</strong> {h.from_party} → {h.to_party} — {h.location}
                    {h.temp_min != null && <span style={{ marginLeft: 8, color: '#94a3b8' }}>({h.temp_min}°C – {h.temp_max}°C)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
