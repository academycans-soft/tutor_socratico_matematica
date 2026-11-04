"""API endpoint tests for math LMS and curriculum."""

import sys
from unittest.mock import MagicMock

try:
    import pytest
    fixture_decorator = pytest.fixture
except ImportError:
    fixture_decorator = lambda f: f

if "jwt" not in sys.modules:
    try:
        import jwt
    except ImportError:
        _jwt_mock = MagicMock()
        _jwt_mock.InvalidTokenError = Exception
        _jwt_mock.decode.return_value = {"id": "test_user_id"}
        sys.modules["jwt"] = _jwt_mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from data.database import Base, get_db
from data import models
from gateway.http.app import create_app
from gateway.http.dependencies import get_current_user
from learning.math_engine.curriculum_service import CurriculumService


@fixture_decorator
def test_setup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    teacher = models.User(
        id="teacher-1",
        email="teacher@tutorai.org",
        name="Profesor Diego",
        password_hash="hash",
        role="teacher",
    )
    student = models.User(
        id="student-1",
        email="student@tutorai.org",
        name="Mateo Estudiante",
        password_hash="hash",
        role="student",
    )
    classroom = models.Classroom(
        id="class-1",
        name="9no Matemática",
        code="CLASS01",
        teacher_id="teacher-1",
    )
    member = models.ClassroomMember(
        id="m-1",
        classroom_id="class-1",
        user_id="student-1",
        role="student",
    )
    session.add_all([teacher, student, classroom, member])
    session.commit()

    cs = CurriculumService(session)
    cs.seed_default_math_curriculum()

    app = create_app()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    def override_get_current_user():
        return student

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)
    yield client, session, teacher, student

    session.close()


def test_get_curriculum_roadmap(test_setup):
    client, session, _, _ = test_setup
    res = client.get("/api/v1/curriculum/roadmap")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 12
    grade_names = [g["name"] for g in data]
    assert "9.° EGB" in grade_names


def test_get_topic_details(test_setup):
    client, _, _, _ = test_setup
    res = client.get("/api/v1/curriculum/topics/MATH-PITAGORAS")
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == "MATH-PITAGORAS"
    assert len(data["microcompetencies"]) == 10


