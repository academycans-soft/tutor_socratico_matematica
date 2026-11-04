"""Parent-Student relationship model."""

import secrets
import string
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from data.database import Base


def generate_link_code(length: int = 6) -> str:
    """Generate link code for parent-student pairing."""
    alphabet = string.ascii_uppercase + string.digits
    alphabet = alphabet.replace("0", "").replace("O", "").replace("1", "").replace("I", "")
    return "FAM-" + "".join(secrets.choice(alphabet) for _ in range(length))


class ParentStudent(Base):
    __tablename__ = "parent_students"

    id = Column(String(36), primary_key=True)
    parent_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(50), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    parent = relationship("User", foreign_keys=[parent_id])
    student = relationship("User", foreign_keys=[student_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "parent_id": self.parent_id,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else None,
            "student_email": self.student.email if self.student else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
