## 目标
- 使用 db/auto_final.sql 作为唯一迁移来源，追加 RBAC 初始化与绑定的 INSERT 语句，并停止运行 001_rbac.sql，避免重复/未知列错误
- 修复平台列表：登录 lv1 时仅返回其启用的平台

## 代码改动
- 修改 src/main.js：
  - runMigrations() 改为执行 db/auto_final.sql（过滤空行与注释），不再执行 001_rbac.sql
  - get-user-platforms：按当前用户从 sys_user_platforms 查询 enabled=1 的平台并返回

## SQL追加内容（追加到 db/auto_final.sql 末尾）
- 角色与平台初始化：INSERT sys_roles、INSERT platforms（ON DUPLICATE）
- 插入不同等级用户：lv1_user/lv2_user/lv3_user，密码统一 123456（bcrypt 哈希）
- 绑定角色：lv1/lv2/lv3；admin(id=1) 绑定 admin
- 角色授权（xhs）：lv1=auto_view；lv2=auto_view/auto_like/auto_favorite；lv3 加 auto_comment；admin 全量
- 用户平台启用（xhs）：admin(id=1) 与 lvX 用户启用 xhs（enabled=1）

## 验证
- 启动应用：不再出现 platform_id/platform_code/enabled 相关迁移错误
- 登录 lv1：平台列表仅显示其启用的平台

## 说明
- 保留你现有表结构（auto_final.sql 中定义），只做 INSERT 级初始化与绑定，避免 ALTER 重复列/键问题