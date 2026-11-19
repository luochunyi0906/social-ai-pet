#!/usr/bin/env python3
"""Hot list skill script (Python stdlib only)."""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, NoReturn
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://developer.zhihu.com"
REQUEST_TIMEOUT_SECONDS = 5


def print_usage() -> None:
    print(
        "Usage:\n"
        '  python3 hot-list.py \'{"limit":10}\'\n\n'
        "Environment:\n"
        "  ZHIHU_ACCESS_SECRET   Bearer auth secret\n"
        "  ZHIHU_OPENAPI_BASE_URL Optional, default https://developer.zhihu.com\n"
        "  ZHIHU_HOT_LIST_URL    Optional full endpoint override\n"
    )


def die(message: str, *, body: Any | None = None) -> NoReturn:
    payload: Dict[str, Any] = {"error": message, "exit_code": 1}
    if body is not None:
        payload["body"] = body
    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(1)


def emit_raw(body_text: str) -> None:
    secret = os.getenv("ZHIHU_ACCESS_SECRET", "")
    if secret:
        body_text = body_text.replace(secret, "***")
    sys.stdout.write(body_text)
    if not body_text.endswith("\n"):
        sys.stdout.write("\n")


def die_http(err: HTTPError) -> NoReturn:
    body_text = err.read().decode("utf-8", errors="replace")
    if body_text:
        emit_raw(body_text)
        raise SystemExit(1)
    die(f"HTTP {err.code}")


def parse_payload(raw: str) -> Dict[str, Any]:
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        die("Invalid JSON payload")
    if not isinstance(payload, dict):
        die("Invalid JSON payload")
    return payload


def parse_limit(payload: Dict[str, Any]) -> int:
    raw = payload.get("limit", payload.get("Limit", 30))
    try:
        limit = int(raw)
    except (TypeError, ValueError):
        limit = 30
    return max(1, min(30, limit))


def get_endpoint() -> str:
    explicit = os.getenv("ZHIHU_HOT_LIST_URL", "").strip()
    if explicit:
        return explicit
    base_url = os.getenv("ZHIHU_OPENAPI_BASE_URL", DEFAULT_BASE_URL).strip()
    return f"{base_url.rstrip('/')}/api/v1/content/hot_list"


def request_hot_list(limit: int) -> str:
    secret = os.getenv("ZHIHU_ACCESS_SECRET", "").strip()
    if not secret:
        die("Set ZHIHU_ACCESS_SECRET first (Bearer auth only)")
    query = urlencode({"Limit": str(limit)})
    request = Request(
        url=f"{get_endpoint()}?{query}",
        method="GET",
        headers={
            "Authorization": f"Bearer {secret}",
            "X-Request-Timestamp": str(int(time.time())),
        },
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            body_text = resp.read().decode("utf-8", errors="replace")
    except HTTPError as err:
        die_http(err)
    except (URLError, TimeoutError):
        die("HTTP request failed (timeout or network error)")

    try:
        json.loads(body_text)
    except json.JSONDecodeError:
        die("Non-JSON response from API")
    return body_text


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] in {"-h", "--help"}:
        print_usage()
        return
    payload = parse_payload(sys.argv[1] if len(sys.argv) >= 2 else "{}")
    emit_raw(request_hot_list(parse_limit(payload)))


if __name__ == "__main__":
    main()
