from __future__ import annotations

import os
import re
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import requests
from bs4 import BeautifulSoup

from .storage import load_machine_index, load_zcache, save_machine_index, save_zcache

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

DEBUG = False
SCRAPER_CACHE: Dict[str, "PlaceFTScraper"] = {}
SCRAPER_LOCKS: Dict[str, threading.Lock] = {}


def _portal_base() -> str:
    """URL base del portal web de PlaceFT ( configurable vía PLACEFT_PORTAL_BASE )."""
    return (os.environ.get("PLACEFT_PORTAL_BASE") or "https://dgi-placef.mef.gob.pa").rstrip("/")


def _api_base() -> str:
    """URL base de la API de PlaceFT ( configurable vía PLACEFT_API_BASE )."""
    return (
        os.environ.get("PLACEFT_API_BASE") or "https://dgi-placef-prod-apiweb.mef.gob.pa:50525"
    ).rstrip("/")


LOGIN_URL = f"{_portal_base()}/Contribuyente/inicio-sesion"


class PlaceFTScraper:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
        self.token_obtained = False
        self.machine_index: Dict[str, Dict[str, str]] = {
            str(k or "").strip().upper(): {
                "machineId": str(v.get("machineId") or ""),
                "taxpayerId": str(v.get("taxpayerId") or ""),
            }
            for k, v in (load_machine_index() or {}).items()
        }
        self.z_cache: Dict[str, Dict[str, str]] = {
            str(k or "").strip().upper(): {kk: str(vv) for kk, vv in (v or {}).items()}
            for k, v in (load_zcache() or {}).items()
        }

    def resolve_machine_ids(self, serial: str) -> Tuple[str | None, str | None]:
        key = (serial or "").strip().upper()
        if not key:
            return None, None
        item = self.machine_index.get(key)
        if not item:
            return None, None
        mid = (item.get("machineId") or "").strip() or None
        tid = (item.get("taxpayerId") or "").strip() or None
        return mid, tid

    def _persist_machine_index(self) -> None:
        try:
            save_machine_index(self.machine_index)
        except Exception:
            pass

    def get_cached_z(self, serial: str) -> Dict[str, str] | None:
        key = (serial or "").strip().upper()
        if not key:
            return None
        item = self.z_cache.get(key)
        if not isinstance(item, dict):
            return None
        return item

    def _persist_z(self, serial: str, item: dict) -> None:
        try:
            key = (serial or "").strip().upper()
            if not key:
                return
            self.z_cache[key] = {
                "datez": str(item.get("datez") or item.get("Datez") or item.get("zDate") or ""),
                "numz": str(item.get("numz") or item.get("Numz") or item.get("zNumber") or item.get("number") or ""),
                "transmissionDate": str(
                    item.get("transmissionDate") or item.get("fechaTransmision") or item.get("FechaTransmision") or ""
                ),
                "updatedAt": datetime.now().isoformat(),
            }
            save_zcache(self.z_cache)
        except Exception:
            pass

    def login(self, username: str, password: str) -> Tuple[bool, str]:
        try:
            response = self.session.get(LOGIN_URL)
            soup = BeautifulSoup(response.content, "html.parser")

            csrf_token = None
            for meta in soup.find_all("meta"):
                if meta.get("name") in ["csrf-token", "_token", "csrf_token"]:
                    csrf_token = meta.get("content")
                    break

            if not csrf_token:
                for inp in soup.find_all("input", type="hidden"):
                    if inp.get("name") in ["_token", "csrf_token", "authenticity_token"]:
                        csrf_token = inp.get("value")
                        break

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": LOGIN_URL,
                "Origin": _portal_base(),
            }

            login_attempts = [
                {
                    "name": "OAuth con Basic Auth (placefweb:12345)",
                    "url": f"{_api_base()}/api/v1/security/oauth/token",
                    "method": "form",
                    "auth": ("placefweb", "12345"),
                    "data": {
                        "username": username,
                        "password": password,
                        "grant_type": "password",
                        "aud": "taxpayer_web",
                    },
                },
                {
                    "name": "OAuth con client credentials en payload",
                    "url": f"{_api_base()}/api/v1/security/oauth/token",
                    "method": "form",
                    "data": {
                        "username": username,
                        "password": password,
                        "grant_type": "password",
                        "aud": "taxpayer_web",
                        "client_id": "placefweb",
                        "client_secret": "12345",
                    },
                },
            ]

            if csrf_token:
                for attempt in login_attempts:
                    attempt["data"]["_token"] = csrf_token

            for idx, attempt in enumerate(login_attempts, 1):
                try:
                    request_kwargs = {"headers": headers, "allow_redirects": True, "timeout": 15}

                    if "auth" in attempt:
                        request_kwargs["auth"] = attempt["auth"]

                    if attempt["method"] == "json":
                        request_kwargs["json"] = attempt["data"]
                    else:
                        request_kwargs["data"] = attempt["data"]
                        request_kwargs["headers"] = {
                            **headers,
                            "Content-Type": "application/x-www-form-urlencoded",
                        }

                    response = self.session.post(attempt["url"], **request_kwargs)

                    if response.status_code == 401:
                        return False, "Credenciales inválidas (401). Verifica correo y contraseña."

                    try:
                        json_response = response.json()
                        if "token" in json_response or "access_token" in json_response:
                            token = json_response.get("token") or json_response.get("access_token")
                            self.session.headers.update({"Authorization": f"Bearer {token}"})
                            self.token_obtained = True
                            return True, "Login exitoso"
                    except Exception:
                        pass

                    if response.status_code == 200:
                        if (
                            any(
                                keyword in response.url.lower()
                                for keyword in ["equipos", "dashboard", "panel", "home"]
                            )
                            and "inicio-sesion" not in response.url.lower()
                        ):
                            return True, "Login exitoso"

                        if "equipos" in response.text.lower() or "dashboard" in response.text.lower():
                            return True, "Login exitoso"

                    if response.status_code in (301, 302):
                        continue

                    if response.status_code not in [404, 405, 500]:
                        soup = BeautifulSoup(response.content, "html.parser")
                        error_indicators = [
                            soup.find(text=re.compile(r"credenciales|incorrec|invalid|error", re.I)),
                            soup.find(class_=re.compile(r"error|alert|danger|invalid", re.I)),
                        ]

                        for error in error_indicators:
                            if error:
                                error_text = (
                                    error.get_text(strip=True) if hasattr(error, "get_text") else str(error)
                                )
                                if len(error_text) < 200:
                                    return False, error_text

                        if "inicio-sesion" in response.url:
                            continue

                except requests.exceptions.Timeout:
                    continue
                except Exception:
                    continue

            return False, "No se pudo iniciar sesión. Verifique las credenciales."
        except Exception as e:
            return False, f"Error: {str(e)}"

    def get_equipos(self) -> Tuple[List[dict] | None, str | None]:
        try:
            base_env = os.environ.get("PLACEFT_API_BASE")
            candidates = [
                u
                for u in [
                    f"{base_env}/api/v1/machines/machines" if base_env else None,
                    f"{_api_base()}/api/v1/machines/machines",
                ]
                if u
            ]
            for api_url in candidates:
                try:
                    equipos: List[dict] = []
                    page = 0
                    size = 100
                    max_pages = 10
                    while True:
                        params = {"activo": "true", "page": page, "size": size}
                        response = self.session.get(api_url, params=params, timeout=15)

                        if response.status_code == 401:
                            self.token_obtained = False
                            return None, "Sesión expirada. Por favor inicie sesión nuevamente."

                        if response.status_code != 200:
                            break

                        data = response.json()
                        if data.get("code") != 0:
                            break
                        result = data.get("result", {})
                        items = result.get("content") or result.get("machines") or result.get("data") or []
                        if not items:
                            break
                        changed_index = False
                        for item in items:
                            try:
                                raw_model = item.get("model") or item.get("modelo") or ""
                                if isinstance(raw_model, dict):
                                    brand = str(raw_model.get("name") or "").strip()
                                    code = str(raw_model.get("code") or raw_model.get("model") or "").strip()
                                    if brand and code:
                                        model_text = f"{brand} {code}"
                                    else:
                                        model_text = brand or code or ""
                                else:
                                    model_text = str(raw_model or "").strip()

                                equipo = {
                                    "serie": item.get("serialNumber")
                                    or item.get("serie")
                                    or item.get("serial")
                                    or "",
                                    "modelo": model_text,
                                    "machineId": item.get("id") or item.get("machineId") or "",
                                    "taxpayerId": item.get("taxpayer", {}).get("id")
                                    if isinstance(item.get("taxpayer"), dict)
                                    else (item.get("taxpayerId") or ""),
                                    "estado_dgi": item.get("status") or item.get("estado") or "ACTIVO",
                                    "distribuidor": item.get("distributor", {}).get("name")
                                    if isinstance(item.get("distributor"), dict)
                                    else item.get("distributor", ""),
                                    "contribuyente": item.get("taxpayer", {}).get("name")
                                    if isinstance(item.get("taxpayer"), dict)
                                    else item.get("contribuyente", ""),
                                    "primera_transmision": item.get("firstTransmission")
                                    or item.get("primeraTransmision")
                                    or "",
                                    "ultima_transmision": item.get("lastTransmission")
                                    or item.get("ultimaTransmision")
                                    or item.get("lastUpdate")
                                    or "",
                                }
                                dias = self.calcular_dias_diferencia(equipo["ultima_transmision"])
                                equipo["dias_sin_actualizar"] = dias
                                equipo["estado"] = self.determinar_estado(dias)
                                equipo["sucursal"] = self.extraer_sucursal(equipo["contribuyente"])
                                equipo["detalle"] = f"Última transmisión: {equipo['ultima_transmision']}"
                                equipo["serie"] = str(equipo.get("serie") or "").strip().upper()

                                cached_z = self.get_cached_z(equipo["serie"])
                                if cached_z:
                                    raw_date = cached_z.get("datez") or ""
                                    if len(raw_date) == 8 and raw_date.isdigit():
                                        raw_date = f"{raw_date[6:8]}-{raw_date[4:6]}-{raw_date[0:4]}"
                                    elif len(raw_date) == 6 and raw_date.isdigit():
                                        try:
                                            d6 = datetime.strptime(raw_date, "%y%m%d")
                                            raw_date = d6.strftime("%d-%m-%Y")
                                        except Exception:
                                            pass
                                    equipo["ultimoReporteZ"] = raw_date or "N/A"
                                    equipo["ultimaZ"] = cached_z.get("numz") or "N/A"
                                else:
                                    equipo["ultimoReporteZ"] = "N/A"
                                    equipo["ultimaZ"] = "N/A"

                                equipos.append(equipo)
                                serie_key = str(equipo.get("serie") or "").strip().upper()
                                mid = str(equipo.get("machineId") or "").strip()
                                tid = str(equipo.get("taxpayerId") or "").strip()
                                if serie_key and mid:
                                    prev = self.machine_index.get(serie_key) or {}
                                    prev_mid = str(prev.get("machineId") or "").strip()
                                    if mid != prev_mid or (tid and tid != str(prev.get("taxpayerId") or "").strip()):
                                        self.machine_index[serie_key] = {"machineId": mid, "taxpayerId": tid}
                                        changed_index = True
                            except Exception:
                                continue
                        if changed_index:
                            self._persist_machine_index()
                        is_last = result.get("last", True)
                        total_pages = result.get("totalPages", 1)
                        if is_last or page >= total_pages - 1:
                            break
                        if page + 1 >= max_pages:
                            break
                        page += 1
                    if equipos:
                        return equipos, None
                except Exception:
                    continue
            return (
                None,
                "No se pudo conectar a la API de PlaceFT. Verifique DNS/Internet o configure PLACEFT_API_BASE.",
            )
        except Exception as e:
            return None, f"Error: {str(e)}"

    def calcular_dias_diferencia(self, fecha_str: str) -> int:
        try:
            tz_name = (os.environ.get("APP_TZ") or os.environ.get("TZ") or "").strip() or "America/Panama"
            app_tz = ZoneInfo(tz_name) if ZoneInfo is not None else None
            today = datetime.now(app_tz).date() if app_tz is not None else datetime.now().date()

            s = (fecha_str or "").strip()
            if not s:
                return 999

            if s.endswith("Z"):
                s = s[:-1] + "+00:00"

            try:
                dt = datetime.fromisoformat(s)
                if dt.tzinfo is not None and app_tz is not None:
                    dt = dt.astimezone(app_tz)
                base_date = dt.date()
                return (today - base_date).days
            except Exception:
                pass

            formatos = [
                "%d-%m-%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
                "%d-%m-%y",
                "%d/%m/%y",
            ]
            for formato in formatos:
                try:
                    dt = datetime.strptime(s[:19], formato)
                    return (today - dt.date()).days
                except Exception:
                    continue

            return 999
        except Exception:
            return 999

    def determinar_estado(self, dias: int) -> str:
        if dias < 0:
            return "Actualizado"
        if dias == 0:
            return "Actualizado"
        if dias == 1:
            return "Pendiente"
        return "Crítico"

    def extraer_sucursal(self, contribuyente: str) -> str:
        return contribuyente.split(",")[0] if "," in contribuyente else contribuyente

    def query_cmd(self, cmd: str, serial: str) -> Tuple[bool, dict]:
        try:
            if not self.token_obtained:
                return False, {"message": "Sin token de autenticación"}
            url = f"{_api_base()}/api/v1/transmission/reception/packet/cmd/{cmd}"
            headers = {"Accept": "application/json, text/plain, */*", "Content-Type": "application/json"}
            payloads = [{"serialNumber": serial}, {"serial": serial}, {"serie": serial}]
            last_data: dict = {}
            for p in payloads:
                r = self.session.post(url, json=p, headers=headers, timeout=15)
                try:
                    data = r.json()
                except Exception:
                    data = {"status_code": r.status_code, "text": r.text[:500]}
                last_data = data
                if r.status_code == 200:
                    return True, data
            return False, last_data
        except Exception as e:
            return False, {"message": str(e)}

    def z_report(
        self,
        serial: str,
        days: int = 2,
        machine_id: str | None = None,
        taxpayer_id: str | None = None,
        transmission: str | None = None,
    ) -> Tuple[bool, dict]:
        try:
            if not self.token_obtained:
                return False, {"message": "Sin token de autenticación"}
            url = f"{_api_base()}/api/v1/machines/reports/z-report"
            taxpayer_id = (taxpayer_id or os.environ.get("PLACEFT_TAXPAYER_ID") or "").strip() or None

            def parse_dt(v):
                fmts = [
                    "%Y-%m-%d %H:%M:%S",
                    "%d-%m-%Y %H:%M:%S",
                    "%d/%m/%Y %H:%M:%S",
                    "%Y-%m-%d",
                    "%d-%m-%Y",
                    "%d/%m/%Y",
                    "%d-%m-%Y %I:%M:%S %p",
                    "%Y-%m-%d %I:%M:%S %p",
                    "%Y-%m-%dT%H:%M:%S",
                ]
                s = str(v or "").strip()
                for f in fmts:
                    try:
                        return datetime.strptime(s, f)
                    except Exception:
                        continue
                return None

            base = parse_dt(transmission) or datetime.now()

            def fmt_js_full(dt):
                days_arr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                day_name = days_arr[dt.weekday()]
                month_name = months[dt.month - 1]
                return f"{day_name} {month_name} {dt.day:02d} {dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} GMT-0500 (hora estándar oriental)"

            def fmt_js_midnight(dt: datetime) -> str:
                return fmt_js_full(datetime(dt.year, dt.month, dt.day, 0, 0, 0))

            def build_attempts(window_days: int) -> List[dict]:
                start = base - timedelta(days=window_days)
                fmt_iso_from = start.strftime("%Y-%m-%d")
                fmt_iso_to = base.strftime("%Y-%m-%d")
                transmission_from = fmt_js_full(start)
                transmission_to = fmt_js_full(base)
                report_from = fmt_js_midnight(start - timedelta(days=1))
                report_to = fmt_js_midnight(base)

                attempts: List[dict] = []

                if machine_id and taxpayer_id:
                    attempts.append(
                        {
                            "machineId": machine_id,
                            "taxpayerId": taxpayer_id,
                            "transmissionDateFrom": transmission_from,
                            "transmissionDateTo": transmission_to,
                            "tipoTransmision": "ReporteZ",
                            "page": 0,
                            "size": 10,
                        }
                    )

                attempts.append(
                    {
                        "serialNumber": serial,
                        "transmissionDateFrom": transmission_from,
                        "transmissionDateTo": transmission_to,
                        "tipoTransmision": "ReporteZ",
                        "reportDateFrom": report_from,
                        "reportDateTo": report_to,
                        "page": 0,
                        "size": 10,
                    }
                )

                attempts.append(
                    {
                        "serialNumber": serial,
                        "tipoTransmision": "ReporteZ",
                        "transmissionDateFrom": fmt_iso_from,
                        "transmissionDateTo": fmt_iso_to,
                        "reportDateFrom": fmt_iso_from,
                        "reportDateTo": fmt_iso_to,
                        "page": 0,
                        "size": 10,
                    }
                )

                return attempts

            window_plan = [7, 30, 90]
            if days and days > 0 and days not in window_plan:
                window_plan.insert(0, days)

            headers_json = {"Accept": "application/json, text/plain, */*", "Content-Type": "application/json"}

            last_data: dict = {}

            for w in window_plan:
                attempts = build_attempts(w)
                if len(attempts) >= 3:
                    attempts = [attempts[2], attempts[0], attempts[1]]

                for idx, p in enumerate(attempts, 1):
                    try:
                        r = self.session.post(url, json=p, headers=headers_json, timeout=15)

                        if r.status_code == 401:
                            self.token_obtained = False
                            return False, {"message": "Sesión expirada"}

                        if r.status_code == 200:
                            data = r.json()
                            found, item = self._parse_z_response(data)
                            last_data = data
                            if found:
                                self._persist_z(serial, item)
                                return True, item
                        elif r.status_code == 400:
                            pass
                    except Exception:
                        pass

                    if idx > 1:
                        try:
                            files = {k: (None, str(v)) for k, v in p.items()}
                            r = self.session.post(url, files=files, timeout=15)
                            if r.status_code == 200:
                                data = r.json()
                                found, item = self._parse_z_response(data)
                                if found:
                                    self._persist_z(serial, item)
                                    return True, item
                        except Exception:
                            pass

            found_alert, alert_item = self.check_alerts_fallback(serial, machine_id)
            if found_alert:
                return True, alert_item

            return False, last_data or {"message": "No se encontraron reportes Z en el rango"}

        except Exception as e:
            return False, {"message": str(e)}

    def check_alerts_fallback(self, serial: str, machine_id: str | None = None) -> Tuple[bool, dict]:
        try:
            url = f"{_api_base()}/api/v1/machines/machines/reportz/alerts"

            payload = {}
            if machine_id:
                payload["machineId"] = machine_id

            for page in range(5):
                params = {"page": page, "size": 50}
                r = self.session.post(url, params=params, json=payload, timeout=10)

                if r.status_code == 200:
                    data = r.json()
                    content = data.get("content") or data.get("result", {}).get("content") or []

                    if not content:
                        break

                    for alert in content:
                        alert_serial = str(alert.get("serial") or "").strip().upper()
                        target_serial = str(serial or "").strip().upper()

                        if alert_serial == target_serial:
                            val = str(alert.get("value") or "").strip()
                            z_date_fmt = val
                            if len(val) == 6 and val.isdigit():
                                try:
                                    dt = datetime.strptime(val, "%y%m%d")
                                    z_date_fmt = dt.strftime("%d-%m-%Y")
                                except Exception:
                                    pass

                            self._persist_z(
                                serial,
                                {"numz": "Invalid", "datez": z_date_fmt, "transmissionDate": datetime.now().isoformat()},
                            )

                            return True, {"numz": "Invalid", "datez": z_date_fmt, "source": "alert", "raw": alert}
                else:
                    break

        except Exception:
            pass

        return False, {}

    def _parse_z_response(self, data: dict) -> Tuple[bool, dict]:
        try:
            result = data.get("result") or {}
            items = result.get("content") or result.get("data") or result.get("reports") or []

            if not isinstance(items, list) or not items:
                return False, {}

            latest = None
            latest_key = None

            for it in items:
                datez_raw = str(it.get("datez") or it.get("Datez") or it.get("zDate") or "").strip()
                numz = str(it.get("numz") or it.get("Numz") or "").strip()

                if not numz:
                    continue

                k = datetime.min
                formatos = ["%Y%m%d", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%y%m%d"]
                parsed = False

                for fmt in formatos:
                    try:
                        k = datetime.strptime(datez_raw[:19], fmt)
                        parsed = True
                        break
                    except Exception:
                        continue

                if not parsed:
                    trans_date = str(it.get("transmissionDate") or "").strip()
                    for fmt in formatos:
                        try:
                            k = datetime.strptime(trans_date[:19], fmt)
                            break
                        except Exception:
                            continue

                if latest is None or k > latest_key:
                    latest = it
                    latest_key = k

            if latest:
                return True, latest
            return False, {}
        except Exception:
            return False, {}


def get_cached_scraper(username: str, password: str) -> Tuple[PlaceFTScraper, bool, str]:
    key = str(username or "").strip()
    s = SCRAPER_CACHE.get(key)
    if s and getattr(s, "token_obtained", False):
        return s, True, "OK"

    lock = SCRAPER_LOCKS.get(key)
    if lock is None:
        lock = threading.Lock()
        SCRAPER_LOCKS[key] = lock

    with lock:
        s = SCRAPER_CACHE.get(key)
        if s and getattr(s, "token_obtained", False):
            return s, True, "OK"
        s = PlaceFTScraper()
        ok, msg = s.login(key, password)
        if ok:
            SCRAPER_CACHE[key] = s
            return s, True, msg
        return s, False, msg


def reset_cached_scraper(username: str) -> None:
    """Olvida el token cacheado de un usuario (p. ej. al cambiar credenciales)."""
    SCRAPER_CACHE.pop(str(username or "").strip(), None)
