"""Math LMS router — /api/v1/math/* for Zero-Click Conversational Stage."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from data.database import get_db
from data.models import User, AppConfig
from gateway.http.dependencies import get_current_user
from ai.providers.service import ProvidersService
from gateway.http.routers.providers import get_providers_service
from learning.math_engine.curriculum_generator import CurriculumGeneratorService
from learning.math_engine.curriculum_service import CurriculumService
from learning.math_engine.pedagogy_service import PedagogyService
from learning.math_engine.socratic_agent import SocraticAgent

router = APIRouter(prefix="/math", tags=["math_lms"])


class RealtimeExerciseSubmitRequest(BaseModel):
    exercise: Dict[str, Any]
    student_answer: str
    hints_used: int = 0


class PedagogicalSettingsUpdateRequest(BaseModel):
    threshold_learned: Optional[float] = None
    threshold_mastered: Optional[float] = None
    domain_weights: Optional[Dict[str, float]] = None
    consecutive_to_advance: Optional[int] = None
    errors_to_hint: Optional[int] = None


class SceneAdvanceRequest(BaseModel):
    stage: str
    scene: str


class HypothesisRequest(BaseModel):
    hypothesis: str


class MicrocheckSubmitRequest(BaseModel):
    answers: Dict[str, str]


class ExerciseSubmitRequest(BaseModel):
    exercise_id: str
    student_answer: str
    hints_used: int = 0


class TutorModelUpdateRequest(BaseModel):
    model: str


class SocraticChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class ProactiveInterventionRequest(BaseModel):
    event_type: str
    event_payload: Dict[str, Any] = {}
    context: Optional[Dict[str, Any]] = None


def _pedagogy_svc(db: Session = Depends(get_db)) -> PedagogyService:
    return PedagogyService(db)


def _agent(db: Session = Depends(get_db)) -> SocraticAgent:
    return SocraticAgent(db)


@router.get("/topics/{code}/state")
def get_student_topic_state(
    code: str,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Returns the student's mastery states, active stage, and scene."""
    return svc.get_or_init_student_state(user_id=user.id, topic_code=code)


