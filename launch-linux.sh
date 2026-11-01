#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to play Dig Wars, but it was not found."
  echo "Install Python 3 from your package manager, for example: sudo apt install python3"
  exit 1
fi
exec python3 server.py
