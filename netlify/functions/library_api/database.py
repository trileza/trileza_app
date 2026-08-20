import os
from sqlmodel import create_engine, Session, SQLModel

DEFAULT_DB_URL = "postgresql://postgres:e7b8960be3f9529667cd9a19786777da@25t8cbg8.us-east.database.insforge.app:5432/insforge?sslmode=require"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# For SQLite, it must use check_same_thread=False
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
