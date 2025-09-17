from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import sqlite3

router = APIRouter()

class MatchRequest(BaseModel):
    embedding: list  # Face descriptor from frontend

DB_PATH = "attendance.db"  # adjust if your DB file has another name
THRESHOLD = 0.6  # tweak if matches are too loose/strict

@router.post("/match")
def match(request: MatchRequest):
    try:
        embedding = np.array(request.embedding, dtype=np.float32)

        # --- Fetch registered students
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT student_id, embedding FROM students")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail="No students registered")

        # --- Compare with each stored embedding
        best_match = None
        best_dist = float("inf")

        for student_id, emb_str in rows:
            db_emb = np.array([float(x) for x in emb_str.split(",")], dtype=np.float32)
            dist = np.linalg.norm(embedding - db_emb)
            if dist < best_dist:
                best_dist = dist
                best_match = student_id

        # --- Decide if it’s a match
        if best_dist < THRESHOLD:
            return {
                "matched": True,
                "student_id": best_match,
                "distance": float(best_dist)
            }
        else:
            return {
                "matched": False,
                "distance": float(best_dist)
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Match failed: {str(e)}")
