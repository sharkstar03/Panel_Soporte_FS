"""Bóveda de contraseñas: crear, listar, revelar (cifrado/descifrado)."""


def test_password_crud_and_reveal(client, auth):
    payload = {
        "title": "Servidor X",
        "username": "root",
        "password": "S3cretoSuperSeguro!",
        "url": "https://x.local",
        "notes": "nota",
        "category": "infra",
        "roles_allowed": "admin,supervisor,tecnico",
    }
    r = client.post("/passwords", json=payload, headers=auth)
    assert r.status_code == 200, r.text
    entry = r.json()
    entry_id = entry["id"]
    # El listado no debe exponer la contraseña en claro.
    assert "password" not in entry

    r = client.get("/passwords", headers=auth)
    assert r.status_code == 200
    assert any(e["id"] == entry_id for e in r.json())

    # Reveal devuelve la contraseña descifrada == original.
    r = client.get(f"/passwords/{entry_id}/reveal", headers=auth)
    assert r.status_code == 200
    assert r.json()["password"] == "S3cretoSuperSeguro!"


def test_password_requires_auth(client):
    assert client.get("/passwords").status_code == 401


def test_crypto_roundtrip():
    from app.crypto import decrypt_value, encrypt_value

    cipher = encrypt_value("dato-sensible")
    assert cipher.startswith("gAAAA")
    assert decrypt_value(cipher) == "dato-sensible"
