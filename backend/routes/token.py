# routes/token.py
from fastapi import APIRouter
from hedera_utils import create_pop_token

router = APIRouter(prefix="/token", tags=["Token"])


@router.post("/create")
def create_token():
    """
    Creates the POP token (admin only, run once).
    """
    try:
        token_id = create_pop_token()
        return {"status": "success", "token_id": token_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}
