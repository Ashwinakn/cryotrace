from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Shipment, SensorLog, DocumentRecord, Anomaly, BlockchainLog
from app.schemas import DashboardStats
from app.auth import get_current_user
from app.models import User

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(Shipment).count()
    in_transit = db.query(Shipment).filter(Shipment.status == "in_transit").count()
    delivered = db.query(Shipment).filter(Shipment.status == "delivered").count()
    flagged = db.query(Shipment).filter(Shipment.status == "flagged").count()
    quarantined = db.query(Shipment).filter(Shipment.status == "quarantined").count()

    recent_threshold = datetime.utcnow() - timedelta(minutes=30)
    active_sensors = db.query(func.count(func.distinct(SensorLog.shipment_id))).filter(
        SensorLog.timestamp >= recent_threshold).scalar() or 0

    verified_docs = db.query(DocumentRecord).filter(DocumentRecord.verified == True, DocumentRecord.tampered == False).count()
    unresolved_anomalies = db.query(Anomaly).filter(Anomaly.resolved == False).count()
    total_anomalies = db.query(Anomaly).count()
    blockchain_verified = db.query(BlockchainLog).filter(BlockchainLog.status == "confirmed").count()

    revenue_row = db.query(func.sum(Shipment.unit_value_usd * Shipment.quantity_units)).filter(
        Shipment.status.in_(["delivered", "flagged"])).scalar()
    revenue_protected = float(revenue_row or 0)

    avg_freshness = db.query(func.avg(Shipment.freshness_score)).scalar() or 100

    return DashboardStats(
        total_shipments=total, in_transit=in_transit, delivered=delivered,
        flagged=flagged, quarantined=quarantined, active_sensors=active_sensors,
        verified_docs=verified_docs, unresolved_anomalies=unresolved_anomalies,
        revenue_protected_usd=revenue_protected, spoilage_prevented_pct=float(avg_freshness),
        total_anomalies=total_anomalies, blockchain_verified=blockchain_verified,
    )


@router.get("/anomalies-trend")
async def get_anomalies_trend(days: int = 30, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    start = datetime.utcnow() - timedelta(days=days)
    anomalies = db.query(
        func.date(Anomaly.created_at).label("date"),
        func.count(Anomaly.id).label("count"),
        Anomaly.severity.label("severity"),
    ).filter(Anomaly.created_at >= start).group_by(func.date(Anomaly.created_at), Anomaly.severity).order_by(func.date(Anomaly.created_at)).all()
    return [{"date": str(a.date), "count": a.count, "severity": a.severity} for a in anomalies]


@router.get("/shipments-by-category")
async def get_by_category(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Shipment.category, func.count(Shipment.id).label("count")).group_by(Shipment.category).all()
    return [{"category": r.category, "count": r.count} for r in rows]


@router.get("/monthly-stats")
async def get_monthly_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # SQLite-compatible: use strftime
    rows = db.query(
        func.strftime("%Y-%m", Shipment.created_at).label("month"),
        func.count(Shipment.id).label("total"),
    ).group_by(func.strftime("%Y-%m", Shipment.created_at)).order_by(func.strftime("%Y-%m", Shipment.created_at)).limit(12).all()
    return [{"month": r.month, "total": r.total, "delivered": 0} for r in rows]


@router.get("/temperature-excursions")
async def get_temp_excursions(days: int = 7, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    start = datetime.utcnow() - timedelta(days=days)
    rows = db.query(
        func.date(SensorLog.timestamp).label("date"),
        func.avg(SensorLog.temperature).label("avg_temp"),
        func.max(SensorLog.temperature).label("max_temp"),
        func.min(SensorLog.temperature).label("min_temp"),
    ).filter(SensorLog.timestamp >= start).group_by(func.date(SensorLog.timestamp)).order_by(func.date(SensorLog.timestamp)).all()
    return [{"date": str(r.date), "avg_temp": round(float(r.avg_temp or 0),2), "max_temp": round(float(r.max_temp or 0),2), "min_temp": round(float(r.min_temp or 0),2)} for r in rows]


@router.get("/esg/{shipment_id}")
async def get_esg(shipment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from fastapi import HTTPException
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Not found")
    weight = shipment.weight_kg or 100
    co2_kg = round(weight * 0.05 * 5, 2)
    return {
        "shipment_id": str(shipment.id),
        "route_efficiency_pct": round(min(100, shipment.sustainability_score), 2),
        "estimated_co2_kg": co2_kg,
        "refrigeration_energy_kwh": round(weight * 0.3 * 72, 2),
        "waste_prevented_kg": round((shipment.freshness_score / 100) * weight, 2),
        "sustainability_score": shipment.sustainability_score,
        "carbon_offset_trees": max(1, int(co2_kg / 21)),
    }
