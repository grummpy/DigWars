#!/usr/bin/env python3
"""Headless smoke launch: server.py serves index.html and falls forward a busy port."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server.py")


def wait_for_serving(proc: subprocess.Popen, timeout: float = 8) -> str:
    deadline = time.time() + timeout
    assert proc.stdout is not None
    while time.time() < deadline:
        line = proc.stdout.readline()
        if line:
            text = line.decode("utf-8", "replace").strip()
            if "serving" in text.lower():
                return text
        elif proc.poll() is not None:
            err = proc.stderr.read() if proc.stderr else b""
            raise RuntimeError(f"server exited {proc.returncode}: {err.decode()}")
        else:
            time.sleep(0.02)
    raise RuntimeError("timed out waiting for Dig Wars server")


def fetch(url: str) -> tuple[int, str, str]:
    with urllib.request.urlopen(url, timeout=5) as response:
        body = response.read().decode("utf-8", "replace")
        return response.status, response.headers.get("Content-Type", ""), body


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


def launch(port: int) -> tuple[subprocess.Popen, str]:
    proc = subprocess.Popen(
        [sys.executable, SERVER, "--no-browser", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        line = wait_for_serving(proc)
    except Exception:
        stop(proc)
        raise
    url = line.rsplit(" ", 1)[-1]
    return proc, url


def check_site(base: str) -> None:
    status, content_type, body = fetch(base)
    if status != 200:
        raise SystemExit(f"GET / returned {status}")
    if "text/html" not in content_type:
        raise SystemExit(f"unexpected content type {content_type}")
    if "Dig Wars" not in body or "<canvas" not in body:
        raise SystemExit("index.html did not look like the game page")
    page, _, html = fetch(base + "index.html")
    if page != 200 or "src/ui/main.js" not in html:
        raise SystemExit("index.html was not served from /index.html")
    script_status, _, script = fetch(base + "src/ui/main.js")
    if script_status != 200 or "createMatch" not in script:
        raise SystemExit("game module was not served")
    arcade_status, _, arcade_body = fetch(base + "arcade.json")
    arcade = json.loads(arcade_body)
    if arcade_status != 200 or arcade.get("id") != "digwars" or arcade.get("port") != 8803:
        raise SystemExit("arcade.json was not served")
    icon_status, icon_type, _ = fetch(base + "assets/icon.jpg")
    if icon_status != 200 or "image" not in icon_type:
        raise SystemExit("icon was not served")


def main() -> int:
    proc, url = launch(0)
    try:
        check_site(url if url.endswith("/") else url + "/")
    finally:
        stop(proc)

    hog = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    hog.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    hog.bind(("127.0.0.1", 8803))
    hog.listen(1)
    fallback = None
    try:
        fallback, fallback_url = launch(8803)
        host_port = fallback_url.split("//", 1)[1].rstrip("/")
        port = int(host_port.rsplit(":", 1)[1])
        if port == 8803:
            raise SystemExit("server did not move off the busy default port")
        if not (8804 <= port <= 8832):
            raise SystemExit(f"unexpected fallback port {port}")
        status, _, body = fetch(fallback_url if fallback_url.endswith("/") else fallback_url + "/")
        if status != 200 or "Dig Wars" not in body:
            raise SystemExit("fallback port did not serve the game")
    finally:
        if fallback is not None:
            stop(fallback)
        hog.close()

    print("smoke ok")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print(f"smoke request failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
