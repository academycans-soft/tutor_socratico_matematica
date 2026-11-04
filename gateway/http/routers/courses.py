"""Courses router — /api/v1/courses/* matching courses UI client."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user
from learning.courses.service import CoursesService

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    classroom_id: str
    level: Optional[str] = "Beginner"
    image_url: Optional[str] = None


def _svc(db: Session = Depends(get_db)) -> CoursesService:
    return CoursesService(db)


@router.get("/")
def list_courses(
    classroom_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    svc: CoursesService = Depends(_svc),
) -> List[Dict[str, Any]]:
    try:
        courses = svc.list_for_user(user, classroom_id)
        return [c.to_dict() for c in courses]
    except (NotFoundError, AuthorizationError) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_course(
    body: CourseCreateRequest,
    user: User = Depends(get_current_user),
    svc: CoursesService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        course = svc.create(user, body.model_dump())
        return course.to_dict()
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{course_id}")
def get_course(
    course_id: str,
    user: User = Depends(get_current_user),
    svc: CoursesService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        course = svc.get_by_id(user, course_id)
        return course.to_dict()
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{course_id}")
def delete_course(
    course_id: str,
    user: User = Depends(get_current_user),
    svc: CoursesService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        svc.delete(user, course_id)
        return {"id": course_id, "deleted": True}
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
