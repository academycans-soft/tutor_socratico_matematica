"""Groups service for business logic and access rules."""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from accounts.groups.repository import GroupRepository
from common.exceptions import AuthorizationError, NotFoundError
from data.models import Group, User


class GroupsService:
    """Service managing classrooms, cohorts, and user groups."""

    def __init__(self, session: Session):
        self.repo = GroupRepository(session)

    def list_groups(self, user: User) -> List[Group]:
        """List groups. Admins see all groups; regular users see their own groups."""
        if user.is_admin:
            return self.repo.list_all_groups()
        return self.repo.list_groups_for_user(user.id)

    def get_group(self, group_id: str, user: User) -> Optional[Group]:
        """Get group by ID with access check."""
        group = self.repo.get_by_id(group_id)
        if not group:
            return None
        if not user.is_admin and group.user_id != user.id:
            if not (group.user_ids and user.id in group.user_ids):
                raise AuthorizationError("You do not have access to this group")
        return group

    def create_group(self, user: User, data: Dict[str, Any]) -> Group:
        """Create a new group."""
        name = (data.get("name") or "New Group").strip()
        description = data.get("description", "")
        permissions = data.get("permissions") or {}
        user_ids = data.get("user_ids") or []
        extra_data = data.get("data") or {}
        meta = data.get("meta") or {}

        group = self.repo.create(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=name,
            description=description,
            permissions=permissions,
            user_ids=user_ids,
            data=extra_data,
            meta=meta,
        )
        return group

    def update_group(
        self, group_id: str, user: User, data: Dict[str, Any]
    ) -> Optional[Group]:
        """Update an existing group."""
        group = self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundError("Group", group_id)
        if not user.is_admin and group.user_id != user.id:
            raise AuthorizationError("Only admins or the creator can update this group")

        updates: Dict[str, Any] = {}
        if "name" in data:
            updates["name"] = data["name"].strip()
        if "description" in data:
            updates["description"] = data["description"]
        if "permissions" in data:
            updates["permissions"] = data["permissions"]
        if "user_ids" in data:
            updates["user_ids"] = data["user_ids"]
        if "data" in data:
            updates["data"] = data["data"]
        if "meta" in data:
            updates["meta"] = data["meta"]

        return self.repo.update(group_id, **updates)

    def delete_group(self, group_id: str, user: User) -> bool:
        """Delete an existing group."""
        group = self.repo.get_by_id(group_id)
        if not group:
            raise NotFoundError("Group", group_id)
        if not user.is_admin and group.user_id != user.id:
            raise AuthorizationError("Only admins or the creator can delete this group")

        return self.repo.delete(group_id)
