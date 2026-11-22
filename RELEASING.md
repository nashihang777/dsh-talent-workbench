# 发布流程（GitHub Actions → npm，Trusted Publishing）

本仓库通过 `.github/workflows/publish.yml` 发布：

- 推送 `v*` 标签 → 校验（语法、自检、标签与版本一致、打包内容）后发布到 npm；
- 手动触发（Actions → publish → Run workflow）→ 只做校验与 `npm publish --dry-run`。

发布使用 **npm Trusted Publishing（OIDC）**：GitHub Actions 用自身的 OIDC 身份换取一次性的发布凭据，
仓库里**不保存任何长期 npm 令牌**，npm 侧会自动生成 provenance（可追溯到本次 commit 与 workflow）。

## 一次性配置

### 1. 先手动发布一次（bootstrap）

Trusted Publishing 只能在**已经存在于 npm 上**的包上配置，所以第一次必须手动发：

```bash
cd talent-workbench
npm login                      # 浏览器登录，或用已有的 npm 账号
npm publish --access public    # 若账号开了 2FA，会要求输入一次 OTP
```

发包前确认文件名与版本：`@nashihang777/dsh-talent-workbench`、`version` 与即将打的标签一致。

### 2. 配置 Trusted Publisher（关键：权限要含 `npm publish`）

npmjs.com → 包页面 → **Settings → Trusted publishing** → 添加 GitHub Actions：

| 字段 | 值 |
|---|---|
| Organization or user | `nashihang777` |
| Repository | `dsh-talent-workbench` |
| Workflow filename | `publish.yml` |
| Environment | 留空（除非想用环境审批） |
| **Permissions** | 必须勾选 **`npm publish`**（只勾 `npm stage publish` 会失败） |

> **这是 `403 OIDC permission denied` 的唯一常见原因。**
> 引入 staged publishing 后，trust relationship 的权限按命令细分：短时令牌只能执行被授予的命令。
> 列表里显示 `Permissions: npm stage publish` 而不含 `npm publish` 时，CI 里的 `npm publish` 必然被拒。

用 npm 12+ 的 CLI 也可以直接设置（本机 npm 11.9 没有该子命令）：

```bash
npx npm@latest trust github \
  --repo nashihang777/dsh-talent-workbench \
  --file publish.yml \
  --allow-publish
```

### 3. 确认仓库与 workflow

- 仓库需为 **public**：`--provenance` 需要公开源码仓库；
- workflow 已声明 `permissions: id-token: write`（OIDC 必需）；
- 发布 job 使用 **Node 24**（自带 npm ≥ 11.5，Trusted Publishing 的最低要求）。

## 日常发布

```bash
# 1. 更新版本号（自动提交并打 tag）
npm version patch -m "release: v%s"    # 或 minor / major

# 2. 推送提交和标签，触发发布
git push origin main --tags
```

`verify` 会检查标签与 `package.json` 版本一致，不一致直接失败；也会跑除 Windows 专用
`dev/import-smoke.mjs` 之外的 8 个自检脚本，并打印 `npm pack --dry-run` 的内容清单。

发布后验证：

```bash
npm view @nashihang777/dsh-talent-workbench version
npm view @nashihang777/dsh-talent-workbench dist.tarball
```

## 手动演练（不发布）

GitHub → **Actions → publish → Run workflow**。只执行校验 + `npm publish --dry-run`，
用来确认 workflow 能拿到 OIDC 权限、包内容正确、自检通过。

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| `403 ... OIDC permission denied for this action` | trust relationship **没有授予 `npm publish`**（只给了 `npm stage publish`）。到 Trusted publishing 编辑该条目勾上 `npm publish` |
| `EOTP` / `two-factor authentication` | 首次手动发布需要 OTP；CI 发布不需要 |
| `403 Forbidden`、`404 Not Found`（无 OIDC 字样） | Trusted Publisher 的 owner/repo/workflow 填写不一致 |
| `npm ERR! ... id-token` | workflow 缺少 `id-token: write`，或跑在 self-hosted runner 上 |
| `tag vX.Y.Z does not match package.json version` | 先 `npm version` 再打标签 |
| `Cannot publish over existing version` | 版本号未递增；npm 不允许重复发布同一版本 |
| `--provenance` 报错 | 仓库不是公开仓库 |
| 自检失败 | 本地先跑一遍 `node dev/*.mjs`；Windows 专用的 `import-smoke.mjs` 不在 CI 里 |

## 与 DeepSeek Harness 本地开发的关系

npm 上的是**分发副本**；本机 profile 里链接的是这个工作目录：

```json
"@nashihang777/dsh-talent-workbench": "link:F:/trae_solo_data/blockchain_talent_identification/talent-workbench"
```

发布新版本后，别人 `dsh plugin install @nashihang777/dsh-talent-workbench` 即可安装；
本机仍然直接跑源码，不需要跟着 npm 发版。

## 安全约定

- 优先 OIDC：没有长期令牌可泄露；
- 若必须用令牌：最小 scope、定期轮换、只放 GitHub Secret（`NPM_TOKEN`），并在 publish 步骤加
  `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`、去掉 `id-token: write` 与 `--provenance`；
- workflow 只在标签推送时真正发布，避免从任意分支误发。
