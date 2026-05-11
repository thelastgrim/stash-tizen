@echo off
setlocal

set PROFILE=%1

echo Building React app...
call npm run build
if errorlevel 1 goto error

echo Staging Tizen assets...
copy tizen\config.xml dist\
copy tizen\icon.png dist\

echo Packaging .wgt with profile %PROFILE%...
tizen package -t wgt -s %PROFILE% -- .\dist
if errorlevel 1 goto error

echo Done.
goto end

:error
echo.
echo Build failed.

:end
echo.
pause