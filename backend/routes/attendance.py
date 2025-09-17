from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import record_attendance, list_attendance

router = APIRouter()

# --- Models ---
class AttendanceIn(BaseModel):
    student_id: str
    unit: str
    txid: Optional[str] = None

# --- Endpoints ---
@router.post("/attendance")
def mark_attendance(payload: AttendanceIn):
    """
    Record a new attendance entry.
    """
    try:
        record_attendance(payload.student_id, payload.unit, payload.txid)
        return {"ok": True, "student_id": payload.student_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/attendance/list")
def get_attendance(limit: int = 50):
    """
    Return last N attendance records.
    """
    try:
        records = list_attendance(limit=limit)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/attendance/history")
def attendance_history(limit: int = 20):
    """
    Return latest attendance records (for dashboard view).
    """
    return {"records": list_attendance(limit)}
