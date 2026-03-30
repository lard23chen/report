from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Room, Booking
from schemas import RoomResponse

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=List[RoomResponse])
def get_all_rooms(db: Session = Depends(get_db)):
    """取得所有會議室"""
    rooms = db.execute(select(Room)).scalars().all()
    return rooms


@router.get("/available", response_model=List[RoomResponse])
def get_available_rooms(
    start_time: datetime = Query(..., description="查詢開始時間，格式：2024-01-01T09:00:00"),
    end_time: datetime = Query(..., description="查詢結束時間，格式：2024-01-01T10:00:00"),
    db: Session = Depends(get_db),
):
    """依 start_time / end_time 查詢無衝突的可用會議室"""
    # 找出在指定時段有衝突預約的會議室 id（排除已取消的預約）
    conflicting_room_ids = db.execute(
        select(Booking.room_id).where(
            and_(
                Booking.status != "cancelled",
                or_(
                    and_(Booking.start_time < end_time, Booking.end_time > start_time),
                ),
            )
        )
    ).scalars().all()

    available_rooms = db.execute(
        select(Room).where(Room.id.not_in(conflicting_room_ids))
    ).scalars().all()

    return available_rooms
