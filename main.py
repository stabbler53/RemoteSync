import os
from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from typing import Optional
from datetime import datetime

# Import from our refactored, centralized modules
from models import User, TeamCreate, TeamInvite, AcceptInvite, TeamSettingsUpdate
from auth import get_current_user
from utils import (
    summarize_text, 
    log_to_db, 
    upload_audio_to_supabase,
    create_team_in_db, 
    invite_users_to_team, 
    process_daily_reminders, 
    get_dashboard_data,
    accept_invite,
    run_scheduled_jobs,
    update_team_settings_in_db,
    remove_member_from_team,
    get_team_members
)

load_dotenv()

app = FastAPI(
    title="RemoteSync API",
    description="API for asynchronous daily standups.",
    version="1.0.0"
)

# --- CORS Middleware ---
origins = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---
@app.post("/api/entry", status_code=201)
async def create_entry(
    team_id: str = Form(...),
    text: Optional[str] = Form(None),
    audio: Optional[UploadFile] = None,
    current_user: User = Depends(get_current_user)
):
    if not text and not audio:
        raise HTTPException(status_code=400, detail="Either text or an audio file is required.")

    audio_url, summary = None, ""
    text_content = "" # Ensure text_content is always a string

    if audio:
        audio_bytes = await audio.read()
        filename = f"{current_user.id}_{team_id}_{int(datetime.utcnow().timestamp())}.wav"
        audio_url = upload_audio_to_supabase(audio_bytes, filename)
        
        transcription = summarize_text(audio_bytes, is_audio=True)
        text_content = str(transcription)
        summary = str(summarize_text(text_content, summarize=True) or "Summary could not be generated.")
    elif text:
        text_content = text
        summary = str(summarize_text(text_content, summarize=True) or "Summary could not be generated.")

    entry = log_to_db(current_user.id, text_content, summary, audio_url, team_id)
    # Assuming log_to_db returns a SQLAlchemy model, we convert it to a dict
    entry_dict = {c.name: getattr(entry, c.name) for c in entry.__table__.columns}
    return {"status": "success", "entry": entry_dict, "summary": summary}

@app.post("/api/teams", status_code=201)
def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    try:
        new_team = create_team_in_db(team_data, current_user.id)
        return new_team
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create team: {e}")

@app.post("/api/teams/{team_id}/invite")
def invite_to_team(team_id: str, invite_data: TeamInvite, current_user: User = Depends(get_current_user)):
    # Optional: Add logic to ensure current_user is an admin/owner of the team
    try:
        result = invite_users_to_team(team_id, invite_data.emails)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
def get_user_dashboard(current_user: User = Depends(get_current_user)):
    try:
        return get_dashboard_data(current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard data: {e}")

@app.post("/api/invites/accept", status_code=200)
def accept_team_invite(invite_data: AcceptInvite, current_user: User = Depends(get_current_user)):
    """
    Endpoint for a user to accept a team invitation using a token.
    """
    try:
        team = accept_invite(invite_data.token, current_user.id)
        # Convert the SQLAlchemy Team object to a dictionary for the response
        team_dict = {c.name: getattr(team, c.name) for c in team.__table__.columns}
        return {"status": "success", "team": team_dict}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.put("/api/teams/{team_id}/settings")
def update_team_settings(
    team_id: str,
    settings_data: TeamSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    try:
        updated_team = update_team_settings_in_db(team_id, settings_data, current_user.id)
        team_dict = {c.name: getattr(updated_team, c.name) for c in updated_team.__table__.columns}
        return {"status": "success", "team": team_dict}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.get("/api/teams/{team_id}/members")
def get_members_of_team(team_id: str, current_user: User = Depends(get_current_user)):
    # Optional: Add a check here to ensure the current_user is part of the team
    try:
        members = get_team_members(team_id)
        return members
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch members: {e}")

@app.delete("/api/teams/{team_id}/members/{member_id}")
def remove_team_member(
    team_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        result = remove_member_from_team(team_id, member_id, current_user.id)
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# --- Scheduler ---
scheduler = AsyncIOScheduler()

@scheduler.scheduled_job(IntervalTrigger(minutes=60))
async def scheduled_tasks():
    print(f"[{datetime.now()}] Running scheduled jobs...")
    run_scheduled_jobs()

@app.on_event("startup")
async def startup_event():
    scheduler.start()
    print("Scheduler started.")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    print("Scheduler shut down.") 