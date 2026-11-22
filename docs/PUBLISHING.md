# 让插件被 `dsh-plugin` 话题收录 & 发布 Release

本文记录两件与代码无关、但会明显影响发现率的事：把仓库挂到 GitHub 的
[`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题下，以及正式发一个 GitHub Release。
发布 npm 包本身的流程见 [RELEASING.md](RELEASING.md)。

---

## 一、被 `dsh-plugin` 话题收录

GitHub 的话题页**没有申请或审核流程**：仓库的 topics 里只要有 `dsh-plugin`，它就会出现在
<https://github.com/topics/dsh-plugin> 的列表里（按更新时间、星标等排序）。所以“被收录”=
“给仓库加这个 topic”。

### 步骤（网页，30 秒）

1. 打开 <https://github.com/nashihang777/dsh-talent-workbench>；
2. 右侧 **About** 面板 → 点齿轮 **⚙**；
3. **Description** 填一句能搜到的话，例如：

   > 本地优先的人才匹配工作台：DeepSeek Harness 插件，19 个可版本化考察维度、13 个岗位模板、智能体识别的简历导入、逐维可解释推导；在 DSH 中「插件 → 添加插件」输入 @nashihang777/dsh-talent-workbench 安装。

4. **Topics** 加这些（每加一个回车）：

   ```
   dsh-plugin
   deepseek-harness
   dsh
   plugin
   cordis-plugin
   ai-agent
   recruiting
   resume-screening
   talent-matching
   local-first
   ```

   `dsh-plugin` 决定是否进话题页，其余是给人搜到用的。
5. **Website** 填 <https://www.npmjs.com/package/@nashihang777/dsh-talent-workbench>；
6. 保存。

### 用命令行（需要带 `repo` 权限的令牌）

```bash
# 仓库 topics（会整体覆盖，所以一次性写全）
TOKEN=<你的 GitHub token>
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/nashihang777/dsh-talent-workbench/topics \
  -d '{"names":["dsh-plugin","deepseek-harness","dsh","plugin","cordis-plugin","ai-agent","recruiting","resume-screening","talent-matching","local-first"]}'

# 描述与主页
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/nashihang777/dsh-talent-workbench \
  -d '{"description":"本地优先的人才匹配工作台 — DeepSeek Harness 插件","homepage":"https://www.npmjs.com/package/@nashihang777/dsh-talent-workbench"}'
```

> 只加 topics 不加描述，话题页的卡片上会是一行空白说明，点击率明显更低。

### 再提高一点曝光

- 社区清单 [`awesome-deepseekharness/awesome-deepseek-harness`](https://github.com/awesome-deepseekharness/awesome-deepseek-harness)
  接受 PR，按它 README 里的格式加一行即可（这是唯一需要“申请”的地方，走 PR 而非话题）；
- 在 npm 包的 `keywords` 里也带上 `dsh-plugin`（本仓库已加）；
- README 顶部的 `topic: dsh-plugin` 徽章已经指向话题页，点进去的人会看到同话题的其他插件。

---

## 二、发一个 GitHub Release

### 与发布工作流的关系（重要）

`.github/workflows/publish.yml` 的触发条件是 **推送 `v*` 标签**。所以：

| 你在 Release 页面的操作 | 会发生什么 |
|---|---|
| 新建 Release 时**创建**一个新标签（如 `v1.6.3`） | GitHub 会创建并推送该标签 → **触发 npm 发布** |
| 从**已存在**的标签建 Release（如 `v1.6.2`） | 标签早已存在，不会再次触发 → 只发布 GitHub Release |
| 先本地 `git push --tags` 再建 Release | 标签推送时已触发发布；建 Release 不会再触发 |

推荐顺序：**先改版本号 → 推标签（CI 发布成功）→ 再基于同一标签写 Release 说明**。
这样 Release 里的“构建产物”与 npm 上的版本严格对应。

### 步骤（网页）

1. 打开 <https://github.com/nashihang777/dsh-talent-workbench/releases/new>；
2. **Choose a tag** → 输入 `v1.6.3` → 点 **Create new tag on publish**
   （如果想先发 Release 再让 CI 发布，这一步本身就会触发 CI）；
3. **Target**: `main`；
4. **Release title**: `v1.6.3 — 中文 README + 社交预览图`；
5. **Describe this release**：点 **Generate release notes** 自动生成，再手工补一句亮点；
6. 勾选 **Set as the latest release**；
7. 点 **Publish release**。

### 步骤（`gh` 命令行）

```bash
# 安装 gh 并登录：winget install GitHub.cli && gh auth login

# 1) 发版前先让版本号、标签、CI 三者一致
npm version patch -m "release: v%s"
git push origin main --tags          # 触发 Actions → npm 发布

# 2) CI 成功后，基于同一个标签写 Release
gh release create v1.6.3 \
  --title "v1.6.3" \
  --notes-file CHANGELOG-entry.md \
  --latest

# 或者让 gh 自动生成说明
gh release create v1.6.3 --generate-notes --latest
```

### Release 说明建议包含

```markdown
## 安装

DeepSeek Harness → 「插件」 → 「添加插件」 → 输入
`@nashihang777/dsh-talent-workbench` → 安装 → 刷新页面。

## 本次变更

- 中文 README 为默认文档，英文内容与之一一对应（README.en.md）
- 新增社交预览图 assets/social-preview.png
- 新增 GitHub Actions + npm Trusted Publishing 发布流程

## 校验

- npm: https://www.npmjs.com/package/@nashihang777/dsh-talent-workbench/v/1.6.3
- provenance: 在 npm 页面右侧的 “Provenance” 可看到由本仓库的 publish.yml 构建
```

---

## 三、社交预览图

GitHub 的仓库社交卡片**只能从网页上传**（API 不支持），所以：

1. 仓库页面 → **Settings** → 左侧 **Social preview** → **Edit**；
2. 上传 `assets/social-preview.png`（1280×640，212 KB，远低于 1 MB 上限）；
3. 保存后，在 Slack/微信/Twitter 里贴仓库链接就会显示这张卡片。

图片由 `dev/make-social-preview.py` 生成（Pillow 绘制，2× 超采样后缩放），改配色或文案后重跑即可：

```bash
python dev/make-social-preview.py     # → assets/social-preview.png
```

README 里的 `![...](assets/social-preview.png)` 是同一张图，随 npm 包一起发布，
所以在 GitHub、Gitee 与 npm 页面上都能正常显示。
