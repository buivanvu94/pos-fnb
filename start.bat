@echo off
rem Khoi dong nhanh POS: Postgres (Docker) -> migrate -> Next dev server -> mo trinh duyet.
setlocal
cd /d "%~dp0"

set PORT=3000

rem Neu cong da co tien trinh lang nghe thi chi mo trinh duyet, khong chay trung.
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 (
  echo POS dang chay san tai http://localhost:%PORT%
  start "" http://localhost:%PORT%
  exit /b 0
)

rem Tao tep cau hinh tu tep mau neu chua co (nho doi JWT_SECRET va mat khau truoc khi dua len quan).
if not exist .env (
  if exist .env.example (
    copy /y .env.example .env >nul
    echo Da tao .env tu .env.example. Hay kiem tra lai gia tri cau hinh.
  ) else (
    echo [LOI] Khong co .env va cung khong co .env.example.
    goto :fail
  )
)

rem Bat container Postgres neu chua chay.
docker start pos-postgres >nul 2>&1
if errorlevel 1 (
  echo [CANH BAO] Khong bat duoc container pos-postgres. Kiem tra Docker Desktop da chay chua.
)

if not exist node_modules (
  echo Cai dependencies...
  call npm install || goto :fail
)

echo Ap dung migration...
call npm run db:migrate || goto :fail

echo Mo trinh duyet sau vai giay...
start "open-browser" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:%PORT%"

echo Khoi dong POS tai http://localhost:%PORT% (Ctrl+C de dung)
call npm run dev
exit /b %errorlevel%

:fail
echo.
echo [LOI] Khoi dong that bai. Xem thong bao phia tren.
pause
exit /b 1