@router.get("/student/progress")
def get_student_progress(
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Returns student's overall curriculum progress and mastery status across all topics."""
    return svc.get_student_overall_progress(user_id=user.id)


@router.post("/topics/{code}/complete")
def complete_topic(
    code: str,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Validates topic completion, sets topic as mastered, and unlocks dynamic practice mode."""
    return svc.mark_topic_completed(user_id=user.id, topic_code=code)


@router.post("/topics/{code}/reset")
def reset_topic(
    code: str,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Resets the student's progress on a topic back to the initial CONECTA stage."""
    return svc.reset_student_topic_state(user_id=user.id, topic_code=code)




@router.post("/topics/{code}/scene")
def advance_scene(
    code: str,
    body: SceneAdvanceRequest,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Updates the active stage and scene in the conversational stage."""
    return svc.advance_stage_scene(
        user_id=user.id,
        topic_code=code,
        stage=body.stage,
        scene=body.scene,
    )


@router.post("/topics/{code}/conecta/hypothesis")
def submit_conecta_hypothesis(
    code: str,
    body: HypothesisRequest,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Registers student hypothesis for the room tiles situation."""
    return svc.submit_conecta_hypothesis(
        user_id=user.id,
        topic_code=code,
        hypothesis=body.hypothesis,
    )


@router.post("/topics/{code}/microcheck")
def submit_microcheck(
    code: str,
    body: MicrocheckSubmitRequest,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Evaluates 4-item microcheck for 'Ya conozco esto' and directs to RESUELVE or COMPRENDE."""
    return svc.submit_microcheck(
        user_id=user.id,
        topic_code=code,
        answers=body.answers,
    )


@router.get("/topics/{code}/exercise/current")
def get_current_exercise(
    code: str,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Fetches the next exercise adapted to the student's level."""
    ex = svc.get_current_adaptive_exercise(user_id=user.id, topic_code=code)
    if not ex:
        raise HTTPException(status_code=404, detail="No exercise available in bank.")
    return ex


@router.post("/topics/{code}/exercise/submit")
def submit_exercise(
    code: str,
    body: ExerciseSubmitRequest,
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Evaluates exercise answer, updates D indices, and triggers level up if eligible."""
    return svc.submit_exercise_answer(
        user_id=user.id,
        topic_code=code,
        exercise_id=body.exercise_id,
        student_answer=body.student_answer,
        hints_used=body.hints_used,
    )


@router.post("/topics/{code}/chat")
async def chat_with_socratic_tutor(
    code: str,
    body: SocraticChatRequest,
    user: User = Depends(get_current_user),
    agent: SocraticAgent = Depends(_agent),
) -> Dict[str, Any]:
    """Interactive Socratic chat with the tutor agent."""
    return await agent.chat_socratic(
        user_id=user.id,
        topic_code=code,
        message=body.message,
        context=body.context,
    )


@router.post("/topics/{code}/proactive-intervention")
async def trigger_proactive_intervention(
    code: str,
    body: ProactiveInterventionRequest,
    user: User = Depends(get_current_user),
    agent: SocraticAgent = Depends(_agent),
) -> Dict[str, Any]:
    """Generates a proactive Socratic intervention when an action or state change occurs in the student canvas."""
    user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else str(user))
    return await agent.generate_proactive_intervention(
        user_id=user_id,
        topic_code=code,
        event_type=body.event_type,
        event_payload=body.event_payload,
        context=body.context,
    )


@router.get("/teacher/{classroom_id}/summary")
def get_classroom_summary(
    classroom_id: str,
    topic_code: str = "MATH-PITAGORAS",
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Class overview cards for teacher."""
    return svc.get_teacher_class_summary(classroom_id=classroom_id, topic_code=topic_code)


@router.get("/teacher/{classroom_id}/matrix")
def get_classroom_matrix(
    classroom_id: str,
    topic_code: str = "MATH-PITAGORAS",
    user: User = Depends(get_current_user),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Students x Microcompetencies mastery matrix for teacher."""
    return svc.get_teacher_mastery_matrix(classroom_id=classroom_id, topic_code=topic_code)


@router.get("/tutor/model")
async def get_tutor_model(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    prov_svc: ProvidersService = Depends(get_providers_service),
) -> Dict[str, Any]:
    """Returns the active model and available models for the Socratic Tutor."""
    cfg = db.query(AppConfig).filter_by(key="socratic_tutor_model").first()
    current_model = None
    if cfg and cfg.value:
        if isinstance(cfg.value, dict):
            current_model = cfg.value.get("model")
        elif isinstance(cfg.value, str):
            current_model = cfg.value
    if not current_model:
        current_model = "gpt-4o-mini"

    available_models: List[Dict[str, str]] = []
    try:
        models = await prov_svc.get_merged_models()
        available_models = [{"id": m["id"], "name": m.get("name", m["id"])} for m in models]
    except Exception:
        pass

    if not available_models:
        available_models = [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Recomendado: Rápido y Eficiente)"},
            {"id": "gpt-4o", "name": "GPT-4o (Alta Capacidad de Razonamiento)"},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        ]

    return {
        "current_model": current_model,
        "available_models": available_models,
    }


@router.post("/tutor/model")
def update_tutor_model(
    body: TutorModelUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Updates the active model for the Socratic Tutor."""
    cfg = db.query(AppConfig).filter_by(key="socratic_tutor_model").first()
    if not cfg:
        cfg = AppConfig(key="socratic_tutor_model", value={"model": body.model})
        db.add(cfg)
    else:
        cfg.value = {"model": body.model}
    db.commit()
    return {"status": "ok", "current_model": body.model}


@router.get("/topics/{code}/exercise/realtime")
async def get_realtime_practice_exercise(
    code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    svc: PedagogyService = Depends(_pedagogy_svc),
) -> Dict[str, Any]:
    """Generates an original dynamic exercise in real-time using Generative AI for infinite practice."""
    curriculum_svc = CurriculumService(db)
    topic = curriculum_svc.get_topic_by_code(code)
    topic_title = topic.title if topic else "Matemáticas"
    micro_names = [m.name for m in topic.microcompetencies] if (topic and topic.microcompetencies) else []

    # Get student's current proficiency
    state = svc.get_or_init_student_state(user_id=user.id, topic_code=code)
    student_level = state.get("active_level", "intermedio")

    ai_gen = CurriculumGeneratorService(db)
    exercise = await ai_gen.generate_realtime_practice_exercise(
        topic_title=topic_title,
        microcompetencies=micro_names,
        student_level=student_level,
    )
    return exercise


@router.post("/topics/{code}/exercise/realtime/submit")
def submit_realtime_practice_exercise(
    code: str,
    body: RealtimeExerciseSubmitRequest,
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Evaluates the student's answer for a real-time infinite practice exercise."""
    ex = body.exercise
    correct_str = str(ex.get("correct_answer", "")).strip().lower()
    student_str = body.student_answer.strip().lower()

    is_correct = False
    if correct_str and student_str:
        if student_str == correct_str:
            is_correct = True
        else:
            try:
                c_val = float(correct_str)
                s_val = float(student_str)
                acceptable = ex.get("acceptable_range")
                if acceptable and len(acceptable) == 2:
                    is_correct = acceptable[0] <= s_val <= acceptable[1]
                else:
                    is_correct = abs(c_val - s_val) <= 0.15
            except ValueError:
                is_correct = False

    feedback = (
        "¡Excelente razonamiento! Has resuelto correctamente el problema generado por IA."
        if is_correct
        else f"Tu respuesta fue {body.student_answer}. La respuesta correcta esperada era {ex.get('correct_answer')} {ex.get('unit', '')}."
    )
    return {
        "is_correct": is_correct,
        "correct_answer": ex.get("correct_answer"),
        "unit": ex.get("unit"),
        "solution_steps": ex.get("solution_steps", []),
        "feedback": feedback,
    }


@router.get("/admin/settings")
def get_math_admin_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns pedagogical thresholds and weights configured by the admin."""
    cfg = db.query(AppConfig).filter_by(key="math_pedagogical_settings").first()
    defaults = {
        "threshold_learned": 60.0,
        "threshold_mastered": 80.0,
        "domain_weights": {"R": 0.55, "I": 0.20, "A": 0.15, "V": 0.10},
        "consecutive_to_advance": 2,
        "errors_to_hint": 2,
    }
    if cfg and cfg.value and isinstance(cfg.value, dict):
        defaults.update(cfg.value)
    return defaults


@router.post("/admin/settings")
def update_math_admin_settings(
    body: PedagogicalSettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Allows admin to configure system-wide mastery thresholds (e.g. D >= 80%)."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    cfg = db.query(AppConfig).filter_by(key="math_pedagogical_settings").first()
    current = {
        "threshold_learned": 60.0,
        "threshold_mastered": 80.0,
        "domain_weights": {"R": 0.55, "I": 0.20, "A": 0.15, "V": 0.10},
        "consecutive_to_advance": 2,
        "errors_to_hint": 2,
    }
    if cfg and cfg.value and isinstance(cfg.value, dict):
        current.update(cfg.value)
    updates = body.model_dump(exclude_unset=True)
    current.update(updates)
    if not cfg:
        cfg = AppConfig(key="math_pedagogical_settings", value=current)
        db.add(cfg)
    else:
        cfg.value = current
    db.commit()
    return {"status": "ok", "settings": current}
