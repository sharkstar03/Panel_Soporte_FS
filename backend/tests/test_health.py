def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["db"] is True
    assert data["storage"] is True
    assert data["version"] == "0.1.0"
