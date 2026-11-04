"""Assignment and Submission domain models."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from data.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String(36), primary_key=True)
    course_id = Column(String(36), ForeignKey("courses.id"), nullable=False, index=True)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False, index=True)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(String(50), nullable=True)
    points = Column(Integer, default=100, nullable=False)
    enable_ai_grading = Column(Boolean, default=False, nullable=False)
    status = Column(String(50), default="published", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    course = relationship("Course", back_populates="assignments")
    classroom = relationship("Classroom")
    teacher = relationship("User", foreign_keys=[teacher_id])
    submissions = relationship(
        "Submission", back_populates="assignment", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "course_id": self.course_id,
            "course_title": self.course.title if self.course else None,
            "classroom_id": self.classroom_id,
            "classroom_name": self.classroom.name if self.classroom else None,
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.name if self.teacher else None,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date,
            "points": self.points,
            "enable_ai_grading": self.enable_ai_grading,
            "status": self.status,
            "submission_count": len(self.submissions) if self.submissions else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True)
    assignment_id = Column(String(36), ForeignKey("assignments.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=True)
    file_id = Column(String(36), ForeignKey("files.id"), nullable=True)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    ai_grade = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    status = Column(String(50), default="submitted", nullable=False)  # submitted, graded
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    graded_at = Column(DateTime, nullable=True)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])
    file = relationship("FileRecord", foreign_keys=[file_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "assignment_id": self.assignment_id,
            "assignment_title": self.assignment.title if self.assignment else None,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else None,
            "student_email": self.student.email if self.student else None,
            "content": self.content,
            "file_id": self.file_id,
            "grade": self.grade,
            "feedback": self.feedback,
            "ai_grade": self.ai_grade,
            "ai_feedback": self.ai_feedback,
            "status": self.status,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "graded_at": self.graded_at.isoformat() if self.graded_at else None,
        }
