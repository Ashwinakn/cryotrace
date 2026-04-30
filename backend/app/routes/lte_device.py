"""
LTE Device endpoint for CryoTrace.

Physical LTE IoT devices (e.g. SIM7600 module with GPS + temperature sensor)
POST their readings here every 30 seconds. The endpoint:

  1. Validates the device API key
  2. Saves the reading to SQLite (historical)
  3. Publishes to Kafka topic → Spark Structured Streaming picks it up
  4. Broadcasts to WebSocket subscribers (live map in React)
  5. Runs fast anomaly checks and publishes alerts to Kafka

This endpoint requires NO user login — devices authenticate via API key header.
"""
import hashlib
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SensorLog, Shipment, Anomaly
from app.schemas import SensorOut
from app.services.anomaly_engine import check_sensor_anomalies
from app.kafka_producer import publish_sensor_event, publish_anomaly_alert, publish_device_status
from app.routes.sensors import manager  # reuse WebSocket connection manager

router = APIRouter()

# ── Device registry ────────────────────────────────────────────────────────────
# In production, move this to DB/env. Maps device_id → allowed shipment_id.
# API key is SHA-256 of (device_id + DEVICE_SECRET).
DEVICE_SECRET = os.getenv("DEVICE_SECRET", "cryotrace-iot-secret-2024")


def _validate_device_key(device_id: str, api_key: str) -> bool:
    """Verify the device API key is valid for the given device_id."""
    expected = hashlib.sha256(f"{device_id}:{DEVICE_SECRET}".encode()).hexdigest()
    return api_key == expected or api_key == "dev-bypass"  # dev bypass for testing


# ── Payload schema ─────────────────────────────────────────────────────────────

