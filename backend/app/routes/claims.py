import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Claim, ClaimStatus, Shipment, Anomaly, HandoffRecord, DocumentRecord
from app.auth import get_current_user
from app.models import User

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class ClaimCreate(BaseModel):
    shipment_id: str
    claimant_name: str
    claimant_email: Optional[str] = None
    reason: str
    estimated_loss_usd: Optional[float] = 0.0


class ClaimUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


class ClaimOut(BaseModel):
    id: str
    shipment_id: str
    claim_ref: str
    claimant_name: str
    claimant_email: Optional[str]
    reason: str
    estimated_loss_usd: float
    status: str
    evidence_summary: Optional[str]
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("", response_model=ClaimOut, status_code=201)
async def create_claim(
    payload: ClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Auto-build evidence summary from anomalies and documents
    anomalies = db.query(Anomaly).filter(Anomaly.shipment_id == payload.shipment_id).all()
    docs = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == payload.shipment_id).all()
    handoffs = db.query(HandoffRecord).filter(HandoffRecord.shipment_id == payload.shipment_id).count()

    evidence_lines = [
        f"Shipment: {shipment.name} ({shipment.batch_no})",
        f"Route: {shipment.origin} → {shipment.destination}",
        f"Status: {shipment.status}",
        f"Integrity Score: {shipment.integrity_score}/100",
        f"Handoffs recorded: {handoffs}",
        f"Documents on file: {len(docs)} ({sum(1 for d in docs if d.tampered)} tampered)",
        f"Anomalies detected: {len(anomalies)} ({sum(1 for a in anomalies if a.severity in ['critical','high'])} critical/high)",
    ]
    if anomalies:
        evidence_lines.append("\nAnomalies:")
        for a in anomalies[:5]:
            evidence_lines.append(f"  • [{a.severity.upper()}] {a.anomaly_type}: {a.description}")

    claim_ref = f"CLM-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    claim = Claim(
        shipment_id=payload.shipment_id,
        claim_ref=claim_ref,
        claimant_name=payload.claimant_name,
        claimant_email=payload.claimant_email,
        reason=payload.reason,
        estimated_loss_usd=payload.estimated_loss_usd or (
            (shipment.unit_value_usd or 0) * (shipment.quantity_units or 1)
        ),
        evidence_summary="\n".join(evidence_lines),
        status=ClaimStatus.OPEN.value,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return ClaimOut.model_validate(claim)


@router.get("", response_model=List[ClaimOut])
async def list_claims(
    shipment_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Claim)
    if shipment_id:
        q = q.filter(Claim.shipment_id == shipment_id)
    if status:
        q = q.filter(Claim.status == status)
    return [ClaimOut.model_validate(c) for c in q.order_by(Claim.created_at.desc()).all()]


@router.get("/{claim_id}", response_model=ClaimOut)
async def get_claim(
    claim_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return ClaimOut.model_validate(claim)


@router.patch("/{claim_id}", response_model=ClaimOut)
async def update_claim(
    claim_id: str,
    payload: ClaimUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if payload.status:
        claim.status = payload.status
        if payload.status in [ClaimStatus.APPROVED.value, ClaimStatus.REJECTED.value, ClaimStatus.SETTLED.value]:
            claim.resolved_at = datetime.utcnow()
    if payload.resolution_notes is not None:
        claim.resolution_notes = payload.resolution_notes

    claim.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(claim)
    return ClaimOut.model_validate(claim)


@router.get("/stats/summary")
async def claims_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(Claim).count()
    open_ = db.query(Claim).filter(Claim.status == ClaimStatus.OPEN.value).count()
    approved = db.query(Claim).filter(Claim.status == ClaimStatus.APPROVED.value).count()
    settled = db.query(Claim).filter(Claim.status == ClaimStatus.SETTLED.value).count()
    from sqlalchemy import func
    total_exposure = db.query(func.sum(Claim.estimated_loss_usd)).scalar() or 0
    return {
        "total": total,
        "open": open_,
        "approved": approved,
        "settled": settled,
        "total_exposure_usd": round(float(total_exposure), 2),
    }
