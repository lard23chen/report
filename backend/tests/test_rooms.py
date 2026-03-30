"""
第二階段測試：GET /api/rooms 與 GET /api/rooms/available
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models import Room, Booking

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="module")
def test_engine():
    # StaticPool：所有連線共用同一個 in-memory 連線，確保測試資料可見
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="module")
def TestSession(test_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="module")
def client(test_engine, TestSession):
    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # 新增測試用會議室
    db = TestSession()
    rooms = [
        Room(name="台北廳", capacity=10, location="3F", description="附投影機"),
        Room(name="新竹廳", capacity=6,  location="3F", description="小型討論室"),
        Room(name="台中廳", capacity=20, location="4F", description="大型會議室"),
    ]
    for r in rooms:
        db.add(r)
    db.commit()
    db.close()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


class TestGetAllRooms:
    def test_returns_list(self, client):
        resp = client.get("/api/rooms")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 3

    def test_room_fields(self, client):
        resp = client.get("/api/rooms")
        room = resp.json()[0]
        assert "id" in room
        assert "name" in room
        assert "capacity" in room
        assert "location" in room

    def test_room_names(self, client):
        resp = client.get("/api/rooms")
        names = {r["name"] for r in resp.json()}
        assert {"台北廳", "新竹廳", "台中廳"}.issubset(names)


class TestGetAvailableRooms:
    def test_all_rooms_available_when_no_bookings(self, client):
        resp = client.get(
            "/api/rooms/available",
            params={"start_time": "2024-06-01T09:00:00", "end_time": "2024-06-01T10:00:00"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_booked_room_excluded(self, client, TestSession):
        # 取得台北廳 id
        rooms_resp = client.get("/api/rooms")
        taipei = next(r for r in rooms_resp.json() if r["name"] == "台北廳")

        # 建立預約佔用台北廳 10:00–11:00
        db = TestSession()
        booking = Booking(
            room_id=taipei["id"],
            user_id=1,
            title="測試會議",
            attendees=5,
            start_time=datetime(2024, 6, 2, 10, 0),
            end_time=datetime(2024, 6, 2, 11, 0),
            status="confirmed",
        )
        db.add(booking)
        db.commit()
        db.close()

        resp = client.get(
            "/api/rooms/available",
            params={"start_time": "2024-06-02T10:00:00", "end_time": "2024-06-02T11:00:00"},
        )
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert "台北廳" not in names
        assert "新竹廳" in names
        assert "台中廳" in names

    def test_partial_overlap_excluded(self, client):
        """預約 10:00–11:00，查詢 10:30–11:30 應排除台北廳"""
        resp = client.get(
            "/api/rooms/available",
            params={"start_time": "2024-06-02T10:30:00", "end_time": "2024-06-02T11:30:00"},
        )
        names = [r["name"] for r in resp.json()]
        assert "台北廳" not in names

    def test_adjacent_slot_is_available(self, client):
        """預約 10:00–11:00，查詢 11:00–12:00 應視為可用（不重疊）"""
        resp = client.get(
            "/api/rooms/available",
            params={"start_time": "2024-06-02T11:00:00", "end_time": "2024-06-02T12:00:00"},
        )
        names = [r["name"] for r in resp.json()]
        assert "台北廳" in names

    def test_cancelled_booking_room_is_available(self, client, TestSession):
        """已取消的預約不應影響可用性"""
        rooms_resp = client.get("/api/rooms")
        hsinchu = next(r for r in rooms_resp.json() if r["name"] == "新竹廳")

        db = TestSession()
        booking = Booking(
            room_id=hsinchu["id"],
            user_id=1,
            title="取消的會議",
            attendees=3,
            start_time=datetime(2024, 6, 3, 9, 0),
            end_time=datetime(2024, 6, 3, 10, 0),
            status="cancelled",
        )
        db.add(booking)
        db.commit()
        db.close()

        resp = client.get(
            "/api/rooms/available",
            params={"start_time": "2024-06-03T09:00:00", "end_time": "2024-06-03T10:00:00"},
        )
        names = [r["name"] for r in resp.json()]
        assert "新竹廳" in names

    def test_missing_params_returns_422(self, client):
        resp = client.get("/api/rooms/available")
        assert resp.status_code == 422
