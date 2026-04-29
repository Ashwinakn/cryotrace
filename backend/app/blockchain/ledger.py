"""
Blockchain ledger integration for CryoTrace.
Simulates Hyperledger Fabric record-writing.
"""
import hashlib
import random
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import HandoffRecord, Shipment, BlockchainLog


def record_handoff_on_chain(
    handoff: HandoffRecord,
    shipment: Shipment,
    db: Session,
) -> BlockchainLog:
    """
    Write a handoff record to the blockchain ledger.
    In production this calls the Fabric SDK.
    For demo: simulates a confirmed transaction.
    """
    # Construct payload
    payload = (
        f"{shipment.id}:{handoff.id}:{handoff.handoff_hash}:"
        f"{handoff.timestamp.isoformat()}:{handoff.to_party}"
    )
    payload_hash = hashlib.sha256(payload.encode()).hexdigest()

    # Simulated transaction
    tx_hash = "0x" + hashlib.sha256(f"{payload_hash}{uuid.uuid4()}".encode()).hexdigest()
    block_number = random.randint(42000000, 43000000)

    log = BlockchainLog(
        shipment_id=shipment.id,
        handoff_id=handoff.id,
        tx_hash=tx_hash,
        block_number=block_number,
        wallet="0x7F3aB12C9D4E5F6A8B1C2D3E4F5A6B7C8D9E0F1",
        network="hyperledger_fabric",
        gas_used=random.randint(21000, 65000),
        status="confirmed",
        payload_hash=payload_hash,
        contract_address="0xCryoTrace1234567890abcdefABCDEF1234567890",
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def verify_on_chain(tx_hash: str) -> dict:
    """
    Verify a transaction on chain.
    In production: calls Fabric SDK.
    """
    return {
        "tx_hash": tx_hash,
        "status": "confirmed",
        "confirmations": random.randint(12, 500),
        "network": "hyperledger_fabric",
        "block_explorer_url": f"https://explorer.hyperledger.org/tx/{tx_hash}",
        "verified": True,
    }
