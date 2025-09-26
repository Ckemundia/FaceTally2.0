from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import sqlite3, json, traceback
from db import DB_PATH  # reuse the same DB path from db.py

router = APIRouter()

class MatchRequest(BaseModel):
    embedding: list[float]  # Face descriptor from frontend

THRESHOLD = 0.6  # tweak threshold as needed

@router.post("/match")
def match(request: MatchRequest):
    try:
        # --- Convert embedding
        embedding = np.array(request.embedding, dtype=np.float32)

        if embedding.shape != (128,):
            raise HTTPException(status_code=400, detail="Invalid embedding shape. Must be 128 values.")

        # --- Fetch registered users
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT student_id, embedding FROM users")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail="No users registered")

        # --- Compare with each stored embedding
        best_match = None
        best_dist = float("inf")

        for student_id, emb_json in rows:
            try:
                db_emb = np.array(json.loads(emb_json), dtype=np.float32)
                if db_emb.shape != (128,):
                    continue  # skip corrupted embeddings
            except Exception:
                continue  # skip invalid rows

            dist = np.linalg.norm(embedding - db_emb)
            if dist < best_dist:
                best_dist = dist
                best_match = student_id

        # --- Decide if it’s a match
        if best_match and best_dist < THRESHOLD:
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
        traceback.print_exc()  # print full traceback to server logs
        raise HTTPException(status_code=500, detail=f"Match failed: {str(e)}")
