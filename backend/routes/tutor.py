# routes/tutor.py
from fastapi import APIRouter, HTTPException, Query
from db import get_db
from datetime import date

router = APIRouter()


# ------------------ Toggle Unit ------------------ #
@router.post("/units/{unit_code}/toggle")
def toggle_unit(unit_code: str, enabled: bool = Query(...)):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO unit_settings (unit_code, is_active)
            VALUES (?, ?)
            ON CONFLICT(unit_code) DO UPDATE SET is_active = excluded.is_active
        """,
            (unit_code, int(enabled)),
        )
        conn.commit()
        return {"unit_code": unit_code, "status": "active" if enabled else "inactive"}
    finally:
        conn.close()


# ------------------ Set Unit Settings ------------------ #
@router.post("/units/{unit_code}/settings")
def set_unit_settings(unit_code: str, slots: int = None, time_limit: str = None):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO unit_settings (unit_code, attendance_limit, time_limit)
            VALUES (?, ?, ?)
            ON CONFLICT(unit_code) DO UPDATE 
              SET attendance_limit = excluded.attendance_limit,
                  time_limit = excluded.time_limit
        """,
            (unit_code, slots, time_limit),
        )
        conn.commit()
        return {"unit_code": unit_code, "slots": slots, "time_limit": time_limit}
    finally:
        conn.close()


# ------------------ Get Unit Statuses ------------------ #
@router.get("/units/status")
def get_unit_status():
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT u.unit_code, u.unit_name, 
                   COALESCE(us.is_active, 0) as is_active,
                   us.time_limit
            FROM units u
            LEFT JOIN unit_settings us ON u.unit_code = us.unit_code
        """
        )
        rows = cur.fetchall()

        units = [
            {
                "unit_code": r[0],
                "unit_name": r[1],
                "is_active": bool(r[2]),
                "time_limit": r[3],
            }
            for r in rows
        ]

        return {
            "units": units,
            "enabledMap": {r[0]: bool(r[2]) for r in rows},
            "timeLimitMap": {r[0]: r[3] for r in rows if r[3] is not None},
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Could not fetch unit statuses: {str(e)}"
        )
    finally:
        conn.close()


# ------------------ Tutor Stats ------------------ #
@router.get("/stats")
def tutor_stats():
    conn = get_db()
    cur = conn.cursor()
    try:
        # total students
        cur.execute("SELECT COUNT(*) FROM users")
        total_students = cur.fetchone()[0] or 0

        # attendance today
        today = date.today().isoformat()
        cur.execute(
            """
            SELECT COUNT(DISTINCT student_id) 
            FROM attendance 
            WHERE date(timestamp) = ?
        """,
            (today,),
        )
        present_today = cur.fetchone()[0] or 0

        # rewards
        try:
            cur.execute("SELECT COUNT(*) FROM rewards")
            rewards = cur.fetchone()[0] or 0
        except:
            rewards = 0

        return {
            "total_students": total_students,
            "present_today": present_today,
            "rewards": rewards,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch stats: {str(e)}")
    finally:
        conn.close()
