---
created: 2026-04-28
modified: 2026-05-05
---
# 1. 安装

- 前置环境：Git、Node.js（版本latest即可）

- 安装 Claude Code
``` powershell
npm install -g @anthropic-ai/claude-code
```

- VS Code 使用
	![[QQ_1777379212861.png]]修改设置的配置文件，环境变量中加入
	```json
      "claudeCode.environmentVariables": [
        { "name": "ANTHROPIC_BASE_URL", "value": "https://xxxx" },
        { "name": "ANTHROPIC_AUTH_TOKEN", "value": "xxxx" }
    ]
	```
	这一步的目的是绕过 Claude Code 原生对使用官方订阅或者指定模型API的限制

- 第三方模型配置
	1. 安装 CC Switch
	2. 购买第三方模型 Token
	3. 接入 CC Switch

# 2. 整体架构

六大功能支柱
> ![[QQ_1777381923940.png]]


# 3. 深度融合软件开发过程

> 以下的所有内容，都是针对使用 CLI 命令式终端讨论的
> 终端支持最多的命令，功能最完整

==针对Vibe Coding，或者说Ai Coding==，我认为核心要点，永远都是如何设计我们的输入，设计模型处理输入的方式，设计模型的能力边界，从而得到让我们更满意的输出。

针对这两个核心要点，会一路引出下文所有的思想和具体的实施工作。

## 我们的角色定位

简单概括，让模型知道现在是怎么一回事情，接下来应该怎么进展，然后让他具体执行

| 描述                      | 实施                                        | 模型能干什么           |
| ----------------------- | ----------------------------------------- | ---------------- |
| 提供和需求相关的正确上下文           | 通过 @ + 文件相对终端路径 定位                        | 阅读文件、搜索代码、理解代码   |
| 用尽可能精确不冗余的自然语言，引导模型规划任务 | 通过设计 Claude.md 文档，规划模型执行任务的方式等，提供给模型最终的输入 | 分析问题、规划执行方案、评估风险 |
| 配置模型权限，让模型可以行动          | 提供 skill、tools、mcp、plugin                 | 编辑代码，执行任务、进行反馈测试 |

> @ : 添加文件作为上下文 **添加文件带来的token消耗会比较大，所以尽量引用最精确的、最需要的文件**
> ! : 添加终端命令运行的输出结果作为上下文
> 当我们想进行单次临时对话，不需要上下文时，在终端中，`命令 | claude -p '提示词文本'` ： `-p` 表示将管道的输出作为提示词的输入

## 模型本身的思考能力

在 Claude Code 中，支持配置模型本身的思考能力，相当于是在 invoke 的时候，传入具体的 config 配置字典。
一般支持的思考能力，从弱到强为：low - medium - high - xHigh - Max

**切换思考能力** : `/model -> /effort`

> CC 的创始人认为：实践中，使用 high 最具性价比，考虑产出质量、思考时间、花费开销

## Claude Code 提供的支持

![[QQ_1777394968345.png]]

