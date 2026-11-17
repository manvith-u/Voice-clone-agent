"""SQLite database initialization and helpers.

Two tables:

* ``voices`` — one row per cloned voice profile.
* ``generations`` — one row per generated audio file.

We use the stdlib ``sqlite3`` module (no ORM) to keep dependencies light.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    profile_path TEXT NOT NULL,
    original_audio_path TEXT,
    language TEXT NOT NULL DEFAULT 'english',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    voice_id TEXT NOT NULL,
    text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'english',
    speed REAL NOT NULL DEFAULT 1.0,
    audio_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (voice_id) REFERENCES voices(id) ON DELETE CASCADE
);
"""


def init_db() -> None:
    """Create tables if they don't exist."""
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Yield a SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
