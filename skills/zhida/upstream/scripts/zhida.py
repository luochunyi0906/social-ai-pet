#!/usr/bin/env python3
"""Zhida Skill adapter (Python stdlib only)."""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, Iterable, NoReturn, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://developer.zhihu.com"
REQUEST_TIMEOUT_SECONDS = 120
DEFAULT_MODEL = "zhida-fast-1p5"
MODELS = {"zhida-fast-1p5", "zhida-thinking-1p5", "zhida-agent"}


def print_usage() -> None:
    print(
        "Usage:\n"
        "  python3 zhida.py "
        "'{\"query\":\"如何理解 rave 文化\",\"model\":\"zhida-thinking-1p5\"}'\n"
        "  python3 zhida.py "
        "'{\"query\":\"简短回答\",\"stream\":true,\"output\":\"text\"}'\n\n"
        "Input:\n"
        "  query   Required user question\n"
        "  model   Optional: zhida-fast-1p5, zhida-thinking-1p5, zhida-agent\n"
        "  stream  Optional boolean, default false\n"
        "  output  Optional: json for non-stream; sse or text for stream\n\n"
        "Environment:\n"
        "  ZHIHU_ACCESS_SECRET      Bearer auth secret\n"
        "  ZHIHU_OPENAPI_BASE_URL   Optional, default https://developer.zhihu.com\n"
        "  ZHIHU_ZHIDA_URL          Optional full endpoint override\n"
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
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        die("Invalid JSON payload")
    if not isinstance(payload, dict):
        die("Invalid JSON payload")
    return payload


def parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    die("stream must be a boolean")


def get_endpoint() -> str:
    explicit = os.getenv("ZHIHU_ZHIDA_URL", "").strip()
    if explicit:
        return explicit
    base_url = os.getenv("ZHIHU_OPENAPI_BASE_URL", DEFAULT_BASE_URL).strip()
    return f"{base_url.rstrip('/')}/v1/chat/completions"


def build_request(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        die("query is required")

    model = str(payload.get("model", DEFAULT_MODEL)).strip().lower() or DEFAULT_MODEL
    if model not in MODELS:
        die("model must be one of zhida-fast-1p5, zhida-thinking-1p5, zhida-agent")

    stream = parse_bool(payload.get("stream"), False)
    output = str(payload.get("output", "")).strip().lower()
    if not output:
        output = "sse" if stream else "json"
    if (not stream and output != "json") or (stream and output not in {"sse", "text"}):
        die("stream and output combination is invalid")

    body = {
        "model": model,
        "messages": [{"role": "user", "content": query.strip()}],
        "stream": stream,
    }
    return body, output


def auth_headers() -> Dict[str, str]:
    secret = os.getenv("ZHIHU_ACCESS_SECRET", "").strip()
    if not secret:
        die("Set ZHIHU_ACCESS_SECRET first (Bearer auth only)")
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {secret}",
        "X-Request-Timestamp": str(int(time.time())),
    }


def post_json(body: Dict[str, Any]) -> str:
    request = Request(
        url=get_endpoint(),
        method="POST",
        headers=auth_headers(),
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except HTTPError as err:
        die_http(err)
    except (URLError, TimeoutError):
        die("HTTP request failed (timeout or network error)")


def iter_sse_data(body_text: str) -> Iterable[str]:
    for raw_line in body_text.splitlines():
        line = raw_line.strip()
        if line.startswith("data:"):
            yield line[len("data:") :].strip()


def stream_text(body_text: str) -> str:
    chunks = []
    saw_done = False
    for data in iter_sse_data(body_text):
        if data == "[DONE]":
            saw_done = True
            break
        if not data:
            continue
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            die("Invalid SSE JSON")
        if isinstance(chunk.get("error"), dict):
            die("stream error", body=chunk)
        choices = chunk.get("choices")
        if not isinstance(choices, list) or not choices:
            continue
        choice = choices[0] if isinstance(choices[0], dict) else {}
        delta = choice.get("delta") if isinstance(choice.get("delta"), dict) else {}
        if delta.get("content") is not None:
            chunks.append(str(delta["content"]))
    if not saw_done:
        die("SSE stream ended before [DONE]")
    return "".join(chunks)


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] in {"-h", "--help"}:
        print_usage()
        return
    if len(sys.argv) < 2:
        print_usage()
        raise SystemExit(1)

    body, output = build_request(parse_payload(sys.argv[1]))
    raw_body = post_json(body)
    if output == "text":
        print(stream_text(raw_body))
        return
    if output == "json":
        try:
            json.loads(raw_body)
        except json.JSONDecodeError:
            die("Non-JSON response from API")
    emit_raw(raw_body)


if __name__ == "__main__":
    main()
