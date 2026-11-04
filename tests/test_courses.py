"""Tests for courses router and visibility scoping."""


def _teacher_token(client, email="teacher_courses@test.com"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Teacher Alice", "password": "pass1234!"},
    )
    return r.json()["token"]


def _student_token(client, email="student_courses@test.com"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Student Charlie", "password": "pass1234!"},
    )
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_course_creation_and_enrolled_visibility(client):
    teacher_token = _teacher_token(client)
    student_token = _student_token(client)

    # 1. Teacher creates classroom
    r = client.post(
        "/api/v1/classrooms/",
        json={"name": "Chemistry Class", "description": "General Chemistry"},
        headers=_auth(teacher_token),
    )
    classroom = r.json()
    classroom_id = classroom["id"]
    code = classroom["code"]

    # 2. Teacher creates a course in that classroom
    r = client.post(
        "/api/v1/courses/",
        json={
            "title": "Thermodynamics",
            "subject": "Chemistry",
            "classroom_id": classroom_id,
            "level": "Intermediate",
            "description": "Laws of thermodynamics",
        },
        headers=_auth(teacher_token),
    )
    assert r.status_code == 201
    course = r.json()
    course_id = course["id"]
    assert "knowledge_id" in course
    assert course["knowledge_id"] is not None

    # Check knowledge base was created
    kb_id = course["knowledge_id"]
    r_kb = client.get(f"/api/v1/knowledge/{kb_id}", headers=_auth(teacher_token))
    assert r_kb.status_code == 200
    assert "Thermodynamics" in r_kb.json()["name"]

    # 3. Non-enrolled student tries to list or view course -> should be empty / 403
    r = client.get("/api/v1/courses/", headers=_auth(student_token))
    assert r.status_code == 200
    assert not any(c["id"] == course_id for c in r.json())

    r = client.get(f"/api/v1/courses/{course_id}", headers=_auth(student_token))
    assert r.status_code == 403

    # Non-enrolled student cannot access course knowledge
    r_kb_denied = client.get(f"/api/v1/knowledge/{kb_id}", headers=_auth(student_token))
    assert r_kb_denied.status_code == 404

    # 4. Student joins classroom
    client.post(
        "/api/v1/classrooms/join", json={"code": code}, headers=_auth(student_token)
    )

    # 5. Now student CAN view the course and its knowledge base
    r = client.get(f"/api/v1/courses/{course_id}", headers=_auth(student_token))
    assert r.status_code == 200
    assert r.json()["title"] == "Thermodynamics"

    r = client.get("/api/v1/courses/", headers=_auth(student_token))
    assert any(c["id"] == course_id for c in r.json())

    # Enrolled student CAN view course knowledge
    r_kb_ok = client.get(f"/api/v1/knowledge/{kb_id}", headers=_auth(student_token))
    assert r_kb_ok.status_code == 200
    assert r_kb_ok.json()["id"] == kb_id
