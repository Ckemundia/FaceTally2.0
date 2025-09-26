# routes/unit_settings.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import set_unit_status, get_unit_status

router = APIRouter()

class UnitStatusIn(BaseModel):
    unit_code: str
    is_active: bool
    attendance_limit: int | None = None

@router.post("/unit/status")
def update_unit_status(payload: UnitStatusIn):
    try:
        set_unit_status(payload.unit_code, payload.is_active, payload.attendance_limit)
        return {"ok": True, "unit_code": payload.unit_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update unit status: {e}")

@router.get("/unit/status/{unit_code}")
def fetch_unit_status(unit_code: str):
    try:
        return get_unit_status(unit_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status: {e}")
