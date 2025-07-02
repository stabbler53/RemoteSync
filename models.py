from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict

class User(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    image_url: Optional[str] = None

class StandupEntrySubmission(BaseModel):
    team_id: str
    text: Optional[str] = None
    audio_url: Optional[str] = None

class Team(BaseModel):
    id: str
    name: str
    owner_id: str
    settings: dict

class Invite(BaseModel):
    team_id: str
    email: str

class TeamCreate(BaseModel):
    name: str
    settings: dict = Field(default_factory=dict)

class TeamInvite(BaseModel):
    emails: List[str]

class AcceptInvite(BaseModel):
    token: str

class TeamSettingsUpdate(BaseModel):
    settings: Optional[Dict[str, str]] = None
    report_recipients: Optional[List[str]] = None 