"""Classrooms router — /api/v1/classrooms/* matching classrooms UI client."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from common.exceptions import AuthorizationError, NotFoundError, ValidationError
from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user
from learning.classrooms.service import ClassroomsService

router = APIRouter(prefix="/classrooms", tags=["classrooms"])


class ClassroomCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    grade_id: Optional[str] = None


class ClassroomUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    grade_id: Optional[str] = None


class ClassroomJoinRequest(BaseModel):
    code: str


class ClassroomEnrollRequest(BaseModel):
    user_id: str



def _svc(db: Session = Depends(get_db)) -> ClassroomsService:
    return ClassroomsService(db)


@router.get("", include_in_schema=False)
@router.get("/")
def list_classrooms(
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> List[Dict[str, Any]]:
    classrooms = svc.list_for_user(user)
    return [c.to_dict() for c in classrooms]


@router.post("", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_classroom(
    body: ClassroomCreateRequest,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        classroom = svc.create(user, body.model_dump())
        return classroom.to_dict()
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/join")
def join_classroom(
    body: ClassroomJoinRequest,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        classroom = svc.join_by_code(user, body.code)
        return classroom.to_dict()
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No classroom found with code '{body.code}'")


@router.get("/{classroom_id}")
def get_classroom(
    classroom_id: str,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        return svc.get_roster(user, classroom_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/{classroom_id}/enroll")
def enroll_student(
    classroom_id: str,
    body: ClassroomEnrollRequest,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        return svc.enroll_student(user, classroom_id, body.user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{classroom_id}/members/{user_id}")
def remove_student(
    classroom_id: str,
    user_id: str,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        return svc.remove_student(user, classroom_id, user_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))



@router.put("/{classroom_id}")
def update_classroom(
    classroom_id: str,
    body: ClassroomUpdateRequest,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        updated = svc.update(user, classroom_id, body.model_dump(exclude_unset=True))
        return updated.to_dict()
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/{classroom_id}")
def delete_classroom(
    classroom_id: str,
    user: User = Depends(get_current_user),
    svc: ClassroomsService = Depends(_svc),
) -> Dict[str, Any]:
    try:
        svc.delete(user, classroom_id)
        return {"id": classroom_id, "deleted": True}
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
