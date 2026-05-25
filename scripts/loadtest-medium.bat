@echo off
setlocal
cd /d "%~dp0.."
if "%TARGET_HOST%"=="" set TARGET_HOST=http://localhost:3001
locust -f load-tests/locustfile.py --host %TARGET_HOST% --headless -u 50 -r 5 -t 3m
