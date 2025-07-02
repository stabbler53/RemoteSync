import os
from fastapi import Depends, HTTPException, Header
from models import User
from utils import clerk # Import the initialized client

async def get_current_user(authorization: str = Header(None)) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        token = authorization.split(" ")[1]
        # Clerk's SDK has built-in verification that raises its own exceptions
        session_claims = clerk.sessions.verify_token(token)
        user_id = session_claims['sub']
        
        # Fetch the full user object from Clerk
        clerk_user = clerk.users.get_user(user_id)
        
        primary_email_id = clerk_user.primary_email_address_id
        primary_email_obj = next((e for e in clerk_user.email_addresses if e.id == primary_email_id), None)
        
        if not primary_email_obj:
            raise HTTPException(status_code=404, detail="Primary email not found for user")

        return User(
            id=clerk_user.id,
            first_name=clerk_user.first_name,
            last_name=clerk_user.last_name,
            email=primary_email_obj.email_address,
            image_url=clerk_user.image_url
        )
    except Exception as e:
        # Catch potential errors from the SDK (e.g., token expired, invalid)
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") 