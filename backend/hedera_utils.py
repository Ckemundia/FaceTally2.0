from dotenv import load_dotenv
import os
from hedera import (
    Client,
    AccountId,
    PrivateKey,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TransferTransaction,
    TokenId,
    TokenInfoQuery,
)

import json

load_dotenv()

# Load operator credentials
OPERATOR_ID = AccountId.fromString(os.getenv("HEDERA_ACCOUNT_ID"))
OPERATOR_KEY = PrivateKey.fromString(os.getenv("HEDERA_PRIVATE_KEY"))

client = Client.forTestnet()
client.setOperator(OPERATOR_ID, OPERATOR_KEY)

# File to store token ID locally
TOKEN_FILE = "pop_token.json"

def load_pop_token():
    """Load existing POP token ID from file, if available"""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            data = json.load(f)
            token_id = data.get("POP_TOKEN_ID")
            if token_id:
                return token_id
    return None

def save_pop_token(token_id):
    """Save POP token ID to file"""
    with open(TOKEN_FILE, "w") as f:
        json.dump({"POP_TOKEN_ID": token_id}, f)

# Try to load existing token ID
POP_TOKEN_ID = load_pop_token()

def create_pop_token():
    """One-time creation of the Proof Of Presence (POP) token"""
    global POP_TOKEN_ID

    # Check if token already exists
    if POP_TOKEN_ID:
        # Optionally, verify it exists on Hedera
        try:
            info = TokenInfoQuery().setTokenId(TokenId.fromString(POP_TOKEN_ID)).execute(client)
            return POP_TOKEN_ID  # Already exists
        except:
            # Token not found, will create new
            pass

    tx = (
        TokenCreateTransaction()
        .setTokenName("Proof Of Presence")
        .setTokenSymbol("POP")
        .setTokenType(TokenType.FUNGIBLE_COMMON)
        .setDecimals(0)
        .setInitialSupply(100_000_000)  # 100M
        .setTreasuryAccountId(OPERATOR_ID)
        .setSupplyType(TokenSupplyType.FINITE)
        .setMaxSupply(100_000_000)
        .freezeWith(client)
        .sign(OPERATOR_KEY)
    )

    resp = tx.execute(client)
    receipt = resp.getReceipt(client)
    token_id = receipt.tokenId.toString()

    # Save token ID for future use
    POP_TOKEN_ID = token_id
    save_pop_token(token_id)

    print("POP token created! Token ID:", token_id)
    return token_id


def reward_student(student_wallet: str, amount: int = 1):
    """Send POP tokens to a student's wallet"""
    global POP_TOKEN_ID
    try:
        if not POP_TOKEN_ID:
            raise ValueError("POP token does not exist. Run create_pop_token() first.")

        token_id = TokenId.fromString(POP_TOKEN_ID)
        tx = (
            TransferTransaction()
            .addTokenTransfer(token_id, OPERATOR_ID, -amount)
            .addTokenTransfer(token_id, AccountId.fromString(student_wallet), amount)
            .freezeWith(client)
            .sign(OPERATOR_KEY)
        )
        resp = tx.execute(client)
        receipt = resp.getReceipt(client)
        return {"status": "success", "tx_id": str(resp.transactionId)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


