# GitHub Actions 自动化构建实施计划

我将创建一个 GitHub Actions 工作流文件，实现云端自动构建 Windows 和 macOS 应用。

### 1. 创建工作流文件
*   **路径**: `.github/workflows/build.yml`
*   **内容**:
    *   **触发条件**: 当代码推送到 `main` 或 `master` 分支时触发。
    *   **Windows Job**:
        *   环境: `windows-latest`
        *   步骤:
            1.  检出代码。
            2.  设置 Python 3.10。
            3.  安装 Python 依赖 (`pip install pyinstaller playwright pymysql dbutils`)。
            4.  安装 Playwright 浏览器 (`playwright install chromium`)。
            5.  **关键步骤**: 运行 PyInstaller 生成 `src/bin/xhs-core.exe`。
            6.  设置 Node.js。
            7.  安装 NPM 依赖。
            8.  运行 `npm run dist:win`。
            9.  上传生成的 `.exe` 文件。
    *   **MacOS Job**:
        *   环境: `macos-latest`
        *   步骤: 与 Windows 类似，生成 `src/bin/xhs-core` 并打包 `.dmg`。

### 2. 验证与交付
*   文件创建后，我将指导用户如何进行 Git 推送以触发构建。

### 待办事项
1.  创建目录 `.github/workflows`。
2.  写入 `build.yml` 文件。
