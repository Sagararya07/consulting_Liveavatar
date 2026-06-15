import os
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import IngestResponse
from services.ingestion_service import ingest_document

router = APIRouter(prefix="/admin", tags=["admin"])

LOG_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEBUG_LOG = os.path.join(LOG_DIR, "ingest_debug.log")


def _write_log(msg: str):
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


@router.post("/upload", response_model=IngestResponse)
async def upload_document(file: UploadFile = File(...)):
    _write_log(f"--- /admin/upload endpoint hit, filename={file.filename} ---")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = file.filename.lower().split(".")[-1]
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported."
        )

    file_bytes = await file.read()
    _write_log(f"Read {len(file_bytes)} bytes from uploaded file")

    try:
        chunks_stored = await ingest_document(file_bytes, file.filename)
        _write_log(f"ingest_document returned: {chunks_stored}")
    except Exception as e:
        _write_log(f"ERROR in ingest_document: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

    return IngestResponse(
        message=f"'{file.filename}' ingested successfully.",
        chunks_stored=chunks_stored,
    )
