"""
執行方式：cd backend && python seed.py
初始化 5 間會議室資料
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
import models  # noqa: F401

Base.metadata.create_all(bind=engine)

ROOMS = [
    {"name": "台北廳", "capacity": 10, "location": "3F", "description": "標準會議室，附投影機與白板"},
    {"name": "新竹廳", "capacity": 6,  "location": "3F", "description": "小型討論室，適合 6 人以下會議"},
    {"name": "台中廳", "capacity": 20, "location": "4F", "description": "大型會議室，附視訊設備"},
    {"name": "台南廳", "capacity": 4,  "location": "2F", "description": "電話會議專用室"},
    {"name": "高雄廳", "capacity": 30, "location": "4F", "description": "大型演講廳，附舞台與麥克風"},
]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(models.Room).count()
        if existing > 0:
            print(f"已有 {existing} 間會議室，略過 seed。")
            return

        for data in ROOMS:
            db.add(models.Room(**data))
        db.commit()
        print(f"成功新增 {len(ROOMS)} 間會議室。")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
