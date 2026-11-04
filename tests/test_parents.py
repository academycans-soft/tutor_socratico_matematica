"""Tests for parents router."""


def _parent_token(client, db, email="parent@family.com"):
    # Create user with role parent
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Parent Mary", "password": "pass1234!"},
    )
    token = r.json()["token"]
    from data.models import User
    user = db.query(User).filter_by(email=email).first()
    if user:
        user.role = "parent"
        db.commit()
    return token


def _student_token(client, db, email="kid@school.edu"):
    r = client.post(
        "/auths/signup",
        json={"email": email, "name": "Student Leo", "password": "pass1234!"},
    )
    token = r.json()["token"]
    from data.models import User
    user = db.query(User).filter_by(email=email).first()
    if user:
        user.role = "student"
        db.commit()
    return token


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_parent_linking_and_progress(client, db):
    student_token = _student_token(client, db, "leo@school.edu")
    parent_token = _parent_token(client, db, "mary@family.com")

    # Link student by email
    r = client.post(
        "/api/v1/parents/link",
        json={"student_email": "leo@school.edu"},
        headers=_auth(parent_token),
    )
    assert r.status_code == 200
    linked = r.json()
    assert linked["student_name"] == "Student Leo"

    # List children
    r = client.get("/api/v1/parents/children", headers=_auth(parent_token))
    assert r.status_code == 200
    children = r.json()
    assert len(children) >= 1
    assert any(c["email"] == "leo@school.edu" for c in children)

    # Get child progress
    leo_id = linked["student_id"]
    r = client.get(
        f"/api/v1/parents/children/{leo_id}/progress", headers=_auth(parent_token)
    )
    assert r.status_code == 200
    progress = r.json()
    assert progress["student"]["name"] == "Student Leo"
