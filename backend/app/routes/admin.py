from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import User, Shipment, Anomaly
from app.schemas import UserOut
from app.auth import get_current_admin, get_current_user

router = APIRouter()


@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    users = db.query(User).all()
    return [UserOut.model_validate(u) for u in users]


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from uuid import UUID
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from uuid import UUID
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"user_id": user_id, "is_active": user.is_active}


@router.get("/system-stats")
async def system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return {
        "total_users": db.query(User).count(),
        "total_shipments": db.query(Shipment).count(),
        "total_anomalies": db.query(Anomaly).count(),
        "unresolved_anomalies": db.query(Anomaly).filter(Anomaly.resolved == False).count(),
    }
