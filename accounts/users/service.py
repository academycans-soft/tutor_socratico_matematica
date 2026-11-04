"""Account service for users and authentication."""

import uuid
from typing import List, Optional

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from accounts.users.repository import UserRepository
from common.exceptions import NotFoundError
from data.models import User

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AccountService:
    """Service for account and user operations."""

    def __init__(self, session: Session):
        self.repo = UserRepository(session, User)

    def get_user(self, user_id: str) -> Optional[User]:
        return self.repo.get_by_id(user_id)

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.repo.get_by_email(email)

    def count_users(self) -> int:
        return self.repo.count()

    def create_user(
        self,
        email: str,
        name: str,
        password_plain: str,
        profile_image_url: Optional[str] = None,
        is_admin: bool = False,
        role: str = "user",
    ) -> User:
        """Create a new user; first user is automatically admin."""
        if self.repo.get_by_email(email):
            raise ValueError("Email already registered")
        return self.repo.create(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            password_hash=_pwd_context.hash(password_plain),
            profile_image_url=profile_image_url,
            is_active=True,
            is_admin=is_admin,
            role="admin" if is_admin else role,
        )

    def authenticate(self, email: str, password_plain: str) -> Optional[User]:
        """Return user if credentials are valid, None otherwise."""
        user = self.repo.get_by_email(email)
        if not user:
            return None
        if not _pwd_context.verify(password_plain, user.password_hash):
            return None
        return user

    def list_users(self, skip: int = 0, limit: int = 500) -> List[User]:
        return self.repo.get_all(skip=skip, limit=limit)

    def search_users(self, query: str) -> List[User]:
        return self.repo.search(query)

    def update_user(self, user_id: str, **kwargs) -> Optional[User]:
        try:
            return self.repo.update(user_id, **kwargs)
        except NotFoundError:
            return None

    def update_password(self, user_id: str, new_password: str) -> bool:
        hashed = _pwd_context.hash(new_password)
        try:
            self.repo.update(user_id, password_hash=hashed)
            return True
        except NotFoundError:
            return False

    def delete_user(self, user_id: str) -> bool:
        session = self.repo.session
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(session.bind)
            existing_tables = set(inspector.get_table_names())

            def safe_delete(tbl: str, col: str, val: str):
                if tbl in existing_tables:
                    session.execute(text(f"DELETE FROM {tbl} WHERE {col} = :val"), {"val": val})

            def safe_update(tbl: str, col: str, new_val: Optional[str], match_val: str):
                if tbl in existing_tables:
                    if new_val:
                        session.execute(
                            text(f"UPDATE {tbl} SET {col} = :nval WHERE {col} = :mval"),
                            {"nval": new_val, "mval": match_val},
                        )
                    else:
                        session.execute(
                            text(f"UPDATE {tbl} SET {col} = NULL WHERE {col} = :mval"),
                            {"mval": match_val},
                        )

            # 1. Clean learning states, events and submissions
            safe_delete("student_skill_states", "user_id", user_id)
            safe_delete("pedagogical_events", "user_id", user_id)
            safe_delete("submissions", "student_id", user_id)
            safe_delete("classroom_members", "user_id", user_id)

            # 2. Clean parental links, supports, feedbacks, chats
            if "parent_students" in existing_tables:
                session.execute(
                    text("DELETE FROM parent_students WHERE parent_id = :uid OR student_id = :uid"),
                    {"uid": user_id},
                )
            safe_delete("supports", "user_id", user_id)
            safe_delete("feedbacks", "user_id", user_id)
            safe_delete("chats", "user_id", user_id)

            # 3. Handle teacher/author owned entities
            admin_user = (
                session.execute(
                    text("SELECT id FROM users WHERE is_admin = true AND id != :uid LIMIT 1"),
                    {"uid": user_id},
                ).scalar()
                if "users" in existing_tables
                else None
            )

            if admin_user:
                safe_update("classrooms", "teacher_id", admin_user, user_id)
                safe_update("courses", "teacher_id", admin_user, user_id)
                safe_update("assignments", "teacher_id", admin_user, user_id)
                safe_update("curriculum_topics", "author_id", admin_user, user_id)
            else:
                safe_delete("classrooms", "teacher_id", user_id)
                safe_delete("courses", "teacher_id", user_id)
                safe_delete("assignments", "teacher_id", user_id)
                safe_update("curriculum_topics", "author_id", None, user_id)

            session.flush()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Error cleaning user dependencies for %s: %s", user_id, e)

        return self.repo.delete(user_id)

    def get_user_settings(self, user_id: str) -> dict:
        user = self.repo.get_by_id(user_id)
        stored = (user.settings or {}) if user else {}
        # Wrap bare dicts in {"ui": ...} so the UI's userSettings.ui is always defined
        if "ui" not in stored:
            return {"ui": stored}
        return stored

    def update_user_settings(self, user_id: str, settings: dict) -> dict:
        user = self.repo.update_settings(user_id, settings)
        return user.settings or {} if user else {}

    def get_user_info(self, user_id: str) -> dict:
        user = self.repo.get_by_id(user_id)
        return user.info or {} if user else {}

    def update_user_info(self, user_id: str, info: dict) -> dict:
        user = self.repo.update_info(user_id, info)
        return user.info or {} if user else {}

    def update_role(self, user_id: str, role: str) -> Optional[User]:
        return self.repo.update_role(user_id, role)
