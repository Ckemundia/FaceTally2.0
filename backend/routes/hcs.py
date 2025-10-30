# routes/hcs.py
from fastapi import APIRouter
from pydantic import BaseModel
from hedera_utils import publish_message, get_messages

router = APIRouter(prefix="/hcs", tags=["HCS"])


# Input model for publishing attendance
class HCSMessage(BaseModel):
    student_id: str
    unit: str
    status: str  # e.g. "present" or "absent"


@router.post("/publish")
def publish(msg: HCSMessage):
    """
    Publish an attendance event to Hedera Consensus Service.
    """
    return publish_message(msg.dict())


@router.get("/messages")
def list_messages(limit: int = 20):
    """
    Fetch latest HCS messages from Hedera mirror node.
    """
    return get_messages(limit)
