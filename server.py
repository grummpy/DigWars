#!/usr/bin/env python3
"""Serve Dig Wars on 127.0.0.1 and open the default browser.

Default port is 8803 (arcade.json). If that port is taken, the next free
port is used. Pass --no-browser for a headless smoke launch.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
DEFAULT_PORT = 8803


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((HOST, port))
        except OSError:
            return False
    return True


def pick_port(start: int) -> int:
    for port in range(start, start + 30):
        if port_is_free(port):
            return port
    print(f"No free port found from {start} to {start + 29}.", file=sys.stderr)
    raise SystemExit(1)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def make_server(port: int) -> tuple[ThreadingHTTPServer, int]:
    handler = Handler
    if port == 0:
        httpd = ThreadingHTTPServer((HOST, 0), handler)
        return httpd, int(httpd.server_address[1])
    chosen = pick_port(port)
    httpd = ThreadingHTTPServer((HOST, chosen), handler)
    return httpd, chosen


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Launch the Dig Wars local server.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to bind (0 picks an ephemeral port)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = parser.parse_args(argv)

    try:
        httpd, port = make_server(args.port)
    except OSError as exc:
        print(f"Could not start Dig Wars: {exc}", file=sys.stderr)
        return 1

    url = f"http://{HOST}:{port}/"
    print(f"Dig Wars serving {url}", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
