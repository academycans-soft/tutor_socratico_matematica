"""Course service."""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.models import Classroom, ClassroomMember, Course, KnowledgeBase, User
from learning.courses.repository import CourseRepository


class CoursesService:
    def __init__(self, session: Session):
        self.repo = CourseRepository(session)
        self.session = session

    def create(self, user: User, data: Dict[str, Any]) -> Course:
        # Check permission: teacher or admin
        if not user.is_admin and user.role not in ("teacher", "admin"):
            raise AuthorizationError("Only teachers or admins can create courses")

        title = data.get("title", "").strip()
        if not title:
            raise ValidationError("Course title is required", field="title")

        classroom_id = data.get("classroom_id")
        if not classroom_id:
            raise ValidationError("Classroom ID is required", field="classroom_id")

        # Verify teacher owns this classroom
        classroom = (
            self.session.query(Classroom)
            .filter(Classroom.id == classroom_id)
            .first()
        )
        if not classroom:
            raise NotFoundError("Classroom", classroom_id)
        if classroom.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("You do not own this classroom")

        course_id = str(uuid.uuid4())
        kb_id = str(uuid.uuid4())
        kb = KnowledgeBase(
            id=kb_id,
            user_id=user.id,
            name=f"{title} - Knowledge Base",
            description=f"Course knowledge base for {title}",
            meta={"course_id": course_id, "classroom_id": classroom_id},
        )
        self.session.add(kb)
        self.session.flush()

        course = self.repo.create(
            id=course_id,
            title=title,
            description=data.get("description"),
            subject=data.get("subject"),
            classroom_id=classroom_id,
            teacher_id=user.id,
            level=data.get("level", "Beginner"),
            image_url=data.get("image_url"),
            knowledge_id=kb_id,
        )
        return course

    def _ensure_knowledge_base(self, course: Course) -> None:
        if not course.knowledge_id:
            kb_id = str(uuid.uuid4())
            kb = KnowledgeBase(
                id=kb_id,
                user_id=course.teacher_id,
                name=f"{course.title} - Knowledge Base",
                description=f"Course knowledge base for {course.title}",
                meta={"course_id": course.id, "classroom_id": course.classroom_id},
            )
            self.session.add(kb)
            course.knowledge_id = kb_id
            self.session.commit()

    def get_by_id(self, user: User, course_id: str) -> Optional[Course]:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise NotFoundError("Course", course_id)

        # Check visibility: teacher, admin, or enrolled student
        if user.is_admin or course.teacher_id == user.id:
            self._ensure_knowledge_base(course)
            return course

        is_enrolled = (
            self.session.query(ClassroomMember)
            .filter(
                ClassroomMember.classroom_id == course.classroom_id,
                ClassroomMember.user_id == user.id,
            )
            .first()
            is not None
        )
        if not is_enrolled:
            raise AuthorizationError("Course is only accessible to enrolled students")

        self._ensure_knowledge_base(course)
        return course

    def list_for_user(self, user: User, classroom_id: Optional[str] = None) -> List[Course]:
        if classroom_id:
            # Check user has access to classroom
            if user.is_admin:
                courses = self.repo.get_by_classroom(classroom_id)
            else:
                classroom = (
                    self.session.query(Classroom)
                    .filter(Classroom.id == classroom_id)
                    .first()
                )
                if not classroom:
                    raise NotFoundError("Classroom", classroom_id)

                if classroom.teacher_id == user.id:
                    courses = self.repo.get_by_classroom(classroom_id)
                else:
                    # Check enrolled
                    is_enrolled = (
                        self.session.query(ClassroomMember)
                        .filter(
                            ClassroomMember.classroom_id == classroom_id,
                            ClassroomMember.user_id == user.id,
                        )
                        .first()
                        is not None
                    )
                    if not is_enrolled:
                        raise AuthorizationError("You are not enrolled in this classroom")
                    courses = self.repo.get_by_classroom(classroom_id)
        else:
            # If no classroom_id passed:
            if user.is_admin or user.role == "teacher":
                courses = self.repo.get_teacher_courses(user.id)
            else:
                courses = self.repo.get_student_courses(user.id)

        for c in courses:
            self._ensure_knowledge_base(c)
        return courses

    def delete(self, user: User, course_id: str) -> bool:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise NotFoundError("Course", course_id)
        if course.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("Only the teacher can delete this course")
        return self.repo.delete(course_id)
