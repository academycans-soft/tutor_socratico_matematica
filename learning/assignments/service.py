"""Assignment and Submission service."""

from datetime import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ai.providers.proxy import proxy_json
from ai.providers.service import ProvidersService
from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.models import Assignment, Classroom, ClassroomMember, Course, Submission, User
from learning.assignments.repository import AssignmentRepository, SubmissionRepository

log = logging.getLogger(__name__)


class AssignmentsService:
    def __init__(self, session: Session):
        self.session = session
        self.assignment_repo = AssignmentRepository(session)
        self.submission_repo = SubmissionRepository(session)

    def create_assignment(self, user: User, data: Dict[str, Any]) -> Assignment:
        if not user.is_admin and user.role not in ("teacher", "admin"):
            raise AuthorizationError("Only teachers or admins can create assignments")

        title = data.get("title", "").strip()
        if not title:
            raise ValidationError("Assignment title is required", field="title")

        course_id = data.get("course_id")
        if not course_id:
            raise ValidationError("Course ID is required", field="course_id")

        course = self.session.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise NotFoundError("Course", course_id)
        if course.teacher_id != user.id and not user.is_admin:
            raise AuthorizationError("You do not own this course")

        assignment = self.assignment_repo.create(
            id=str(uuid.uuid4()),
            course_id=course.id,
            classroom_id=course.classroom_id,
            teacher_id=user.id,
            title=title,
            description=data.get("description"),
            due_date=data.get("due_date"),
            points=int(data.get("points", 100)),
            enable_ai_grading=bool(data.get("enable_ai_grading", False)),
            status=data.get("status", "published"),
        )
        return assignment

    def get_by_id(self, user: User, assignment_id: str) -> Assignment:
        assignment = self.assignment_repo.get_by_id(assignment_id)
        if not assignment:
            raise NotFoundError("Assignment", assignment_id)

        # Check user has access to the classroom
        if user.is_admin or assignment.teacher_id == user.id:
            return assignment

        is_enrolled = (
            self.session.query(ClassroomMember)
            .filter(
                ClassroomMember.classroom_id == assignment.classroom_id,
                ClassroomMember.user_id == user.id,
            )
            .first()
            is not None
        )
        if not is_enrolled:
            raise AuthorizationError("You do not have access to this assignment")

        return assignment

    def list_for_user(
        self,
        user: User,
        course_id: Optional[str] = None,
        classroom_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if user.is_admin or user.role == "teacher":
            if course_id:
                assignments = self.assignment_repo.get_by_course(course_id)
            elif classroom_id:
                assignments = self.assignment_repo.get_by_classroom(classroom_id)
            else:
                assignments = self.assignment_repo.get_teacher_assignments(user.id)
        else:
            if course_id:
                assignments = [
                    a for a in self.assignment_repo.get_by_course(course_id)
                    if self._is_enrolled(user.id, a.classroom_id)
                ]
            elif classroom_id:
                if not self._is_enrolled(user.id, classroom_id):
                    return []
                assignments = self.assignment_repo.get_by_classroom(classroom_id)
            else:
                assignments = self.assignment_repo.get_student_assignments(user.id)

        # Attach student's submission status if student
        res = []
        for a in assignments:
            d = a.to_dict()
            if user.role != "teacher" and not user.is_admin:
                sub = self.submission_repo.get_student_submission(a.id, user.id)
                d["my_submission"] = sub.to_dict() if sub else None
            res.append(d)
        return res

    def _is_enrolled(self, user_id: str, classroom_id: str) -> bool:
        return (
            self.session.query(ClassroomMember)
            .filter(
                ClassroomMember.classroom_id == classroom_id,
                ClassroomMember.user_id == user_id,
            )
            .first()
            is not None
        )

    async def submit_assignment(
        self,
        user: User,
        assignment_id: str,
        content: Optional[str],
        file_id: Optional[str] = None,
    ) -> Submission:
        assignment = self.assignment_repo.get_by_id(assignment_id)
        if not assignment:
            raise NotFoundError("Assignment", assignment_id)

        if not self._is_enrolled(user.id, assignment.classroom_id) and not user.is_admin:
            raise AuthorizationError("You must be enrolled in this classroom to submit")

        existing = self.submission_repo.get_student_submission(assignment_id, user.id)
        if existing:
            submission = self.submission_repo.update(
                existing.id,
                content=content,
                file_id=file_id,
                submitted_at=datetime.utcnow(),
                status="submitted",
            )
        else:
            submission = self.submission_repo.create(
                id=str(uuid.uuid4()),
                assignment_id=assignment_id,
                student_id=user.id,
                content=content,
                file_id=file_id,
                status="submitted",
                submitted_at=datetime.utcnow(),
            )

        # If AI grading is enabled by the teacher, evaluate with AI!
        if assignment.enable_ai_grading and content:
            await self._run_ai_grading(assignment, submission, content)

        return submission

    async def _run_ai_grading(
        self, assignment: Assignment, submission: Submission, student_work: str
    ) -> None:
        """Call LLM provider to evaluate student submission if enabled."""
        try:
            providers_svc = ProvidersService(self.session)
            # Try to resolve default model
            base_url, api_key, path = await providers_svc.resolve_provider("")
            if not base_url:
                return

            prompt = (
                f"You are an encouraging and pedagogical AI teacher evaluating a student's submission.\n"
                f"ASSIGNMENT: {assignment.title}\n"
                f"INSTRUCTIONS: {assignment.description or 'No instructions provided.'}\n"
                f"MAX POINTS: {assignment.points}\n\n"
                f"STUDENT SUBMISSION:\n{student_work}\n\n"
                f"Evaluate the work. Respond ONLY with a valid JSON object in this exact schema:\n"
                f'{{"score": <number between 0 and {assignment.points}>, "feedback": "<constructive feedback explaining strengths and areas for improvement>"}}'
            )

            llm_payload = {
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "temperature": 0.2,
            }
            res = await proxy_json(base_url, api_key, "POST", path, body=llm_payload)
            choices = res.get("choices", [])
            if choices and choices[0].get("message", {}).get("content"):
                ai_text = choices[0]["message"]["content"].strip()
                # Parse JSON out of response
                if "```json" in ai_text:
                    ai_text = ai_text.split("```json")[1].split("```")[0].strip()
                elif "```" in ai_text:
                    ai_text = ai_text.split("```")[1].split("```")[0].strip()

                parsed = json.loads(ai_text)
                score = float(parsed.get("score", 0))
                feedback = str(parsed.get("feedback", ""))

                self.submission_repo.update(
                    submission.id,
                    ai_grade=score,
                    ai_feedback=feedback,
                )
        except Exception as exc:
            log.warning("AI grading failed: %s", exc)

    def grade_submission(
        self,
        teacher: User,
        submission_id: str,
        grade: float,
        feedback: Optional[str] = None,
    ) -> Submission:
        submission = self.submission_repo.get_by_id(submission_id)
        if not submission:
            raise NotFoundError("Submission", submission_id)

        assignment = self.assignment_repo.get_by_id(submission.assignment_id)
        if not assignment:
            raise NotFoundError("Assignment", submission.assignment_id)

        if assignment.teacher_id != teacher.id and not teacher.is_admin:
            raise AuthorizationError("Only the teacher can grade this submission")

        updated = self.submission_repo.update(
            submission_id,
            grade=grade,
            feedback=feedback,
            status="graded",
            graded_at=datetime.utcnow(),
        )
        return updated

    def list_submissions(self, teacher: User, assignment_id: str) -> List[Submission]:
        assignment = self.assignment_repo.get_by_id(assignment_id)
        if not assignment:
            raise NotFoundError("Assignment", assignment_id)

        if assignment.teacher_id != teacher.id and not teacher.is_admin:
            raise AuthorizationError("Only the teacher can view all submissions")

        return self.submission_repo.get_by_assignment(assignment_id)
