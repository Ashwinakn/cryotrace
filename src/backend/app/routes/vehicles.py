"""
Vehicle tracking routes for CryoTrace.

Returns real-time vehicle positions, temperatures, and metadata.
These records are auto-created and updated by the /device/push endpoint
as the IoT magnetic-latch device reports sensor data.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Vehicle

router = APIRouter()


@router.get("")
def list_vehicles(db: Session = Depends(get_db)):
    """List all known vehicles with their latest real-time telemetry."""
    vehicles = db.query(Vehicle).order_by(Vehicle.last_seen.desc()).all()
    return [_vehicle_to_dict(v) for v in vehicles]


@router.get("/{vehicle_number}")
def get_vehicle(vehicle_number: str, db: Session = Depends(get_db)):
    """Get a specific vehicle by its number plate / identifier."""
    v = db.query(Vehicle).filter(Vehicle.vehicle_number == vehicle_number).first()
    if not v:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _vehicle_to_dict(v)


def _vehicle_to_dict(v: Vehicle) -> dict:
    return {
        "id":               v.id,
        "vehicle_number":   v.vehicle_number,
        "vehicle_type":     v.vehicle_type,
        "driver_name":      v.driver_name,
        "carrier_name":     v.carrier_name,
        "route_name":       v.route_name,
        "device_id":        v.device_id,
        "status":           v.status,
        "current_lat":      v.current_lat,
        "current_lng":      v.current_lng,
        "current_temp":     v.current_temp,
        "current_humidity": v.current_humidity,
        "current_battery":  v.current_battery,
        "last_seen":        v.last_seen.isoformat() if v.last_seen else None,
        "created_at":       v.created_at.isoformat() if v.created_at else None,
    }
