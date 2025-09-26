from hedera_utils import create_pop_token

if __name__ == "__main__":
    token_id = create_pop_token()
    print("Token created successfully! Token ID:", token_id)
