import os
from sqlmodel import create_engine, Session, SQLModel

# The connection string MUST be supplied via the environment. There is no
# in-source fallback on purpose: a default here would be a committed credential.
# Set DATABASE_URL in the Netlify site environment (and in a local .env for dev).
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. The library API cannot start without a database "
        "connection string. Configure it in the Netlify environment variables."
    )

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
