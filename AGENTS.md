# 学习知识库项目约束

本项目只管理 `002-学习笔记` 的学习内容及其引用附件。Pages「学习知识库」是今后的笔记正文工作区，本地 Markdown 是镜像，也是 Quartz 的内容来源。日记、项目、任务总表、电子书和其他根目录笔记不自动迁入；引用附件按需处理。

根目录 `Agent.md` 是原有 LLM 学习笔记，保留原样，不能当配置文件改写。

## 多会话协作

本项目使用 Router / Worker（原 Controller / Expert）。Router 创建 Worker 时，在首条消息中指定负责领域、项目路径、角色文档、首次任务和交付要求。Worker 读取角色文档后开始工作，后续沿用本聊天与原生上下文压缩接续。

角色文档保存在 `.codex/docs/roles/`，协作方式见 [.codex/docs/collaboration.md](.codex/docs/collaboration.md)。短任务直接交接；较长或跨 Worker 的工作，按需在 `.codex/docs/handoffs/` 记录关键决定、已有结果、材料入口与下一步。角色文档变更时，由 Router 在相关 Worker 聊天中说明并要求读取新版。

Router 根据创建工具的真实回执维护 `.knowledge/threads.json`，用于派工、查找聊天和关联笔记。Worker 按收到的任务工作，无需自行登记或查询身份。Worker 返回结果后，由 Router 检查实际产物。

Worker 通过 `.codex/docs` 共享结论、Router 中转协调、项目负责 Page 承载正式内容。明确正文来源，避免竞争副本；共享材料不会自动唤醒聊天。普通学习直接在 Worker 进行，归纳员沿用既有自动化。

## 按任务加载技能

- 用户自然语言建页、总结 Worker、查找或修改笔记时，读取 [knowledge-controller](.codex/skills/knowledge-controller/SKILL.md)。
- 撰写学习总结或实质修订正文时，应用已安装的 `precise-writing` 技能；先保证术语、推理、例子与学习范围准确，再按类型模板组织，不把讨论中的猜测写成已确认结论。
- 每周整理临时笔记、同步 Pages 与本地、检查 Quartz 和推送时，读取 [knowledge-curator](.codex/skills/knowledge-curator/SKILL.md)。
- 归档依据见 [.knowledge/routing.md](.knowledge/routing.md)，操作与数据约定见 [.knowledge/workflow.md](.knowledge/workflow.md)。项目技能位于 `.codex/skills/<name>/SKILL.md`；即使尚未自动发现，也应按本文件显式读取。

## 不变量

- ID 从 `.knowledge/state.json`、`manifest.json`、`threads.json` 与 live 工具回执读取；不硬编码、不猜造、不混用 Space ID 与 Page ID。
- 原始迁入笔记 `source_thread=null`；维持者另记 `maintainer_expert`。聊天 ID 只存管理文件，学习正文仅放用户可理解的关联链接。
- 笔记与 Worker 表仅维护本次规则生效后新建的笔记；已有笔记不补录，编辑、更名、移动也不自动入表。已收录笔记查找和返工先查持久表；旧笔记通过 manifest、Pages 和本地正文定位。catalog-policy.json 保留既有 Page ID 排除范围，每周只核验已收录项。字段及流程见 Router 的 references/note-catalog.md。
- 临时笔记用于用户自行创建、待整理的页面；每周只归档其中由用户自行创建的直接子页。Router 或 Worker 创建的笔记（含模板、用户提供正文和聊天总结）直接放入合适的正式目录，目录无法确定时先澄清再创建。以页面创建方式判断，不把“用户提供正文”等同于“用户自行创建页面”；创建方式在 manifest 的 page_creator 中记录为 user / agent / unknown，无法核实的不猜。归档用同 Space 的 `move_page`，保留原 Page ID、历史与链接。
- 修改前读取目标及 guidance，带最新块 hash/sequence；不整页重写无关内容。结果不明先读回核对。
- 全量 live Pages 导出保存在 `.knowledge/exports/<page_id>.json` 后再反向转换。用远端摘要和本地 SHA256 比较基线，双边改动标为 conflict，不静默覆盖。未验证迁入页和空占位页不得覆盖原笔记。
- 附件必须有本地文件与映射才能构建发布；不猜页内锚点；保留源 frontmatter 和人工 tags。
- 普通正文和行内 code 保持原生可编辑；含行内数学的段落由 AI 同时维护源 Markdown 与 HTML 嵌入，让公式和 code 在同一句排版。仅展开 `manifest.visualizations` 中摘要与嵌入守卫有效的 `math_region`；未知或变更未核实的可视化保持 blocked。禁止把公式源改成编号附录、空源或仅更新 HTML。
- 公式源修改用 `.knowledge-tools/render-math-region.mjs` 重渲染，再用最新 guards 替换嵌入、合并源映射并读回。嵌入内容可能不被 Pages 原生全文搜索覆盖，Router 定位还需搜索本地 Markdown。
- 仅暂存本轮明确归属的文件，不带其他脏改，不 force。未来每周整理后的提交推送已获授权，遵守仓库与 git-workflow 技能；身份、认证或分支不可用时报告。
- 本地自动任务依赖本机与应用可运行。不要把本地脚本写成无法连接的 Pages API；由 Agent 调用已连接工具。当前迁移不归档旧 Pages，不擅自创建重复自动化。
- 归纳员每周日北京时间 20:00 的本地自动化已由 Router 启用并绑定归纳员聊天，不重复创建。
