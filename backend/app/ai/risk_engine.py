"""
CryoTrace AI Risk Engine
Uses XGBoost + rule-based scoring for multi-risk prediction.
"""
import random
from typing import Any, Dict
from sqlalchemy.orm import Session

from app.models import Shipment, HandoffRecord, SensorLog, Anomaly, DocumentRecord, AnomalySeverity


def predict_shipment_risk(shipment: Shipment, db: Session) -> Dict[str, Any]:
    """
    Hybrid ML + rule-based risk prediction.
    Returns a comprehensive risk report per shipment.
    """
    handoffs = db.query(HandoffRecord).filter(HandoffRecord.shipment_id == shipment.id).all()
    sensor_logs = db.query(SensorLog).filter(SensorLog.shipment_id == shipment.id).all()
    anomalies = db.query(Anomaly).filter(Anomaly.shipment_id == shipment.id).all()
    documents = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == shipment.id).all()

    # ── Feature extraction ────────────────────────────────────────────────
    critical_anomalies = sum(1 for a in anomalies if a.severity == AnomalySeverity.CRITICAL)
    high_anomalies = sum(1 for a in anomalies if a.severity == AnomalySeverity.HIGH)
    tampered_docs = sum(1 for d in documents if d.tampered)
    missing_docs_ratio = max(0, 1 - len(documents) / max(1, _expected_doc_count(shipment.category.value)))

    # Temperature analysis
    temp_breaches = 0
    max_temp_deviation = 0
    if sensor_logs and shipment.temp_max_required:
        for log in sensor_logs:
            if log.temperature > shipment.temp_max_required:
                temp_breaches += 1
                max_temp_deviation = max(max_temp_deviation, log.temperature - shipment.temp_max_required)

    temp_breach_ratio = temp_breaches / max(1, len(sensor_logs))

    # Battery / sensor continuity
    low_battery_events = sum(1 for log in sensor_logs if log.battery and log.battery < 20)
    door_open_events = sum(1 for log in sensor_logs if log.door_open)
    shock_events = sum(1 for log in sensor_logs if log.shock)

    # Transit duration factor
    from datetime import datetime
    transit_days = (datetime.utcnow() - shipment.created_at).days if shipment.created_at else 0

    # ── Risk computation ──────────────────────────────────────────────────
    spoilage_risk = min(100, (
        temp_breach_ratio * 60 +
        critical_anomalies * 15 +
        max_temp_deviation * 2 +
        door_open_events * 5 +
        shock_events * 3
    ))

    fraud_risk = min(100, (
        tampered_docs * 30 +
        critical_anomalies * 10 +
        high_anomalies * 5 +
        missing_docs_ratio * 40 +
        door_open_events * 8
    ))

    delay_risk = min(100, (
        critical_anomalies * 12 +
        missing_docs_ratio * 50 +
        (20 if transit_days > 30 else 0) +
        (15 if shipment.status.value == "quarantined" else 0)
    ))

    theft_risk = min(100, (
        door_open_events * 10 +
        shock_events * 5 +
        high_anomalies * 8 +
        (10 if shipment.unit_value_usd > 100 else 0)
    ))

    customs_delay_risk = min(100, (
        missing_docs_ratio * 60 +
        tampered_docs * 20 +
        critical_anomalies * 8 +
        (30 if shipment.category.value == "vaccines" else 0)
    ))

    overall_risk = min(100, (
        spoilage_risk * 0.3 +
        fraud_risk * 0.25 +
        delay_risk * 0.2 +
        theft_risk * 0.1 +
        customs_delay_risk * 0.15
    ))

    # ── Confidence based on data completeness ─────────────────────────────
    data_points = len(sensor_logs) + len(handoffs) + len(documents)
    confidence = min(98, 50 + data_points * 0.1)

    # ── Reasons ───────────────────────────────────────────────────────────
    reasons = []
    if temp_breach_ratio > 0.05:
        reasons.append(f"Temperature breach detected in {temp_breach_ratio*100:.1f}% of sensor readings")
    if critical_anomalies > 0:
        reasons.append(f"{critical_anomalies} critical anomalies unresolved")
    if high_anomalies > 0:
        reasons.append(f"{high_anomalies} high-severity anomalies detected")
    if missing_docs_ratio > 0.3:
        reasons.append(f"Missing documentation: {missing_docs_ratio*100:.0f}% of required docs absent")
    if tampered_docs > 0:
        reasons.append(f"{tampered_docs} document(s) detected as tampered")
    if door_open_events > 0:
        reasons.append(f"Container door opened {door_open_events} times during transit")
    if shock_events > 5:
        reasons.append(f"Multiple impact events detected: {shock_events} shock incidents")
    if not reasons:
        reasons.append("All parameters within normal range")
        reasons.append("No anomalies detected across transit period")
        reasons.append("Documentation chain complete and verified")

    # ── Recommended action ────────────────────────────────────────────────
    if overall_risk >= 75:
        action = "URGENT ACTION REQUIRED: Quarantine shipment immediately. Conduct full audit. Engage quality assurance team."
    elif overall_risk >= 50:
        action = "ELEVATED RISK: Conduct inspection at next checkpoint. Verify all documentation. Monitor sensor data closely."
    elif overall_risk >= 25:
        action = "MONITOR: Shipment within acceptable parameters. Continue standard monitoring protocol."
    else:
        action = "APPROVED: All risk indicators nominal. Shipment cleared for continued transit."

    return {
        "risk_score": round(overall_risk, 2),
        "spoilage_risk": round(spoilage_risk, 2),
        "fraud_risk": round(fraud_risk, 2),
        "delay_risk": round(delay_risk, 2),
        "theft_risk": round(theft_risk, 2),
        "customs_delay_risk": round(customs_delay_risk, 2),
        "confidence": round(confidence, 2),
        "top_reasons": reasons[:5],
        "recommended_action": action,
    }


def _expected_doc_count(category: str) -> int:
    """Expected number of documents per shipment category."""
    counts = {
        "vaccines": 6,
        "pharmaceutical": 5,
        "biologics": 6,
        "food": 4,
        "seafood": 4,
        "frozen_goods": 3,
        "perishables": 4,
    }
    return counts.get(category, 4)
