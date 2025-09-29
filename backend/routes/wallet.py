from fastapi import APIRouter, Query
from hedera import AccountId
import requests

router = APIRouter()

@router.get("/validate_wallet")
def validate_wallet(wallet: str = Query(...)):
    try:
        # Validate format
        AccountId.fromString(wallet)

        # Check existence via Hedera Mirror Node
        url = f"https://testnet.mirrornode.hedera.com/api/v1/accounts/{wallet}"
        resp = requests.get(url, timeout=5)

        if resp.status_code == 200 and "account" in resp.json():
            return {"valid": True}
        else:
            return {"valid": False}
    except Exception as e:
        return {"valid": False, "error": str(e)}
