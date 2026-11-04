"""Classroom and ClassroomMember domain models."""

import secrets
import string
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from data.database import Base


def generate_classroom_code(length: int = 6) -> str:
    """Generate a random uppercase alfanumeric code for classroom enrollment."""
    alphabet = string.ascii_uppercase + string.digits
    # Avoid ambiguous characters like 0, O, 1, I
    alphabet = alphabet.replace("0", "").replace("O", "").replace("1", "").replace("I", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    grade_id = Column(String(36), ForeignKey("curriculum_grades.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    teacher = relationship("User", foreign_keys=[teacher_id])
    grade = relationship("CurriculumGrade", foreign_keys=[grade_id])
    members = relationship(
        "ClassroomMember", back_populates="classroom", cascade="all, delete-orphan"
    )
    courses = relationship(
        "Course", back_populates="classroom", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "code": self.code,
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.name if self.teacher else None,
            "grade_id": self.grade_id,
            "grade_name": self.grade.name if self.grade else None,
            "member_count": len(self.members) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ClassroomMember(Base):
    __tablename__ = "classroom_members"

    id = Column(String(36), primary_key=True)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="student", nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    classroom = relationship("Classroom", back_populates="members")
    user = relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "classroom_id": self.classroom_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }
