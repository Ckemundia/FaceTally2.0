from fastapi import APIRouter, HTTPException
import numpy as np
from db import save_user
from models import RegisterIn, RegisterOut

router = APIRouter()

@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn):
    emb = np.array(payload.embedding, dtype=np.float32)

    if emb.shape != (128,):
        raise HTTPException(status_code=400, detail="Invalid embedding shape. Must be 128 values.")

    try:
        save_user(payload.student_id, payload.name, emb, payload.wallet)
    except ValueError as e:
        # Duplicate wallet or student ID
        raise HTTPException(status_code=400, detail=str(e))

    return {"ok": True, "student_id": payload.student_id}
