# Quartz 笔记网站维护

站点地址：<https://heiferleaf.github.io/ObsidianNote/>。当前使用 Quartz 4，保留 TypeScript 配置；不要直接套用 Quartz 5 的 YAML 配置说明。

## 本地构建与预览

在仓库根目录执行：

```powershell
npm --prefix quartz ci
npm --prefix quartz run test:site
npm --prefix quartz run build:site
npm --prefix quartz run preview:site
```

预览地址为 <http://127.0.0.1:8088/ObsidianNote/>，使用与线上相同的子路径。可用 `npm --prefix quartz run preview:site -- --port 8096` 更换端口。预览读取已生成的静态文件；修改后重新构建，再刷新页面。

`build:site` 是本地与 GitHub Actions 共用的入口：复制原始笔记和附件到新的构建副本，在副本中补充缺少的标签、规范公式边界并处理真实图片嵌入，运行 Quartz，再验证首页导航、内容索引、sitemap、每个本地图片引用及公式渲染结果。构建结果在 `quartz/public/`，验证通过后写入 `.nojekyll`。

原始目录 `002-学习笔记/`、`003-Attachments/` 保持完整路径，构建不会改写原文或现有 `quartz/content/`。首页模板固定读取 `quartz/content/index.md`；页面中的简介、专题和更新列表由 `HomePage.tsx` 渲染，不复制含 Dataview 查询的 Obsidian Dashboard。

## 发布规则与导航

发布排除规则集中在 `quartz.config.ts` 的 `ignorePatterns`，包括练习、作业目录及 `.excalidraw.md`。排除发生在解析和索引前；不要在构建完成后删除页面，否则搜索、标签和 sitemap 会留下失效条目。指向被排除内容的原始笔记链接仍需单独维护。

专题按照 `002-学习笔记/<类别>/<主题>/` 聚合；直接位于类别目录的笔记归入该类别。链接保留原路径，分类标题仅用于展示。计数及最近更新只包含已发布学习笔记，不包含附件和目录索引。

日期优先读取 frontmatter，再查询原始文件的 Git 记录，最后使用原始文件的时间戳。构建副本路径不会使所有“最近更新”都变成本次构建时间。

部署仅由 `main` 分支的推送或手动运行触发，避免临时标签分支直接覆盖正式站点。需要合并并推送后，GitHub Actions 才会执行发布。

## 视觉设计与交互

2026-11-14 的重设计参考 [MotionSites](https://motionsites.ai/) 的公开作品展示与书架构图。站点采用纸色正文、森林绿导航和陶土色强调，以阅读、检索和专题浏览为主。书本封面由 CSS 绘制，均链接到真实专题，不依赖付费素材或组件。

首页由 `HomePage.tsx` 和 `homePage.scss` 负责；搜索入口和场景筛选由 `scripts/homePage.inline.ts` 接入现有 Quartz 搜索及页面导航生命周期。`TopicRail.tsx` 按场景分组专题，手机折叠、桌面展开。页面标识在 `PageTitle.tsx`，正文、目录、公式横向滚动与小屏布局在 `styles/custom.scss`。配色及字体仍由 `quartz.config.ts` 管理，中文设置系统字体回退。

修改后先检查 320、390、768、1029、1440 像素视口，再验证明暗主题、搜索、筛选、文章跳转与移动端菜单；从文章返回首页后再测试一次搜索，避免重复绑定事件。文章内的长公式应单独滚动，不能把整页撑宽。保留键盘焦点提示和减少动态效果设置。静态文件正在重新构建时不要进行浏览器验收，等待构建成功后刷新。

## 故障定位

`quartz/.quartz-cache/site-sync.json` 记录最近一次构建副本路径，`site-build.json` 记录成功构建的索引和导航验证数量。每次同步使用独立的 `site-content-*` 目录，旧副本留作本地排查；这些目录被既有 Git 忽略规则排除，不上传为站点内容。

构建副本位于 Git 忽略目录中，构建入口会给 Quartz 设置 `QUARTZ_STAGED_CONTENT=1`，让内容扫描使用明确的发布排除规则。直接运行 Quartz CLI 时没有该环境设置，仍沿用原有 Git 忽略规则。Windows 的 CLI 内容路径会转换为正斜杠。

标签检查可从任意工作目录执行 `node quartz/scripts/tag-normalize.mjs`（命令路径按当前目录调整）。默认只生成建议，`--apply` 才写入；`--directory <路径>` 可指定构建副本。报告固定在 `quartz/.quartz-cache/tag-report.json`。已有 `tags` 或 `tag` 字段（包括空列表）会保留，其他 YAML 字段与正文不变。

`generate-tag-patch.mjs` 与 `apply-sample-tags.mjs` 使用同一报告路径。补丁写到 `quartz/.quartz-cache/tag-apply.patch`，从仓库根目录检查或应用；样例脚本默认只显示结果，需 `--apply` 才写入。

部署不再运行历史 `fix:latex` 脚本。新的 `scripts/math-normalize.mjs` 在构建副本中处理相邻行内公式、紧贴正文的块公式边界、错误缩进的特定 Java 围栏及少数明确的 LaTeX 兼容写法，不修改数学运算、下标或矩阵行。中文数学模式警告本身不作为错误；未识别的错误公式会明确显示为保留的 LaTeX 代码并记入报告，不会删除。`content-normalization.json` 记录缺图说明、替换的嵌入及公式回退。

Pages 转换可从 `.knowledge-tools/math-normalize.mjs` 导入 `normalizeMathMarkdown` 和 `normalizeMath`。代码围栏先经 `normalizeCodeFences` 修复，再运行 `normalizeMathMarkdown(body)`，最后提取块公式和行内公式；已经误切分的公式块无法仅靠 `normalizeMath(latex)` 恢复。后者只处理单个公式的兼容写法。Quartz 的 `scripts/fence-normalize.mjs` 是 Controller 所用 `.knowledge-tools/fence-normalize.mjs` 的部署副本，避免 CI 依赖未跟踪的迁移工具目录；若共享围栏逻辑更新，应同步这个副本。

附件映射优先读取本地 `.knowledge/quartz-assets.json`，缺失时读取可随代码部署的 `quartz/site-assets.json` 快照；两者均不存在时不执行映射替换。映射的目标文件必须位于同步进来的内容目录中。需要同步新的迁移图片时，将生成文件加入 `003-Attachments/pages-import/`，同时更新 `quartz/site-assets.json`（可从迁移映射复制）。代码围栏、行内代码、数学内容及普通 PDF 链接不走图片替换；真实图片和 Obsidian 嵌入才按源笔记相对路径、原始 fragment 和精确映射查找。

现有 `CustomOgImages` 和字体设置仍会访问外部字体资源，因此构建需要可用网络。

参考：[Quartz 官方配置文档](https://quartz.jzhao.xyz/configuration)及[托管文档](https://quartz.jzhao.xyz/hosting)。官方站点已迁移到 Quartz 5，修改本仓库时以本地 Quartz 4 类型和实现为准。
