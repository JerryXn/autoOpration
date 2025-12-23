# 项目体积瘦身计划

由于 Git 历史中意外包含了 `node_modules` 和二进制文件，导致 `.git` 目录体积高达 657MB。我将重置 Git 仓库以解决此问题。

### 步骤
1.  **清理旧仓库**: 删除 `.git` 目录。
2.  **验证忽略规则**: 确保 `.gitignore` 包含 `node_modules/`, `src/bin/`, `dist/`。
3.  **重建仓库**:
    *   运行 `git init`。
    *   运行 `git add .`（此时会遵循新的忽略规则，只添加源码）。
    *   运行 `git commit -m "Initial commit (clean)"`。
4.  **关联远程**: 提示用户重新关联 GitHub 远程仓库（因为 `.git` 删除后远程配置也会丢失）。

### 预期结果
*   `.git` 目录大小将从 ~600MB 降至 <1MB。
*   `node_modules` 和 `src/bin` 将不再被 Git 追踪。
