"""Database initialization and session management."""

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from config import settings

# Create declarative base for models (independent from open_webui)
Base = declarative_base()


def get_database_url() -> str:
    """Get database URL, normalizing PostgreSQL and creating SQLite directory if needed."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
    return db_url


# Create engine with appropriate pool settings
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        get_database_url(),
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.DATABASE_ECHO,
    )
else:
    engine = create_engine(
        get_database_url(),
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.DATABASE_ECHO,
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to inject database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_lightweight_migrations():
    """Apply safe, backward-compatible column additions for existing databases."""
    try:
        from sqlalchemy import inspect, text

        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        if "courses" in table_names:
            columns = [c["name"] for c in inspector.get_columns("courses")]
            if "knowledge_id" not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE courses ADD COLUMN knowledge_id VARCHAR(36)"))
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning("Migration check warning: %s", e)


def init_database(max_retries: int = 10, retry_delay: float = 2.0):
    """Initialize database tables with retry logic for container startup."""
    import time
    import logging

    logger = logging.getLogger(__name__)

    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _run_lightweight_migrations()
            logger.info("Database initialized successfully.")
            return
        except Exception as e:
            if attempt == max_retries:
                logger.error(
                    "Failed to initialize database after %d attempts: %s",
                    max_retries,
                    e,
                )
                raise
            logger.warning(
                "Database initialization attempt %d/%d failed (%s). Retrying in %.1fs...",
                attempt,
                max_retries,
                e,
                retry_delay,
            )
            time.sleep(retry_delay)


def close_database():
    """Close database connection."""
    engine.dispose()
