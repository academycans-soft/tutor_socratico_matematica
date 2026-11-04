"""Tests for math pedagogical state machine and adaptive rules."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from data.database import Base
from data import models
from learning.math_engine.curriculum_service import CurriculumService
from learning.math_engine.pedagogy_service import PedagogyService


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create dummy user
    user = models.User(
        id="student-1",
        email="student@tutorai.org",
        name="Mateo Estudiante",
        password_hash="hash",
    )
    session.add(user)
    session.commit()

    # Seed curriculum
    cs = CurriculumService(session)
    cs.seed_default_math_curriculum()

    yield session
    session.close()


def test_student_state_initialization(db_session):
    svc = PedagogyService(db_session)
    state = svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    assert state["active_stage"] == "CONECTA"
    assert state["active_scene"] == "scene_0_intro"
    assert state["current_level"] == "basico"
    assert len(state["skills"]) == 10
    # PIT-01 should be ready to learn (no prerequisites)
    pit01 = next(s for s in state["skills"] if s["microcompetency_code"] == "PIT-01")
    assert pit01["ready_to_learn"] is True
    # PIT-02 should NOT be ready to learn yet (PIT-01 is not learned/mastered)
    pit02 = next(s for s in state["skills"] if s["microcompetency_code"] == "PIT-02")
    assert pit02["ready_to_learn"] is False


def test_microcheck_approval_and_routing(db_session):
    svc = PedagogyService(db_session)
    svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    # 4/4 correct answers
    answers = {
        "PIT-01": "Tiene exactamente un ángulo interior de 90°",
        "PIT-02": "p",
        "PIT-06": "5 cm",
        "PIT-07": "8 m",
    }
    result = svc.submit_microcheck("student-1", "MATH-PITAGORAS", answers)

    assert result["approved"] is True
    assert result["correct_count"] == 4
    # Must route directly to RESUELVE Basic level
    assert result["next_stage"] == "RESUELVE"

    state = svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")
    assert state["active_stage"] == "RESUELVE"
    assert state["current_level"] == "basico"


def test_microcheck_failure_routes_to_comprende(db_session):
    svc = PedagogyService(db_session)
    svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    # Only 1 correct answer (below threshold of 3)
    answers = {
        "PIT-01": "Tiene lados iguales",
        "PIT-02": "m",
        "PIT-06": "5",
        "PIT-07": "15",
    }
    result = svc.submit_microcheck("student-1", "MATH-PITAGORAS", answers)

    assert result["approved"] is False
    assert result["correct_count"] == 1
    # Must route to COMPRENDE
    assert result["next_stage"] == "COMPRENDE"


def test_desafio_pond_rejects_twelve_and_accepts_thirteen(db_session):
    svc = PedagogyService(db_session)
    ex = (
        db_session.query(models.ExerciseItem)
        .filter_by(topic_code="MATH-PITAGORAS", level="desafio")
        .first()
    )
    assert ex is not None

    # Answering 12 (depth of pond) must be rejected with specific modeling feedback
    res_12 = svc.submit_exercise_answer("student-1", "MATH-PITAGORAS", ex.id, "12 m")
    assert res_12["correct"] is False
    assert "profundidad" in res_12["feedback"].lower()
    assert "longitud total" in res_12["feedback"].lower()

    # Answering 13 (true length of plant) must be accepted
    res_13 = svc.submit_exercise_answer("student-1", "MATH-PITAGORAS", ex.id, "13 m")
    assert res_13["correct"] is True


def test_adaptive_level_up_on_two_consecutive_correct(db_session):
    svc = PedagogyService(db_session)
    svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    ex = (
        db_session.query(models.ExerciseItem)
        .filter_by(topic_code="MATH-PITAGORAS", level="basico")
        .first()
    )

    # First correct answer (no hints)
    res1 = svc.submit_exercise_answer("student-1", "MATH-PITAGORAS", ex.id, "10 m", hints_used=0)
    assert res1["correct"] is True
    assert res1["level_up"] is False

    # Second consecutive correct answer (no hints) -> triggers level up
    res2 = svc.submit_exercise_answer("student-1", "MATH-PITAGORAS", ex.id, "10 m", hints_used=0)
    assert res2["correct"] is True
    assert res2["level_up"] is True
    assert res2["current_level"] == "intermedio"


def test_student_overall_progress_and_completion(db_session):
    svc = PedagogyService(db_session)
    svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    # Initial overall progress
    prog = svc.get_student_overall_progress("student-1")
    assert "MATH-PITAGORAS" in prog["topics"]
    assert prog["topics"]["MATH-PITAGORAS"]["is_mastered"] is False
    assert prog["completed_count"] == 0

    # Mark topic completed
    completed = svc.mark_topic_completed("student-1", "MATH-PITAGORAS")
    assert completed["is_mastered"] is True
    assert completed["active_stage"] == "COMPLETADO"

    # Verify updated overall progress reflects completion
    prog2 = svc.get_student_overall_progress("student-1")
    assert prog2["topics"]["MATH-PITAGORAS"]["is_mastered"] is True
    assert prog2["topics"]["MATH-PITAGORAS"]["completed"] is True
    assert prog2["completed_count"] == 1


def test_reset_student_topic_state(db_session):
    svc = PedagogyService(db_session)
    svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")

    # Move to RESUELVE
    svc.advance_stage_scene("student-1", "MATH-PITAGORAS", "RESUELVE", "scene_5_exercise")
    state = svc.get_or_init_student_state("student-1", "MATH-PITAGORAS")
    assert state["active_stage"] == "RESUELVE"

    # Reset
    reset = svc.reset_student_topic_state("student-1", "MATH-PITAGORAS")
    assert reset["active_stage"] == "CONECTA"
    assert reset["active_scene"] == "scene_0_intro"
    assert reset["current_level"] == "basico"
    assert reset["average_domain_d"] == 0.0

    # Verify overall progress reflects the reset
    prog = svc.get_student_overall_progress("student-1")
    assert prog["topics"]["MATH-PITAGORAS"]["active_stage"] == "CONECTA"


