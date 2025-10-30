from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime
from db import (
    record_attendance,
    list_attendance,
    get_unit_status,
    update_attendance_txid,
    get_student_wallet,
)
from hedera_utils import reward_student, publish_message


router = APIRouter()


# --- Models ---
class AttendanceIn(BaseModel):
    student_id: str
    unit: str
    txid: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


def is_within_radius(lat1, lng1, lat2, lng2, radius_meters):
    """Return True if point (lat1, lng1) is within radius_meters of (lat2, lng2)."""
    if None in (lat1, lng1, lat2, lng2, radius_meters):
        return True  # skip if incomplete (no location restriction)

    R = 6371000  # radius of Earth in meters
    dlat = radians(lat2 - lat1)
    dlon = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = R * c
    return distance <= radius_meters


# --- Endpoints ---
@router.post("/attendance")
def mark_attendance(payload: AttendanceIn):
    try:
        if not payload.student_id or not payload.unit:
            raise HTTPException(status_code=400, detail="Missing student_id or unit")

        status = get_unit_status(payload.unit)
        if not status:
            raise HTTPException(
                status_code=404, detail=f"Unit '{payload.unit}' not found in settings"
            )

        # --- 1️⃣ Check if unit is active ---
        if not status.get("is_active", False):
            raise HTTPException(
                status_code=403,
                detail=f"Attendance is disabled for unit '{payload.unit}'",
            )

        # --- 2️⃣ Check time window if provided ---
        time_limit = status.get("time_limit")
        if time_limit:
            try:
                start_str, end_str = time_limit.split("-")
                now = datetime.now().time()

                start_hour, start_minute = map(int, start_str.split(":"))
                end_hour, end_minute = map(int, end_str.split(":"))

                start_time = (
                    datetime.now()
                    .replace(
                        hour=start_hour, minute=start_minute, second=0, microsecond=0
                    )
                    .time()
                )
                end_time = (
                    datetime.now()
                    .replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
                    .time()
                )

                if not (start_time <= now <= end_time):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Attendance time window closed for '{payload.unit}'",
                    )
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid time_limit format. Use HH:MM-HH:MM"
                )

        # --- 3️⃣ Check location radius ---
        lat, lng = payload.lat, payload.lng
        ref_lat = status.get("location_lat")
        ref_lng = status.get("location_lng")
        radius = status.get("location_radius")

        if not is_within_radius(lat, lng, ref_lat, ref_lng, radius):
            raise HTTPException(
                status_code=403,
                detail=f"Outside allowed attendance radius for '{payload.unit}'",
            )

        # --- 4️⃣ Check attendance limit ---
        limit = status.get("limit") or status.get("attendance_limit")
        if limit is not None:
            records = list_attendance(limit=1000)
            unit_records = [r for r in records if r["unit"] == payload.unit]
            if len(unit_records) >= limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Attendance limit ({limit}) reached for '{payload.unit}'",
                )

        # --- 5️⃣ Record attendance initially ---
        record_attendance(payload.student_id, payload.unit, None)

        # --- 6️⃣ Reward the student ---
        txid = None
        wallet = get_student_wallet(payload.student_id)
        if wallet:
            reward_result = reward_student(wallet, amount=1)
            if reward_result.get("status") == "success":
                txid = reward_result.get("tx_id")
                update_attendance_txid(payload.student_id, payload.unit, txid)
            else:
                print(f"⚠️ Reward failed: {reward_result.get('message')}")
        else:
            print(f"⚠️ No wallet found for student {payload.student_id}")

        # --- 7️⃣ Publish message to Hedera Consensus Service ---
        try:
            publish_message(
                {
                    "student_id": payload.student_id,
                    "unit": payload.unit,
                    "status": "present",
                    "txid": txid,
                    "timestamp": datetime.now().isoformat(),
                }
            )
        except Exception as e:
            print(f"⚠️ Failed to publish HCS message: {e}")

        return {
            "ok": True,
            "student_id": payload.student_id,
            "unit": payload.unit,
            "txid": txid,
            "message": (
                f"✅ Attendance recorded for {payload.unit}. Reward sent."
                if txid
                else f"✅ Attendance recorded (no reward)."
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attendance failed: {str(e)}")


# --- GET endpoints ---
@router.get("/attendance/list")
def get_attendance(limit: int = 50):
    """Return last N attendance records."""
    try:
        return {"records": list_attendance(limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {str(e)}")


@router.get("/attendance/history")
def attendance_history(
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    limit: int = 20,
):
    """Return latest attendance records, optionally filtered by student."""
    try:
        records = list_attendance(limit=1000)
        if student_id:
            records = [r for r in records if r["student_id"] == student_id]
        return {"records": records[:limit]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History fetch failed: {str(e)}")
