"""Group domain model for classrooms, cohorts, and user groups."""

import time as _time
import uuid
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import JSON, Column, DateTime, String, Text

from data.database import Base


class Group(Base):
    """Group model representing classrooms, cohorts, or permission groups."""

    __tablename__ = "groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)  # creator ID
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, nullable=True)
    user_ids = Column(JSON, nullable=True, default=list)  # list of member user IDs
    data = Column(JSON, nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert group to dictionary matching UI contract."""
        created_ts = (
            int(self.created_at.timestamp()) if self.created_at else int(_time.time())
        )
        updated_ts = (
            int(self.updated_at.timestamp()) if self.updated_at else created_ts
        )
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description or "",
            "permissions": self.permissions or {},
            "user_ids": self.user_ids or [],
            "data": self.data or {},
            "meta": self.meta or {},
            "created_at": created_ts,
            "updated_at": updated_ts,
        }
