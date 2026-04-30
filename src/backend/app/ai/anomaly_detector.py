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
                l.temperature if l.temperature is not None else 0.0,
                l.humidity    if l.humidity    is not None else 50.0,
                l.battery     if l.battery     is not None else 100.0,
                int(l.door_open or False),
                int(l.shock    or False),
            ]
            for l in logs
        ], dtype=float)

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
        # Fallback: simple statistical detection (sklearn not available)
        # Filter out logs with None temperature before any arithmetic
        valid = [(i, l) for i, l in enumerate(logs) if l.temperature is not None]
        if len(valid) < 2:
            return []
        temps = [l.temperature for _, l in valid]
        mean = sum(temps) / len(temps)
        std = (sum((t - mean) ** 2 for t in temps) / len(temps)) ** 0.5

        return [
            {
                "timestamp": l.timestamp.isoformat(),
                "temperature": l.temperature,
                "anomaly_score": (l.temperature - mean) / max(std, 0.001),
                "index": i,
            }
            for i, l in valid
            if abs(l.temperature - mean) > 2 * std
        ]

    except Exception as exc:  # noqa: BLE001 — never let detection crash the API
        import logging
        logging.getLogger(__name__).exception("Anomaly detection failed: %s", exc)
        return []
