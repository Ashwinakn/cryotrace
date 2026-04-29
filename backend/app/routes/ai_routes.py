from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import Shipment, AIResult, Anomaly
from app.schemas import AIResultOut, AnomalyOut
from app.auth import get_current_user
from app.models import User
from app.ai.risk_engine import predict_shipment_risk
from app.ai.anomaly_detector import detect_anomalies

router = APIRouter()


@router.get("/predict/{shipment_id}", response_model=AIResultOut)
async def predict_risk(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    result = predict_shipment_risk(shipment, db)

    # Persist result
    ai_result = AIResult(
        shipment_id=shipment_id,
        risk_score=result["risk_score"],
        spoilage_risk=result["spoilage_risk"],
        fraud_risk=result["fraud_risk"],
        delay_risk=result["delay_risk"],
        theft_risk=result["theft_risk"],
        customs_delay_risk=result["customs_delay_risk"],
        confidence=result["confidence"],
        top_reasons=result["top_reasons"],
        recommended_action=result["recommended_action"],
        model_version="1.0.0",
    )
    db.add(ai_result)

    # Update shipment risk score
    shipment.risk_score = result["risk_score"]
    if result["risk_score"] >= 75:
        shipment.status = "flagged"

    db.commit()
    db.refresh(ai_result)
    return AIResultOut.model_validate(ai_result)


@router.get("/anomalies", response_model=List[AnomalyOut])
async def get_anomalies(
    shipment_id: UUID = None,
    severity: str = None,
    resolved: bool = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Anomaly)
    if shipment_id:
        q = q.filter(Anomaly.shipment_id == shipment_id)
    if severity:
        q = q.filter(Anomaly.severity == severity)
    if resolved is not None:
        q = q.filter(Anomaly.resolved == resolved)

    anomalies = q.order_by(Anomaly.created_at.desc()).limit(limit).all()
    return [AnomalyOut.model_validate(a) for a in anomalies]


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    from datetime import datetime
    anomaly.resolved = True
    anomaly.resolved_by = current_user.email
    anomaly.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Anomaly resolved", "id": str(anomaly_id)}


@router.get("/history/{shipment_id}", response_model=List[AIResultOut])
async def get_ai_history(
    shipment_id: UUID,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = (
        db.query(AIResult)
        .filter(AIResult.shipment_id == shipment_id)
        .order_by(AIResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return [AIResultOut.model_validate(r) for r in results]
