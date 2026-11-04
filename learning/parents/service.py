"""Parent-Student service and repository."""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.models import Assignment, ParentStudent, Submission, Support, User
from data.models.parent_student import generate_link_code
from data.repositories.base import BaseRepository


class ParentRepository(BaseRepository[ParentStudent]):
    def __init__(self, session: Session):
        super().__init__(session, ParentStudent)

    def get_by_parent(self, parent_id: str) -> List[ParentStudent]:
        return (
            self.session.query(ParentStudent)
            .filter(ParentStudent.parent_id == parent_id, ParentStudent.status == "active")
            .all()
        )

    def get_link(self, parent_id: str, student_id: str) -> Optional[ParentStudent]:
        return (
            self.session.query(ParentStudent)
            .filter(
                ParentStudent.parent_id == parent_id,
                ParentStudent.student_id == student_id,
            )
            .first()
        )


class ParentsService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ParentRepository(session)

    def link_student_by_email(self, parent: User, student_email: str) -> ParentStudent:
        if parent.role != "parent" and not parent.is_admin:
            raise AuthorizationError("Only users with role 'parent' can link children")

        student = (
            self.session.query(User)
            .filter(User.email == student_email.strip().lower())
            .first()
        )
        if not student:
            raise NotFoundError("Student", student_email)

        if student.id == parent.id:
            raise ValidationError("You cannot link yourself as a student")

        existing = self.repo.get_link(parent.id, student.id)
        if existing:
            return existing

        return self.repo.create(
            id=str(uuid.uuid4()),
            parent_id=parent.id,
            student_id=student.id,
            status="active",
        )

    def get_children(self, parent: User) -> List[Dict[str, Any]]:
        links = self.repo.get_by_parent(parent.id)
        children = []
        for link in links:
            s = link.student
            if not s:
                continue
            # Get summary metrics: number of supports and submissions
            supports_count = (
                self.session.query(Support).filter(Support.user_id == s.id).count()
            )
            submissions_count = (
                self.session.query(Submission).filter(Submission.student_id == s.id).count()
            )
            children.append({
                "student_id": s.id,
                "name": s.name,
                "email": s.email,
                "supports_count": supports_count,
                "submissions_count": submissions_count,
            })
        return children

    def get_child_progress(self, parent: User, student_id: str) -> Dict[str, Any]:
        link = self.repo.get_link(parent.id, student_id)
        if not link and not parent.is_admin:
            raise AuthorizationError("You do not have permission to view this student")

        student = self.session.query(User).filter(User.id == student_id).first()
        if not student:
            raise NotFoundError("Student", student_id)

        supports = (
            self.session.query(Support)
            .filter(Support.user_id == student_id)
            .order_by(Support.created_at.desc())
            .limit(20)
            .all()
        )
        submissions = (
            self.session.query(Submission)
            .filter(Submission.student_id == student_id)
            .order_by(Submission.submitted_at.desc())
            .limit(20)
            .all()
        )

        return {
            "student": {"id": student.id, "name": student.name, "email": student.email},
            "supports": [s.to_dict() for s in supports],
            "submissions": [sub.to_dict() for sub in submissions],
        }
