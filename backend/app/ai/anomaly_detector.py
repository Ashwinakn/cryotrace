"""
Isolation Forest anomaly detector for CryoTrace.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models import Shipment, SensorLog


def detect_anomalies(shipment: Shipment, db: Session) -> List[Dict[str, Any]]:
    """
    Run Isolation Forest anomaly detection on sensor log time series.
    Returns list of detected anomaly windows.
    """
    logs = (
        db.query(SensorLog)
        .filter(SensorLog.shipment_id == shipment.id)
        .order_by(SensorLog.timestamp.asc())
        .all()
    )

    if len(logs) < 10:
        return []

    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest

        features = np.array([
            [
                l.temperature or 0,
                l.humidity or 50,
                l.battery or 100,
                int(l.door_open or False),
                int(l.shock or False),
            ]
            for l in logs
        ])

        iso = IsolationForest(contamination=0.05, random_state=42)
        predictions = iso.fit_predict(features)

        anomaly_windows = []
        for i, (log, pred) in enumerate(zip(logs, predictions)):
            if pred == -1:
                anomaly_windows.append({
                    "timestamp": log.timestamp.isoformat(),
                    "temperature": log.temperature,
                    "humidity": log.humidity,
                    "battery": log.battery,
                    "anomaly_score": float(iso.score_samples(features[i:i+1])[0]),
                    "index": i,
                })

        return anomaly_windows

    except ImportError:
        # Fallback: simple statistical detection
        temps = [l.temperature for l in logs]
        mean = sum(temps) / len(temps)
        std = (sum((t - mean) ** 2 for t in temps) / len(temps)) ** 0.5
        threshold = mean + 2 * std

        return [
            {
                "timestamp": logs[i].timestamp.isoformat(),
                "temperature": logs[i].temperature,
                "anomaly_score": (temps[i] - mean) / max(std, 0.001),
                "index": i,
            }
            for i, t in enumerate(temps)
            if abs(t - mean) > 2 * std
        ]
