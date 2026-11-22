---
name: knowledge-controller
description: 在本学习知识库中按自然语言创建并分类学习笔记和 Worker 聊天、总结指定 Worker、定位或局部修改学习笔记，并维护页面与聊天的真实关联。
---

# 学习知识库 Router

按用户交给 Router 的请求工作，沿用本聊天与原生上下文压缩接续。短任务直接交接，较长或跨 Worker 的工作按需写简短交接文档。再读 [工作流](../../../.knowledge/workflow.md)。分类时读 [归档规则](../../../.knowledge/routing.md)；建页或总结时按需读 [六类模板](references/templates.md)。仅管理学习笔记，不把日记、项目或根 `Agent.md` 纳入迁移。

撰写学习内容、总结 Worker 或实质修订笔记时，读取并应用本机 `precise-writing` 技能。派发任务时把这一要求传给 Worker：术语准确、论证有明确前提、保留代表性例子，区分已学结论与未解决问题；模板服务于内容，没有材料的栏目不填空话。

## 建模板页与 Worker

从 `.knowledge/state.json` 和 manifest 取得本 Space 与候选目录的真实 ID，按归档规则选择最合适的正式目录，并验证 live 父页可写。Router 或 Worker 创建的笔记（含空模板、用户提供正文和聊天总结）直接用该目录的真实 `parent_page_id` 创建实际子页，不经过临时笔记。主题或归属无法确定时先澄清再创建。临时笔记仅用于用户自行创建、待每周整理的页面。标题来自用户主题；模板只保留有用段落。

用户只要求空模板时，交付实际 Page 即可，不为每篇模板强制新建 Worker 聊天。先查登记表是否已有合适 Worker，可复用为 `maintainer_expert`。仅当用户明确要求新建 Worker 聊天时，才调用 `create_thread`，沿用本地项目工作目录；传入页面链接、真正父 Page ID、模板类型、主题范围及项目约束，登记精确 `threadId/title/role/aliases/topics`。

空模板的 `source_thread` 始终为 null，关联或新建维持者不等于已有学习来源。真正从 Worker 的学习对话总结生成内容后，才记录该来源。不要把 Router、迁入任务或刚建立的空聊天冒充历史学习来源。新页在 manifest 记录 `page_creator:agent` 和创建回执依据；用户提供正文的 `origin:manual` 只说明正文来源，不能据此当作用户自行创建的页面。

先持久化创建意图及幂等键，成功后保存精确回执与映射；超时先查现状，不重复建页/聊天。注册用 `registry.mjs` 锁定合并，不能用旧内存快照覆盖整个 `threads.json`。向用户返回可用的页面与 Worker 聊天入口，local 聊天链接采用已确认的 `codex://threads/<真实threadId>`。

新建 Worker 前先写角色文件；首条消息指定负责领域、项目路径、角色文档、实际任务与交付要求，要求 Worker 读取角色文档后开始工作。Router 根据创建回执，用 registry.mjs 记录真实聊天 ID、标题、role_ref 与领域信息，检查首次回复。Worker 无需自行登记；角色文档变更时由 Router 通知读取新版。registry.mjs 继续维护笔记关系与常规元数据，历史路径和 maintainer_expert 字段保留兼容。

## 总结指定 Worker

用户说「总结 WorkerXX」时，先用登记表标题/别名解析，必要时 `list_threads/read_thread` 分页定位该聊天。多个同名且无法由当前话题区分才问；常规请求继续执行。读取聊天是为定位与确定范围，不把有限摘要当成完整学习上下文。

用 `send_message_to_thread` 向用户指定的该 Worker 发总结任务，包含：

- 用户要总结的学习范围与截止范围、选定模板和必须保留的例子/问题；
- 目标 `page_id`（已有页）或已选正式目录的**真正 `parent_page_id`**（需新建）、Space 与可读链接；
- 要求 Worker 使用它自己的完整对话上下文，区分已学结论、未解决问题和待核实内容；
- 写前读取 Page/guidance，沿用新 guards 做局部编辑；需要新页时复用同一创建幂等键；
- 普通正文与 code 保持原生；涉及行内公式的段落按下述维护流程同时更新源 Markdown、HTML 和映射，不改成编号附录；
- 成功后在本聊天的最终回复交付收据：page_id、url、parent_page_id、标题、来源 Worker、改动范围、工具结果与未完成项。不要要求它反向发消息给 Router。

