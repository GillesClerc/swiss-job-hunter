"""
Database session factory and helpers.
"""
from __future__ import annotations

import glob
import hashlib
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from config.settings import settings
from db.models import Base


def _get_engine() -> Engine:
    db_url = settings.database_url
    # Ensure data directory exists for SQLite
    if db_url.startswith("sqlite"):
        db_path = db_url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
        echo=False,
    )

    # Enable WAL mode for better SQLite concurrency
    if "sqlite" in db_url:
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, _):  # type: ignore[misc]
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = _get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


_NEW_JOB_COLUMNS = {
    "wish_score": "FLOAT",
    "wish_explanation": "TEXT",
}


def _ensure_columns() -> None:
    """Add columns introduced after the initial `jobs` table was created. Idempotent."""
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(jobs)"))}
        for col, coltype in _NEW_JOB_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col} {coltype}"))
        conn.commit()


def _migrate_legacy_profiles() -> None:
    """
    One-time import: turn legacy data/cv_{direction}.txt + json keyword caches into
    `Profile` rows, if the profiles table is empty and legacy files exist.
    """
    from db.models import Profile

    with get_session() as session:
        if session.query(Profile).first() is not None:
            return

        data_dir = settings.cv_text_path.parent
        cv_files = sorted(glob.glob(str(data_dir / "cv_*.txt")))
        for path in cv_files:
            name = Path(path).stem[3:]  # strip "cv_"
            cv_text = Path(path).read_text(encoding="utf-8")

            search_keywords = []
            search_kw_path = data_dir / f"cv_search_keywords_{name}.json"
            if search_kw_path.exists():
                try:
                    search_keywords = json.loads(search_kw_path.read_text(encoding="utf-8")).get("keywords", [])
                except Exception:
                    pass

            scoring_keywords = None
            scoring_kw_path = data_dir / f"cv_keywords_{name}.json"
            if scoring_kw_path.exists():
                try:
                    scoring_keywords = json.loads(scoring_kw_path.read_text(encoding="utf-8")).get("keywords")
                except Exception:
                    pass

            session.add(Profile(
                name=name,
                cv_text=cv_text,
                wish_description=None,
                search_keywords=search_keywords,
                scoring_keywords=scoring_keywords,
                cv_text_hash=hashlib.sha256(cv_text.encode()).hexdigest() if scoring_keywords else None,
            ))


def init_db() -> None:
    """Create all tables and apply lightweight migrations. Safe to call multiple times."""
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _migrate_legacy_profiles()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager for database sessions."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