def test_teacher_author_custom_topic(test_setup):
    client, session, teacher, _ = test_setup
    from gateway.http.dependencies import get_current_user
    client.app.dependency_overrides[get_current_user] = lambda: teacher

    payload = {
        "code": "MATH-TRIG-SENOS",
        "title": "Ley de Senos y Cosenos",
        "subtitle": "Aprende a resolver triángulos oblicuángulos",
        "stage_initial": "CONECTA",
        "order_index": 2,
        "microcompetencies": [
            {"code": "SEN-01", "name": "Reconoce triángulos oblicuángulos", "prerequisites": []},
            {"code": "SEN-02", "name": "Aplica la Ley de Senos", "prerequisites": ["SEN-01"]},
        ],
    }
    # 1. Normal teacher is rejected with 403
    teacher.role = "teacher"
    res_forbidden = client.post("/api/v1/curriculum/topics", json=payload)
    assert res_forbidden.status_code == 403

    # 2. Teacher Manager is allowed to author and create topic
    teacher.role = "teacher_manager"
    res = client.post("/api/v1/curriculum/topics", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["code"] == "MATH-TRIG-SENOS"
    assert len(data["microcompetencies"]) == 2


def test_student_topic_state_and_conecta_hypothesis(test_setup):
    client, _, _, _ = test_setup
    # Get state
    res = client.get("/api/v1/math/topics/MATH-PITAGORAS/state")
    assert res.status_code == 200
    data = res.json()
    assert data["active_stage"] == "CONECTA"
    assert data["active_scene"] == "scene_0_intro"

    # Submit hypothesis for room floor tiles
    hypo_res = client.post(
        "/api/v1/math/topics/MATH-PITAGORAS/conecta/hypothesis",
        json={"hypothesis": "Podemos medir la diagonal de la esquina opuesta"},
    )
    assert hypo_res.status_code == 200
    assert hypo_res.json()["measured_diagonal"] == 10.18


def test_student_exercise_flow(test_setup):
    client, _, _, _ = test_setup
    # Get current adaptive exercise
    res = client.get("/api/v1/math/topics/MATH-PITAGORAS/exercise/current")
    assert res.status_code == 200
    ex = res.json()
    assert ex["level"] == "basico"

    # Submit correct answer
    sub_res = client.post(
        "/api/v1/math/topics/MATH-PITAGORAS/exercise/submit",
        json={
            "exercise_id": ex["id"],
            "student_answer": ex["correct_answer"],
            "hints_used": 0,
        },
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["correct"] is True


def test_teacher_classroom_analytics(test_setup):
    client, session, teacher, _ = test_setup
    from gateway.http.dependencies import get_current_user
    client.app.dependency_overrides[get_current_user] = lambda: teacher

    summary_res = client.get("/api/v1/math/teacher/class-1/summary")
    assert summary_res.status_code == 200
    s_data = summary_res.json()
    assert s_data["total_students"] == 1
    assert len(s_data["skills_chart"]) == 10

    matrix_res = client.get("/api/v1/math/teacher/class-1/matrix")
    assert matrix_res.status_code == 200
    m_data = matrix_res.json()
    assert len(m_data["matrix"]) == 1
    assert "PIT-01" in m_data["matrix"][0]["skills"]


def test_curriculum_units_and_approval(test_setup):
    client, session, teacher, _ = test_setup
    from gateway.http.dependencies import get_current_user

    # 1. Normal teacher cannot create units (403)
    teacher.role = "teacher"
    client.app.dependency_overrides[get_current_user] = lambda: teacher

    # Get a grade
    roadmap_res = client.get("/api/v1/curriculum/roadmap")
    assert roadmap_res.status_code == 200
    grade_id = roadmap_res.json()[0]["id"]

    res_fail = client.post(
        "/api/v1/curriculum/units",
        json={"grade_id": grade_id, "title": "Álgebra y Funciones", "trimester": 2, "order_index": 1},
    )
    assert res_fail.status_code == 403

    # 2. Teacher Manager can create unit (201)
    teacher.role = "teacher_manager"
    res_ok = client.post(
        "/api/v1/curriculum/units",
        json={"grade_id": grade_id, "title": "Álgebra y Funciones", "trimester": 2, "order_index": 1},
    )
    assert res_ok.status_code == 201
    unit_data = res_ok.json()
    assert unit_data["title"] == "Álgebra y Funciones"
    assert unit_data["trimester"] == 2

    # 3. Create a staged topic and approve it
    from learning.math_engine.curriculum_service import CurriculumService
    svc = CurriculumService(session)
    staged_payload = {
        "conecta": {"problem_title": "La sombra del edificio"},
        "comprende": {"proof_title": "Relación de sombras"},
        "resuelve": {
            "exercises": [
                {
                    "level": "basico",
                    "title": "Cálculo de altura",
                    "statement": "Calcula la altura si la sombra mide 12m",
                    "figure_type": "shadow",
                    "data_params": {"base": 12, "angle": 45},
                    "correct_answer": "12",
                    "hints": {"level_1": "Usa tangente"},
                }
            ]
        },
        "microcompetencies": [
            {"code": "SOM-01", "name": "Calcula alturas mediante sombras", "prerequisites": []}
        ],
    }
    svc.create_staged_topic(
        author_id=teacher.id,
        unit_id=unit_data["id"],
        code="MATH-SOMBRAS",
        title="Sombras y Alturas",
        subtitle="Mide lo inaccesible",
        description="Trigonometría contextual",
        staged_content=staged_payload,
    )

    # Approve topic
    approve_res = client.post("/api/v1/curriculum/topics/MATH-SOMBRAS/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "published"

    # Verify topic is now published with microcompetencies and exercises
    topic_res = client.get("/api/v1/curriculum/topics/MATH-SOMBRAS")
    assert topic_res.status_code == 200
    t_data = topic_res.json()
    assert t_data["status"] == "published"
    assert len(t_data["microcompetencies"]) == 1
    assert t_data["exercises_count"] == 1


def test_infinite_realtime_practice_flow(test_setup):
    client, session, _, student = test_setup
    from gateway.http.dependencies import get_current_user
    client.app.dependency_overrides[get_current_user] = lambda: student

    # Get real-time generated exercise
    ex_res = client.get("/api/v1/math/topics/MATH-PITAGORAS/exercise/realtime")
    assert ex_res.status_code == 200
    ex = ex_res.json()
    assert "statement" in ex
    assert "correct_answer" in ex
    assert "figure_type" in ex

    # Submit answer
    sub_res = client.post(
        "/api/v1/math/topics/MATH-PITAGORAS/exercise/realtime/submit",
        json={
            "exercise": ex,
            "student_answer": ex["correct_answer"],
            "hints_used": 0,
        },
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["is_correct"] is True
    assert "feedback" in sub_data


def test_math_admin_settings(test_setup):
    client, session, teacher, _ = test_setup
    from gateway.http.dependencies import get_current_user

    # Regular teacher cannot update admin settings (403)
    teacher.is_admin = False
    teacher.role = "teacher"
    client.app.dependency_overrides[get_current_user] = lambda: teacher

    res_fail = client.post(
        "/api/v1/math/admin/settings",
        json={"threshold_mastered": 85.0},
    )
    assert res_fail.status_code == 403

    # Admin user can read and update settings
    teacher.is_admin = True
    teacher.role = "admin"
    get_res = client.get("/api/v1/math/admin/settings")
    assert get_res.status_code == 200
    assert get_res.json()["threshold_mastered"] == 80.0

    post_res = client.post(
        "/api/v1/math/admin/settings",
        json={"threshold_mastered": 85.0, "threshold_learned": 65.0},
    )
    assert post_res.status_code == 200
    assert post_res.json()["settings"]["threshold_mastered"] == 85.0
    assert post_res.json()["settings"]["threshold_learned"] == 65.0


def test_proactive_intervention_exercise_error(test_setup):
    client, _, _, _ = test_setup
    res = client.post(
        "/api/v1/math/topics/MATH-PITAGORAS/proactive-intervention",
        json={
            "event_type": "exercise_evaluated",
            "event_payload": {
                "is_correct": False,
                "student_answer": "16",
                "correct_answer": "10",
                "level": "basico",
            },
            "context": {
                "active_stage": "RESUELVE",
                "active_scene": "scene_5_exercise",
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "suggested_prompts" in data
    assert len(data["suggested_prompts"]) > 0


def test_proactive_intervention_hypothesis(test_setup):
    client, _, _, _ = test_setup
    res = client.post(
        "/api/v1/math/topics/MATH-PITAGORAS/proactive-intervention",
        json={
            "event_type": "hypothesis_submitted",
            "event_payload": {
                "hypothesis": "Creo que la diagonal mide 10 m",
            },
            "context": {
                "active_stage": "CONECTA",
                "active_scene": "scene_1_room",
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert data["action"] is not None


if __name__ == "__main__":
    setup = test_setup()
    test_get_roadmap_endpoint(setup)
    test_get_topic_endpoint(setup)
    test_proactive_intervention_exercise(setup)
    test_proactive_intervention_hypothesis(setup)
    print("ALL MATH LMS & PROACTIVE ENDPOINT TESTS PASSED SUCCESSFULLY!")

