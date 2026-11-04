"""Assignments router — /api/v1/assignments/* matching assignments UI client."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user
from learning.assignments.service import AssignmentsService

router = APIRouter(prefix="/assignments", tags=["assignments"])


class AssignmentCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: str
    due_date: Optional[str] = None
    points: Optional[int] = 100
    enable_ai_grading: Optional[bool] = False
    status: Optional[str] = "published"


class AssignmentSubmitRequest(BaseModel):
    content: Optional[str] = None
    file_id: Optional[str] = None


class GradeSubmissionRequest(BaseModel):
    grade: float
    feedback: Optional[str] = None


def _svc(db: Session = Depends(get_db)) -> AssignmentsService:
    return AssignmentsService(db)


@router.get("/")
def list_assignments(
    course_id: Optional[str] = Query(None),
    classroom_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> List[Dict[str, Any]]:
    return svc.list_for_user(user, course_id=course_id, classroom_id=classroom_id)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreateRequest,
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        assignment = svc.create_assignment(user, body.model_dump())
        return assignment.to_dict()
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{assignment_id}")
def get_assignment(
    assignment_id: str,
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        assignment = svc.get_by_id(user, assignment_id)
        return assignment.to_dict()
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    body: AssignmentSubmitRequest,
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        submission = await svc.submit_assignment(
            user, assignment_id, body.content, body.file_id
        )
        return submission.to_dict()
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/{assignment_id}/submissions")
def list_submissions(
    assignment_id: str,
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> List[Dict[str, Any]]:
    try:
        submissions = svc.list_submissions(user, assignment_id)
        return [s.to_dict() for s in submissions]
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: str,
    body: GradeSubmissionRequest,
    user: User = Depends(get_current_user),
    svc: AssignmentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        updated = svc.grade_submission(user, submission_id, body.grade, body.feedback)
        return updated.to_dict()
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
