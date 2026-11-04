"""Tests for assignments and submissions router."""


def _teacher_token(client, email="teacher_asg@test.com"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Teacher Dan", "password": "pass1234!"},
    )
    return r.json()["token"]


def _student_token(client, email="student_asg@test.com"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Student Emma", "password": "pass1234!"},
    )
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_assignment_lifecycle(client):
    teacher_token = _teacher_token(client)
    student_token = _student_token(client)

    # 1. Setup classroom & course
    r = client.post(
        "/api/v1/classrooms/",
        json={"name": "Biology 101", "description": "Cellular biology"},
        headers=_auth(teacher_token),
    )
    classroom = r.json()
    code = classroom["code"]

    r = client.post(
        "/api/v1/courses/",
        json={
            "title": "Mitosis and Meiosis",
            "classroom_id": classroom["id"],
            "subject": "Biology",
        },
        headers=_auth(teacher_token),
    )
    course = r.json()

    # 2. Teacher creates assignment with enable_ai_grading=True
    r = client.post(
        "/api/v1/assignments/",
        json={
            "title": "Explain Meiosis Stages",
            "course_id": course["id"],
            "description": "Describe Prophase I and Metaphase I.",
            "points": 50,
            "enable_ai_grading": True,
        },
        headers=_auth(teacher_token),
    )
    assert r.status_code == 201
    assignment = r.json()
    assignment_id = assignment["id"]

    # 3. Student enrolls and submits assignment
    client.post(
        "/api/v1/classrooms/join", json={"code": code}, headers=_auth(student_token)
    )

    r = client.post(
        f"/api/v1/assignments/{assignment_id}/submit",
        json={"content": "Prophase I involves crossing over between homologous chromosomes."},
        headers=_auth(student_token),
    )
    assert r.status_code == 200
    submission = r.json()
    submission_id = submission["id"]
    assert submission["status"] == "submitted"

    # 4. Teacher reviews submissions
    r = client.get(
        f"/api/v1/assignments/{assignment_id}/submissions",
        headers=_auth(teacher_token),
    )
    assert r.status_code == 200
    subs = r.json()
    assert len(subs) == 1
    assert subs[0]["student_name"] == "Student Emma"

    # 5. Teacher grades submission
    r = client.post(
        f"/api/v1/assignments/submissions/{submission_id}/grade",
        json={"grade": 48.5, "feedback": "Excellent explanation of crossing over!"},
        headers=_auth(teacher_token),
    )
    assert r.status_code == 200
    graded = r.json()
    assert graded["grade"] == 48.5
    assert graded["status"] == "graded"
    assert graded["feedback"] == "Excellent explanation of crossing over!"
