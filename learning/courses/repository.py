"""Course repository."""

from typing import List, Optional

from sqlalchemy.orm import Session

from data.models import Classroom, ClassroomMember, Course
from data.repositories.base import BaseRepository


class CourseRepository(BaseRepository[Course]):
    def __init__(self, session: Session):
        super().__init__(session, Course)

    def get_by_classroom(self, classroom_id: str) -> List[Course]:
        return (
            self.session.query(Course)
            .filter(Course.classroom_id == classroom_id)
            .order_by(Course.created_at.desc())
            .all()
        )

    def get_teacher_courses(self, teacher_id: str) -> List[Course]:
        return (
            self.session.query(Course)
            .filter(Course.teacher_id == teacher_id)
            .order_by(Course.created_at.desc())
            .all()
        )

    def get_student_courses(self, student_id: str) -> List[Course]:
        """Get courses only for classrooms where the student is enrolled."""
        return (
            self.session.query(Course)
            .join(Classroom, Course.classroom_id == Classroom.id)
            .join(ClassroomMember, Classroom.id == ClassroomMember.classroom_id)
            .filter(ClassroomMember.user_id == student_id)
            .order_by(Course.created_at.desc())
            .all()
        )
