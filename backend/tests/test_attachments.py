"""Subida/descarga de adjuntos con almacenamiento LOCAL (sin S3)."""
import io


def _create_session(client, auth):
    r = client.post(
        "/assets",
        json={"name": "PC-Test", "type": "pc", "anydesk_id": "123456789"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    asset_id = r.json()["id"]

    r = client.post(
        "/sessions",
        json={
            "asset_id": asset_id,
            "tool": "anydesk",
            "reason": "prueba automatizada de adjuntos del sistema",
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_attachment_upload_and_download_local(client, auth):
    session_id = _create_session(client, auth)
    content = b"contenido-de-prueba"

    r = client.post(
        f"/attachments/sessions/{session_id}",
        files={"file": ("evidencia.txt", io.BytesIO(content), "text/plain")},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    att_id = r.json()["id"]

    r = client.get(f"/attachments/{att_id}/download", headers=auth)
    assert r.status_code == 200
    assert r.content == content


def test_empty_file_rejected(client, auth):
    session_id = _create_session(client, auth)
    r = client.post(
        f"/attachments/sessions/{session_id}",
        files={"file": ("vacio.txt", io.BytesIO(b""), "text/plain")},
        headers=auth,
    )
    assert r.status_code == 400
