@echo off
setlocal
set URL=%1
if "%URL%"=="" set URL=http://localhost:3001
echo Checking backend instances through %URL%/health
for /L %%i in (1,1,12) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$r=Invoke-WebRequest -Uri '%URL%/health' -UseBasicParsing; $j=$r.Content | ConvertFrom-Json; Write-Host ('Request %%i -> header={0}; body={1}; host={2}' -f $r.Headers['X-Backend-Instance'], $j.instanceId, $j.hostname)"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1"
)
