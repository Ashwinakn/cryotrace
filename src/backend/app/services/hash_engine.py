import hashlib


def generate_genesis_hash(batch_no: str, origin: str, eta: str) -> str:
    """Generate the root hash for a new shipment."""
    raw = f"GENESIS:{batch_no}:{origin}:{eta}"
    return hashlib.sha256(raw.encode()).hexdigest()


def compute_handoff_hash(
    prev_hash: str,
    to_party: str,
    timestamp: str,
    temp_min: float,
    temp_max: float,
    location: str,
) -> str:
    """
    SHA256(prev_hash + to_party + timestamp + temp_min + temp_max + location)
    Creates an immutable chain link.
    """
    raw = f"{prev_hash}{to_party}{timestamp}{temp_min}{temp_max}{location}"
    return hashlib.sha256(raw.encode()).hexdigest()


def verify_hash_chain(handoffs: list) -> dict:
    """Verify the entire hash chain for a shipment's handoffs."""
    issues = []
    for i, h in enumerate(handoffs):
        if i == 0:
            continue
        expected_prev = handoffs[i - 1].handoff_hash
        if h.prev_hash != expected_prev:
            issues.append({
                "sequence": h.sequence,
                "handoff_id": str(h.id),
                "expected_prev_hash": expected_prev,
                "actual_prev_hash": h.prev_hash,
                "tampered": True,
            })

    return {
        "chain_valid": len(issues) == 0,
        "total_links": len(handoffs),
        "broken_links": len(issues),
        "issues": issues,
    }
