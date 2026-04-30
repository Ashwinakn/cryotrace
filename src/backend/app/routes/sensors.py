import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from app.database import get_db, SessionLocal
from app.models import SensorLog, Shipment, Anomaly, AnomalyType, AnomalySeverity
from app.schemas import SensorPush, SensorOut
from app.auth import get_current_user
from app.models import User
from app.services.anomaly_engine import check_sensor_anomalies

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, shipment_id: str, ws: WebSocket):
        await ws.accept()
        if shipment_id not in self.active_connections:
            self.active_connections[shipment_id] = []
        self.active_connections[shipment_id].append(ws)

    def disconnect(self, shipment_id: str, ws: WebSocket):
        if shipment_id in self.active_connections:
            self.active_connections[shipment_id].remove(ws)

    async def broadcast(self, shipment_id: str, data: dict):
        connections = self.active_connections.get(shipment_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.active_connections[shipment_id].remove(d)


manager = ConnectionManager()


@router.post("/push", response_model=SensorOut, status_code=201)
async def push_sensor_data(
    payload: SensorPush,
    db: Session = Depends(get_db),
):
    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    log = SensorLog(
        shipment_id=payload.shipment_id,
        device_id=payload.device_id,
        temperature=payload.temperature,
        humidity=payload.humidity,
        lat=payload.lat,
        lng=payload.lng,
        battery=payload.battery,
        door_open=payload.door_open or False,
        shock=payload.shock or False,
        light=payload.light,
        pressure=payload.pressure,
        timestamp=payload.timestamp or datetime.utcnow(),
    )
    db.add(log)

    # Anomaly checks
    anomalies = check_sensor_anomalies(log, shipment)
    for a in anomalies:
        db.add(a)

    db.commit()
    db.refresh(log)

    # Broadcast to WebSocket subscribers
    data = {
        "type": "sensor_update",
        "shipment_id": str(payload.shipment_id),
        "data": {
            "temperature": payload.temperature,
            "humidity": payload.humidity,
            "lat": payload.lat,
            "lng": payload.lng,
            "battery": payload.battery,
            "door_open": payload.door_open,
            "shock": payload.shock,
            "timestamp": log.timestamp.isoformat(),
        },
        "anomalies": [{"type": a.anomaly_type.value, "severity": a.severity.value, "description": a.description} for a in anomalies],
    }
    await manager.broadcast(str(payload.shipment_id), data)

    return SensorOut.model_validate(log)


@router.get("/{shipment_id}", response_model=List[SensorOut])
async def get_sensor_logs(
    shipment_id: UUID,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(SensorLog)
        .filter(SensorLog.shipment_id == shipment_id)
        .order_by(SensorLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [SensorOut.model_validate(l) for l in reversed(logs)]


@router.websocket("/ws/live/{shipment_id}")
async def websocket_endpoint(websocket: WebSocket, shipment_id: str):
    await manager.connect(shipment_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(shipment_id, websocket)
