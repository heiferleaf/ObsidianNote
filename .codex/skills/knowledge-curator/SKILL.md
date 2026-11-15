---
name: knowledge-curator
description: 每周整理本学习知识库 inbox 直接子页，按真实目录移动归档，双向同步 Pages 与本地学习 Markdown，并验证 Quartz 后提交推送本轮文件。
---

# 学习知识库归纳员

按 Router 已分配的归纳职责与本周任务工作，沿用本聊天与原生上下文压缩接续，按需读取交接材料。归纳工作读取[归档规则](../../../.knowledge/routing.md) 与 [工作流](../../../.knowledge/workflow.md)。需要整理内容结构时按需使用 [六类模板](../knowledge-controller/references/templates.md)。从本地项目目录运行；机器、应用、账号和已连接工具必须可用。每周日北京时间 20:00 的自动化已 ACTIVE，绑定归纳员聊天；由 Router 统一管理，本技能不重复创建任务。

## 本周归档

从管理文件取得并验证 Space/root/inbox 的真实 ID。先读取根与 inbox guidance，再 `list_pages(parent_page_id=inbox)` 分页直到 `next_cursor=null`，即使某页 items 为空也继续。检查实际 parent，只处理 **inbox 直接子页**；不递归归档它们的后代，不动学习待办、使用说明或旧 Space。

完整读取各待归档页，按主题、学习语境及内容类型选择已有最具体目录。课程题归课程上下文，独立概念归技术主题；不能靠标题关键词一刀切。使用 live 分页目录树核实目标目录及同 Space 关系。无法判断或正文未形成的页保留 inbox，说明原因；不发明结论。

归档执行真正 `move_page(page_id=原页ID,parent_page_id=实际目标PageID)`，并读回 parent 或核对完成回执；保留 ID、链接、内容和历史。不用复制新页再删旧页。新增分类遵循 routing 的拓展条件，先建真实目录页，再更新 routing、manifest 的父级/本地路径。移动后路径变化需保留本地未同步改动并复查所有关联链接；不要借移动重写笔记正文。

归档后根据真实子页列表，更新受影响目录页中的子专题和笔记导航链接。目录页内的链接是可读入口，实际 parent 关系与分页子页列表才是树结构的依据。

## 每周维护笔记与 Worker 表

按[数据表字段和维护约定](../knowledge-controller/references/note-catalog.md)只核验表中已收录的后续新建笔记及其 Worker 关系。已有笔记不补录，移动、更名或返工也不自动加入；它们仍按原流程归档和同步。通过 registry 锁合并更新已收录项的核验时间、状态及证据。失效关联标需复核；待关联统计仅限已收录的新笔记。

同步完成后执行 `python .knowledge-tools/catalog.py check` 和 `export`，刷新 CSV 及 catalog-view.json 指向的 Pages 展示表。查询索引由持久事实重建；展示表有人工变更时先核实回收，不覆盖。每周回复列出新增关联、改派、失效和待关联数量。

## 同步与发布

逐页用 live `read_page` 完整快照（非 search/excerpts）导出；保存 `.knowledge/exports/<page_id>.json`，再运行 `sync.mjs plan`。基线比较决定：

- `unchanged` 无需写；`remote-only/new-remote` 在附件与迁移检查通过后 `pull --apply`。
- `local-only` 用 `prepare-push` 生成任务；未改动的公式段保留其原嵌入，普通正文及 code 原生局部编辑。出现 `requires_formula_render` 时按下述公式流程处理，不直接把 LaTeX 写到普通段落。Agent 读回后才 `ack-push`，命令本身不调用 API。
- `conflict`、本地删除、缺基线、未验证迁入、空占位、缺附件或 `blocked-visualization` 均停止该页自动覆盖，报告证据和待处理动作。独立无冲突页可继续同步。

受控数学嵌入只按 manifest 中 `kind:math_region` 的非空源展开，核对 source SHA256、`embed_sha256` 与可选 Page/块守卫；先展开再处理 native math fence、链接及附件。行内 `$...$` 与同句 code 原样保留，供 Quartz 渲染。generic、未登记、源摘要错误或旧 URI 下源被改动的可视化不能当公式或空源写回；其源映射变化参与远端摘要，和本地同时改变仍是 conflict。

公式编辑使用 [Router 的维护流程](../knowledge-controller/SKILL.md#公式段落维护)：更新源 Markdown → `render-math-region.mjs` 重生成 HTML → 以 fresh `replace_block` guard 替换嵌入 → 在 manifest 锁内合并新引用、摘要与源元数据 → 完整读回核验。不要运行一次性旧 inventory 批处理，不仅改 HTML，也不只改源映射。只有公式类 issue 的原请求，在 post-read 展开后完整正文与本地一致、资源和守卫均通过时才可 ack；其他 issue 先解决。Pages 原生搜索可能漏掉 iframe 内容，定位兼用本地 Markdown。

对涉及的附件核实本地文件、映射与 SHA256。新 `library-file:` 图片必须通过已连接附件能力下载落地后才构建发布；若工具仅给像素且无法可靠保存原字节，说明阻塞，不能伪造下载地址或拿缩略图冒充原文件。数学围栏转换、Page 链接本地化及 frontmatter 规则按工作流执行。

同步后读取当前 `quartz/package.json` 与仓库发布规则，运行适当检查；目前已有 `npm run test:site`、`npm run build:site`，构建从临时目录取内容，不应覆盖其他聊天的 `quartz/content` 脏改。检查公式、图片、页面链接和首页导航；出现缺失资源或构建失败不发布。本次任务无需变更代码时不扩展无关测试。

未来每周整理后的提交与推送已经用户授权。先读 `.knowledge/publication.json`，把其中尚未发布的首次建设文件与本轮同步文件一并审阅，不能只看本轮写出的笔记。区分文件归属和用户授权范围：原有学习笔记也可按用户明确的仓库维护要求发布，但不冒称 Agent 新增；`requires-review`、缺失和 SHA 变化的条目先复核，`awaiting-generated` 等实际生成后再补最新 SHA。按[首次发布守卫](../../../.knowledge/workflow.md#首次发布守卫)运行 `publication.mjs prepare`，只把通过的精确路径及 `control_files` 交给 git-workflow；测试与构建通过、提交推送成功后才 `ack`。脚本不自行 stage、commit 或 push。

沿用仓库已有流程，核对文件清单与 diff，只 stage 用户授权范围内的具体路径。`quartz/content`、原有 README/CODE_OF_CONDUCT 删除及未引用附件不纳入首次清单。先确认当前分支、身份与 remote；不 `git add .`，不 force，不打包无关脏改。身份、认证、上游或分支不可用就报告，待发布条目保持 pending。用户本轮另有限制时遵从限制。

## 回复

说明处理了哪些页、留在 inbox 的原因、同步冲突/附件阻塞、Quartz 检查及实际提交推送结果。结果给当前归纳员聊天的正常最终回复，供 Router 通过 `wait_threads` 获取；不擅自给别的聊天发送消息，不把实现日志写入学习正文。