class LTEDevicePayload(BaseModel):
    device_id:        str
    shipment_id:      str
    temperature:      float
    humidity:         Optional[float]   = None
    lat:              Optional[float]   = None
    lng:              Optional[float]   = None
    battery:          Optional[float]   = None
    door_open:        Optional[bool]    = False
    shock:            Optional[bool]    = False
    light:            Optional[float]   = None
    pressure:         Optional[float]   = None
    signal_dbm:       Optional[int]     = None     # LTE signal strength
    lte_provider:     Optional[str]     = None     # e.g. "Airtel", "Jio"
    firmware_version: Optional[str]     = None
    timestamp:        Optional[datetime] = None


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.post("/push")
async def device_push(
    payload:  LTEDevicePayload,
    x_device_key: str = Header(..., alias="X-Device-Key"),
    db: Session = Depends(get_db),
):
    """
    Receive a sensor reading from an LTE IoT device.

    Authentication: X-Device-Key header
    Key generation: SHA-256(device_id + DEVICE_SECRET)

    Example curl:
      curl -X POST http://localhost:8000/device/push \\
        -H "X-Device-Key: dev-bypass" \\
        -H "Content-Type: application/json" \\
        -d '{"device_id":"LTE-001","shipment_id":"<uuid>","temperature":4.2,"lat":12.97,"lng":77.59}'
    """
    # 1 — Authenticate device
    if not _validate_device_key(payload.device_id, x_device_key):
        raise HTTPException(status_code=403, detail="Invalid device API key")

    # 2 — Validate shipment exists
    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment {payload.shipment_id} not found")

    # 3 — Persist to SQLite (historical record)
    ts = payload.timestamp or datetime.utcnow()
    log = SensorLog(
        shipment_id = payload.shipment_id,
        device_id   = payload.device_id,
        temperature = payload.temperature,
        humidity    = payload.humidity,
        lat         = payload.lat,
        lng         = payload.lng,
        battery     = payload.battery,
        door_open   = payload.door_open or False,
        shock       = payload.shock or False,
        light       = payload.light,
        pressure    = payload.pressure,
        timestamp   = ts,
    )
    db.add(log)

    # 4 — Run fast anomaly checks
    anomalies = check_sensor_anomalies(log, shipment)
    for a in anomalies:
        db.add(a)

    # 5 — Vaccine hardening updates (MKT, Excursion, VVM)
    if shipment.category == 'vaccines' or shipment.category == 'pharmaceutical':
        from app.services.vaccine_utils import calculate_mkt
        
        # Get recent temperatures for MKT (last 100 logs)
        recent_logs = db.query(SensorLog.temperature).filter(SensorLog.shipment_id == shipment.id).order_by(SensorLog.timestamp.desc()).limit(100).all()
        temps = [r[0] for r in recent_logs]
        shipment.mkt = calculate_mkt(temps)
        
        # Update cumulative excursion time if out of range
        # Assuming push interval is ~10-30s. We'll add 0.5 mins per reading if out of range for simplicity.
        if shipment.temp_min_required is not None and shipment.temp_max_required is not None:
            if payload.temperature < shipment.temp_min_required or payload.temperature > shipment.temp_max_required:
                shipment.cumulative_excursion_minutes = (shipment.cumulative_excursion_minutes or 0) + 1
        
        # VVM Status update (Stage progression)
        # Stage 1 -> 2 if excursions > 10 mins
        # Stage 2 -> 3 if excursions > 30 mins
        # Stage 3 -> 4 if excursions > 60 mins
        exc = shipment.cumulative_excursion_minutes or 0
        if exc > 60: shipment.vvm_status = 4
        elif exc > 30: shipment.vvm_status = 3
        elif exc > 10: shipment.vvm_status = 2

    db.commit()
    db.refresh(log)
    db.refresh(shipment)

    # 5 — Publish to Kafka → Spark Structured Streaming
    sensor_event = {
        "temperature":      payload.temperature,
        "humidity":         payload.humidity,
        "lat":              payload.lat,
        "lng":              payload.lng,
        "battery":          payload.battery,
        "door_open":        payload.door_open,
        "shock":            payload.shock,
        "signal_dbm":       payload.signal_dbm,
        "lte_provider":     payload.lte_provider,
        "firmware_version": payload.firmware_version,
        "timestamp":        ts.isoformat(),
    }
    kafka_ok = publish_sensor_event(payload.shipment_id, payload.device_id, sensor_event)

    # Publish anomaly alerts to Kafka
    for a in anomalies:
        publish_anomaly_alert(
            shipment_id   = payload.shipment_id,
            anomaly_type  = a.anomaly_type,
            severity      = a.severity,
            description   = a.description,
        )

    # 6 — Broadcast to WebSocket subscribers (live React map)
    ws_data = {
        "type":        "sensor_update",
        "shipment_id": payload.shipment_id,
        "data":        {**sensor_event, "id": str(log.id)},
        "anomalies":   [{"type": a.anomaly_type, "severity": a.severity, "description": a.description} for a in anomalies],
    }
    await manager.broadcast(payload.shipment_id, ws_data)

    return {
        "status":       "accepted",
        "log_id":       str(log.id),
        "kafka":        "published" if kafka_ok else "no_broker_fallback",
        "anomalies":    len(anomalies),
        "timestamp":    ts.isoformat(),
    }


@router.get("/key/{device_id}")
async def generate_device_key(
    device_id:    str,
    admin_secret: str,
    current_user = Depends(__import__("app.auth", fromlist=["get_current_user"]).get_current_user),
):
    """
    Admin-only: generate the API key for a new device.
    Returns the key to provision onto the device firmware.
    """
    if admin_secret != DEVICE_SECRET:
        raise HTTPException(status_code=403, detail="Wrong admin secret")
    key = hashlib.sha256(f"{device_id}:{DEVICE_SECRET}".encode()).hexdigest()
    return {
        "device_id": device_id,
        "api_key":   key,
        "header":    "X-Device-Key",
        "note":      "Store this key in the device firmware. It cannot be recovered — generate a new one if lost.",
    }
