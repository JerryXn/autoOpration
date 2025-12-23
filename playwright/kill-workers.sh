#!/bin/bash

echo "Finding and killing Playwright worker processes..."

# 查找所有包含 worker-runtime/src/run.js 的 node 进程并杀掉
pkill -f "worker-runtime/src/run.js"

if [ $? -eq 0 ]; then
  echo "Successfully killed worker runtimes."
else
  echo "No worker runtimes found."
fi

# 查找所有包含 cli/src/index.js 的进程
pkill -f "cli/src/index.js"

echo "Cleanup complete."
