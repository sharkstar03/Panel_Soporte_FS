"""Tests del módulo de documentos."""


def test_create_document_rejects_invalid_email(client, auth):
    r = client.post(
        "/documents",
        json={
            "type": "entrega_equipo",
            "title": "Entrega de prueba",
            "data_json": "{}",
            "approver_email": "no-es-un-email",
        },
        headers=auth,
    )
    assert r.status_code == 422


def test_create_document_accepts_valid_email(client, auth):
    r = client.post(
        "/documents",
        json={
            "type": "entrega_equipo",
            "title": "Entrega de prueba",
            "data_json": "{}",
            "approver_email": "Aprobador@Ejemplo.COM",
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["approver_email"] == "aprobador@ejemplo.com"
