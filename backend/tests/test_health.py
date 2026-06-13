def test_health(client, monkeypatch):
    # El chequeo de la DGI depende de un servicio externo; se simula para que
    # los tests no dependan de conectividad real (ideal para CI).
    from app import main as main_module
    monkeypatch.setattr(main_module, "_check_dgi", lambda: True)

    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["db"] is True
    assert data["storage"] is True
    assert data["dgi"] is True
    assert data["version"] == "0.1.0"


def test_health_dgi_down(client, monkeypatch):
    from app import main as main_module
    monkeypatch.setattr(main_module, "_check_dgi", lambda: False)

    r = client.get("/health")
    assert r.status_code == 503
    data = r.json()
    assert data["status"] == "fail"
    assert data["dgi"] is False
