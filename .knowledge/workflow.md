# 学习知识库工作流

## 内容与职责

Pages「学习知识库」是未来学习正文的工作区。`002-学习笔记` 是本地 Markdown 镜像和 Quartz 来源。首次迁移保留原文件；将每页与原文比较、核实图片/公式/链接后，才标记该页 `migration_status: verified`。空占位或迁入未完成的页不能反向覆盖原笔记。日记、项目、根目录杂记与电子书不自动迁移；根 `Agent.md` 保留。

Router 负责理解自然语言、真实建页、Worker 关联与委派。Worker 使用自己的完整学习对话整理或局部修改对应页。归纳员每周只归档 inbox 的直接子页，随后同步、验证 Quartz、提交推送。本机与应用必须可运行；定时任务在本地项目执行。Router 统一创建自动化，其他聊天不重复创建。

归纳员的每周日北京时间 20:00 自动化已 ACTIVE 并绑定归纳员聊天，无需再建。正文以原生段落为主；含行内公式的段落用 HTML 可视化呈现，由 AI 同时维护源 Markdown 和 HTML，使公式与 inline code 在同一句排版。其他正文和 code 保持原生可编辑。

本次已确认的聊天入口：[Router](codex://threads/01a1cf78-a31d-7541-9deb-28bde445a168)、[学习知识库归纳员](codex://threads/01a1cf87-561b-7e40-91e9-246b0d676f85)、[Worker 知识库工程](codex://threads/01a1cf7f-14a4-7752-8fb7-fb1b00522a45)、[Worker 笔记图文与格式](codex://threads/01a1cf85-fb15-71c3-ac4b-34ca1f7dbc9a)。执行委派仍查最新 registry；深链只用于用户导航。此 `codex://threads/<thread-id>` 形式由 Router 依据[官方命令参考](https://learn.chatgpt.com/docs/reference/commands)确认，不套用于 Pages block links。

## 管理数据与可恢复操作

- `state.json`：当前 Space、root、`@inbox/@tasks/@guide` 的真实 IDs 和迁移期收据。读取工具时直接使用观测到的 ID，不重构字符串。
- `manifest.json`：Router 维护的稳定 Page/目录/本地路径、附件和同步基线。下列脚本约定供 Router 首次写入时采用；已有不同 schema 时先适配，不用新文件覆盖。
- `threads.json`：聊天与来源登记，结构为 `{version:1,threads:{threadId:record},pages:{page_id:association}}`。`threads` 中记录 `threadId/title/role/aliases/topics`；`pages` 中记录 `page_id/origin/source_thread/maintainer_expert/url`。
- `catalog.sqlite`：由 manifest、threads 与本地正文自动生成的笔记/聊天/关联/历史查询表。Router 用 catalog search/show 定位和派工，不依赖会话记忆；输入摘要变化会自动重建。关联事实仍只通过 registry 锁合并，SQLite 为可重建索引。
- 数据表只收录之后新建并登记的笔记；catalog-policy.json 的既有 Page ID 排除范围不得因更名、移动或返工而取消。旧笔记不生成关联索引，仍保留 manifest 映射和同步基线，用 Pages 与本地正文定位。
- `note-expert-index.csv` 与 `catalog-view.json`：可读索引快照和 Pages 展示页的真实 ID/刷新基线。每周检查目录、聊天状态和未关联项后刷新；字段与操作详见 [笔记与 Worker 数据表](../.codex/skills/knowledge-controller/references/note-catalog.md)。
- `exports/<page_id>.json`：每次 live 完整 `read_page` 的原始工具结果或其完整 `structuredContent`，保留全部 canonical blocks、metadata 和 guidance。
- `previews/`、`requests/`：可审阅的渲染预览与本地改动推回 Pages 的任务输入。API 调用仍由 Agent 使用已连接工具执行。

历史迁入关联使用 `origin: imported, source_thread: null`，另设 `maintainer_expert`。新模板尚无学习对话时来源为 null，Worker 真正用自己的对话生成内容后才能登记来源。关联 ID 仅存管理文件；学习正文只放清楚命名的页面、资料或可用聊天链接，不泄漏内部 ID。

创建/移动/编辑前持久化意图与幂等键/操作引用；成功后登记真实回执。创建重试沿用原键。文件登记由 `registry.mjs` 以排他锁、最新读取、字段合并、原子替换执行；修改同一条记录时传已观测的 `--expected-revision`。锁超时报告所有者，不自动抢占或删除锁。多聊天不可各自把旧缓存覆盖写回完整管理文件。

### 同步 manifest v1

最小笔记记录示例（这里的 ID 是 schema 占位，执行时必须从真实收据取得）：

```json
{
  "version": 1,
  "pages": {
    "OBSERVED_PAGE_ID": {
      "page_id": "OBSERVED_PAGE_ID",
      "kind": "note",
      "path": "002-学习笔记/技术栈/JVM/垃圾回收.md",
      "url": "OBSERVED_CANONICAL_URL",
      "parent_page_id": "OBSERVED_PARENT_PAGE_ID",
      "migration_status": "verified",
      "baseline": {
        "remote_sha256": "SCRIPT_GENERATED_DIGEST",
        "local_sha256": "LOCAL_FILE_SHA256",
        "synced_at": "ISO_TIMESTAMP"
      }
    }
  },
  "attachments": {
    "OBSERVED_LIBRARY_FILE_REFERENCE": {
      "path": "003-Attachments/example.png",
      "sha256": "LOCAL_ATTACHMENT_SHA256"
    }
  },
  "block_links": {},
  "visualizations": {}
}
```

目录记录用 `kind: folder`、真实父 ID 与目录路径，不伪装成笔记。脚本也接受 `notes` 数组和 `local_path`，但写回保持原集合；不支持的 schema 先报错。附件可用 `attachments` 或 `assets`，键为远端引用，或本地路径加 `reference/url/path/sha256`；没有本地文件不能以映射代替下载。

`remote_sha256` 由 `remoteDigest(page,manifest)` 计算：标题与 canonical blocks 的 `id/kind/markdown`，加上该页引用的 visualization 源映射与守卫，排除 sequence、时间戳与瞬时元数据。无可视化的页兼容原摘要；有可视化时必须传 manifest，不能只对 Page 算摘要。源映射变化也是远端变化，和本地同时改动仍为 conflict。`local_sha256` 是完整本地文件字节的 SHA256。首次迁移须人工/Agent 比较原文与实际迁入正文后，显式建立基线；**不能根据占位页或源 Markdown 哈希推测远端摘要**。

### 受控公式段的双向转换

Router 从 `formula-receipts-{media,engineering}.jsonl` 合并真实回执，生成 `manifest.visualizations[完整visualize引用]`。以回执的 `source_markdown` 取得原段落；不要把回执中的嵌入 Markdown 误作源。最小有效记录为：

```json
{
  "kind": "math_region",
  "key": "RENDERER_REGION_KEY",
  "markdown": "该段原 Markdown，保留 $行内公式$ 与 `inlineCode`",
  "source_sha256": "EXACT_SOURCE_UTF8_SHA256",
  "embed_sha256": "LIVE_CANONICAL_EMBED_BLOCK_MARKDOWN_UTF8_SHA256"
}
```

`source_sha256` 按源 Markdown 的完整 UTF-8 字节计算，含原换行与空白；`embed_sha256` 按最新完整读回中**整个独立嵌入块**的 `b.markdown` 计算。源摘要不使用 trim 后文本。建议一并记录 `html_sha256/html_file/page_id/block_id/block_hash` 及来源元数据；后面三个字段一旦提供就必须与 live 块匹配。脚本只推进 baseline，不替换这些源记录或抹掉未知元数据。

独立 `![标题](visualize:真实引用)` 仅在已登记 `kind:math_region`、源非空、源摘要和嵌入守卫均有效时展开。先按原位置连续展开各源段，再将 native math fence 转成 `$$`，并进行 Page/附件链接本地化。原源中的 `$...$` 与同句 code 保留，供 Quartz 正常渲染；不写入 visualization URI，也不转为「行内公式编号附录」。源内的附件仍须落地并通过摘要检查。

未登记、generic visualization、摘要不符、嵌入被改动、缺少守卫或嵌套 visualization 一律 `blocked-visualization`，不能以空源兜底。真正图表/交互工具不被当成公式。成功基线还保存 `baseline.visualizations[引用]` 的源/嵌入摘要；同一个既有 URI 下改源会被阻止，须重新渲染并取得新引用。若本地也改动，仍以 conflict 保留双边内容。

嵌入的 iframe 内容可能不被 Pages 原生全文搜索覆盖。Router 全文定位兼查本地 Markdown 和已登记源，再读 live 目标；搜索无结果不能证明不存在。普通段落仍可在 Pages 原生编辑。

公式源修改使用长期维护 renderer：

```powershell
node .knowledge-tools/render-math-region.mjs --input region.md --output region.html
```

也可调用导出的 `renderMathRegion(markdown,key)` 取得 HTML。renderer 校验 KaTeX 语法；命令行输出源/HTML 摘要与字节，超过 256 KiB 就报错，不能截断 HTML。此流程不调用一次性 `formula-regions.mjs` 重跑旧 inventory 或 converted 缓存。

Worker 修改时保留同句文字、公式与 code，重新读 Page/guidance，以最新 `replace_block:{block_id,expected_hash}` 和可用 `base_sequence` 调用 `create_page_visualization`。核对上传/替换回执，未知结果先读回；从实际完整读回取得新引用与嵌入守卫，在 manifest 锁内合并相应源/HTML 摘要与来源元数据。只改 HTML 而不更新源，或只改旧 URI 下的源而不重渲染，均不能确认同步成功。

## 自然语言任务

「建 XX 模板」一律先在真实 inbox 页下创建实际子 Page；用户只要空模板时，交付 Page 即可。先查并按需复用合适 Worker 作为维持者；仅在用户明确要求新建 Worker 聊天时才创建。先写角色文档，在首次提示中给出项目路径、角色文件和实际任务，允许它用本人真实 ID 登记自己；Router 随后确认登记并检查首次回复。空模板的 `source_thread` 仍为 null，真正从学习对话总结后才记录来源。按 [六类模板](../.codex/skills/knowledge-controller/references/templates.md) 选择结构，没有内容的段落省略；返回可用链接，不能只回复模板文本。

「总结 WorkerXX」先按登记标题/别名定位，必要时分页读聊天。Router 向该 Worker 发送模板、准确父 Page ID/目标 Page ID、范围和写入约束，Worker 用自己完整的学习上下文写 Page 并在自己的最终回复交收据。Router 通过 `wait_threads`（保留 cursor）获取结果并 live 读回验证，再更新来源和维持者。用户已指明目标的委派无需重复确认；多义且上下文无法消解时才问。不能要求 Worker 未获用户授权便反向消息给 Router。

查找顺序为标题/aliases → 目录/主题 → 全文；搜索不是树的完整枚举。读取实际目标后再派相应 Worker，写前重新读最新 guards，只改用户指定部分。没有历史来源的迁入笔记可以关联新维持者，但不改变 `source_thread:null` 的事实。

## Pages 工具实操

以下依据本次已连接工具 schema（2026-11-12）整理；每次执行以 live schema、guidance 与回执为准，不使用旧 MCP 配置假设。

- `list_spaces` 按 cursor 找当前 Space；旧笔记保存但未验证的 Space ID 先与 listing 精确匹配。`get_space` 返回 `root_page_id`，不能拿 Space ID 当 Page ID。
- `list_pages(parent_page_id=实际页ID, space_id=已验证SpaceID)` 用于遍历真实子树。每一层持续跟随 `next_cursor`，即使 items 为空；检查 parent、partial_results 与 incomplete_reasons。用 BFS/DFS 读取目录树，但周归档处理集合只取 inbox 第一层。
- `create_page` 的 `initial_blocks` 是最多 100 个 Markdown 字符串。子页传真实 `parent_page_id`；同一创建沿用同一 `idempotency_key`，子页继承 Space。
- `read_page({page_id,view:'full'})` 得到完整正文。默认 editing 无 selectors 时也是全块；过大默认读可改 full。`search`、`block_ids` 和 excerpts 只用于定位或刷新编辑 guards，不能当作同步快照。同步器拒绝不完整 selection、excerpts、scratch 与 native artifact。
- 留存 successful `structuredContent` 为 `p`；真正编辑目标为 `p.content.page_id`。`metadata.parent.page_id` 是导航父级。块取 `b.id/b.hash`；sequence 仅用该次读返回的 `content.through_sequence`，没有就省略。
- 单块内文字替换用 `patch_page` 或 `edit_page` 的 `patch_block_markdown`，带 exact `old/new` 与 `expected_hash`。新增、删除、拆分、合并块用 `insert_markdown/replace_block_markdown/delete_block`。不要先试 literal patch 再做结构编辑。
- `edit_page` 原子批次只能用非 patch 操作；partial 批次只能用 patch（最多一个 set_title）。每次检查每项 `operation_results`、commit_status 与 recovery。已 applied/ignored 的操作不重放；未知结果同 stream 读回，再构造未完成改动。目标更新后旧 hash 作废。
- 归档用同 Space 的 `move_page(action:'move', page_id, parent_page_id)`，核对完成与 parent，未知结果读 metadata.parent。跨 Space 会产生访问变化预览，需按工具要求取得确认；本周归档流程不擅自跨 Space。
- `write_page_reference` 消费授权的绝对本地文件路径，上传后返回 native 引用与图片 Markdown，**不会自动插入正文**。读取 guidance 后再编辑。下载用 `inspect_page_reference/read_page_reference` 或其他实际已连接且有授权的文件能力；不要编造 HTTP 下载端点。读取格式/大小不支持时报告。

## 同步命令与状态

在项目根执行 Node 命令。依赖使用仓库已安装的 Quartz `unified/remark-parse/remark-math/gray-matter`；依赖缺失时按仓库锁文件安装，不调用 Pages HTTP API。输入 `live-read.json` 必须是 Agent 刚从工具取得的完整 JSON，不是截断屏幕文本。

```powershell
node .knowledge-tools/sync.mjs capture --input live-read.json
node .knowledge-tools/sync.mjs plan --input live-read.json
node .knowledge-tools/sync.mjs render --input live-read.json --output .knowledge/previews/note.md
```

首次已验证迁入页有本地原文但缺基线时为 `unbased`，只导出/比较，不改原文。确认迁入内容、资源与原文相符后，用 plan 给出的本地 SHA256 显式建立初始基线：

```powershell
node .knowledge-tools/sync.mjs baseline --input live-read.json --accept-initial --expected-local REVIEWED_LOCAL_SHA256
```

基线后两端都不变为 `unchanged`；只有 Pages 或受控源映射改为 `remote-only`；只有本地改为 `local-only`；两边都改为 `conflict`。本地文件被删除为 `conflict-local-deleted`，不默认把删除传播到 Pages 或重新生成文件。未 verified 为 `blocked-migration`，空远端为 `blocked-empty`，未落地资源为 `blocked-assets`，无效/变更未核实的可视化为 `blocked-visualization`。新增已 verified 且尚无本地文件为 `new-remote`。

```powershell
node .knowledge-tools/sync.mjs pull --input live-read.json
node .knowledge-tools/sync.mjs pull --input live-read.json --apply
```

不带 apply 仅计划。apply 先保存原始导出，只写安全状态的本地页，临写前再次核对本地哈希，写成功才推进基线。临界期间仍需避免其他 Agent 或编辑器同时保存同一笔记；manifest 锁不能锁住外部编辑器。崩溃发生在笔记写入与基线写入之间时，旧基线会保守地产生 conflict，读回后再处理。

本地改动推 Pages：

```powershell
node .knowledge-tools/sync.mjs prepare-push --input live-read.json --output .knowledge/requests/push.json
```

请求包含正文、原 frontmatter、观测 guards、预期本地 SHA256、旧远端摘要和 `formula_regions`。完整且未改动的公式源段按原顺序恢复原嵌入，因此仅改普通正文或 code 时仍可原生局部编辑。独立 `$$` 显示数学反向转 native `math` fence；普通代码里的美元符号和行内 code 不变。新/变更的行内公式、公式段删除/重排、复杂嵌套显示公式会产生 `requires_formula_render:true` 与同名 issue，须由 Agent 按上述 renderer 流程更新，不能直接把 LaTeX 塞进普通 Page 段落。

`issues` 非空时先处理；不要删除 issue 伪装已解决。Agent 写前重新 full 读，`remoteDigest(page,manifest)` 必须与请求一致；使用最新 hash/sequence 局部编辑，保留 Page instruction 与无关块，不直接把整份本地 frontmatter 塞进学习正文。写后读回并验证实际内容才确认：

```powershell
node .knowledge-tools/sync.mjs ack-push --input post-write-read.json --request .knowledge/requests/push.json --verified
```

ack 验证本地未再改、旧基线未变和远端确有变化后推进基线；`--verified` 是 Agent 已核对工具写入与读回的声明，不是解决 conflict 的捷径。前置 guards 不符时废弃请求并重做计划。仅本地 frontmatter 改动且正文与当前导出一致时，请求标记 `metadata_only:true`；不用写远端，Agent 核对后以同一快照 ack，脚本要求远端摘要不变且正文匹配，保留本地元数据。不为通过 ack 伪造远端改动。

原请求若只有 `requires_formula_render:` 类 issue，Agent 完成源/HTML/映射联动更新后可用**原请求** ack。脚本会重新检查所有源摘要、live 嵌入守卫与附件，并要求 post-read 展开后的**完整正文**与当前本地正文一致；仍有 native 行内 LaTeX、旧 URI 下改源、只更新 HTML 或源/正文不一致都会拒绝。其他 issue 不适用此路径。锁、旧基线和本地 SHA256 守卫继续生效，正常局部编辑无需为了公式无关的改动重建全部嵌入。

### 保真要求

- 原 frontmatter 逐字保留未知字段和人工 tags；tags 键缺失才按目录回填。新镜像补 title/created/modified/tags/subject。不批量替换历史元数据。
- 先展开受控 math region，再将 `math/latex/tex` 围栏转为 `$$`，保留原 `$行内公式$`、普通代码块与行内代码。嵌套在代码示例中的 math 标记不转换；特殊列表/引用内公式要渲染复核，反向写入不扁平化其结构。
- Page 链接按 manifest 已观测 canonical URL 转本地相对 Markdown 链接，路径安全转义。图像 `library-file:` 等引用按附件映射转路径并检查文件/摘要；新远程图像没有本地文件就阻止该页 pull/发布。
- 页内链接只使用真实已验证 block link。`block_links` 以完整 live URL 为键，值包含 `verified:true,page_id,block_id,local_fragment`；local_fragment 必须对应目标文件实际存在的显式 `^block-id` 或 HTML id。未经验证的跳转改为页面链接，链接文字明确章节名，并依靠 Pages 原生标题大纲导航；可在映射中存已观测的 `section_title`，脚本自动附到链接文字。没有章节名的告警由 Agent 读目标后补齐，不从 opaque block ID 猜标题，不根据标题猜 slug/锚点。脚本不自行制造导航锚点。
- 代码样例中的链接不重写。标准 Markdown 链接、引用定义、HTML src/href 可转换；本地推回支持对应 Page/附件链接及 Obsidian wikilinks。复杂嵌入、Dataview、未知引用或表内特殊公式由 Agent 检查，不以静默删除解决。

`--output` 仅允许 `.knowledge/previews/`、`requests/` 或 `reports/`，防止绕过冲突检测直接输出到本地笔记。原始 live 读输入可放在 Agent 已授权的暂存位置；不得把截断屏幕文本当作原始 JSON。

## 登记命令

```powershell
node .knowledge-tools/registry.mjs show
node .knowledge-tools/registry.mjs resolve "Worker Java"
node .knowledge-tools/registry.mjs register --input .knowledge/requests/expert.json
node .knowledge-tools/registry.mjs link-page --input .knowledge/requests/page-link.json --expected-revision 0
```

Router 根据创建工具回执登记聊天，register 输入示例为 `{threadId,title,role:'worker',role_ref:'.codex/docs/roles/java.md',aliases:[],topics:[]}`，用于派工与笔记关联，Worker 无需自行登记或查询身份。职责与角色文档由 Router 在首条消息中指定，后续沿用本聊天与原生压缩，较长或跨 Worker 的任务按需写交接文档。新建笔记的 link-page 输入为 `{page_id,origin:'template',source_thread:null,maintainer_expert:已登记threadId,url}`，自动纳入索引。旧笔记不调用 link-page 补录。只传本次要变更的字段；更新已有记录时传 expected-revision，冲突重读。

## 每周发布收尾

本轮无冲突页可继续整理；有冲突页保留双端内容和导出，不静默选边。若 unresolved 图片或链接会使网站缺页、缺图，先修复或报告阻塞，不将有问题的站点推送。

读当前 Quartz 脚本与仓库规则。目前 `npm run test:site` 与 `npm run build:site` 在 `quartz` 执行；构建会暂存学习笔记/附件，验证首页导航、索引目标和 sitemap。另抽查本轮改动的公式、图片和链接。成功后依 git-workflow 仅暂存本轮拥有的具体文件，检查 staged diff，再按现有 branch/remote 提交推送。不 force，不纳入其他聊天脏改，不修改提交身份以绕过错误。身份、认证、分支或 upstream 不可用时报告已有成果与阻塞。

根 `.gitignore` 已加入 `AGENTS.md`、项目技能、工具与持久管理文件的例外；exports、reports、requests、锁和临时运行数据仍留在本地。首次建设文件通过下述待发布清单纳管，不依赖它们恰好在当周同步中再次被改写，也不强制添加被忽略的运行数据。

### 首次发布守卫

`.knowledge/publication.json` 是持久待发布清单，逐项区分 `ownership` 与 `scope_authorization`，保存精确路径、当前 SHA256、审阅证据和 `pending/published`。用户明确要求的学习笔记与确实引用附件、工程 Worker 的 Quartz 修复属于发布范围；既有用户内容仍标原有内容。未知归属或混有无关 diff 的条目保留 `requires-review`，缺少的 manifest、threads 或迁移报告保留 `awaiting-generated`，实际生成并审阅后才补 SHA。`quartz/content`、原有 README/CODE_OF_CONDUCT 删除和未引用附件始终排除。

允许路径依赖持久的 `.knowledge/quartz-result.json` 工程回执、附件映射与 `.knowledge/quartz-assets.json` 的源引用键（去除 fragment），不要求克隆后仍有一次性 plan 缓存；清单中的附件 SHA 仍须与本地文件一致。机械范围、来源摘要及非意外删除检查要如实注明，不伪称人工逐字审阅；提交前仍检查实际 staged diff。

每周把待发布首次文件与本轮授权改动合并审阅。新增或变化的条目用 `{version:1,entries:[{path,sha256,ownership,scope_authorization,evidence,reviewed_diff:true,review_status:"approved"}]}` 的精确审阅输入，通过 `prepare --review reviewed.json --expected-ledger 当前清单SHA256` 锁定合并；不要从 `git status` 推断归属。没有变化时直接 prepare：

`scope_authorization` 按实际范围取 `user-requested learning notes`、`user-requested referenced attachments`、`user-requested Quartz repair` 或 `user-requested knowledge infrastructure`。原有内容的 `ownership` 如实记录为用户既有内容；授权范围不能代替来源说明。

```powershell
node .knowledge-tools/publication.mjs prepare --output .knowledge/requests/publication.json
```

`ready` 仅包含已审阅且 SHA 未变化的路径，`blocked` 逐项说明缺失、漂移或范围问题；清单自身放在 `control_files`，避免自引用 SHA。使用 git-workflow 审阅并仅暂存这些具体路径，完成既有同步和站点检查，再按已授权流程提交推送。推送成功后用实际完整提交哈希运行：

```powershell
node .knowledge-tools/publication.mjs ack --request .knowledge/requests/publication.json --commit 实际提交哈希 --remote note --branch main
```

当前仓库远端名为 `note`、分支为 `main`；以后执行前仍核对实际分支和远端，不能假定存在 `origin`。ack 同时核对原清单、当前文件、提交内经过 Git clean filter 的 blob，以及远端分支确实包含该提交，全部通过才标记 published；失败保持 pending，不自动 stage、commit、push、fetch 或部署。ack 的清单状态更新在下一次授权提交中纳管。原始笔记不因清单生成或检查而改写。

自测只在 OS 临时目录运行并清理，不改管理中的真实页、基线或原笔记：

```powershell
node .knowledge-tools/registry.mjs self-test
node .knowledge-tools/sync.mjs self-test
```