| 支柱                                                                                                                                    | 关键能力                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core                                                                                                                                  | 终端交互、文件读写、Git 操作、自适应思考、验证、沟通                                                                                                                     |
| Memory                                                                                                                                | [CLAUDE.md](https://zhida.zhihu.com/search?content_id=270598290&content_type=Article&match_order=1&q=CLAUDE.md&zhida_source=entity) 层级配置、项目上下文注入 |
| Agents                                                                                                                                | 子代理编排、后台任务、并行执行                                                                                                                                  |
| [Automation](https://zhida.zhihu.com/search?content_id=270598290&content_type=Article&match_order=1&q=Automation&zhida_source=entity) | 自定义命令、Slash Commands、Hooks                                                                                                                       |
| [Extensions](https://zhida.zhihu.com/search?content_id=270598290&content_type=Article&match_order=1&q=Extensions&zhida_source=entity) | Skills、Plugins、MCP Servers                                                                                                                       |
| [Enterprise](https://zhida.zhihu.com/search?content_id=270598290&content_type=Article&match_order=1&q=Enterprise&zhida_source=entity) | 托管策略、云平台集成                                                                                                                                       |

虽然看着多，但是每一点都是对应到上面说的核心要点，也就是我们在Vide Coding中的角色定位。

最后如果完整使用这些支持，一个项目的所有配置项，大概如下
```
your-project/
├── CLAUDE.md                    # 📋 项目级指令（团队共享，提交到 Git）
├── CLAUDE.local.md              # 👤 个人项目偏好（自动 gitignore）
├── .claude/
│   ├── settings.json            # ⚙️ 项目设置（团队共享）
│   ├── settings.local.json      # 👤 个人项目设置（gitignore）
│   ├── CLAUDE.md                # 📋 等效于根目录 CLAUDE.md
│   ├── rules/                   # 📏 模块化规则文件
│   │   ├── code-style.md        #    代码风格
│   │   ├── testing.md           #    测试规范
│   │   └── security.md          #    安全要求
│   ├── agents/                  # 🤖 自定义子代理
│   │   ├── code-reviewer.md
│   │   └── debugger.md
│   ├── skills/                  # ⚡ 自定义技能
│   │   └── fix-issue/
│   │       └── SKILL.md
│   └── worktrees/               # 🌳 Git Worktree 目录（加入 .gitignore）
├── .mcp.json                    # 🔌 项目级 MCP 服务器配置
└── .github/
    └── workflows/
        └── claude.yml           # 🔄 Claude Code GitHub Actions
```

^489f20

# 4. 提供更精确匹配需求的输入提示

除了上述说的 `/` 和 `!` 。 Claude Code 支持从上述所有的[[#^489f20|配置项]] 读取信息，避免了每次会话都要自己输入一堆相同的信息。

在这些配置项的读取上，我们可以发现很多的命名相似，这是因为 CC 采用了优先级的机制，低优先级的配置会被高优先级的配置覆盖，从而实现特殊环境的配置特殊化。

|优先级|层级|位置|作用范围|是否共享|
|---|---|---|---|---|
|最高 🔴|托管策略|系统级路径（IT 部署）|组织内所有用户|是|
|↓|命令行参数|CLI flags|当前会话|否|
|↓|本地项目设置|.claude/settings.local.json|你在此项目|否|
|↓|共享项目设置|.claude/settings.json|所有协作者|是（提交 Git）|
|最低 🟢|用户设置|~/.claude/settings.json|你的所有项目|否|

> 这里 ~/.claude ，就是C盘用户目录下的文件，配置优先级最低，因为生效对象是所有项目，最一般
> settings.local.json 之所以是我所在当前项目，是因为.gitignore 文件会忽略这个配置文件，所以别的写作者不会同步

> 命令行参数，是在使用 claude 命令启动服务时，后面可以携带的参数，优先级较高，会覆盖底层一些配置，单次打开会话中生效，这里提供一些常用的：

|**参数**|**它的作用**|**你的使用场景**|
|---|---|---|
|**`--no-emoji`**|纯净文本模式|强迫症或旧版终端显示异常。|
|**`--power-steer`**|算力拉满|解决分布式锁、分布式事务等高难度 Bug。|
|**`--read-only`**|只读模式|纯代码分析，不希望 AI 乱动你的源码。|
|**`--non-interactive`**|自动执行|配合脚本跑定时任务或批量重构。|
|**`--verbose`**|详尽日志|当你觉得 Claude 卡住了或运行逻辑很怪时。|

一般 `setting.json` 中的文件，配置格式如下：
- 第一行的 schema ，就是一套规则，约束有哪些字段，在VSCode中，通过schema，可以自动补全后续的字段
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(git commit *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Bash(curl *)"
    ]
  },
  "enabledPlugins": {
    "example-skills@anthropic-agent-skills": true,
    "context7@claude-plugins-official": true
  },
  "alwaysThinkingEnabled": true,
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "high"
  }
}
```

> [!NOTE] 好用的工具
> 
> 因为 Claude 能够感知外部世界，执行各种行为，全靠 tools，而所有的cli命令行终端，是 Claude 可以直接使用的工具，不需要额外配置。这里提供几个使用的cli：
> ### GitHub CLI（Claude Code 用它操作 PR、Issue）
> - winget install gh
> - gh auth login
> ### jq（在 Hooks 脚本中，解析 Json）
> - winget install jqlang.jq
> ### ripgrep（高速代码搜索）
> - winget install ripgrep

> [!NOTE] 更详细的配置信息查看方式
> 1. `/config` ： 查看、修改配置
> 2. `/permissions` ： 查看修改 【当前的工作区】【当前允许/拒绝/需要申请/最近拒绝 执行的cli命令】
> 3. `/cost` ：==查看花费开销==
> 4. `/context` ： 查看上下文分布情况


> 总结：本章节内容关注于如何让模型感知上下文环境，查看具体的配置信息。1. 通过@添加文件或者通过!显示添加命令输出结果；2. 通过配置不同优先级的偏好文件和配置文件，让项目在符合基础偏好设定的同时，可以根据项目特性自定义化；3. 通过配置更多的CLI工具，让增强模型的检索功能和能力边界（当然这一点严谨来说不算是通过增强感知环境能力）

# 5. 让 Claude Code 具备更加科学严谨的工作方式

> 本章节中，具体强调如何用软件工程开发中的思想，让模型在能==正确感知上下文==的前提下，开发出高质量、后续可维护、易维护的软件。

## 思想：TDD

让模型表现更好的一个==最有效==策略是校验输出，衡量产出的结果好与坏，是通过测试比较，并根据测试结果进行调整，直至一个好的输出状态，也就是软件工程中的测试驱动开发的思想。为了让Claude Code中集成这种工作模式，我们需要进行一些设定。

> 这里说的我们需要的设定，也包含了上述说的如何通过配置文件，让模型有一些通用的设定 这个技巧

如果我们要完成一个小任务，可以直接通过对话描述需求，让模型进行计划并执行。这时候，我们的输入就要体现 TDD，几个要点：
1. 具体的例子，给几个输入条件和期待的输出，让模型更好的验证
2. 详细的信息提供，给出我们对期待结果的详细描述，而不是：*我需要让页面更好看*
3. 提供验证的方法：告诉模型生成完成之后 运行 npm test -- --testPathPattern auth 验证所有认证测试通过

为了让模型能更稳定的执行测试步骤，设计一些技巧：
1. 对于通用的测试需求，可以通过 Claude.md 进行设定，比如告知测试文件夹位置，测试的命令是什么
2. 设计 Hooks 在模型输出完成后执行测试，防止模型遗忘
3. Skills 中告知最后一步需要测试


## 思想：探索 + 计划 + 编程

1. 先让模型只读文件，理解上下文，明白项目是怎么一回事
2. 让模型根据我们的需求，产出具体的计划文档
	1. 建议让第二个模型对计划文档进行检查
3. 根据计划，进行编码实现
	1. 这个过程可以通过 TDD，让模型先写测试代码，然后编写实现代码，最后进行测试校验
	2. ==先写测试代码，这一点很重要，否则会让错误的实现代码污染测试代码（测试代码主动迎合错误实现代码）==
4. 提交代码
	1. 可以直接自然语言描述
	2. 可以编写一个 skills，描述更加详细的指令步骤

> [!NOTE] 防止TDD幻觉
> 为了防止模型偷偷改测试代码，进行一下几点纠偏：
> 1. Claude.md 文档中，明确指出：严禁修改 \*.test.go / \*.test.ts 文件
> 2. 在 Permission 设置中，在 `.claude/settings.json` 中配置 `"deny": ["Write(*_test.go)", "Write(*.test.ts)"]`
> 3. Git 提交之前，通过 git --diff 校验

## 思想：SDD

**Spec-Driven-Development** : 规范驱动开发。
当我们的任务是一个大型项目，这时候，一般的通过对话输入我们的需求，会导致需求变得零散，不好维护、不好复盘，进一步导致对一个需求理解出错的纠偏变得困难，因为不知道从什么时候开始理解有问题的。

为了解决问题，采用SDD，将需求分析，软件设计、编码实现、测试校验、提交维护，这一完整流程的各个步骤，都采用md文档记录。*这也符合软件工程中强调的文档的重要性*

**第一步：协作编写需求 spec.md**

> 我想构建 [功能描述]。用采访模式对我进行详细提问，
> 帮我生成一份 spec.md，包含：用户故事、验收标准、边界情况。
> 不要写任何技术实现细节。

**第二步：设计文档生成 plan.md**

> @specs/001-feature/spec.md
> 基于这份需求规范，生成技术方案 plan.md。
> 技术栈约束：[TypeScript / React / PostgreSQL]
> 包含：目录结构、核心数据模型、接口定义、实施阶段。

**第三步：分解执行任务 tasks.md**

> @specs/001-feature/spec.md @specs/001-feature/plan.md
> 将技术方案分解为原子任务列表 tasks.md。
> 要求：每个任务只改一个文件，测试先行（奇数任务写测试，偶数任务写实现）。

**第四步：逐步执行**

> @specs/001-feature/tasks.md
> 执行任务 T001-T006。严格按 TDD 顺序：先写测试（必须失败），再写实现（使测试通过）。

## 良好的提示词

> 以下的提示词，并不是说和上面的思想直接配套使用的，而是针对于一个小问题、小文件、小模版的单独功能开发，bug调通，代码审查。
> 
> 如果想设计适配如 SDD 规范的提示词，可以参考结构，但是专注内容拆分上会有不同。
> 例如，在开始的需求分析中，一句话描述引用 + 具体的用户故事 + 提问式引导要求 + 生成 spec.md 文档
> 在任务执行文档的生成中，可以将模板中的约束部分，要求加到每一个任务中

**提示词的结构**

```
┌─────────────────────────────────────────────┐
│  1. 任务描述                                 │
│     做什么？（一句话清晰描述）                 │
├─────────────────────────────────────────────┤
│  2. 上下文                                   │
│     相关文件：@path/to/files                  │
│     参考模式：@path/to/example                │
│     背景信息：为什么要做这个                    │
├─────────────────────────────────────────────┤
│  3. 约束                                     │
│     不能做什么 / 必须满足什么                   │
│     "不引入新依赖"、"保持向后兼容"              │
├─────────────────────────────────────────────┤
│  4. 验证标准                                  │
│     怎么确认做对了？                           │
│     "运行 npm test"、"截图对比"               │
└─────────────────────────────────────────────┘
```

**功能开发模板**
```

实现 [功能描述]。

上下文：
- 相关文件：@path/to/relevant/files
- 参考已有模式：@path/to/similar/implementation

要求：
1. [具体要求 1]
2. [具体要求 2]
3. [具体要求 3]

验证：
- 运行 `npm test` 确保所有测试通过
- 运行 `npm run typecheck` 确保无类型错误

```

**Bug 修复模板**
```
修复 [问题描述]。

复现步骤：
1. [步骤 1]
2. [步骤 2]
3. [出现错误]

错误信息：
[粘贴完整错误信息或堆栈跟踪]

期望行为：[描述正确行为]

请：
1. 找到根因
2. 写一个能复现问题的失败测试
3. 修复问题
4. 确认测试通过
```

**代码审查模板**
```
审查 @path/to/file 的以下方面：
- 安全漏洞（注入、XSS、认证问题）
- 边界情况处理
- 性能问题
- 与项目现有模式的一致性

对每个问题给出：
1. 问题严重度（Critical / Warning / Suggestion）
2. 具体位置（文件名和行号）
3. 修复建议
```

## 项目需求的引导

`AskUserQuestion` 是 Claude Code 内置的一个交互工具。当 Claude 需要你做决策时，它会弹出**结构化的选择题界面**——不需要你打字组织语言，只需点击选项即可。

这个工具有时候会被自动调用，我们也可以选择手动要求，比如下述模板：
```text
我想构建 [简要描述]。用 AskUserQuestion 工具对我进行详细采访。

问我关于技术实现、UI/UX、边界情况、顾虑和权衡的问题。
不要问显而易见的问题，深入挖掘我可能没有考虑到的困难部分。

持续采访直到我们覆盖了所有方面，然后把完整的需求规格写入 SPEC.md。

==================
对于这个问题，我们还有哪些没有考虑到的？

使用 AskUserQuestion 工具，像苏格拉底一样帮助我，
无论是技术选型、潜在风险、需求对齐等等任何方向，
因为我是小白我什么都不懂，请帮助我理解。
```

# 6. 更加复杂但是有效的配置

## Claude.md 里放什么

每一次对话开始前，模型都会读取这个文件。我们应该在这个文件中放一些模型不好推断出来的信息，作为有效补充。

| 该写 ✅                | 不该写 ❌             |
| ------------------- | ----------------- |
| Claude 猜不到的 Bash 命令 | Claude 读代码就能知道的信息 |
| 与默认不同的代码风格规则        | 标准语言规范（Claude 已知） |
| 测试指令和首选测试框架         | 详细的 API 文档（链接即可）  |
| 仓库约定（分支命名、PR 格式）    | 频繁变化的信息           |
| 项目特有的架构决策           | 长篇教程或解释           |
| 开发环境怪癖（必需的环境变量）     | 逐文件的代码库描述         |
| 常见陷阱和非显而易见的行为       | "写干净的代码" 之类的废话    |
> 通过删减法，总结一份尽量的 Claude.md。对于每一行，考虑能否删除，删除掉会对模型有影响就别删
> **保持精简**：1. 省钱 2. 更容易让模型理解重点


## Claude.md 的生效优先级

[[#^489f20|完整配置文件及路径]]

|**权力等级**|**文件位置**|**覆盖逻辑**|**核心意义**|
|---|---|---|---|
|**1. 绝对统治级**|`/Library/.../CLAUDE.md` (企业级)|**不可覆盖**。无论你在本地怎么改，这一层永远生效。|**合规与安全**。公司定义的红线，个人无法逾越。|
|**2. 最高执行级**|`./CLAUDE.local.md` (项目个人级)|**可覆盖下方所有规则**。它是你个人的“特权文件”。|**本地适配**。解决“我这台电脑”与“团队环境”的差异。|
|**3. 核心准则级**|`./CLAUDE.md` 或 `.claude/rules/*.md` (项目团队级)|**覆盖下方全局规则**。团队共识，随 Git 共享。|**项目规范**。针对该项目特有的技术栈和开发习惯。|
|**4. 基础偏好级**|`~/.claude/CLAUDE.md` (用户全局级)|**基础底色**。在所有项目中都会加载。|**个人习惯**。你作为一个开发者跨项目的通用偏好。|
|**5. 记忆补丁级**|`.../memory/MEMORY.md` (自动记忆)|**最低优先级**。Claude 根据历史自动生成的总结。|**上下文延续**。防止 AI 忘记之前的对话重点。|
## Claude.md 的编写

**1. 通过YAML 的frontmatter 限定规则的作用路径**

```md
---
paths:
  - "src/api/**/*.ts"
  - "lib/**/*.ts"
  - "src/**/*.{ts,tsx}"       # brace expansion：同时匹配 .ts 和 .tsx
---
# 下面的规则指对上面paths的路径生效
# API 开发规范
- 所有 API 端点必须包含输入验证
- 使用标准错误响应格式
  
---
```

**2. 通过 @导入其他文件**

使用这种方式的时候，注意 token 的开销，因为会导入完整的文件，另外代码段中的 @不会生效

**3. 通过 文件链接的系统调用，实现文件复用**

- 在 ~/claude-share-rules 中存放共享的规则md，以供后续按需取
- 在项目文件路径的终端中，使用系统调用
- 链接完整目录
```
New-Item -ItemType SymbolicLink -Path ".claude/rules/shared" -Target "$HOME/claude-common-rules"
```
- 链接单独文件
```
New-Item -ItemType SymbolicLink -Path ".claude/rules/security.md" -Target "$HOME/claude-common-rules/security.md"
```

**通用项目Claude.md模板**
```
# 项目：[项目名]
[一句话描述]。技术栈：[列出关键技术]。

# 构建与测试（说明本项目中一些操作使用哪种指令）
- 安装：`pnpm install`
- 开发：`pnpm dev`
- 构建：`pnpm build`
- 测试全部：`pnpm test`
- 测试单个：`pnpm test -- path/to/test`
- 类型检查：`pnpm typecheck`
- Lint：`pnpm lint`

# 代码规范
- 使用 ES modules（import/export）
- 函数参数 >3 个时使用对象参数
- 错误处理使用 AppError 类（@src/lib/errors.ts）
- API 路径 kebab-case，JSON 属性 camelCase

# 架构
- 状态管理：Zustand（不是 Redux）
- ORM：Drizzle（不是 Prisma）
- API：tRPC

# 工作流
- **IMPORTANT**: 修改代码后运行 `pnpm typecheck`
- **NEVER**: 不要修改 migrations/ 下的已有文件
- 提交遵循 Conventional Commits

# 压缩指令
When compacting, preserve:
- 修改过的文件完整列表
- 测试命令和结果
- 未完成的任务
```


## 其他记忆系统

除了 Claude.md 能引入提示词的部分，CC还有两种记忆机制：
- 会话 Session 记忆
- AutoMemory 记忆

前者比较简单，就是在当前会话中保持的一个上下文记忆，基于内存的、临时的，关闭这次会话，就失去了记忆，下一次进入会话的时候，要重新从上下文中读取记忆。

AutoMemory 可以说是前者的精要总结版本，在  ~/.claude/projects/\<project>/memory/ 路径下，存放对于对话记忆的摘要，这个摘要会随着对话实时更新，存放的内容主要适合对话内容中的关键点；

==区别于Claude.md中主要存放的是规则==

> [!NOTE] Automemory 实践
> 
> 1. 通过 /memory 可以关闭自动更新memory文件，从而自己组织
> 2. 当任务的进行不按照我们的规则定义的方式时，可能是被老的 memory 影响
> 3. Memory.md的前200行会被重点关注，可以放重要内容，


## 配置权限

| 模式                | 含义         | 切换方式                                               |
| ----------------- | ---------- | -------------------------------------------------- |
| default           | 标准权限检查     | 默认                                                 |
| acceptEdits       | 自动接受文件编辑   | Shift+Tab                                          |
| plan              | 只读模式       | Shift+Tab / --permission-mode plan                 |
| dontAsk           | 自动拒绝未允许的工具 | CLI 参数                                             |
| bypassPermissions | 跳过所有检查     | --dangerously-skip-permissions（强烈建议仅在沙箱 / 隔离环境中使用） |
> Claude Code 创建文件，销毁文件在开启edits on模式下，就不需要用户授权，因为着这种操作是用户可以撤销的，但是涉及到一些敏感的cli命令调用，可能带来不可逆的影响。
> CC的策略：
> 1. 看配置 setting 文件，包含了 deny、ask、allow三种模式的列表。通过/permissions 指令也能看
> 2. deny 列表的命令会被直接拒绝；ask会询问；allow会直接执行
> 3. 结合前面所学，启动的命令行配置会覆盖 setting 配置

## CLI 使用

CLI 的本身不占用上下文，将命令输出的结果给到AI，进行观察推理思考。
我们也可以让模型学习如何使用CLI命令
```
用 'foo-cli-tool --help' 学习 foo 工具的用法，然后用它完成 A、B、C
```

> [!NOTE] 优先使用CLI工具，而不是MCP
> CLI 工具无常驻上下文成本，只在调用时产生输出。而 MCP 服务器的工具定义默认常驻占用上下文空间


## MCP

MCP 是拓展模型感知、改变外部世界能力地一种方式。没有 MCP，也可以通过自己开发 Tools，来适配对外部数据源的连接、数据获取、数据修改。但是通过 MCP的概念，转为让外部数据库，作为服务器端，主动提供可以访问、修改数据的工具。

对于使用 mcp 服务器的用户来说，mcp 就像是外部的资源、主动提供的工具、内置好的提示词模板。当我们通过对话，模型推断出使用 mcp提供的工具时，就按照工具的提示词模板，使用工具，服务器接收使用工具命令，获取结果返回。

## Hooks

区别于 Claude.md 中定义的偏好，需要依赖模型推断，可能是不会进行。Hooks 依赖于框架设置的拦截器。在不同的时机进行拦截，拦截后进行匹配，如果满足Hooks的触发条件，就执行Hooks对应定义的动作。

所有的 Hooks 时机（按需使用）

|事件|位置|触发时机|Matcher 过滤|典型用途|
|---|---|---|---|---|
|SessionStart|会话级|会话开始或恢复|startup/resume/clear/compact|注入上下文、初始化环境|
|UserPromptSubmit|会话级|提交提示词后|不支持 matcher|预处理或验证输入|
|PreToolUse|循环内|工具调用前（可阻止）|工具名：Bash、Edit\\|Write|阻止危险操作、权限校验|
|PermissionRequest|循环内|权限对话框出现时|工具名|自动批准 / 拒绝|
|PostToolUse|循环内|工具调用成功后|工具名|自动格式化、运行 lint|
|PostToolUseFailure|循环内|工具调用失败后|工具名|错误日志、告警|
|SubagentStart|循环内|子代理启动时|Agent 类型名|建立连接、准备环境|
|SubagentStop|循环内|子代理完成时|Agent 类型名|清理连接、收集结果|
|TaskCompleted|循环内|任务标记完成时|不支持 matcher|验证完成度|
|Stop|会话级|Claude 完成响应（可阻止）|不支持 matcher|验证任务、强制继续|
|TeammateIdle|会话级|Agent Team 成员即将空闲|不支持 matcher|分配新任务|
|PreCompact|会话级|上下文压缩前|manual/auto|注入必须保留的上下文|
|SessionEnd|会话级|会话终止时|clear/logout/other|清理资源|
|Notification|异步|需要用户注意时|通知类型|桌面通知|
|ConfigChange|异步|配置文件变更时|配置来源|热重载|
|WorktreeCreate|Setup|创建 worktree 时|不支持 matcher|替换默认 git 行为|
|WorktreeRemove|Teardown|移除 worktree 时|不支持 matcher|清理 worktree|

Hooks 被触发时，如果内部定义动作的执行出错，会产出一个退出码，这个退出码的含义与 Hooks 定义的拦截实际相关。对于在模型想要执行动作之前的拦截 Hooks，如果退出码为2，就会退出之后的操作；如果是对已执行结果的校验失败，还是会继续往下执行，CC 的动作就只是打印退出err信息

| 退出码 | 行为                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0   | 操作继续。stdout 可注入上下文（仅 exit 0 时解析 JSON 输出）                                                                                      |
| 2   | 阻止操作（仅限可阻止事件：PreToolUse、UserPromptSubmit、Stop 等）。stderr 作为反馈发送给 Claude。对于不可阻止事件（PostToolUse、Notification 等），exit 2 仅显示 stderr |
| 其他  | 操作继续。stderr 记入日志                                                                                                              |
> **一个使用的技巧**：定义一个创建或者编辑文件工具被调用后 （PostToolUse）的 Hooks，用于格式化文件，稳定代码的格式质量。
> 配合之前安装的 jq cli 工具使用

## Skill

Skill 中定义的是一套工作流，用于处理某种场景中的任务。通常包含了处理任务的完整流程，每一个步骤需要使用的命令行，或者调用的工具。

从能发挥的效果来说，Skill和Command是一样的，现在统一使用Skill，Command只为了兼容老版本而存在了。两个都是工作流的定义，不过 Skill 是声明式的，Skill.md 文件开头元数据，可以定义描述信息，这段==描述信息会被存放到context中==，模型执行任务前，检查这些信息，判断自己是不是要使用skill。
> 声明式的定义：用户只要声明这个Skill即可，模型自己判断要不要用

Command 是命令式的，用户需要通过 /【command名】来主动调用，当然 skill 也支持这样。

> 在元信息中设置：disable-model-invocation: true，skill就不会在context中，模型也不会自动调用。适用于只能让用户自己调用的skill

> [!NOTE] 内置的 skills
> ## /simplify
> 并行代码审查。调用后，会创建三个并行工作的 subagent。**在有一定量的代码变更后使用**
> 
> |审查代理|关注点|典型发现|
|---|---|---|
|code reuse|重复代码、可提取的公共逻辑|"这三个文件有相似的错误处理，可提取为 handleApiError() 工具函数"|
|code quality|代码规范、可读性、潜在 bug|"变量命名不一致：userId vs user_id；缺少边界检查"|
|efficiency|性能问题、不必要的计算|"循环内重复查询数据库，可移到循环外批量获取"|
> 
> ## /batch
> 大规模代码迁移。调用后，会把涉及到大规模代码变动的任务进行拆分，使用的工作流大致为：
>```
> ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. 研究     │ →  │  2. 执行     │ →  │  3. 追踪     │
│  分析代码库  │    │  并行处理    │    │  汇总结果    │
│  生成任务列表│    │  每个任务独立│    │  状态看板    │
│  人工审批    │    │  独立 PR     │    │  失败重试    │
└─────────────┘    └─────────────┘    └─────────────┘
>```
> 使用大量简单的重复的工作，比如只涉及到没有协作逻辑的组件替换（把console改为log）...



## Sub Agent

为什么需要子代理？
	专人办专事，将一件任务进行拆分，每一个细化的任务，交给该任务的领域中专家执行。**不会污染上下文、工具的配置更加细化，避免冗余工具、专门为领域角色设计提示词**

子代理的配置文件：`./claude/agents/` 下的 `md` 文件。关键的元信息配置项如下：
```
---
name: db-reader
description: 执行只读数据库查询
tools: Bash                        # 可用工具
model: haiku                       # 控制成本
permissionMode: dontAsk            # 自动拒绝未允许的工具
maxTurns: 10                       # 限制最大轮次
memory: user                       # 启用跨会话持久记忆
background: true                   # 在后台运行
isolation: worktree                # 在独立 worktree 中工作
---
```

Claude Code 有一些内置的子代理

| 子代理             | 默认模型      | 用途                |
| --------------- | --------- | ----------------- |
| Explore         | Haiku（快速） | 只读代码搜索和分析         |
| Plan            | 继承        | Plan Mode 下的代码库研究 |
| general-purpose | 继承        | 复杂多步骤任务           |
| Bash            | 继承        | 独立上下文中执行命令        |

# 7. 其他有用的建议

1. 当我们要处理一个新的任务时，**选择 /clear**，或者开一个新的会话。不要污染原来的上下文
   
2. **Claude.md 不易过长**，一是token开销，而是使用效果
   
3. 接触一个已经有较大规模的项目，想要快速上手时，通过 /config 设置 **output style 为 learning**，可以让模型的回答更有引导教学性
   
4. 当Claude Code在处理长时间开销任务时，想要临时进行对话，可以**使用 /btw**，缺点时无法使用工具，优点是不阻塞、能看到上下文
   
5. 如果想要并发处理 Git 仓库中多个分支的任务，不建议每一次任务处理一半，stash checkout，而是**使用 git 的 worktree 机制**，从一个仓库迁出多个分支到不同文件夹下，每一个文件夹中开一个 claude。
   对应的 claude 启动命令：`claude --worktree [branch_name]` ,会在当前根路径中的 .claude/worktree 中，创建一个分支的文件夹。在分支文件夹中，git环境就是branch_name分支，在主文件路径中，git环境就是main分支
   
6. 解决一个问题时，两三轮对话都没正确满足要求，建议通过 **/rewind 回溯对话**，防止污染上下文
   
7. 每一次犯错后，都可以考虑**更新 Claude.md**
   
8. 所有Claude Code 的产出，**都需要经过验证**，或通过脚本，或通过执行效果。

9. 上下文管理：**最好是手动管理**，通过 /compact 【压缩要求】，这样压缩后的上下文，尽可能保留需要的信息，更加个性化

10. 根据任务拆分文档，或者手动输入任务提示词时，**限制每次完成一个任务**，并进行测试校验。这是为了过程更可控。

# 下一步探索

Github 深度集成 Claude Code