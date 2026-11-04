"""Groups router — /api/v1/groups/* matching groups/index.ts UI client."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from accounts.groups.service import GroupsService
from common.exceptions import AuthorizationError, NotFoundError
from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/")
def list_groups(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    svc = GroupsService(db)
    return [g.to_dict() for g in svc.list_groups(user)]


@router.post("/create")
def create_group(
    body: Dict[str, Any],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    svc = GroupsService(db)
    group = svc.create_group(user, body)
    return group.to_dict()


@router.get("/id/{group_id}")
def get_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    svc = GroupsService(db)
    try:
        group = svc.get_group(group_id, user)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        return group.to_dict()
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/id/{group_id}/update")
def update_group(
    group_id: str,
    body: Dict[str, Any],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    svc = GroupsService(db)
    try:
        group = svc.update_group(group_id, user, body)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        return group.to_dict()
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/id/{group_id}/delete")
def delete_group(
    group_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    svc = GroupsService(db)
    try:
        ok = svc.delete_group(group_id, user)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        return {"id": group_id}
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
