"""
CryoTrace Seed Database — SQLite/PostgreSQL compatible
"""
import hashlib
import random
import uuid as uuid_mod
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    User, Shipment, HandoffRecord, DocumentRecord,
    SensorLog, BlockchainLog, AIResult, Anomaly,
    UserRole, ShipmentStatus, ShipmentCategory,
    AnomalyType, AnomalySeverity
)
from app.auth import hash_password
from app.services.hash_engine import compute_handoff_hash, generate_genesis_hash


def make_tx_hash() -> str:
    return "0x" + hashlib.sha256(str(uuid_mod.uuid4()).encode()).hexdigest()[:64]


def make_file_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


async def seed_database():
    db: Session = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return

        U1 = "00000000-0000-0000-0000-000000000001"
        U2 = "00000000-0000-0000-0000-000000000002"
        U3 = "00000000-0000-0000-0000-000000000003"
        U4 = "00000000-0000-0000-0000-000000000004"
        U5 = "00000000-0000-0000-0000-000000000005"
        U6 = "00000000-0000-0000-0000-000000000006"
        U7 = "00000000-0000-0000-0000-000000000007"

        users = [
            User(id=U1, name="Alice Sharma", email="admin@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.ADMIN.value, company="CryoTrace HQ"),
            User(id=U2, name="Dr. Rajesh Kumar", email="regulator@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.REGULATOR.value, company="WHO Cold Chain Division"),
            User(id=U3, name="Marcus Diaz", email="operator@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.OPERATOR.value, company="Pfizer Global Supply"),
            User(id=U5, name="Vendor User", email="vendor@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.VENDOR.value, company="Global Vendor Inc"),
            User(id=U6, name="Distributor Hub", email="hub@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.HUB.value, company="Central Logistics Hub"),
            User(id=U7, name="End Customer", email="customer@cryotrace.io", password_hash=hash_password("cryotrace123"), role=UserRole.CUSTOMER.value, company="Retail Pharmacy"),
        ]
        for u in users:
            db.add(u)
        db.flush()

        # ── Shipment 1: Pfizer Vaccine ─────────────────────────────────
        S1 = "10000000-0000-0000-0000-000000000001"
        s1_genesis = generate_genesis_hash("PFZ-2024-MUM-001", "Mumbai, India", "2024-02-15")
        s1 = Shipment(
            id=S1, name="Pfizer BNT162b2 mRNA Vaccine Batch A7", batch_no="PFZ-2024-MUM-001",
            category=ShipmentCategory.VACCINES.value, origin="Mumbai, India", destination="Berlin, Germany",
            status=ShipmentStatus.FLAGGED.value, created_at=datetime.utcnow() - timedelta(days=18),
            eta=datetime.utcnow() + timedelta(days=2), created_by=U1,
            description="Ultra-cold chain BNT162b2 COVID-19 vaccine. Requires -70°C storage.",
            temp_min_required=-80.0, temp_max_required=-60.0, weight_kg=450.0,
            quantity_units=50000, unit_value_usd=22.50, integrity_score=72.0,
            freshness_score=85.0, risk_score=68.5, genesis_hash=s1_genesis,
            carbon_footprint_kg=2340.5, sustainability_score=71.0,
        )
        db.add(s1); db.flush()

        s1_handoffs = [
            ("Pfizer Manufacturing Mumbai", "DHL Pharma Hub Mumbai", "Mumbai Cold Storage, India", 19.076, 72.877, -72.0, -70.0),
            ("DHL Pharma Hub Mumbai", "Emirates SkyCargo Dubai", "Dubai International Airport, UAE", 25.253, 55.365, -71.5, -69.5),
            ("Emirates SkyCargo Dubai", "Lufthansa Cargo Frankfurt", "Frankfurt Airport, Germany", 50.037, 8.562, -8.0, -6.0),
            ("Lufthansa Cargo Frankfurt", "Pfizer Berlin Distribution", "Berlin Distribution Center, Germany", 52.520, 13.405, -71.0, -69.0),
        ]
        prev = s1_genesis
        base = datetime.utcnow() - timedelta(days=16)
        s1h = []
        for i, (frm, to, loc, lat, lng, tmin, tmax) in enumerate(s1_handoffs):
            ts = base + timedelta(days=i*3)
            new_hash = compute_handoff_hash(prev, to, ts.isoformat(), tmin, tmax, loc)
            hid = str(uuid_mod.uuid4())
            h = HandoffRecord(id=hid, shipment_id=S1, sequence=i+1, from_party=frm, to_party=to,
                location=loc, lat=lat, lng=lng, timestamp=ts, temp_min=tmin, temp_max=tmax,
                humidity=random.uniform(20,40), prev_hash=prev, handoff_hash=new_hash,
                notes="Standard handoff" if i != 2 else "Reefer unit malfunction detected")
            db.add(h); db.flush(); s1h.append(hid); prev = new_hash
            db.add(BlockchainLog(shipment_id=S1, handoff_id=hid, tx_hash=make_tx_hash(),
                block_number=random.randint(38000000,39000000), wallet="0x7F3aB12C9D4E5F6A8B1C2D3E4F5A6B7C8D9E0F1",
                status="confirmed", payload_hash=new_hash, contract_address="0xCryoTrace1234567890abcdefABCDEF1234567890"))

        db.add(Anomaly(shipment_id=S1, handoff_id=s1h[2], anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
            severity=AnomalySeverity.CRITICAL.value,
            description="Critical temperature breach at Frankfurt: -6°C recorded, required ≤-60°C. Reefer unit failure suspected."))

        for fname, dtype in [("WHO_CCertificate.pdf","certificate"),("EU_Import_Auth.pdf","authorization"),("QRC_PFZ.pdf","certificate"),("Dubai_Transit.pdf","customs")]:
            db.add(DocumentRecord(shipment_id=S1, filename=fname, original_filename=fname, file_type="pdf",
                content_hash=make_file_hash(fname+"s1"), file_size=random.randint(50000,500000),
                verified=True, tampered=False, uploaded_by="operator@cryotrace.io", document_type=dtype))

        for i in range(168):
            ts = datetime.utcnow() - timedelta(hours=168-i)
            temp = random.uniform(-20,-5) if 80<=i<=96 else random.uniform(-73,-68)
            db.add(SensorLog(shipment_id=S1, device_id="CRYO-001", temperature=temp,
                humidity=random.uniform(15,35), lat=19.076+random.uniform(-0.01,0.01),
                lng=72.877+random.uniform(-0.01,0.01), battery=max(10,100-i*0.5),
                door_open=False, shock=random.choice([False,False,False,True]), timestamp=ts))

        db.add(AIResult(shipment_id=S1, risk_score=68.5, spoilage_risk=72.0, fraud_risk=35.0,
            delay_risk=45.0, theft_risk=20.0, customs_delay_risk=38.0, confidence=87.3,
            top_reasons=["Critical temperature breach at Frankfurt","Reefer unit anomaly hours 80-96","Ultra-cold chain breach: efficacy compromised","Missing WHO incident documentation"],
            recommended_action="QUARANTINE: Halt distribution. Conduct potency testing. File WHO incident report.",
            model_version="1.0.0"))

        # ── Shipment 2: Mango Export ───────────────────────────────────
        S2 = "20000000-0000-0000-0000-000000000002"
        s2_genesis = generate_genesis_hash("MANGO-2024-RTN-002", "Ratnagiri, India", "2024-03-10")
        s2 = Shipment(
            id=S2, name="Alphonso Mango Export – Premium Grade A", batch_no="MANGO-2024-RTN-002",
            category=ShipmentCategory.PERISHABLES.value, origin="Ratnagiri, Maharashtra, India",
            destination="Rotterdam, Netherlands", status=ShipmentStatus.DELIVERED.value,
            created_at=datetime.utcnow()-timedelta(days=30), eta=datetime.utcnow()-timedelta(days=5),
            created_by=U3, description="Premium Alphonso mangoes, GI-tagged, export grade.",
            temp_min_required=12.0, temp_max_required=14.0, weight_kg=18000.0,
            quantity_units=36000, unit_value_usd=8.50, integrity_score=98.5,
            freshness_score=95.2, risk_score=8.3, genesis_hash=s2_genesis,
            carbon_footprint_kg=4820.0, sustainability_score=89.5,
        )
        db.add(s2); db.flush()

        s2_handoffs = [
            ("Ratnagiri Farmers Collective", "APEDA Export Hub Mumbai", "Ratnagiri Pack House, Maharashtra", 16.990, 73.312, 12.5, 13.5),
            ("APEDA Export Hub Mumbai", "Maersk Shipping Mumbai", "Nhava Sheva Port, Mumbai", 18.938, 72.951, 12.8, 13.8),
            ("Maersk Shipping Mumbai", "Port of Rotterdam Customs", "Port of Rotterdam, Netherlands", 51.922, 4.479, 13.0, 13.5),
            ("Port of Rotterdam Customs", "Albert Heijn Distribution", "Rotterdam DC, Netherlands", 51.924, 4.477, 12.5, 13.0),
        ]
        prev = s2_genesis
        base = datetime.utcnow() - timedelta(days=28)
        for i, (frm, to, loc, lat, lng, tmin, tmax) in enumerate(s2_handoffs):
            ts = base + timedelta(days=i*6)
            new_hash = compute_handoff_hash(prev, to, ts.isoformat(), tmin, tmax, loc)
            hid = str(uuid_mod.uuid4())
            h = HandoffRecord(id=hid, shipment_id=S2, sequence=i+1, from_party=frm, to_party=to,
                location=loc, lat=lat, lng=lng, timestamp=ts, temp_min=tmin, temp_max=tmax,
                humidity=random.uniform(85,95), prev_hash=prev, handoff_hash=new_hash,
                notes="All checks passed. APEDA certificate verified.")
            db.add(h); db.flush(); prev = new_hash
            db.add(BlockchainLog(shipment_id=S2, handoff_id=hid, tx_hash=make_tx_hash(),
                block_number=random.randint(39000000,40000000), wallet="0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
                status="confirmed", payload_hash=new_hash, contract_address="0xCryoTrace1234567890abcdefABCDEF1234567890"))

        for fname, dtype in [("APEDA_Phytosanitary.pdf","certificate"),("GI_Tag_Alphonso.pdf","certificate"),("Maersk_BillOfLading.pdf","bill_of_lading"),("EU_SPS_Compliance.pdf","compliance"),("Rotterdam_Customs.pdf","customs")]:
            db.add(DocumentRecord(shipment_id=S2, filename=fname, original_filename=fname, file_type="pdf",
                content_hash=make_file_hash(fname+"s2"), file_size=random.randint(80000,600000),
                verified=True, tampered=False, uploaded_by="operator@cryotrace.io", document_type=dtype))

        for i in range(200):
            ts = datetime.utcnow() - timedelta(hours=200-i)
            db.add(SensorLog(shipment_id=S2, device_id="FRESH-002", temperature=random.uniform(12.3,13.9),
                humidity=random.uniform(88,95), lat=18.938+random.uniform(-2,5),
                lng=72.951+random.uniform(-1,10), battery=max(20,100-i*0.1),
                door_open=False, shock=False, timestamp=ts))

        db.add(AIResult(shipment_id=S2, risk_score=8.3, spoilage_risk=5.2, fraud_risk=3.1,
            delay_risk=12.0, theft_risk=2.5, customs_delay_risk=8.0, confidence=96.1,
            top_reasons=["All temperatures within ±1°C of target","Complete documentation chain verified","No anomalies detected across 28-day transit"],
            recommended_action="CLEAR FOR DISTRIBUTION: All cold chain requirements met. Safe for retail.", model_version="1.0.0"))

        # ── Shipment 3: Hepatitis Vaccine ──────────────────────────────
        S3 = "30000000-0000-0000-0000-000000000003"
        s3_genesis = generate_genesis_hash("HEP-2024-DEL-003", "Delhi, India", "2024-04-01")
        s3 = Shipment(
            id=S3, name="Serum Institute Hepatitis B Vaccine – Batch HB-2024-Q1", batch_no="HEP-2024-DEL-003",
            category=ShipmentCategory.VACCINES.value, origin="Pune, Maharashtra, India",
            destination="Nairobi, Kenya", status=ShipmentStatus.QUARANTINED.value,
            created_at=datetime.utcnow()-timedelta(days=10), eta=datetime.utcnow()+timedelta(days=5),
            created_by=U2, description="Serum Institute Hepatitis B for UNICEF Kenya. Missing import permit.",
            temp_min_required=2.0, temp_max_required=8.0, weight_kg=320.0,
            quantity_units=200000, unit_value_usd=3.80, integrity_score=55.0,
            freshness_score=78.0, risk_score=82.4, genesis_hash=s3_genesis,
            carbon_footprint_kg=980.0, sustainability_score=60.0,
        )
        db.add(s3); db.flush()

        s3_handoffs = [
            ("Serum Institute Pune", "Air India Cargo Mumbai", "Pune Vaccine Facility, Maharashtra", 18.520, 73.856, 4.0, 6.0),
            ("Air India Cargo Mumbai", "Nairobi JKIA Customs", "Jomo Kenyatta Airport, Nairobi", -1.319, 36.927, 12.0, 15.0),
        ]
        prev = s3_genesis
        base = datetime.utcnow() - timedelta(days=8)
        s3h = []
        for i, (frm, to, loc, lat, lng, tmin, tmax) in enumerate(s3_handoffs):
            ts = base + timedelta(days=i*3)
            new_hash = compute_handoff_hash(prev, to, ts.isoformat(), tmin, tmax, loc)
            hid = str(uuid_mod.uuid4())
            h = HandoffRecord(id=hid, shipment_id=S3, sequence=i+1, from_party=frm, to_party=to,
                location=loc, lat=lat, lng=lng, timestamp=ts, temp_min=tmin, temp_max=tmax,
                humidity=random.uniform(40,60), prev_hash=prev, handoff_hash=new_hash,
                status="completed" if i==0 else "held",
                notes="Cleared" if i==0 else "Held by customs - missing WHO import permit")
            db.add(h); db.flush(); s3h.append(hid); prev = new_hash
            db.add(BlockchainLog(shipment_id=S3, handoff_id=hid, tx_hash=make_tx_hash(),
                block_number=random.randint(40000000,41000000), wallet="0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
                status="confirmed" if i==0 else "pending", payload_hash=new_hash,
                contract_address="0xCryoTrace1234567890abcdefABCDEF1234567890"))

        db.add(DocumentRecord(shipment_id=S3, filename="Serum_MFG_Certificate.pdf",
            original_filename="Serum_MFG_Certificate.pdf", file_type="pdf",
            content_hash=make_file_hash("serum_hep_cert"), file_size=245000,
            verified=True, tampered=False, uploaded_by="regulator@cryotrace.io", document_type="certificate"))

        db.add(Anomaly(shipment_id=S3, handoff_id=s3h[1], anomaly_type=AnomalyType.MISSING_DOCUMENTS.value,
            severity=AnomalySeverity.CRITICAL.value,
            description="Missing: WHO Import Permit, KEBS Approval, Cold Chain Clearance, UNICEF Delivery Order."))
        db.add(Anomaly(shipment_id=S3, handoff_id=s3h[1], anomaly_type=AnomalyType.TEMPERATURE_EXCEEDANCE.value,
            severity=AnomalySeverity.HIGH.value,
            description="Temperature 12-15°C at Nairobi. Hepatitis B vaccine requires 2-8°C."))
        db.add(Anomaly(shipment_id=S3, handoff_id=s3h[1], anomaly_type=AnomalyType.EXCESS_DWELL_TIME.value,
            severity=AnomalySeverity.MEDIUM.value,
            description="Shipment held at Nairobi customs 72+ hours due to missing documentation."))

        for i in range(240):
            ts = datetime.utcnow() - timedelta(hours=240-i)
            temp = random.uniform(11,16) if i > 160 else random.uniform(3.5,7.5)
            db.add(SensorLog(shipment_id=S3, device_id="VACC-003", temperature=temp,
                humidity=random.uniform(45,65), lat=-1.319 if i>160 else 18.520,
                lng=36.927 if i>160 else 73.856, battery=max(5,80-i*0.3),
                door_open=random.choice([False,False,False,True]) if i>180 else False,
                shock=False, timestamp=ts))

        db.add(AIResult(shipment_id=S3, risk_score=82.4, spoilage_risk=65.0, fraud_risk=45.0,
            delay_risk=90.0, theft_risk=30.0, customs_delay_risk=95.0, confidence=91.8,
            top_reasons=["3 of 4 required documents missing","Temperature 12-15°C vs 2-8°C required","Customs hold >72h","Low sensor battery","Potential vaccine potency compromise"],
            recommended_action="URGENT: File emergency import permit. Engage UNICEF Kenya. Conduct potency testing. Return batch if permit not obtained within 48h.",
            model_version="1.0.0"))

        db.commit()
        print("✓ CryoTrace seeded with 3 demo shipments.")

    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()
