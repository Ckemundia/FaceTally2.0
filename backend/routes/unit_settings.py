from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import set_unit_status, get_unit_status

router = APIRouter()


class UnitStatusIn(BaseModel):
    unit_code: str
    is_active: bool
    attendance_limit: int | None = None
    time_limit: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    location_radius: float | None = None


@router.post("/unit/status")
def update_unit_status(payload: UnitStatusIn):
    try:
        set_unit_status(
            payload.unit_code,
            payload.is_active,
            payload.attendance_limit,
            payload.time_limit,
            payload.location_lat,
            payload.location_lng,
            payload.location_radius,
        )
        return {"ok": True, "unit_code": payload.unit_code}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update unit status: {e}",
        )


from datetime import datetime


@router.get("/unit/status/{unit_code}")
def fetch_unit_status(unit_code: str):
    """
    Fetch the current status for a unit.
    Automatically deactivates the unit if its time limit has expired.
    """
    try:
        status = get_unit_status(unit_code)
        if not status:
            raise HTTPException(status_code=404, detail="Unit not found")

        # ⏰ Auto-deactivate if time expired
        if status.get("is_active") and status.get("time_limit"):
            try:
                start_str, end_str = status["time_limit"].split("-")
                now = datetime.now().time()
                end_hour, end_minute = map(int, end_str.split(":"))
                end_time = (
                    datetime.now()
                    .replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
                    .time()
                )

                if now > end_time:
                    # Deactivate unit automatically
                    set_unit_status(
                        unit_code,
                        False,
                        status.get("attendance_limit"),
                        status.get("time_limit"),
                        status.get("location_lat"),
                        status.get("location_lng"),
                        status.get("location_radius"),
                    )
                    status["is_active"] = False
            except Exception as e:
                print(f"[Auto-deactivate error] {unit_code}: {e}")

        return status

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status: {e}")


@router.get("/unit/settings")
def get_all_unit_settings():
    """
    Return all unit settings from the database for the Tutor Dashboard.
    """
    try:
        from db import get_all_unit_statuses  # We'll add this helper next

        return get_all_unit_statuses()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load unit settings: {e}"
        )
