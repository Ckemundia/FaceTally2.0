# routes/reward.py
from fastapi import APIRouter
from hedera_utils import reward_student

router = APIRouter(prefix="/reward", tags=["Reward"])

@router.post("/give")
def give_reward(student_wallet: str, amount: int = 1):
    """
    Send POP tokens to a student's wallet.
    """
    return reward_student(student_wallet, amount)
