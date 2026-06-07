"""Gestión de usuarios: creación con política, cambio/reset de contraseña,
activación/desactivación y guardas anti-bloqueo."""


def _create(client, auth, username, password, role="tecnico"):
    return client.post(
        "/users",
        json={"username": username, "password": password, "role": role},
        headers=auth,
    )


def test_create_user_weak_password_rejected(client, auth):
    assert _create(client, auth, "weakuser", "123").status_code == 422


def test_create_user_common_password_rejected(client, auth):
    assert _create(client, auth, "commonuser", "admin1234").status_code == 422


def test_create_user_strong_ok(client, auth):
    assert _create(client, auth, "tecnico_qa", "Str0ngPass2026").status_code == 200


def test_admin_reset_password(client, auth):
    uid = _create(client, auth, "reset_target", "Str0ngPass2026").json()["id"]
    r = client.post(f"/users/{uid}/password", json={"new_password": "NuevaClave2026"}, headers=auth)
    assert r.status_code == 200
    # Debe poder iniciar sesión con la nueva contraseña.
    r = client.post("/auth/login", json={"username": "reset_target", "password": "NuevaClave2026"})
    assert r.status_code == 200


def test_admin_reset_password_policy(client, auth):
    uid = _create(client, auth, "reset_weak", "Str0ngPass2026").json()["id"]
    r = client.post(f"/users/{uid}/password", json={"new_password": "abc"}, headers=auth)
    assert r.status_code == 422


def test_deactivate_user_blocks_login(client, auth):
    uid = _create(client, auth, "to_disable", "Str0ngPass2026").json()["id"]
    assert client.post("/auth/login", json={"username": "to_disable", "password": "Str0ngPass2026"}).status_code == 200
    r = client.put(f"/users/{uid}", json={"active": False}, headers=auth)
    assert r.status_code == 200 and r.json()["active"] is False
    # Usuario desactivado ya no puede entrar.
    assert client.post("/auth/login", json={"username": "to_disable", "password": "Str0ngPass2026"}).status_code == 401


def test_self_change_password(client, auth):
    assert _create(client, auth, "selfchg", "Str0ngPass2026").status_code == 200
    tok = client.post("/auth/login", json={"username": "selfchg", "password": "Str0ngPass2026"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    # Contraseña actual incorrecta.
    assert client.post("/auth/change-password", json={"current_password": "mala", "new_password": "OtraClave2026"}, headers=h).status_code == 400
    # Cambio válido.
    assert client.post("/auth/change-password", json={"current_password": "Str0ngPass2026", "new_password": "OtraClave2026"}, headers=h).status_code == 200
    assert client.post("/auth/login", json={"username": "selfchg", "password": "OtraClave2026"}).status_code == 200


def test_admin_cannot_deactivate_self(client, auth):
    me = client.get("/auth/me", headers=auth).json()
    assert client.put(f"/users/{me['id']}", json={"active": False}, headers=auth).status_code == 400
