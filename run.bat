@echo off
setlocal
set "ROOT=%~dp0"

if not exist "%ROOT%backend\target\cartlens-backend-0.0.1-SNAPSHOT.jar" (
  echo Backend JAR not found: %ROOT%backend\target\cartlens-backend-0.0.1-SNAPSHOT.jar
  echo Build the backend first, then run this file again.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo Installing frontend dependencies...
  pushd "%ROOT%frontend"
  call corepack pnpm install --frozen-lockfile
  if errorlevel 1 (
    popd
    pause
    exit /b 1
  )
  popd
)

netstat -ano | findstr /R /C:":8080 .*LISTENING" >nul
if errorlevel 1 (
  start "CartLens Backend" /D "%ROOT%backend" cmd /k "java -jar target\cartlens-backend-0.0.1-SNAPSHOT.jar"
) else (
  echo Backend is already running on port 8080.
)

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 (
  start "CartLens Frontend" /D "%ROOT%frontend" cmd /k "corepack pnpm dev --host 127.0.0.1 --port 5173 --strictPort"
) else (
  echo Frontend is already running on port 5173.
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
echo CartLens is starting at http://localhost:5173
