import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Plus, AlertCircle, Thermometer } from 'lucide-react'
import { shipmentsApi, aiApi } from '../../api'

export default function VendorDashboard() {
  const [shipments, setShipments] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    shipmentsApi.list().then(res => setShipments(res.data)).catch(() => {})
    aiApi.anomalies({ limit: 5 }).then(res => setAlerts(res.data)).catch(() => {})
  }, [])

  return (
    <div className="dashboard-layout">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Vendor Dashboard</h1>
          <p>Manage products, create shipments, and monitor live temperatures</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={() => alert('Product UI')}>+ Add Product Details</button>
          <button className="btn btn-primary" onClick={() => alert('Create Shipment UI')}>+ Create Shipment</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Temperature Map (Hub-to-Hub)</span>
          </div>
          <div className="card-body" style={{ padding: 0, height: 400 }}>
            <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%', borderRadius: '0 0 8px 8px' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              {shipments.map(s => {
                const logs = s.sensor_logs || [];
                const lastLog = logs[logs.length - 1];
                const coords: [number, number][] = logs.filter((l: any) => l.lat && l.lng).map((l: any) => [l.lat, l.lng] as [number, number]);
                
                return (
                  <div key={s.id}>
                    {coords.length > 1 && <Polyline positions={coords} color="#2563eb" weight={2} />}
                    {lastLog && lastLog.lat && lastLog.lng && (
                      <Marker position={[lastLog.lat, lastLog.lng]}>
                        <Popup>
                          <strong>{s.name}</strong><br/>
                          Target Range: {s.temp_min_required}°C to {s.temp_max_required}°C<br/>
                          Current: {lastLog.temperature}°C
                        </Popup>
                      </Marker>
                    )}
                  </div>
                )
              })}
            </MapContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Live Alerts</span></div>
            <div className="card-body">
              {alerts.length === 0 ? <p>No active alerts.</p> : alerts.map(a => (
                <div key={a.id} className="flex gap-3 mb-3 pb-3 border-b border-gray-100">
                  <AlertCircle size={20} className="text-red-500" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.anomaly_type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">My Active Shipments</span></div>
            <div className="card-body">
              {shipments.slice(0, 3).map(s => (
                <div key={s.id} className="flex gap-4 align-center p-3 border-b border-gray-200">
                  <Box size={24} className="text-blue-500" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Target: {s.temp_min_required}°C to {s.temp_max_required}°C</div>
                  </div>
                  <Thermometer size={18} className={s.status === 'flagged' ? 'text-red-500' : 'text-green-500'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
