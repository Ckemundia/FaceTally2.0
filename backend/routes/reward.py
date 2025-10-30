# routes/reward.py
from fastapi import APIRouter
from pydantic import BaseModel
from hedera_utils import reward_student

router = APIRouter(prefix="/reward", tags=["Reward"])


# --- Pydantic model to accept JSON body ---
class RewardIn(BaseModel):
    student_wallet: str
    amount: int = 1


@router.post("/give")
def give_reward(payload: RewardIn):
    """
    Send POP tokens to a student's wallet.
    """
    return reward_student(payload.student_wallet, payload.amount)
