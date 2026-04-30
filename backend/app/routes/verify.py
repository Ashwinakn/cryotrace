from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session
from fastapi import Depends
from typing import List, Optional

from app.database import get_db
from app.models import Shipment, HandoffRecord, DocumentRecord, BlockchainLog, Anomaly
from app.schemas import VerifyOut, HandoffOut, DocumentOut, BlockchainLogOut, AnomalyOut, ShipmentOut
from app.blockchain.ledger import get_shipment_history_from_chain

router = APIRouter()


@router.get("/search", response_model=List[ShipmentOut])
async def search_shipments(
    q: str = Query(..., min_length=2, description="Batch number or partial name"),
    db: Session = Depends(get_db),
):
    """Public search — allows any stakeholder to find a shipment by batch number."""
    results = (
        db.query(Shipment)
        .filter(
            (Shipment.batch_no.ilike(f"%{q}%")) |
            (Shipment.name.ilike(f"%{q}%"))
        )
        .limit(10)
        .all()
    )
    return [ShipmentOut.model_validate(s) for s in results]


@router.get("/{shipment_id}", response_model=VerifyOut)
async def verify_shipment(
    shipment_id: str,
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
    # Note: severity and status are strings in the database
    critical_anomalies = [a for a in anomalies if a.severity == "critical" and not a.resolved]
    consumer_safe = len(critical_anomalies) == 0 and shipment.integrity_score >= 80

    # Blockchain verified
    verified_blockchain = any(bl.status == "confirmed" for bl in blockchain_logs)

    # Cross-check documents with on-chain history if available
    chain_history = await get_shipment_history_from_chain(str(shipment_id))
    if chain_history.get("status") == "on_chain":
        on_chain_data = chain_history.get("data", {})
        on_chain_shipment = on_chain_data.get("shipment", {})
        on_chain_docs = {d.get("doc_id"): d for d in on_chain_shipment.get("documents", [])}

        # Update document tampered status based on on-chain hash
        for doc in documents:
            chain_doc = on_chain_docs.get(str(doc.id))
            if chain_doc:
                doc.blockchain_status = "confirmed"
                if doc.content_hash != chain_doc.get("doc_hash"):
                    doc.tampered = True
                    doc.verified = False
            else:
                if doc.blockchain_status == "confirmed":
                    # DB claims it's confirmed but it's not on chain!
                    doc.tampered = True
                    doc.verified = False

        if on_chain_data.get("chain_intact") is True:
            verified_blockchain = True

    return VerifyOut(
        shipment_id=shipment.id,
        name=shipment.name,
        batch_no=shipment.batch_no,
        category=shipment.category,
        origin=shipment.origin,
        destination=shipment.destination,
        status=shipment.status,
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
