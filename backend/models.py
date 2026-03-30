from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="room")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    attendees: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    room: Mapped["Room"] = relationship("Room", back_populates="bookings")
    user: Mapped["User"] = relationship("User", back_populates="bookings")
