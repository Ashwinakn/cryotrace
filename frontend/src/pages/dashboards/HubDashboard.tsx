import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ShieldCheck, Hash, Clock, PackageCheck } from 'lucide-react'
import { shipmentsApi } from '../../api'

export default function HubDashboard() {
  const [shipments, setShipments] = useState<any[]>([])

  useEffect(() => {
    shipmentsApi.list().then(res => setShipments(res.data)).catch(() => {})
  }, [])

  return (
    <div className="dashboard-layout">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Distributor Hub Dashboard</h1>
          <p>Scan shipments, verify documents, and check temperature logs</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-primary" onClick={() => alert('Scanner Open')}>📷 Scan Package QR</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Pending Arrivals & Verification</span></div>
            <div className="card-body">
              {shipments.slice(0, 4).map(s => (
                <div key={s.id} className="flex gap-4 align-center p-3 border-b border-gray-200">
                  <PackageCheck size={24} className="text-purple-500" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}><Hash size={12} className="inline mr-1" />{s.id.split('-')[0]}...</div>
                  </div>
                  <button className="btn btn-sm btn-outline">Verify Hash & Docs</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-2 gap-4">
            <div className="card">
              <div className="card-header"><span className="card-title">Tamper Checks</span></div>
              <div className="card-body flex-center flex-col text-center">
                <ShieldCheck size={48} className="text-green-500 mb-2" />
                <div style={{ fontWeight: 600 }}>All Clear</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>No physical tampering detected in the last 24 hours.</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Temperature In/Out</span></div>
              <div className="card-body flex-center flex-col text-center">
                <Clock size={48} className="text-blue-500 mb-2" />
                <div style={{ fontWeight: 600 }}>Auto-Synced</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Timestamps and Temp logs are auto-fetched from IoT tags at handoff.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Hub Locations & Incoming Shipments</span>
          </div>
          <div className="card-body" style={{ padding: 0, height: 400 }}>
            <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%', borderRadius: '0 0 8px 8px' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              {shipments.map(s => {
                const logs = s.sensor_logs || [];
                const lastLog = logs[logs.length - 1];
                if (lastLog && lastLog.lat && lastLog.lng) {
                  return (
                    <Marker key={s.id} position={[lastLog.lat, lastLog.lng]}>
                      <Popup>
                        <strong>{s.name}</strong><br/>
                        Incoming to Hub
                      </Popup>
                    </Marker>
                  )
                }
                return null;
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
