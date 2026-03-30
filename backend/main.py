from fastapi import FastAPI
from database import engine, Base
import models  # noqa: F401 — ensure all models are registered before create_all
from routers import rooms

app = FastAPI(title="會議室預約系統", version="1.0.0")

app.include_router(rooms.router)


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "會議室預約系統 API"}
