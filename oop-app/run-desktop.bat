@echo off
rem LPA Administration System - starts the desktop app with Java 17+ (or the Java that comes with Android Studio)
cd /d "%~dp0"
set JAR=target\lpa-desktop.jar
if not exist "%JAR%" set JAR=lpa-desktop.jar
where java >nul 2>nul && (java -jar "%JAR%" & goto :eof)
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" ("%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" -jar "%JAR%" & goto :eof)
echo Java was not found. Install Java 17 or newer (e.g. from https://adoptium.net) and try again.
pause
