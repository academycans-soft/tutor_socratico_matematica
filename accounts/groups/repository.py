"""Groups repository for database operations."""

from typing import List, Optional

from sqlalchemy.orm import Session

from data.models import Group
from data.repositories.base import BaseRepository


class GroupRepository(BaseRepository[Group]):
    """Repository for Group data operations."""

    def __init__(self, session: Session):
        super().__init__(session, Group)

    def get_by_name(self, name: str) -> Optional[Group]:
        return self.session.query(Group).filter(Group.name == name).first()

    def list_all_groups(self, skip: int = 0, limit: int = 1000) -> List[Group]:
        return (
            self.session.query(Group)
            .order_by(Group.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_groups_for_user(self, user_id: str) -> List[Group]:
        """Return groups where user is creator or in user_ids list."""
        all_groups = self.list_all_groups()
        result = []
        for g in all_groups:
            if g.user_id == user_id:
                result.append(g)
            elif g.user_ids and user_id in g.user_ids:
                result.append(g)
        return result
