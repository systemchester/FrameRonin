# Droi-game-tool **V3** — 部署说明

产品能力与版本说明见根目录 [README.md](./README.md)；功能扩展与已实现对照见 [DEV_PLAN_extensions.md](./DEV_PLAN_extensions.md)。

![部署相关示意图](image/DEPLOY/1773816518080.png)

## 推送远程

- **默认 / GitHub**：`git push` 或 `git push origin main`
- **腾讯云 CNB**：`git push cnb main`

## CNB 密钥配置（必须完成，否则 CNB 部署会失败）

`.cnb.yml` 从 CNB 密钥仓库读取 Token，代码可安全推送到 GitHub。

**在 cnb.cool 创建密钥仓库并配置：**

1. 登录 [cnb.cool](https://cnb.cool)，新建 **密钥仓库**，命名为 `eo-token`（或自定）
2. 在仓库中新建 `envs.yml`，内容：
   ```yaml
   EDGEONE_API_TOKEN: 你的EdgeOne_Pages_API_Token
   ```
3. 若密钥仓库路径不是 `RoninCatTeam/eo-token`，需修改 `.cnb.yml` 中的 `imports` URL
4. 在密钥仓库设置中，为 `envs.yml` 配置 `allow_slugs`，允许 `RoninCatTeam/RoninPixeltools` 引用

## 不应提交到版本库的文件

已通过 `.gitignore` 排除：
- `backend/uploads/*`：用户上传文件（.gitkeep 除外）
- `dist/`、`frontend/dist/`：构建产物
- `*.log`、`.env` 等