Router 用 `wait_threads` 获取最终回复，保留 cursor；读回目标确认正文、父级与写入范围，再登记来源、维持者、映射和基线状态。没有验证前不宣称已总结。待办写入 `@tasks` 的相关位置，避免把实施日志塞进学习正文。

## 查找与修改

先读取[笔记与 Worker 数据表](references/note-catalog.md)。仅为之后新建的笔记登记索引与 Worker 关系；已有笔记不补录，后续编辑、更名、移动也不自动加入。新建笔记执行 catalog search/show 查询真实关联，创建、总结或改派后即时登记来源/维护者、摘要、关键词和类型；旧笔记通过 manifest、Pages 与本地正文定位。

依次查标题和 aliases、目录与主题、全文。先查 manifest/threads 的索引，再用本 Space 的 `find_pages`；搜索有 cursor 时遍历，空结果不是不存在的证据。公式段的 iframe 内容可能不进入 Pages 原生全文索引，全文定位还需查本地 Markdown 与已登记源。读目标后确认身份、内容和最新 guidance。若一个目标明确，不重复征求确认。

对已收录的新笔记优先派已登记的 `maintainer_expert`；没有维持者时确认适合的 Worker 再登记。旧笔记可为当前修改委派合适 Worker，但不因此生成索引项。向 Worker 传精确目标、原始用户修改要求和范围；让它在真正写入前重新读取并使用最新 guards。文本改动保留原块身份；增加、拆分或删除块用结构编辑。用 `wait_threads` 收据和 Page 读回验证，随后安排同步。不能拿父页 ID 编辑子页，也不能凭搜索结果整页重写。

新增或删除笔记间引用后，核对受影响页面的「引用本篇的笔记」区，补齐或移除对应反向链接；先读实际引用，避免自链、重复项和已不存在的来源。保留原生标题大纲，页内跳转只用验证过的块链接。

## 公式段落维护

标题继续使用原生 heading：简单符号可写成可读的 Unicode，复杂等式完整放到紧邻标题的公式段，保留大纲。数学列表按正文与真实列表层级组织，不用四空格或 Tab 把讲解误变成代码；真正代码中的美元符号不转换。

派 Worker 修改公式段时，传递真实 Page/块与 `manifest.visualizations[完整visualize引用]` 的源记录。先核对 `kind:math_region`、源 SHA256 和 live 嵌入守卫；未知或不符时停止覆盖。保留源元数据及同句 inline code，只改用户指定内容。

1. 更新该段源 Markdown，运行 `node .knowledge-tools/render-math-region.mjs --input region.md --output region.html`；也可调用其 `renderMathRegion(markdown,key)`。不调用一次性 `formula-regions.mjs` 重跑旧 inventory/converted。
2. 写前重新读取 Page，使用 `create_page_visualization` 的 `replace_block:{block_id,expected_hash}` 与可用的新 `base_sequence` 替换原嵌入；创建/上传结果未知时先读回核对。
3. 保存新 native visualization 引用、源/HTML 摘要及回执，完整读回后取得 `embed_sha256`（该嵌入块原始 Markdown 的 UTF-8 SHA256）。在 manifest 锁内合并相应源映射，保留其他来源元数据；源变动应生成新嵌入引用，不改旧 URI 下的源记录冒充重渲染。
4. 验证展开后的正文、公式和 code，并返回源与嵌入一起更新的收据。同步器的 `requires_formula_render` 不是可删除后忽略的提示；按工作流处理后才 ack。其余段落继续原生局部编辑。

## 收尾

只报告实际成功的 Page 与聊天链接、变更摘要和剩余问题。聊天关联、工具 guards、哈希和同步状态写管理文件。周整理与发布交给 [knowledge-curator](../knowledge-curator/SKILL.md)，不要另建重复自动化。
