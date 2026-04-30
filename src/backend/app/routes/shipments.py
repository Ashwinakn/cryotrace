from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Shipment, HandoffRecord, DocumentRecord, Anomaly
from app.schemas import ShipmentCreate, ShipmentUpdate, ShipmentOut, ShipmentListOut
from app.auth import get_current_user
from app.models import User
from app.services.hash_engine import generate_genesis_hash

router = APIRouter()


@router.get("", response_model=List[ShipmentListOut])
async def list_shipments(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Shipment)
    if category:
        q = q.filter(Shipment.category == category)
    if status:
        q = q.filter(Shipment.status == status)
    if origin:
        q = q.filter(Shipment.origin.ilike(f"%{origin}%"))
    if destination:
        q = q.filter(Shipment.destination.ilike(f"%{destination}%"))
    if search:
        q = q.filter(
            Shipment.name.ilike(f"%{search}%") |
            Shipment.batch_no.ilike(f"%{search}%")
        )

    shipments = q.order_by(Shipment.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for s in shipments:
        out = ShipmentListOut.model_validate(s)
        out.handoff_count = db.query(HandoffRecord).filter(HandoffRecord.shipment_id == s.id).count()
        out.anomaly_count = db.query(Anomaly).filter(Anomaly.shipment_id == s.id, Anomaly.resolved == False).count()
        out.doc_count = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == s.id).count()
        result.append(out)
    return result


@router.post("", response_model=ShipmentOut, status_code=status.HTTP_201_CREATED)
async def create_shipment(
    payload: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Shipment).filter(Shipment.batch_no == payload.batch_no).first()
    if existing:
        raise HTTPException(status_code=409, detail="Batch number already exists")

    genesis_hash = generate_genesis_hash(payload.batch_no, payload.origin, str(payload.eta))
    shipment = Shipment(
        name=payload.name, batch_no=payload.batch_no,
        category=payload.category.value, origin=payload.origin, destination=payload.destination,
        eta=payload.eta, description=payload.description,
        temp_min_required=payload.temp_min_required, temp_max_required=payload.temp_max_required,
        weight_kg=payload.weight_kg, quantity_units=payload.quantity_units,
        unit_value_usd=payload.unit_value_usd or 0.0,
        product_details=payload.product_details or {},
        created_by=current_user.id, genesis_hash=genesis_hash,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return ShipmentOut.model_validate(shipment)


@router.get("/{shipment_id}", response_model=ShipmentOut)
async def get_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return ShipmentOut.model_validate(s)


@router.put("/{shipment_id}", response_model=ShipmentOut)
async def update_shipment(
    shipment_id: str,
    payload: ShipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return ShipmentOut.model_validate(s)


@router.delete("/{shipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    db.delete(s)
    db.commit()
