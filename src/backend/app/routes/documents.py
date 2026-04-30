"""
Document management routes for CryoTrace.

Two-tier document security:
  Tier 1 (Blockchain): SHA-256 hash anchored immutably on Hyperledger Fabric
  Tier 2 (Local):      File bytes stored in ./uploads/ — served on demand

Verification flow:
  User re-uploads (or system re-reads) the file → computes SHA-256 →
  queries on-chain hash via VerifyDocument chaincode →
  compares the two hashes → match = authentic, mismatch = TAMPERED
"""
import hashlib
import mimetypes
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models import DocumentRecord, Shipment
from app.schemas import DocumentOut, DocumentVerifyOut
from app.auth import get_current_user
from app.models import User
from app.config import settings
from app.blockchain.ledger import anchor_document_on_chain, verify_document_on_chain

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".csv", ".xml"}


def compute_file_hash(file_bytes: bytes) -> str:
    """SHA-256 of raw file bytes — format-agnostic, works for PDF, JPG, PNG, etc."""
    return hashlib.sha256(file_bytes).hexdigest()


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    shipment_id:   UUID          = Form(...),
    handoff_id:    Optional[UUID] = Form(None),
    document_type: Optional[str] = Form(None),
    description:   Optional[str] = Form(None),
    file: UploadFile             = File(...),
    db:  Session                 = Depends(get_db),
    current_user: User           = Depends(get_current_user),
):
    """
    Upload a document (PDF/image) for a shipment.

    Steps:
      1. Read all file bytes
      2. Compute SHA-256 hash
      3. Save bytes to local disk (./uploads/)
      4. Anchor the hash on Hyperledger Fabric (immutable, tamper-proof)
      5. Store metadata + blockchain TX hash in SQLite
    """
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    ext = os.path.splitext(file.filename or "file.bin")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {ALLOWED_EXTENSIONS}",
        )

    # 1 — Read bytes
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    # 2 — SHA-256 hash of the raw file bytes
    content_hash = compute_file_hash(content)

    # 3 — Persist file to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{content_hash[:8]}_{file.filename}"
    storage_path  = os.path.join(settings.UPLOAD_DIR, safe_filename)
    with open(storage_path, "wb") as f:
        f.write(content)

    # 4 — Anchor hash on Hyperledger Fabric (non-blocking; falls back if network down)
    import uuid as uuid_lib
    doc_id = str(uuid_lib.uuid4())

    chain_result = await anchor_document_on_chain(
        shipment_id  = str(shipment_id),
        doc_id       = doc_id,
        doc_hash     = content_hash,
        doc_type     = document_type or "document",
        filename     = file.filename or safe_filename,
        uploaded_by  = current_user.email,
    )

    # 5 — Persist metadata to DB
    doc = DocumentRecord(
        id               = doc_id,
        shipment_id      = shipment_id,
        handoff_id       = handoff_id,
        filename         = safe_filename,
        original_filename= file.filename,
        file_type        = ext.lstrip("."),
        content_hash     = content_hash,
        file_size        = len(content),
        verified         = True,
        tampered         = False,
        uploaded_by      = current_user.email,
        document_type    = document_type,
        description      = description,
        storage_path     = storage_path,
        blockchain_tx    = chain_result.get("tx_hash"),        # proof of anchoring
        blockchain_status= chain_result.get("status", "simulated"),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentOut.model_validate(doc)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/shipment/{shipment_id}", response_model=List[DocumentOut])
async def get_documents(
    shipment_id:  UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    docs = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == shipment_id).all()
    return [DocumentOut.model_validate(d) for d in docs]


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/{document_id}/download")
async def download_document(
    document_id:  UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Serve the original file bytes for download.
    Access is restricted to authenticated users only.
    """
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.storage_path or not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    mime_type, _ = mimetypes.guess_type(doc.original_filename or doc.filename)
    mime_type = mime_type or "application/octet-stream"

    return FileResponse(
        path          = doc.storage_path,
        filename      = doc.original_filename or doc.filename,
        media_type    = mime_type,
    )


# ── Verify ────────────────────────────────────────────────────────────────────

@router.post("/verify/{document_id}", response_model=DocumentVerifyOut)
async def verify_document(
    document_id:  UUID,
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    """
    Verify a document against its on-chain anchored hash.

    Process:
      1. Re-read the uploaded file and compute its SHA-256
      2. Query Hyperledger Fabric for the original anchored hash
      3. Compare — match means authentic, mismatch means tampered
      4. If Fabric is unreachable, fall back to DB hash comparison
    """
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    content       = await file.read()
    computed_hash = compute_file_hash(content)

    # Try on-chain verification first (the tamper-proof source of truth)
    chain_verify  = await verify_document_on_chain(
        shipment_id = str(doc.shipment_id),
        doc_id      = str(document_id),
    )

    if chain_verify["status"] == "on_chain":
        # Compare recomputed hash against the BLOCKCHAIN record
        original_hash = chain_verify["doc_hash"]
        source        = "blockchain"
    else:
        # Fabric unavailable — fall back to DB hash (less tamper-proof)
        original_hash = doc.content_hash
        source        = "database_fallback"

    match = computed_hash == original_hash

    if not match:
        doc.tampered = True
        doc.verified = False
        db.commit()

    return DocumentVerifyOut(
        document_id   = document_id,
        verified      = match,
        tampered      = not match,
        original_hash = original_hash,
        computed_hash = computed_hash,
        match         = match,
        message       = (
            f"✅ Document verified — hashes match ({source})"
            if match else
            f"🚨 TAMPERED — hash mismatch detected! (verified against {source})"
        ),
    )


# ── Public verify (no auth — for consumer QR scan) ────────────────────────────

@router.get("/public-verify/{shipment_id}/{document_id}")
async def public_verify_document_by_hash(
    shipment_id: str,
    document_id: str,
    db:          Session = Depends(get_db),
):
    """
    Public endpoint — no login required.
    Called from the consumer QR verify page.
    Returns the on-chain anchored hash metadata so consumers can see
    what was locked at upload time.
    """
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chain_verify = await verify_document_on_chain(
        shipment_id = shipment_id,
        doc_id      = document_id,
    )

    return {
        "document_id":      document_id,
        "shipment_id":      shipment_id,
        "original_filename": doc.original_filename,
        "document_type":    doc.document_type,
        "content_hash":     doc.content_hash,
        "uploaded_at":      doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "uploaded_by":      doc.uploaded_by,
        "blockchain_tx":    doc.blockchain_tx,
        "blockchain_status": doc.blockchain_status,
        "on_chain":         chain_verify,
        "tampered":         doc.tampered,
    }
