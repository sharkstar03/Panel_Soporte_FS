"""Regresión del arreglo de seguridad: el endpoint público de settings solo
debe exponer claves de la lista blanca, nunca secretos como smtp_password."""


def test_public_setting_whitelisted_ok(client):
    r = client.get("/settings/public/app_name")
    assert r.status_code == 200
    assert r.json()["key"] == "app_name"


def test_public_setting_smtp_password_blocked(client):
    # smtp_password NO está en la lista blanca → 404 (sin autenticación).
    r = client.get("/settings/public/smtp_password")
    assert r.status_code == 404


def test_public_setting_cors_blocked(client):
    assert client.get("/settings/public/cors_origins").status_code == 404


def test_settings_list_requires_permission(client):
    assert client.get("/settings").status_code == 401
