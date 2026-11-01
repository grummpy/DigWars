@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  py -3 server.py
  exit /b %errorlevel%
)
where python >nul 2>&1
if %errorlevel%==0 (
  python server.py
  exit /b %errorlevel%
)
echo Python 3 is required to play Dig Wars, but it was not found.
echo Install Python 3 from https://www.python.org/downloads/ and enable "Add python.exe to PATH".
exit /b 1
