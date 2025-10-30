from fastapi import APIRouter, HTTPException
import numpy as np
from db import save_user, assign_units
from models import RegisterIn, RegisterOut

router = APIRouter()


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn):
    emb = np.array(payload.embedding, dtype=np.float32)

    if emb.shape != (128,):
        raise HTTPException(
            status_code=400, detail="Invalid embedding shape. Must be 128 values."
        )

    try:
        # ✅ Save user
        save_user(payload.student_id, payload.name, emb.tolist(), payload.wallet)

        # ✅ Assign units if provided
        if payload.units and isinstance(payload.units, list):
            assign_units(payload.student_id, payload.units)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")

    return {"ok": True, "student_id": payload.student_id}
