import uuid
import hashlib
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


def _uuid_col(primary=False, fk=None):
    """UUID column compatible with SQLite (stores as string) and PostgreSQL."""
    if fk:
        return Column(String(36), ForeignKey(fk), nullable=primary is False)
    return Column(String(36), primary_key=primary, default=lambda: str(uuid.uuid4()))


class ShipmentStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FLAGGED = "flagged"
    QUARANTINED = "quarantined"
    CANCELLED = "cancelled"


class ShipmentCategory(str, enum.Enum):
    PHARMACEUTICAL = "pharmaceutical"
    VACCINES = "vaccines"
    BIOLOGICS = "biologics"
    FOOD = "food"
    SEAFOOD = "seafood"
    FROZEN_GOODS = "frozen_goods"
    PERISHABLES = "perishables"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REGULATOR = "regulator"
    OPERATOR = "operator"
    VENDOR = "vendor"
    HUB = "hub"
    CUSTOMER = "customer"


class AnomalySeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyType(str, enum.Enum):
    TEMPERATURE_EXCEEDANCE = "temperature_exceedance"
    MISSING_DOCUMENTS = "missing_documents"
    TIMESTAMP_ANOMALY = "timestamp_anomaly"
    CHAIN_BREAK = "chain_break"
    GPS_IMPOSSIBLE_JUMP = "gps_impossible_jump"
    DUPLICATE_HANDLER = "duplicate_handler"
    TAMPERED_HASH = "tampered_hash"
    ROUTE_DEVIATION = "route_deviation"
    EXCESS_DWELL_TIME = "excess_dwell_time"
    SENSOR_OFFLINE = "sensor_offline"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.OPERATOR.value)
    company = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    shipments = relationship("Shipment", back_populates="created_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(500), nullable=False)
    batch_no = Column(String(100), unique=True, nullable=False)
    category = Column(String(50), nullable=False)
    origin = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    status = Column(String(50), default=ShipmentStatus.PENDING.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    eta = Column(DateTime)
    created_by = Column(String(36), ForeignKey("users.id"))
    description = Column(Text)
    product_details = Column(JSON, default={})

    integrity_score = Column(Float, default=100.0)
    freshness_score = Column(Float, default=100.0)
    risk_score = Column(Float, default=0.0)

    temp_min_required = Column(Float)
    temp_max_required = Column(Float)

    weight_kg = Column(Float)
    quantity_units = Column(Integer)
    unit_value_usd = Column(Float, default=0.0)

    carbon_footprint_kg = Column(Float, default=0.0)
    sustainability_score = Column(Float, default=100.0)
    genesis_hash = Column(String(64))

    created_by_user = relationship("User", back_populates="shipments")
    handoffs = relationship("HandoffRecord", back_populates="shipment", cascade="all, delete-orphan")
    documents = relationship("DocumentRecord", back_populates="shipment", cascade="all, delete-orphan")
    sensor_logs = relationship("SensorLog", back_populates="shipment", cascade="all, delete-orphan")
    blockchain_logs = relationship("BlockchainLog", back_populates="shipment", cascade="all, delete-orphan")
    ai_results = relationship("AIResult", back_populates="shipment", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="shipment", cascade="all, delete-orphan")


class HandoffRecord(Base):
    __tablename__ = "handoff_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    from_party = Column(String(255), nullable=False)
    to_party = Column(String(255), nullable=False)
    location = Column(String(500), nullable=False)
    lat = Column(Float)
    lng = Column(Float)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    temp_min = Column(Float)
    temp_max = Column(Float)
    humidity = Column(Float)
    prev_hash = Column(String(64))
    handoff_hash = Column(String(64))
    status = Column(String(50), default="completed")
    notes = Column(Text)
    signature = Column(Text)

    shipment = relationship("Shipment", back_populates="handoffs")
    documents = relationship("DocumentRecord", back_populates="handoff")
    blockchain_logs = relationship("BlockchainLog", back_populates="handoff")
    anomalies = relationship("Anomaly", back_populates="handoff")


class DocumentRecord(Base):
    __tablename__ = "document_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    handoff_id = Column(String(36), ForeignKey("handoff_records.id"))
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    file_type = Column(String(50))
    content_hash = Column(String(64), nullable=False)
    file_size = Column(Integer)
    verified = Column(Boolean, default=True)
    tampered = Column(Boolean, default=False)
    uploaded_by = Column(String(255))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    document_type = Column(String(100))
    description = Column(Text)
    storage_path = Column(String(500))

    shipment = relationship("Shipment", back_populates="documents")
    handoff = relationship("HandoffRecord", back_populates="documents")


class SensorLog(Base):
    __tablename__ = "sensor_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    device_id = Column(String(100))
    temperature = Column(Float, nullable=False)
    humidity = Column(Float)
    lat = Column(Float)
    lng = Column(Float)
    battery = Column(Float)
    door_open = Column(Boolean, default=False)
    shock = Column(Boolean, default=False)
    light = Column(Float)
    pressure = Column(Float)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="sensor_logs")


class BlockchainLog(Base):
    __tablename__ = "blockchain_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    handoff_id = Column(String(36), ForeignKey("handoff_records.id"))
    tx_hash = Column(String(100), nullable=False)
    block_number = Column(Integer)
    wallet = Column(String(100))
    network = Column(String(50), default="hyperledger_fabric")
    gas_used = Column(Integer)
    status = Column(String(50), default="confirmed")
    timestamp = Column(DateTime, default=datetime.utcnow)
    payload_hash = Column(String(64))
    contract_address = Column(String(100))

    shipment = relationship("Shipment", back_populates="blockchain_logs")
    handoff = relationship("HandoffRecord", back_populates="blockchain_logs")


class AIResult(Base):
    __tablename__ = "ai_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    risk_score = Column(Float, default=0.0)
    spoilage_risk = Column(Float, default=0.0)
    fraud_risk = Column(Float, default=0.0)
    delay_risk = Column(Float, default=0.0)
    theft_risk = Column(Float, default=0.0)
    customs_delay_risk = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    top_reasons = Column(JSON, default=[])
    recommended_action = Column(Text)
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="ai_results")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False)
    handoff_id = Column(String(36), ForeignKey("handoff_records.id"))
    anomaly_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(255))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata_ = Column("metadata", JSON, default={})

    shipment = relationship("Shipment", back_populates="anomalies")
    handoff = relationship("HandoffRecord", back_populates="anomalies")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"))
    action = Column(String(255), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(String(100))
    ip_address = Column(String(50))
    user_agent = Column(Text)
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
