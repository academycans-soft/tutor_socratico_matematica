"""Classroom repository."""

import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from data.models import Classroom, ClassroomMember
from data.repositories.base import BaseRepository


class ClassroomRepository(BaseRepository[Classroom]):
    def __init__(self, session: Session):
        super().__init__(session, Classroom)

    def get_by_code(self, code: str) -> Optional[Classroom]:
        return (
            self.session.query(Classroom)
            .filter(Classroom.code == code.strip().upper())
            .first()
        )

    def get_teacher_classrooms(self, teacher_id: str) -> List[Classroom]:
        return (
            self.session.query(Classroom)
            .filter(Classroom.teacher_id == teacher_id)
            .order_by(Classroom.created_at.desc())
            .all()
        )

    def get_student_classrooms(self, student_id: str) -> List[Classroom]:
        return (
            self.session.query(Classroom)
            .join(ClassroomMember, Classroom.id == ClassroomMember.classroom_id)
            .filter(ClassroomMember.user_id == student_id)
            .order_by(Classroom.created_at.desc())
            .all()
        )

    def get_member(
        self, classroom_id: str, user_id: str
    ) -> Optional[ClassroomMember]:
        return (
            self.session.query(ClassroomMember)
            .filter(
                ClassroomMember.classroom_id == classroom_id,
                ClassroomMember.user_id == user_id,
            )
            .first()
        )

    def add_member(
        self, classroom_id: str, user_id: str, role: str = "student"
    ) -> ClassroomMember:
        member = ClassroomMember(
            id=str(uuid.uuid4()),
            classroom_id=classroom_id,
            user_id=user_id,
            role=role,
        )
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    def remove_member(self, classroom_id: str, user_id: str) -> bool:
        member = self.get_member(classroom_id, user_id)
        if not member:
            return False
        self.session.delete(member)
        self.session.commit()
        return True

    def get_members(self, classroom_id: str) -> List[ClassroomMember]:
        return (
            self.session.query(ClassroomMember)
            .filter(ClassroomMember.classroom_id == classroom_id)
            .all()
        )
