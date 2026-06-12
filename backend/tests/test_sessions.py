"""Tests del flujo de sesiones de soporte."""


def _create_asset(client, auth):
    r = client.post(
        "/assets",
        json={
            "name": "PC-TEST",
            "type": "pc",
            "anydesk_id": "123456789",
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_session_reason_too_short(client, auth):
    asset_id = _create_asset(client, auth)

    r = client.post(
        "/sessions",
        json={"asset_id": asset_id, "tool": "anydesk", "reason": "corto"},
        headers=auth,
    )
    assert r.status_code == 400
    assert "al menos 20 caracteres" in r.json()["detail"]


def test_close_session_summary_too_short(client, auth):
    asset_id = _create_asset(client, auth)

    r = client.post(
        "/sessions",
        json={"asset_id": asset_id, "tool": "anydesk", "reason": "Motivo suficientemente largo para pasar"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    session_id = r.json()["id"]

    r = client.post(
        "/sessions",
        json={"asset_id": asset_id, "tool": "anydesk", "reason": "Otra sesión para cerrar con resumen corto"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    session_id = r.json()["id"]

    r = client.post(
        f"/sessions/{session_id}/close",
        json={"result": "resuelto", "summary": "corto"},
        headers=auth,
    )
    assert r.status_code == 400
    assert "al menos 30 caracteres" in r.json()["detail"]


def test_session_min_lengths_are_configurable(client, auth):
    asset_id = _create_asset(client, auth)

    # Guardar valores originales para restaurar al final
    r = client.get("/settings/session_min_reason_length", headers=auth)
    original_reason = r.json()["value"]
    r = client.get("/settings/session_min_summary_length", headers=auth)
    original_summary = r.json()["value"]

    try:
        # Cambiar los mínimos desde la configuración
        client.put("/settings/session_min_reason_length", json={"value": 5}, headers=auth)
        client.put("/settings/session_min_summary_length", json={"value": 10}, headers=auth)

        # Verificar que el endpoint público refleja el cambio
        r = client.get("/settings/public/session-config")
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["session_min_reason_length"] == 5
        assert cfg["session_min_summary_length"] == 10

        # El motivo de 8 caracteres debería pasar ahora
        r = client.post(
            "/sessions",
            json={"asset_id": asset_id, "tool": "anydesk", "reason": "ochochar"},
            headers=auth,
        )
        assert r.status_code == 200, r.text
        session_id = r.json()["id"]

        # El resumen de 15 caracteres debería pasar ahora
        r = client.post(
            f"/sessions/{session_id}/close",
            json={"result": "resuelto", "summary": "quince caracteres"},
            headers=auth,
        )
        assert r.status_code == 200, r.text
    finally:
        client.put("/settings/session_min_reason_length", json={"value": original_reason}, headers=auth)
        client.put("/settings/session_min_summary_length", json={"value": original_summary}, headers=auth)
