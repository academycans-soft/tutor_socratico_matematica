"""Tests for groups router and persistence."""

def _admin_token(client):
    r = client.post(
        "/auths/signup",
        json={"email": "admin@t.com", "name": "Admin", "password": "pass1234!"},
    )
    return r.json()["token"]


def _user_token(client, email="user@t.com"):
    r = client.post(
        "/auths/signup", json={"email": email, "name": "User", "password": "pass1234!"}
    )
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_create_and_list_group(client):
    token = _admin_token(client)
    # Create group
    r = client.post(
        "/api/v1/groups/create",
        json={
            "name": "Matemáticas 101",
            "description": "Curso de matemáticas",
            "permissions": {"workspace": {"models": True}},
            "user_ids": [],
        },
        headers=_auth(token),
    )
    assert r.status_code == 200
    created = r.json()
    assert created["name"] == "Matemáticas 101"
    assert created["id"] != ""

    # List groups
    r = client.get("/api/v1/groups/", headers=_auth(token))
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) >= 1
    assert any(g["id"] == created["id"] for g in groups)


def test_get_group_by_id(client):
    token = _admin_token(client)
    r = client.post(
        "/api/v1/groups/create",
        json={"name": "Física", "description": "Curso de física"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = client.get(f"/api/v1/groups/id/{group_id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["name"] == "Física"


def test_update_group(client):
    token = _admin_token(client)
    r = client.post(
        "/api/v1/groups/create",
        json={"name": "Química", "description": "Inicial"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = client.post(
        f"/api/v1/groups/id/{group_id}/update",
        json={"name": "Química Avanzada", "description": "Actualizado"},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Química Avanzada"
    assert r.json()["description"] == "Actualizado"


def test_delete_group(client):
    token = _admin_token(client)
    r = client.post(
        "/api/v1/groups/create",
        json={"name": "Para Borrar"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = client.delete(f"/api/v1/groups/id/{group_id}/delete", headers=_auth(token))
    assert r.status_code == 200

    r = client.get(f"/api/v1/groups/id/{group_id}", headers=_auth(token))
    assert r.status_code == 404
