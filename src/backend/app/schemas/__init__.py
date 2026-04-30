from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    REGULATOR = "regulator"
    OPERATOR = "operator"
    WAREHOUSE = "warehouse"
    CONSUMER = "consumer"


class ShipmentStatus(str, Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FLAGGED = "flagged"
    QUARANTINED = "quarantined"
    CANCELLED = "cancelled"


class ShipmentCategory(str, Enum):
    PHARMACEUTICAL = "pharmaceutical"
    VACCINES = "vaccines"
    BIOLOGICS = "biologics"
    FOOD = "food"
    SEAFOOD = "seafood"
    FROZEN_GOODS = "frozen_goods"
    PERISHABLES = "perishables"


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.OPERATOR
    company: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    company: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Shipments ─────────────────────────────────────────────────────────────────

class ShipmentCreate(BaseModel):
    name: str
    batch_no: str
    category: ShipmentCategory
    origin: str
    destination: str
    eta: Optional[datetime] = None
    description: Optional[str] = None
    temp_min_required: Optional[float] = None
    temp_max_required: Optional[float] = None
    weight_kg: Optional[float] = None
    quantity_units: Optional[int] = None
    unit_value_usd: Optional[float] = 0.0
    product_details: Optional[dict] = {}


class ShipmentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    eta: Optional[datetime] = None
    description: Optional[str] = None
    integrity_score: Optional[float] = None
    freshness_score: Optional[float] = None
    risk_score: Optional[float] = None


class ShipmentOut(BaseModel):
    id: str
    name: str
    batch_no: str
    category: str
    origin: str
    destination: str
    status: str
    created_at: datetime
    eta: Optional[datetime]
    integrity_score: float
    freshness_score: float
    risk_score: float
    temp_min_required: Optional[float]
    temp_max_required: Optional[float]
    weight_kg: Optional[float]
    quantity_units: Optional[int]
    unit_value_usd: float
    carbon_footprint_kg: float
    sustainability_score: float
    genesis_hash: Optional[str]
    description: Optional[str]
    class Config: from_attributes = True


class ShipmentListOut(ShipmentOut):
    handoff_count: int = 0
    anomaly_count: int = 0
    doc_count: int = 0


# ── Handoffs ──────────────────────────────────────────────────────────────────

class HandoffCreate(BaseModel):
    shipment_id: str
    from_party: str
    to_party: str
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    humidity: Optional[float] = None
    notes: Optional[str] = None
    signature: Optional[str] = None
    signed_by: Optional[str] = None      # Name of the person accepting the shipment
    signer_role: Optional[str] = None   # warehouse | driver | customs | system


class HandoffOut(BaseModel):
    id: str
    shipment_id: str
    sequence: int
    from_party: str
    to_party: str
    location: str
    lat: Optional[float]
    lng: Optional[float]
    timestamp: datetime
    temp_min: Optional[float]
    temp_max: Optional[float]
    humidity: Optional[float]
    prev_hash: Optional[str]
    handoff_hash: Optional[str]
    status: str
    notes: Optional[str]
    signed_by: Optional[str] = None
    signer_role: Optional[str] = None
    class Config: from_attributes = True


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    shipment_id: str
    handoff_id: Optional[str]
    filename: str
    original_filename: Optional[str]
    file_type: Optional[str]
    content_hash: str
    file_size: Optional[int]
    verified: bool
    tampered: bool
    uploaded_by: Optional[str]
    uploaded_at: datetime
    document_type: Optional[str]
    description: Optional[str]
    blockchain_tx: Optional[str]        # TX hash from AnchorDocument chaincode
    blockchain_status: Optional[str]    # "confirmed" | "simulated"
    class Config: from_attributes = True



class DocumentVerifyOut(BaseModel):
    document_id: str
    verified: bool
    tampered: bool
    original_hash: str
    computed_hash: str
    match: bool
    message: str


# ── Sensors ───────────────────────────────────────────────────────────────────

class SensorPush(BaseModel):
    shipment_id: str
    device_id: Optional[str] = None
    temperature: float
    humidity: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    battery: Optional[float] = None
    door_open: Optional[bool] = False
    shock: Optional[bool] = False
    light: Optional[float] = None
    pressure: Optional[float] = None
    timestamp: Optional[datetime] = None


class SensorOut(BaseModel):
    id: str
    shipment_id: str
    device_id: Optional[str]
    temperature: float
    humidity: Optional[float]
    lat: Optional[float]
    lng: Optional[float]
    battery: Optional[float]
    door_open: bool
    shock: bool
    timestamp: datetime
    class Config: from_attributes = True


# ── AI ────────────────────────────────────────────────────────────────────────

class AIResultOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    id: str
    shipment_id: str
    risk_score: float
    spoilage_risk: float
    fraud_risk: float
    delay_risk: float
    theft_risk: float
    customs_delay_risk: float
    confidence: float
    top_reasons: List[str]
    recommended_action: Optional[str]
    model_version: Optional[str]
    created_at: datetime


# ── Anomalies ─────────────────────────────────────────────────────────────────

class AnomalyOut(BaseModel):
    id: str
    shipment_id: str
    handoff_id: Optional[str]
    anomaly_type: str
    severity: str
    description: str
    resolved: bool
    created_at: datetime
    class Config: from_attributes = True


# ── Blockchain ────────────────────────────────────────────────────────────────

class BlockchainLogOut(BaseModel):
    id: str
    shipment_id: str
    handoff_id: Optional[str]
    tx_hash: str
    block_number: Optional[int]
    wallet: Optional[str]
    network: str
    status: str
    timestamp: datetime
    payload_hash: Optional[str]
    class Config: from_attributes = True


# ── Verify ────────────────────────────────────────────────────────────────────

class VerifyOut(BaseModel):
    shipment_id: str
    name: str
    batch_no: str
    category: str
    origin: str
    destination: str
    status: str
    integrity_score: float
    freshness_score: float
    risk_score: float
    created_at: datetime
    eta: Optional[datetime]
    handoffs: List[HandoffOut]
    documents: List[DocumentOut]
    blockchain_logs: List[BlockchainLogOut]
    anomalies: List[AnomalyOut]
    consumer_safe: bool
    verified_blockchain: bool


# ── Analytics ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_shipments: int
    in_transit: int
    delivered: int
    flagged: int
    quarantined: int
    active_sensors: int
    verified_docs: int
    unresolved_anomalies: int
    revenue_protected_usd: float
    spoilage_prevented_pct: float
    total_anomalies: int
    blockchain_verified: int
