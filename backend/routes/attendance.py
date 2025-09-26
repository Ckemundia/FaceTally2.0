from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import record_attendance, list_attendance, get_unit_status

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
    ✅ Only allowed if unit is active.
    ✅ Respects attendance limit if set.
    """
    try:
        # --- Validate input ---
        if not payload.student_id or not payload.unit:
            raise HTTPException(status_code=400, detail="Missing student_id or unit")

        # --- Check unit status ---
        status = get_unit_status(payload.unit)
        if not status:
            raise HTTPException(status_code=404, detail=f"Unit '{payload.unit}' not found in settings")

        if not status.get("is_active", False):
            raise HTTPException(status_code=403, detail=f"Attendance is disabled for unit '{payload.unit}'")

        # --- Enforce attendance limit (if set) ---
        limit = status.get("limit")
        if limit is not None:
            # Retrieve only this unit’s records to avoid large queries
            records = list_attendance(limit=1000)
            unit_records = [r for r in records if r["unit"] == payload.unit]
            if len(unit_records) >= limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Attendance limit ({limit}) reached for unit '{payload.unit}'"
                )

        # --- Record attendance ---
        record_attendance(payload.student_id, payload.unit, payload.txid)

        return {
            "ok": True,
            "student_id": payload.student_id,
            "unit": payload.unit,
            "message": f"Attendance recorded successfully for {payload.unit}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attendance failed: {str(e)}")


@router.get("/attendance/list")
def get_attendance(limit: int = 50):
    """Return last N attendance records."""
    try:
        return {"records": list_attendance(limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {str(e)}")


@router.get("/attendance/history")
def attendance_history(limit: int = 20):
    """Return latest attendance records (for dashboard view)."""
    try:
        return {"records": list_attendance(limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History fetch failed: {str(e)}")
