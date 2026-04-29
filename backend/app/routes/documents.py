import hashlib
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models import DocumentRecord, Shipment
from app.schemas import DocumentOut, DocumentVerifyOut
from app.auth import get_current_user
from app.models import User
from app.config import settings

router = APIRouter()

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "text/csv", "application/xml", "text/xml"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".csv", ".xml"}


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    shipment_id: UUID = Form(...),
    handoff_id: Optional[UUID] = Form(None),
    document_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {ALLOWED_EXTENSIONS}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    content_hash = compute_file_hash(content)

    # Store file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{content_hash[:8]}_{file.filename}"
    storage_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    with open(storage_path, "wb") as f:
        f.write(content)

    doc = DocumentRecord(
        shipment_id=shipment_id,
        handoff_id=handoff_id,
        filename=safe_filename,
        original_filename=file.filename,
        file_type=ext.lstrip("."),
        content_hash=content_hash,
        file_size=len(content),
        verified=True,
        tampered=False,
        uploaded_by=current_user.email,
        document_type=document_type,
        description=description,
        storage_path=storage_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.get("/shipment/{shipment_id}", response_model=List[DocumentOut])
async def get_documents(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = db.query(DocumentRecord).filter(DocumentRecord.shipment_id == shipment_id).all()
    return [DocumentOut.model_validate(d) for d in docs]


@router.post("/verify/{document_id}", response_model=DocumentVerifyOut)
async def verify_document(
    document_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    content = await file.read()
    computed_hash = compute_file_hash(content)
    match = computed_hash == doc.content_hash

    if not match:
        doc.tampered = True
        doc.verified = False
        db.commit()

    return DocumentVerifyOut(
        document_id=document_id,
        verified=match,
        tampered=not match,
        original_hash=doc.content_hash,
        computed_hash=computed_hash,
        match=match,
        message="Document verified - hashes match" if match else "TAMPERED - hash mismatch detected!",
    )
