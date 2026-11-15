# 笔记与 Worker 数据表

仅维护本次规则生效后新建的学习笔记。`.knowledge/catalog-policy.json` 固定排除现有笔记的 Page ID；旧笔记即使编辑、更名、移动或返工也不自动入表。旧笔记用 manifest、Pages live 搜索和本地正文查找，同步映射与基线照常保留。

关联事实保存在 `.knowledge/threads.json` 的 pages/threads 表，页面标题、路径、父级和同步基线来自 manifest。不要从聊天上下文记忆推断维持者，也不把 manifest 中可能较旧的关联缓存覆盖回 registry。

`catalog.py` 将这些事实和本地正文构建为 `.knowledge/catalog.sqlite`，提供 notes、threads、note_expert_links、association_history 和 note_expert_index 视图。它是可重建查询索引，每次查询都会按输入摘要自动刷新；不在 SQLite、CSV 或 Pages 展示表中直接改关联。SQLite 和正文缓存留在本地；JSON 事实、CSV 快照和工具随仓库备份。

## 字段及含义

- `page_id/title/aliases/keywords/summary/subject/tags/note_type`：精确身份、可搜索标题别名、检索词、摘要、主题和模板类型。未知类型留空；机械摘录不是掌握程度或学习结论。
- `page_url/local_path/parent_page_id`：真实页面入口、本地镜像和目录位置。
- `origin/source_thread`：历史迁入、模板或 Worker 总结来源。历史迁入始终 source_thread=null；维护者不是学习来源。
- `maintainer_expert`：当前返工负责人；`contributor_experts` 是参与修改者。所有关联必须指向已登记且 role=worker 的实际聊天。
- `association_status`：待关联、已关联或需复核。维持者已归档/确证不存在时保留原关联并标需复核，不悄悄改派。
- `review_status/verification.checked_at/verification.evidence`：关联核验状态、实际核验时间和证据说明，不能拿内容同步时间冒充关联核验时间。
- `lifecycle/lifecycle_checked_at`：聊天 active/archived/missing/unknown 及实际检查时间。未知状态不等于可用，也不等于已删除。
- `association_history`：registry 自动追加来源/维护者/参与者变更前后值、时间和原因；普通元数据更新不制造改派记录。

## 查找与返工

```powershell
python .knowledge-tools/catalog.py search "虚拟线程 协程" --limit 10
python .knowledge-tools/catalog.py show 实际page_id
python .knowledge-tools/catalog.py search "" --expert 实际thread_id
python .knowledge-tools/catalog.py check
```

Router 把自然语言转成必要的主题词检索。仅对已收录的新笔记按 show 返回的精确 maintainer_expert 委派；旧笔记改用 manifest、Pages 和本地正文定位，不因为未命中索引就补录。写前仍读 Page 和聊天现状。新笔记没有绑定或需复核时先确定适合 Worker，再登记；不按相似标题编造来源。

```powershell
node .knowledge-tools/registry.mjs link-page --input .knowledge/requests/association.json --expected-revision 实际revision
python .knowledge-tools/catalog.py rebuild
python .knowledge-tools/catalog.py export
```

association.json 只放本次要改字段，例如 page_id、maintainer_expert、assignment_reason、keywords、note_type、summary。完整确认后可附 `review_status:"confirmed"` 和 `verification:{checked_at,maintainer_expert,status:"confirmed",evidence}`。未关联页核验使用 status:"unassigned"、maintainer_expert:null。时间和证据来自本轮实际工具观测，不从模型记忆补。

## 每周维护

归纳员仅对已收录的新笔记核实标题/路径/父级和 Worker 聊天身份、标题及 active/archived 状态，不把旧笔记纳入表或待关联清单。确认 missing 必须完整遍历普通和归档列表；单次搜索无结果或 partial listing 只能记 unknown。已收录项的历史关系不删除，确证失效标 needs_review。

新建笔记通过 link-page 登记时自动设 catalog_managed=true；排除范围内的旧 ID 会被拒绝。用锁合并核验结果，保留来源、维护者、参与者和手工关键词；正文实质变化时更新摘要与检索词。每周报告仅统计已收录的新笔记。

随后执行 catalog check 和 export。export 生成 `.knowledge/note-expert-index.csv`、`.knowledge/requests/note-expert-index.md` 及同名 JSON 的来源/正文摘要。将 Markdown 刷新到 `.knowledge/catalog-view.json` 指向的真实 Pages 表格页；写前确认请求 sources_sha256 与 catalog check 一致，并读取 live guidance/blocks。上次展示正文摘要与 live 不同，先核实手工修改并回收事实，不能静默覆盖。写后完整读回，更新 catalog-view 的实际 canonical 正文摘要和刷新时间；不把新索引页纳入学习笔记镜像。

新增/改派时立即登记事实；每周统一校验和刷新展示。用户查找/返工时的 SQLite 自动刷新不依赖等到周任务运行。

角色已统一为 router/worker；maintainer_expert、contributor_experts、CSV 列名与 note-expert-index 文件名为兼容字段，继续关联真实 Worker。Router 按创建回执维护聊天和角色文档路径，业务元数据仍用 registry 锁更新；角色文档变更后通知相关 Worker 读取新版。
