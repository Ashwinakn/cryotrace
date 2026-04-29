import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Package, RefreshCw, FileCheck, MapPin } from 'lucide-react'
import { shipmentsApi } from '../../api'

export default function CustomerDashboard() {
  const [shipments, setShipments] = useState<any[]>([])

  useEffect(() => {
    shipmentsApi.list().then(res => setShipments(res.data)).catch(() => {})
  }, [])

  return (
    <div className="dashboard-layout">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customer Portal</h1>
          <p>Track your orders, verify documents, and manage returns</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-primary" onClick={() => alert('Order Placed! (Demo)')}>+ Place New Order</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Tracking Map</span>
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
                        Status: {s.status}<br/>
                        Temp: {lastLog.temperature}°C
                      </Popup>
                    </Marker>
                  )
                }
                return null;
              })}
            </MapContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-header"><span className="card-title">Active Orders</span></div>
            <div className="card-body">
              {shipments.slice(0, 3).map(s => (
                <div key={s.id} className="flex gap-4 align-center p-3 border-b border-gray-200">
                  <Package size={24} className="text-blue-500" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Status: {s.status} • ETA: {new Date(s.eta).toLocaleDateString()}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">Track</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Document Verification Transparency</span></div>
            <div className="card-body">
              <div className="flex gap-4 align-center p-3">
                <FileCheck size={24} className="text-green-500" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>100% Verified</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>All documents hashed on Hyperledger Fabric</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Return Temp Tags</span></div>
            <div className="card-body flex gap-4">
              <RefreshCw size={24} className="text-purple-500" />
              <div>
                <div style={{ fontWeight: 600 }}>Return IoT Tags</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Send back temperature sensors from delivered packages to earn ESG credits.</div>
                <button className="btn btn-outline btn-sm" onClick={() => alert('Return process initiated!')}>Initiate Return</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
