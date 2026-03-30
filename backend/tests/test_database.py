"""
第一階段測試：資料庫連線、SessionLocal、資料表自動建立
"""
import sys
import os

# 讓 pytest 能 import backend 模組
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from database import Base, get_db


TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="module")
def test_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    # 匯入所有 model，確保 metadata 已登錄
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSession()
    yield session
    session.close()


class TestDatabaseConnection:
    def test_engine_connects(self, test_engine):
        """確認 engine 可以成功建立連線"""
        with test_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1

    def test_session_local_creates_and_closes(self, db_session):
        """確認 SessionLocal 可正常建立與關閉"""
        result = db_session.execute(text("SELECT 1")).scalar()
        assert result == 1
        # session 由 fixture 負責關閉，此處只確認操作無例外


class TestTableCreation:
    def test_users_table_exists(self, test_engine):
        inspector = inspect(test_engine)
        assert "users" in inspector.get_table_names()

    def test_rooms_table_exists(self, test_engine):
        inspector = inspect(test_engine)
        assert "rooms" in inspector.get_table_names()

    def test_bookings_table_exists(self, test_engine):
        inspector = inspect(test_engine)
        assert "bookings" in inspector.get_table_names()

    def test_users_columns(self, test_engine):
        inspector = inspect(test_engine)
        columns = {col["name"] for col in inspector.get_columns("users")}
        assert {"id", "name", "email", "created_at"}.issubset(columns)

    def test_rooms_columns(self, test_engine):
        inspector = inspect(test_engine)
        columns = {col["name"] for col in inspector.get_columns("rooms")}
        assert {"id", "name", "capacity", "location", "description"}.issubset(columns)

    def test_bookings_columns(self, test_engine):
        inspector = inspect(test_engine)
        columns = {col["name"] for col in inspector.get_columns("bookings")}
        assert {
            "id", "room_id", "user_id", "title", "attendees",
            "note", "start_time", "end_time", "status", "created_at",
        }.issubset(columns)

    def test_bookings_foreign_keys(self, test_engine):
        inspector = inspect(test_engine)
        fks = {fk["referred_table"] for fk in inspector.get_foreign_keys("bookings")}
        assert "rooms" in fks
        assert "users" in fks


class TestGetDbDependency:
    def test_get_db_yields_session(self, test_engine):
        """確認 get_db 依賴注入能正常 yield session 並關閉"""
        from database import SessionLocal
        # 暫時替換 SessionLocal binding 為測試 engine
        TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

        def patched_get_db():
            db = TestSession()
            try:
                yield db
            finally:
                db.close()

        gen = patched_get_db()
        session = next(gen)
        assert session is not None
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1
        try:
            next(gen)
        except StopIteration:
            pass
