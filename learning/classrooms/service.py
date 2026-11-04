"""Classroom service."""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.models import Classroom, User
from data.models.classroom import generate_classroom_code
from learning.classrooms.repository import ClassroomRepository


class ClassroomsService:
    def __init__(self, session: Session):
        self.repo = ClassroomRepository(session)

    def create(self, user: User, data: Dict[str, Any]) -> Classroom:
        # Check permissions: teacher, teacher_manager or admin
        if not user.is_teacher:
            raise AuthorizationError("Only teachers or admins can create classrooms")

        name = data.get("name", "").strip()
        if not name:
            raise ValidationError("Classroom name is required", field="name")

        # Generate unique code
        code = generate_classroom_code()
        while self.repo.get_by_code(code) is not None:
            code = generate_classroom_code()

        classroom = self.repo.create(
            id=str(uuid.uuid4()),
            name=name,
            description=data.get("description"),
            code=code,
            teacher_id=user.id,
            grade_id=data.get("grade_id"),
        )
        return classroom

    def update(self, user: User, classroom_id: str, data: Dict[str, Any]) -> Classroom:
        classroom = self.repo.get_by_id(classroom_id)
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)
        if classroom.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("Only the classroom teacher or admin can update it")

        if "name" in data and data["name"]:
            classroom.name = data["name"].strip()
        if "description" in data:
            classroom.description = data["description"]
        if "grade_id" in data:
            classroom.grade_id = data["grade_id"]

        self.repo.session.commit()
        self.repo.session.refresh(classroom)
        return classroom

    def get_by_id(self, classroom_id: str) -> Optional[Classroom]:
        return self.repo.get_by_id(classroom_id)

    def list_for_user(self, user: User) -> List[Classroom]:
        if user.is_teacher:
            return self.repo.get_teacher_classrooms(user.id)
        return self.repo.get_student_classrooms(user.id)

    def join_by_code(self, user: User, code: str) -> Classroom:
        code_clean = code.strip().upper()
        classroom = self.repo.get_by_code(code_clean)
        if not classroom:
            raise NotFoundError("Classroom", code_clean)

        # Check if already a member or is teacher
        if classroom.teacher_id == user.id:
            return classroom

        existing = self.repo.get_member(classroom.id, user.id)
        if not existing:
            self.repo.add_member(classroom.id, user.id, role="student")

        return classroom

    def get_roster(self, user: User, classroom_id: str) -> Dict[str, Any]:
        classroom = self.repo.get_by_id(classroom_id)
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)

        # Authorization: teacher of classroom, admin, or member
        is_teacher = classroom.teacher_id == user.id or user.is_admin
        is_member = is_teacher or (self.repo.get_member(classroom_id, user.id) is not None)
        if not is_member:
            raise AuthorizationError("You do not have access to this classroom")

        members = self.repo.get_members(classroom_id)
        res = classroom.to_dict()
        res["members"] = [m.to_dict() for m in members]
        return res

    def delete(self, user: User, classroom_id: str) -> bool:
        classroom = self.repo.get_by_id(classroom_id)
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)
        if classroom.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("Only the classroom teacher can delete it")
        return self.repo.delete(classroom_id)

    def enroll_student(self, user: User, classroom_id: str, student_id: str) -> Dict[str, Any]:
        classroom = self.repo.get_by_id(classroom_id)
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)
        if classroom.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("Only the classroom teacher or admin can enroll students")

        student = self.repo.session.query(User).filter_by(id=student_id).first()
        if not student:
            raise NotFoundError("User", student_id)

        existing = self.repo.get_member(classroom_id, student_id)
        if not existing:
            self.repo.add_member(classroom_id, student_id, role="student")
        return {
            "status": "enrolled",
            "classroom_id": classroom_id,
            "student_id": student_id,
            "student_name": student.name,
        }

    def remove_student(self, user: User, classroom_id: str, student_id: str) -> Dict[str, Any]:
        classroom = self.repo.get_by_id(classroom_id)
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)
        if classroom.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("Only the classroom teacher or admin can remove students")

        self.repo.remove_member(classroom_id, student_id)
        return {"status": "removed", "classroom_id": classroom_id, "student_id": student_id}

