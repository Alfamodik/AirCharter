@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-api.ps1" %*
