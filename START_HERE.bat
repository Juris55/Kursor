@echo off
title Kursor - Latviešu teksta redaktors
cd /d "%~dp0"

echo ============================================
echo   Kursor - Latviešu teksta redaktors
echo ============================================
echo.
echo Tiek palaists Kursor...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Pirma palaide - tiek instaletas atkaribas...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [KJUDA] Neizdevas instalet atkaribas!
        echo Ludzu parbaudiet vai Node.js ir instalets
        echo https://nodejs.org
        pause
        exit /b 1
    )
    echo Atkaribas veiksmigi instaletas!
)

echo Palaiz Kursor...
echo.
REM vite-plugin-electron automatically starts Electron, no need to run it separately
npx vite
if %errorlevel% neq 0 (
    echo.
echo     [KJUDA] Neizdevas palaist Kursor!
    pause
    exit /b 1
)
