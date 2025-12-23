# 内置 Python 环境改造计划

为了让用户无需安装 Python 即可使用，我将把 Python 脚本打包成独立的可执行程序，并将其集成到 Electron 应用中。

### 1. 打包 Python 脚本 (Mac 版)
*   **工具**: 使用 `PyInstaller`。
*   **操作**: 在当前 Mac 环境下，将 `src/playwright/python/xhs.py` 及其依赖（`playwright`, `pymysql` 等）打包成一个名为 `xhs-core` 的可执行文件。
*   **产物**: 生成文件位于 `src/bin/xhs-core`。

### 2. 修改 Electron 调用逻辑 (`src/main.js`)
*   **当前逻辑**: `spawn('python', ['script.py', ...])` —— 依赖用户系统的 Python。
*   **新逻辑**:
    *   优先查找打包后的独立程序：`spawn('./bin/xhs-core', [...])`。
    *   保留原有逻辑作为开发环境的后备（Fallback）。

### 3. 配置 Electron 打包 (`package.json`)
*   **配置**: 将生成的 `src/bin/` 目录加入到 `build.files` 中。
*   **效果**: 当运行 `npm run dist:mac` 时，这个 Python 可执行程序会被自动放入最终的 App 中。

### 4. 关于 Windows 的说明
*   由于 `PyInstaller` 不支持跨平台打包（不能在 Mac 上打出 Windows 的 .exe），我将为您创建一个 `scripts/build_python_win.bat` 脚本。
*   **后续操作**: 您需要在 Windows 电脑上运行一次这个脚本来生成 `xhs-core.exe`，然后才能打 Windows 包。

### 执行步骤
1.  **安装 PyInstaller**: `pip install pyinstaller`。
2.  **执行打包**: 运行 PyInstaller 命令生成 Mac 二进制文件。
3.  **代码适配**: 修改 `src/main.js` 以适配二进制文件的调用方式。
4.  **配置更新**: 更新 `package.json` 包含二进制文件。

完成后，您的 Mac 应用将实现“零依赖”启动。
