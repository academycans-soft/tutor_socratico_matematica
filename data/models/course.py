"""Course domain model."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from data.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(255), nullable=True)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False, index=True)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    level = Column(String(100), nullable=True, default="Beginner")
    image_url = Column(Text, nullable=True)
    knowledge_id = Column(String(36), ForeignKey("knowledge_bases.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    classroom = relationship("Classroom", back_populates="courses")
    teacher = relationship("User", foreign_keys=[teacher_id])
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    knowledge_base = relationship("KnowledgeBase", foreign_keys=[knowledge_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "subject": self.subject,
            "classroom_id": self.classroom_id,
            "classroom_name": self.classroom.name if self.classroom else None,
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.name if self.teacher else None,
            "level": self.level,
            "image_url": self.image_url,
            "knowledge_id": self.knowledge_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
