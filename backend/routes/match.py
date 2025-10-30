from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import sqlite3, json, traceback
from db import DB_PATH, get_student_by_id

router = APIRouter()


class MatchRequest(BaseModel):
    embedding: list[float]


THRESHOLD = 0.6


@router.post("/match")
def match(request: MatchRequest):
    try:
        # Convert incoming embedding to NumPy array
        embedding = np.array(request.embedding, dtype=np.float32)
        if embedding.shape != (128,):
            raise HTTPException(
                status_code=400, detail="Invalid embedding shape. Must be 128 values."
            )

        # Fetch all users
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT student_id, embedding FROM users")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail="No users registered")

        best_match = None
        best_dist = float("inf")

        # Find the closest embedding
        for student_id, emb_json in rows:
            try:
                db_emb = np.array(json.loads(emb_json), dtype=np.float32)
                if db_emb.shape != (128,):
                    print(
                        f"[DEBUG] Skipping student {student_id}: embedding shape {db_emb.shape}"
                    )
                    continue
            except Exception as e:
                print(f"[DEBUG] Failed to parse embedding for {student_id}: {e}")
                continue

            dist = np.linalg.norm(embedding - db_emb)
            if dist < best_dist:
                best_dist = dist
                best_match = student_id

        # Build debug info
        debug_info = {
            "best_match_candidate": best_match,
            "best_distance": float(best_dist),
            "all_student_ids": [r[0] for r in rows],
        }

        # Check if best match is within threshold
        if best_match and best_dist < THRESHOLD:
            student = get_student_by_id(best_match)
            debug_info["student_from_db"] = student
            print("[MATCH DEBUG]", debug_info)

            if not student:
                raise HTTPException(
                    status_code=404,
                    detail=f"Student record not found for {best_match}",
                )

            # ✅ Return full student details
            return {
                "matched": True,
                "distance": float(best_dist),
                "student": student,
                "debug": debug_info,
            }

        # No match found
        print("[MATCH DEBUG] No match found", debug_info)
        return {"matched": False, "distance": float(best_dist), "debug": debug_info}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Match failed: {str(e)}")
