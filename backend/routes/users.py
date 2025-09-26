# routes/users.py
from fastapi import APIRouter, HTTPException
from db import get_db

router = APIRouter()

@router.get("/users")
def list_users():
    """Return a list of all registered users (students)."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT student_id, name FROM users ORDER BY name")
        rows = cur.fetchall()
        return {
            "users": [
                {"student_id": r["student_id"], "name": r["name"]}
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch users: {str(e)}")
    finally:
        conn.close()
