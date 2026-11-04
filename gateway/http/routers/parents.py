"""Parents router — /api/v1/parents/* for parent portal."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user
from learning.parents.service import ParentsService

router = APIRouter(prefix="/parents", tags=["parents"])


class LinkStudentRequest(BaseModel):
    student_email: str


def _svc(db: Session = Depends(get_db)) -> ParentsService:
    return ParentsService(db)


@router.get("/children")
def list_children(
    user: User = Depends(get_current_user),
    svc: ParentsService = Depends(_svc),
) -> List[Dict[str, Any]]:
    return svc.get_children(user)


@router.post("/link")
def link_student(
    body: LinkStudentRequest,
    user: User = Depends(get_current_user),
    svc: ParentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        link = svc.link_student_by_email(user, body.student_email)
        return link.to_dict()
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No student found with email '{body.student_email}'",
        )
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/children/{student_id}/progress")
def get_child_progress(
    student_id: str,
    user: User = Depends(get_current_user),
    svc: ParentsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        return svc.get_child_progress(user, student_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
