# This script is intended to be run on a Windows machine to build the python executable
# Prerequisite: Python installed, pip install pyinstaller

if not exist "src\bin" mkdir src\bin

pyinstaller --onefile --name xhs-core src\playwright\python\xhs.py --add-data "src\playwright\python;." --distpath src\bin

echo "Build complete. Check src\bin\xhs-core.exe"
