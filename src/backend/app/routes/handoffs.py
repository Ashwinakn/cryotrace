from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import HandoffRecord, Shipment, Anomaly, AnomalyType, AnomalySeverity
from app.schemas import HandoffCreate, HandoffOut
from app.auth import get_current_user
from app.models import User
from app.services.hash_engine import compute_handoff_hash
from app.services.anomaly_engine import check_handoff_anomalies
from app.blockchain.ledger import record_handoff_on_chain

router = APIRouter()


@router.post("", response_model=HandoffOut, status_code=201)
async def create_handoff(
    payload: HandoffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    last = (
        db.query(HandoffRecord)
        .filter(HandoffRecord.shipment_id == payload.shipment_id)
        .order_by(HandoffRecord.sequence.desc())
        .first()
    )
    sequence = (last.sequence + 1) if last else 1
    prev_hash = last.handoff_hash if last else shipment.genesis_hash

    from datetime import datetime
    timestamp = datetime.utcnow()
    new_hash = compute_handoff_hash(
        prev_hash or "", payload.to_party, timestamp.isoformat(),
        payload.temp_min or 0, payload.temp_max or 0, payload.location,
    )

    handoff = HandoffRecord(
        shipment_id=payload.shipment_id, sequence=sequence,
        from_party=payload.from_party, to_party=payload.to_party,
        location=payload.location, lat=payload.lat, lng=payload.lng,
        timestamp=timestamp, temp_min=payload.temp_min, temp_max=payload.temp_max,
        humidity=payload.humidity, prev_hash=prev_hash, handoff_hash=new_hash,
        notes=payload.notes, signature=payload.signature,
        signed_by=payload.signed_by or None,
        signer_role=payload.signer_role or "system",
    )
    db.add(handoff)
    db.flush()

    shipment.status = "in_transit"
    anomalies = check_handoff_anomalies(handoff, shipment, db)
    for a in anomalies:
        db.add(a)

    critical = sum(1 for a in anomalies if a.severity == "critical")
    high = sum(1 for a in anomalies if a.severity == "high")
    shipment.integrity_score = max(0, shipment.integrity_score - critical * 20 - high * 10)

    db.commit()
    db.refresh(handoff)

    try:
        record_handoff_on_chain(handoff, shipment, db)
    except Exception:
        pass

    return HandoffOut.model_validate(handoff)


@router.get("/{shipment_id}", response_model=List[HandoffOut])
async def get_handoffs(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    handoffs = (
        db.query(HandoffRecord)
        .filter(HandoffRecord.shipment_id == shipment_id)
        .order_by(HandoffRecord.sequence.asc())
        .all()
    )
    return [HandoffOut.model_validate(h) for h in handoffs]
