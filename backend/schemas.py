from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# --- User ---

class UserCreate(BaseModel):
    name: str
    email: EmailStr


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Room ---

class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: int
    location: Optional[str] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Booking ---

class BookingCreate(BaseModel):
    room_id: int
    user_id: int
    title: str
    attendees: int = 1
    note: Optional[str] = None
    start_time: datetime
    end_time: datetime


class BookingUpdate(BaseModel):
    title: Optional[str] = None
    attendees: Optional[int] = None
    note: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class BookingResponse(BaseModel):
    id: int
    room_id: int
    user_id: int
    title: str
    attendees: int
    note: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime
    room: Optional[RoomResponse] = None
    user: Optional[UserResponse] = None

    model_config = {"from_attributes": True}
