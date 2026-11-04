"""Tests for classrooms router."""


def _teacher_token(client, email="teacher@school.edu"):
    # First user is admin, second user has role
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Teacher Jane", "password": "pass1234!"},
    )
    return r.json()["token"]


def _student_token(client, email="student@school.edu"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Student Bob", "password": "pass1234!"},
    )
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_create_and_join_classroom(client):
    # First user is admin/teacher
    teacher_token = _teacher_token(client, "admin_teacher@test.com")
    student_token = _student_token(client, "student_bob@test.com")

    # 1. Teacher creates a classroom
    r = client.post(
        "/api/v1/classrooms/",
        json={"name": "Physics 101", "description": "Intro to Classical Physics"},
        headers=_auth(teacher_token),
    )
    assert r.status_code == 201
    classroom = r.json()
    assert classroom["name"] == "Physics 101"
    code = classroom["code"]
    assert len(code) == 6

    # 2. Student joins with code
    r = client.post(
        "/api/v1/classrooms/join",
        json={"code": code},
        headers=_auth(student_token),
    )
    assert r.status_code == 200
    joined = r.json()
    assert joined["id"] == classroom["id"]

    # 3. Student lists classrooms -> sees Physics 101
    r = client.get("/api/v1/classrooms/", headers=_auth(student_token))
    assert r.status_code == 200
    student_classrooms = r.json()
    assert any(c["id"] == classroom["id"] for c in student_classrooms)

    # 4. Teacher views roster
    r = client.get(
        f"/api/v1/classrooms/{classroom['id']}", headers=_auth(teacher_token)
    )
    assert r.status_code == 200
    roster = r.json()
    assert len(roster["members"]) >= 1
    assert any(m["user_name"] == "Student Bob" for m in roster["members"])
