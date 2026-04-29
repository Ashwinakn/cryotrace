from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from app.models import HandoffRecord, SensorLog, Shipment, Anomaly, AnomalyType, AnomalySeverity


def check_handoff_anomalies(handoff: HandoffRecord, shipment: Shipment, db: Session) -> List[Anomaly]:
    anomalies = []

    # 1. Temperature exceedance
    if shipment.temp_min_required is not None and handoff.temp_min is not None:
        if handoff.temp_min < shipment.temp_min_required:
            anomalies.append(Anomaly(
                shipment_id=str(shipment.id), handoff_id=str(handoff.id),
                anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
                severity=AnomalySeverity.CRITICAL.value,
                description=f"Temperature {handoff.temp_min}°C below required minimum {shipment.temp_min_required}°C at {handoff.location}",
            ))

    if shipment.temp_max_required is not None and handoff.temp_max is not None:
        if handoff.temp_max > shipment.temp_max_required:
            anomalies.append(Anomaly(
                shipment_id=str(shipment.id), handoff_id=str(handoff.id),
                anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
                severity=AnomalySeverity.CRITICAL.value,
                description=f"Temperature {handoff.temp_max}°C exceeded maximum {shipment.temp_max_required}°C at {handoff.location}",
            ))

    # 2. GPS impossible jump
    prev_handoff = (
        db.query(HandoffRecord)
        .filter(HandoffRecord.shipment_id == str(shipment.id), HandoffRecord.sequence == handoff.sequence - 1)
        .first()
    )
    if prev_handoff and prev_handoff.lat and handoff.lat:
        distance = _haversine(prev_handoff.lat, prev_handoff.lng, handoff.lat, handoff.lng)
        time_diff = (handoff.timestamp - prev_handoff.timestamp).total_seconds() / 3600
        if time_diff > 0 and distance / time_diff > 1000:
            anomalies.append(Anomaly(
                shipment_id=str(shipment.id), handoff_id=str(handoff.id),
                anomaly_type=AnomalyType.GPS_IMPOSSIBLE_JUMP.value,
                severity=AnomalySeverity.HIGH.value,
                description=f"Impossible GPS jump: {distance:.0f}km in {time_diff:.1f}h ({distance/time_diff:.0f}km/h)",
            ))

    # 3. Future timestamp
    if handoff.timestamp > datetime.utcnow() + timedelta(minutes=5):
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id), handoff_id=str(handoff.id),
            anomaly_type=AnomalyType.TIMESTAMP_ANOMALY.value,
            severity=AnomalySeverity.HIGH.value,
            description=f"Future timestamp detected: {handoff.timestamp.isoformat()}",
        ))

    # 4. Duplicate handler
    existing = db.query(HandoffRecord).filter(
        HandoffRecord.shipment_id == str(shipment.id),
        HandoffRecord.to_party == handoff.to_party,
        HandoffRecord.id != str(handoff.id),
    ).count()
    if existing >= 2:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id), handoff_id=str(handoff.id),
            anomaly_type=AnomalyType.DUPLICATE_HANDLER.value,
            severity=AnomalySeverity.MEDIUM.value,
            description=f"Handler '{handoff.to_party}' appears more than twice in chain",
        ))

    # 5. Excess dwell time
    if prev_handoff and prev_handoff.location == handoff.location:
        dwell_hours = (handoff.timestamp - prev_handoff.timestamp).total_seconds() / 3600
        if dwell_hours > 72:
            anomalies.append(Anomaly(
                shipment_id=str(shipment.id), handoff_id=str(handoff.id),
                anomaly_type=AnomalyType.EXCESS_DWELL_TIME.value,
                severity=AnomalySeverity.MEDIUM.value,
                description=f"Excessive dwell of {dwell_hours:.1f}h at {handoff.location}",
            ))

    return anomalies


def check_sensor_anomalies(log: SensorLog, shipment: Shipment) -> List[Anomaly]:
    anomalies = []

    if shipment.temp_max_required and log.temperature > shipment.temp_max_required:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id),
            anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
            severity=AnomalySeverity.CRITICAL.value if log.temperature > shipment.temp_max_required + 5 else AnomalySeverity.HIGH.value,
            description=f"Sensor {log.temperature}°C exceeds max {shipment.temp_max_required}°C",
        ))

    if shipment.temp_min_required and log.temperature < shipment.temp_min_required:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id),
            anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
            severity=AnomalySeverity.HIGH.value,
            description=f"Sensor {log.temperature}°C below min {shipment.temp_min_required}°C",
        ))

    if log.battery is not None and log.battery < 15:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id),
            anomaly_type=AnomalyType.SENSOR_OFFLINE.value,
            severity=AnomalySeverity.MEDIUM.value,
            description=f"Battery critically low: {log.battery}%",
        ))

    if log.door_open:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id),
            anomaly_type=AnomalyType.ROUTE_DEVIATION.value,
            severity=AnomalySeverity.HIGH.value,
            description="Container door opened during transit",
        ))

    if log.shock:
        anomalies.append(Anomaly(
            shipment_id=str(shipment.id),
            anomaly_type=AnomalyType.ROUTE_DEVIATION.value,
            severity=AnomalySeverity.MEDIUM.value,
            description="Shock/impact detected on container",
        ))

    return anomalies


def _haversine(lat1, lon1, lat2, lon2) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
