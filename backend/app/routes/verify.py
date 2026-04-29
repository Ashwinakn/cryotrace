from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends
from uuid import UUID

from app.database import get_db
from app.models import Shipment, HandoffRecord, DocumentRecord, BlockchainLog, Anomaly
from app.schemas import VerifyOut, HandoffOut, DocumentOut, BlockchainLogOut, AnomalyOut

router = APIRouter()


@router.get("/{shipment_id}", response_model=VerifyOut)
async def verify_shipment(
    shipment_id: UUID,
    db: Session = Depends(get_db),
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

    documents = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == shipment_id).all()
    blockchain_logs = db.query(BlockchainLog).filter(BlockchainLog.shipment_id == shipment_id).all()
    anomalies = db.query(Anomaly).filter(Anomaly.shipment_id == shipment_id).all()

    # Consumer safe check
    critical_anomalies = [a for a in anomalies if a.severity.value == "critical" and not a.resolved]
    consumer_safe = len(critical_anomalies) == 0 and shipment.integrity_score >= 80

    # Blockchain verified
    verified_blockchain = any(bl.status == "confirmed" for bl in blockchain_logs)

    return VerifyOut(
        shipment_id=shipment.id,
        name=shipment.name,
        batch_no=shipment.batch_no,
        category=shipment.category.value,
        origin=shipment.origin,
        destination=shipment.destination,
        status=shipment.status.value,
        integrity_score=shipment.integrity_score,
        freshness_score=shipment.freshness_score,
        risk_score=shipment.risk_score,
        created_at=shipment.created_at,
        eta=shipment.eta,
        handoffs=[HandoffOut.model_validate(h) for h in handoffs],
        documents=[DocumentOut.model_validate(d) for d in documents],
        blockchain_logs=[BlockchainLogOut.model_validate(b) for b in blockchain_logs],
        anomalies=[AnomalyOut.model_validate(a) for a in anomalies],
        consumer_safe=consumer_safe,
        verified_blockchain=verified_blockchain,
    )
