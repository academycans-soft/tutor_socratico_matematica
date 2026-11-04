"""Curriculum router — /api/v1/curriculum/*."""

import re
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from data.database import get_db
from data.models import User
from gateway.http.dependencies import get_current_user
from learning.math_engine.curriculum_service import CurriculumService
from learning.math_engine.curriculum_generator import CurriculumGeneratorService

router = APIRouter(prefix="/curriculum", tags=["curriculum"])


class UnitCreateRequest(BaseModel):
    grade_id: str
    title: str
    description: Optional[str] = None
    trimester: int = 1
    order_index: int = 1


class UnitUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    trimester: Optional[int] = None
    order_index: Optional[int] = None


class TopicCreateRequest(BaseModel):
    code: str
    unit_id: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    stage_initial: str = "CONECTA"
    order_index: int = 1
    meta: Optional[Dict[str, Any]] = None
    microcompetencies: Optional[List[Dict[str, Any]]] = None


class TopicUpdateRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    unit_id: Optional[str] = None
    order_index: Optional[int] = None
    status: Optional[str] = None
    stage_initial: Optional[str] = None


class AITopicGenerateRequest(BaseModel):
    title: str
    grade_level: str
    unit_id: Optional[str] = None
    unit_title: Optional[str] = None
    description: Optional[str] = None
    prerequisites: Optional[List[str]] = None
    objectives: Optional[List[str]] = None


class AITopicRefineRequest(BaseModel):
    instruction: str
    model_id: Optional[str] = None


def _svc(db: Session = Depends(get_db)) -> CurriculumService:
    return CurriculumService(db)


def _require_teacher_manager(user: User = Depends(get_current_user)) -> User:
    """Verifies that the user is an admin or a teacher manager (profesor gestor)."""
    if not user.is_teacher_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo un Profesor Gestor o Administrador puede crear, modificar o publicar contenidos curriculares.",
        )
    return user


# ── Roadmap & Navigation ───────────────────────────────────────────────────────

@router.get("/roadmap")
def get_curriculum_roadmap(
    user: User = Depends(get_current_user),
    svc: CurriculumService = Depends(_svc),
) -> List[Dict[str, Any]]:
    """Returns the complete hierarchical curriculum (Grades, Units, Topics)."""
    return svc.get_full_curriculum_roadmap()


# ── Units Management ──────────────────────────────────────────────────────────

@router.get("/units")
def list_units(
    grade_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    svc: CurriculumService = Depends(_svc),
) -> List[Dict[str, Any]]:
    """Lists curriculum units, optionally filtered by grade_id."""
    units = svc.list_units(grade_id=grade_id)
    return [u.to_dict() for u in units]


@router.post("/units", status_code=status.HTTP_201_CREATED)
def create_unit(
    body: UnitCreateRequest,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Allows teacher managers and admins to create curriculum units for a trimester."""
    unit = svc.create_unit(
        grade_id=body.grade_id,
        title=body.title,
        description=body.description,
        trimester=body.trimester,
        order_index=body.order_index,
    )
    return unit.to_dict()


@router.put("/units/{unit_id}")
def update_unit(
    unit_id: str,
    body: UnitUpdateRequest,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Updates a unit's title, description, or trimester."""
    unit = svc.update_unit(unit_id=unit_id, data=body.model_dump(exclude_unset=True))
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit.to_dict()


@router.delete("/units/{unit_id}")
def delete_unit(
    unit_id: str,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Deletes a curriculum unit."""
    ok = svc.delete_unit(unit_id=unit_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"id": unit_id, "deleted": True}


# ── Topics & AI Authoring Studio ───────────────────────────────────────────────

@router.get("/topics/{code}")
def get_topic(
    code: str,
    user: User = Depends(get_current_user),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Returns details and microcompetencies of a specific topic."""
    topic = svc.get_topic_by_code(code)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic.to_dict()


@router.post("/topics", status_code=status.HTTP_201_CREATED)
def create_custom_topic(
    body: TopicCreateRequest,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Allows teacher managers and admins to manually author curriculum topics."""
    topic = svc.create_custom_topic(teacher_id=user.id, data=body.model_dump())
    return topic.to_dict()


@router.post("/topics/generate-ai", status_code=status.HTTP_201_CREATED)
async def generate_topic_with_ai(
    body: AITopicGenerateRequest,
    user: User = Depends(_require_teacher_manager),
    db: Session = Depends(get_db),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Generates complete CONECTA -> COMPRENDE -> RESUELVE content using the AI Curriculum Designer.
    
    The resulting topic is stored in 'staging_review' status for the teacher manager to inspect,
    chat-refine, and approve before it goes live for students.
    """
    ai_gen = CurriculumGeneratorService(db)
    generated_content = await ai_gen.generate_topic_content(
        topic_title=body.title,
        grade_name=body.grade_level,
        unit_title=body.unit_title or "Unidad de Matemáticas",
        description=body.description or "",
        objectives=body.objectives or [],
    )

    clean_slug = re.sub(r"[^A-Z0-9]+", "-", body.title.upper()).strip("-")[:20]
    code = f"MATH-{clean_slug}-{uuid.uuid4().hex[:4].upper()}"

    topic = svc.create_staged_topic(
        author_id=user.id,
        unit_id=body.unit_id,
        code=code,
        title=body.title,
        subtitle=generated_content.get("conecta", {}).get("problem_title", body.title),
        description=body.description,
        staged_content=generated_content,
        stage_initial="CONECTA",
    )

    return {
        "topic": topic.to_dict(),
        "staged_content": generated_content,
    }


@router.post("/topics/{code}/refine-ai")
async def refine_topic_with_ai(
    code: str,
    body: AITopicRefineRequest,
    user: User = Depends(_require_teacher_manager),
    db: Session = Depends(get_db),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Refines a staged topic's content based on conversational teacher feedback."""
    topic = svc.get_topic_by_code(code)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    current_staged = topic.staged_content or {}
    ai_gen = CurriculumGeneratorService(db)
    updated_content = await ai_gen.refine_staged_content(
        current_content=current_staged,
        user_instruction=body.instruction,
    )

    updated_topic = svc.update_staged_content(topic_code=code, staged_content=updated_content)
    return {
        "topic": updated_topic.to_dict() if updated_topic else topic.to_dict(),
        "staged_content": updated_content,
    }


@router.post("/topics/{code}/approve")
def approve_and_publish_topic(
    code: str,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Approves a staged topic, publishing it and populating microcompetencies and exercises."""
    topic = svc.approve_and_publish_topic(topic_code=code)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {
        "topic": topic.to_dict(),
        "status": "published",
        "message": "Tema aprobado y publicado exitosamente en el currículo.",
    }


@router.put("/topics/{code}")
def update_topic(
    code: str,
    body: TopicUpdateRequest,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Updates a topic's metadata, title, description, or unit."""
    topic = svc.update_topic(topic_code=code, data=body.model_dump(exclude_unset=True))
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic.to_dict()


@router.delete("/topics/{code}")
def delete_topic(
    code: str,
    user: User = Depends(_require_teacher_manager),
    svc: CurriculumService = Depends(_svc),
) -> Dict[str, Any]:
    """Deletes a topic and its microcompetencies and exercises."""
    ok = svc.delete_topic(topic_code=code)
    if not ok:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"code": code, "deleted": True}
