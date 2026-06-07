def test_login_success(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "admin1234"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "incorrecta"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_me_with_token(client, auth):
    r = client.get("/auth/me", headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"


def test_protected_endpoint_requires_auth(client):
    # Sin token no se puede listar usuarios.
    assert client.get("/users").status_code == 401


def test_login_rate_limit(client):
    # Tras varios intentos fallidos desde la misma IP debe devolver 429.
    codes = [
        client.post("/auth/login", json={"username": "x", "password": "y"}).status_code
        for _ in range(15)
    ]
    assert 429 in codes
