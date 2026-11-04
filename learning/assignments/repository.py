"""Assignment and Submission repository."""

from typing import List, Optional

from sqlalchemy.orm import Session

from data.models import Assignment, Classroom, ClassroomMember, Submission
from data.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository[Assignment]):
    def __init__(self, session: Session):
        super().__init__(session, Assignment)

    def get_by_course(self, course_id: str) -> List[Assignment]:
        return (
            self.session.query(Assignment)
            .filter(Assignment.course_id == course_id)
            .order_by(Assignment.created_at.desc())
            .all()
        )

    def get_by_classroom(self, classroom_id: str) -> List[Assignment]:
        return (
            self.session.query(Assignment)
            .filter(Assignment.classroom_id == classroom_id)
            .order_by(Assignment.created_at.desc())
            .all()
        )

    def get_teacher_assignments(self, teacher_id: str) -> List[Assignment]:
        return (
            self.session.query(Assignment)
            .filter(Assignment.teacher_id == teacher_id)
            .order_by(Assignment.created_at.desc())
            .all()
        )

    def get_student_assignments(self, student_id: str) -> List[Assignment]:
        """Get assignments for classrooms where student is enrolled."""
        return (
            self.session.query(Assignment)
            .join(Classroom, Assignment.classroom_id == Classroom.id)
            .join(ClassroomMember, Classroom.id == ClassroomMember.classroom_id)
            .filter(ClassroomMember.user_id == student_id)
            .order_by(Assignment.created_at.desc())
            .all()
        )


class SubmissionRepository(BaseRepository[Submission]):
    def __init__(self, session: Session):
        super().__init__(session, Submission)

    def get_by_assignment(self, assignment_id: str) -> List[Submission]:
        return (
            self.session.query(Submission)
            .filter(Submission.assignment_id == assignment_id)
            .order_by(Submission.submitted_at.desc())
            .all()
        )

    def get_student_submission(
        self, assignment_id: str, student_id: str
    ) -> Optional[Submission]:
        return (
            self.session.query(Submission)
            .filter(
                Submission.assignment_id == assignment_id,
                Submission.student_id == student_id,
            )
            .first()
        )
