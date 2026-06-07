import html
import json
import re
from datetime import datetime
from typing import Any


_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}")


def _get_path(data: dict[str, Any], path: str) -> Any:
    cur: Any = data
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def render_template_html(
    template_html: str,
    data_json: str,
    *,
    title: str,
    creator_username: str,
    created_at: datetime,
) -> str:
    try:
        data = json.loads(data_json) if data_json else {}
    except Exception:
        data = {}

    ctx: dict[str, Any] = {
        **(data if isinstance(data, dict) else {}),
        "document": {
            "title": title,
            "created_at": created_at.strftime("%Y-%m-%d %H:%M"),
        },
        "creator": {
            "username": creator_username,
        },
    }

    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        v = _get_path(ctx, key)
        if v is None:
            return ""
        return html.escape(str(v))

    return _VAR_RE.sub(repl, template_html)
