---
title: SmolAgent 框架
created: 2025-07-28 18:19
modified: 2025-07-29 14:57
tags: [技术学习, AI, Agent]
subject: AI Agent
---
# 目录

- **_smolagents 简介_**
- **_使用 smolagents的原因 & 场景_**
- **_使用 smolagents的相关代码_**

# smolagents 简介

`smolagents` 是 `huggin face` 上的一个库，支持对于AI代理智能体的快速构建，支持：

- 快速构建工具函数（通过提供的`tool`装饰器）
- 可以自己配置能被智能体安全导入使用的 `python` 模块
- 支持代码执行和工具调用两种模式
- 支持上传 `hugging face` 自己构建的智能体，也可以直接导入别人制作的智能体
- 具备视觉能力和网络浏览能力的集成

# 使用smolagents的原因 & 场景

### smolagents 的关键优势

- **简洁性：** 最小的代码复杂性和抽象层，使==框架易于理解==、采用和扩展。
- **灵活的 LLM 支持：** 通过与 Hugging Face 工具和外部 API 的集成，==支持任何 LLM==。
- **代码优先方法：** 首选支持直接在代码中编写操作的 ==Code Agents==，无需解析并简化工具调用。
- **HF Hub 集成：** 与 Hugging Face Hub 无缝集成，允许使用 Gradio Spaces 作为工具。

### 何时使用 smolagents？

考虑到这些优势，我们应该在什么情况下选择 smolagents 而不是其他框架？

smolagents 在以下情况下是最理想的：

- 需要一个 **轻量级且最小化的解决方案**。
- 希望 **快速实验** 而无需复杂的配置。
- 的应用逻辑 **相对简单**。

# 使用smolagents的相关代码

### _配置`HF`环境和`smolagents`_

```
pip install huggingface_hub
pip install smolagents -U
```

> 值得注意的是安装框架对于python的版本有要求

### _运行代码智能体的方法_

```python
from smolagents import CodeAgent, DuckDuckGoSearchTool, InferenceClientModel

agent = CodeAgent(tools=[DuckDuckGoSearchTool()], model=InferenceClientModel())

agent.run("Search for the best music recommendations for a party at the Wayne's mansion.")
```

- 使用 **`CodeAgent`** 指定智能体的执行模式为代码执行
- 通过 `tools=[DuckDuckGoSearchTool()]` 配置工具，这里使用的是库中提供的网络搜索工具
- 通过 `model=InferenceClientModel()` 配置模型，这里使用的是推理模型，默认是`"Qwen/Qwen2.5-Coder-32B-Instruct"`
- `agent.run(prompt)` 内部通过框架设置系统提示词，可以清楚地看到每一步动作地执行以及最终地成果

### _配置能安全导入的模块_

```python
from smolagents import CodeAgent, InferenceClientModel
import numpy as np
import time
import datetime

agent = CodeAgent(tools=[], model=InferenceClientModel(), additional_authorized_imports=['datetime'])

agent.run(
    """
    Alfred needs to prepare for the party. Here are the tasks:
    1. Prepare the drinks - 30 minutes
    2. Decorate the mansion - 60 minutes
    3. Set up the menu - 45 minutes
    4. Prepare the music and playlist - 45 minutes

    If we start right now, at what time will the party be ready?
    """
)
```

- `additional_authorized_imports=['datetime'])` 将python中的datetime模块设置为安全使用的模块

>**中文解读：**  
  代码执行环境**有严格的安全策略**，默认只允许一部分“预定义的安全模块”导入，其他模块（即使是标准库）都可能被**禁止导入**。
🚫 例如：`os`, `sys`, `subprocess` 等会被限制。  
✅ 安全模块如 `math`, `random`，可能默认开放。


### 使用工具调用智能体

```python
from smolagents import ToolCallingAgent, DuckDuckGoSearchTool, InferenceClientModel

agent = ToolCallingAgent(tools=[DuckDuckGoSearchTool()], model=InferenceClientModel())

agent.run("Search for the best music recommendations for a party at the Wayne's mansion.")
```

>`ToolCallingAgent` 使用工具调用的智能体

### 工具

正如我们在[第一单元](https://huggingface.co/learn/agents-course/unit1/tools)所探讨的，智能体通过工具执行各类操作。在`smolagents`框架中，工具被视为 **LLM 可以在智能体系统中调用的函数**。

要使LLM能够调用工具，需要为其提供包含以下关键要素的**接口描述**：

- **名称**：工具的标识名称
- **工具描述**：工具的功能说明
- **输入类型及描述**：工具接受的参数说明
- **输出类型**：工具的返回结果类型

以韦恩庄园筹备派对为例，Alfred 需要多种工具来收集信息——从搜索餐饮服务到寻找派对主题创意。以下是一个简单搜索工具的接口示例：

- **名称:** `web_search`
- **工具描述:** 根据特定查询进行网络搜索
- **输入:** `query` (字符串) - 需要查找的搜索关键词
- **输出:** 包含搜索结果的字符串

通过使用这些工具，Alfred 能够做出明智决策并收集派对筹备所需的所有信息。

下方动画展示了工具调用的管理流程：

![来自 https://huggingface.co/docs/smolagents/conceptual_guides/react 的智能体流程](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/Agent_ManimCE.gif)

#### 工具创建方法

在`smolagents`中，可以通过两种方式定义工具：

1. **使用`@tool`装饰器**创建基于函数的简单工具
2. **创建`Tool`的子类**实现复杂功能

**@tool 装饰器**

`@tool`装饰器是**定义简单工具的推荐方式**。在底层，smolagents 会从 Python 函数解析基本信息。因此，清晰的函数命名和规范的文档字符串（docstring）能让 LLM 更易理解工具用途。

使用此方法时，我们需要定义包含以下要素的函数：

- **明确描述性的函数名称**：帮助LLM理解其用途
- **输入输出的类型提示**：确保正确使用
- **详细描述**：包含明确描述各参数的`Args:`部分，这些描述为 LLM 提供关键上下文信息

**假设我们有一个获取最高评分餐饮服务的函数**
```python
def catering_service_tool(query: str) -> str:
    """
    This tool returns the highest-rated catering service in Gotham City.
    
    Args:
        query: A search term for finding catering services.
    """
   # 示例餐饮服务及评分列表
    services = {
        "Gotham Catering Co.": 4.9,
        "Wayne Manor Catering": 4.8,
        "Gotham City Events": 4.7,
    }
    
    # 查找评分最高的餐饮服务（模拟搜索查询过滤）
    best_service = max(services, key=services.get)
    
    return best_service


agent = CodeAgent(tools=[catering_service_tool], model=InferenceClientModel())
```

**运行智能体寻找最佳餐饮服务**
``` python
result = agent.run(
    "Can you give me the name of the highest-rated catering service in Gotham City?"
)

print(result)   # Output: Gotham Catering Co.
```

**通过Python类定义工具**

此方法需要创建[`Tool`](https://huggingface.co/docs/smolagents/v1.8.1/en/reference/tools#smolagents.Tool)的子类。对于复杂工具，我们可以通过类封装函数及其元数据来帮助 LLM 理解使用方式。在类中需要定义：

- `name`: 工具名称
- `description`: 用于构建智能体系统提示的描述
- `inputs`: 包含`type`和`description`的字典，帮助Python解释器处理输入
- `output_type`: 指定期望的输出类型
- `forward`: 包含执行逻辑的方法

以下是通过`Tool`类构建工具并与`CodeAgent`集成的示例：

```
from smolagents import Tool, CodeAgent, InferenceClientModel

class SuperheroPartyThemeTool(Tool):
    name = "superhero_party_theme_generator"
    description = """
    This tool suggests creative superhero-themed party ideas based on a category.
    It returns a unique party theme idea."""
    
    inputs = {
        "category": {
            "type": "string",
            "description": "The type of superhero party (e.g., 'classic heroes', 'villain masquerade', 'futuristic Gotham').",
        }
    }
    
    output_type = "string"

    def forward(self, category: str):
        themes = {
            "classic heroes": "Justice League Gala: Guests come dressed as their favorite DC heroes with themed cocktails like 'The Kryptonite Punch'.",
            "villain masquerade": "Gotham Rogues' Ball: A mysterious masquerade where guests dress as classic Batman villains.",
            "futuristic Gotham": "Neo-Gotham Night: A cyberpunk-style party inspired by Batman Beyond, with neon decorations and futuristic gadgets."
        }
        
        return themes.get(category.lower(), "Themed party idea not found. Try 'classic heroes', 'villain masquerade', or 'futuristic Gotham'.")
```

#### 实例化工具
``` python
party_theme_tool = SuperheroPartyThemeTool()
agent = CodeAgent(tools=[party_theme_tool], model=InferenceClientModel())
```

`smolagents` 自带一组预构建工具，可直接注入到您的智能体中。[默认工具箱](https://huggingface.co/docs/smolagents/guided_tour?build-a-tool=Decorate+a+function+with+%40tool#default-toolbox) 包含:

- **PythonInterpreterTool**
- **FinalAnswerTool**
- **UserInputTool**
- **DuckDuckGoSearchTool**
- **GoogleSearchTool**
- **VisitWebpageTool**

Alfred 可以使用多种工具来确保韦恩庄园的完美派对:

- 首先，他可以使用 `DuckDuckGoSearchTool` 搜索创意超级英雄主题派对灵感
    
- 对于餐饮，他依赖 `GoogleSearchTool` 查找哥谭市评分最高的服务
    
- 要管理座位安排，Alfred 可以通过 `PythonInterpreterTool` 运行计算
    
- 收集完所有信息后，他使用 `FinalAnswerTool` 整合计划



### 智能体驱动的RAG检索系统

相比于原始的RAG系统，智能体驱动的RAG系统可以进行智能的检索，可以自己决定查询知识库的步骤和次数

- **检索网页**
```python
from smolagents import CodeAgent, DuckDuckGoSearchTool, InferenceClientModel

# 初始化搜索工具
search_tool = DuckDuckGoSearchTool()

# 初始化模型
model = InferenceClientModel()

agent = CodeAgent(
    model=model,
    tools=[search_tool]
)

# 使用示例
response = agent.run(
    "Search for luxury superhero-themed party ideas, including decorations, entertainment, and catering."
)
print(response)
```

- **自定义知识库工具**
``` python
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from smolagents import Tool
from langchain_community.retrievers import BM25Retriever
from smolagents import CodeAgent, InferenceClientModel

class PartyPlanningRetrieverTool(Tool):
    name = "party_planning_retriever"
    description = "Uses semantic search to retrieve relevant party planning ideas for Alfred’s superhero-themed party at Wayne Manor."
    inputs = {
        "query": {
            "type": "string",
            "description": "The query to perform. This should be a query related to party planning or superhero themes.",
        }
    }
    output_type = "string"

    def __init__(self, docs, **kwargs):
        super().__init__(**kwargs)
        self.retriever = BM25Retriever.from_documents(
            docs, k=5  # 检索前 5 个文档
        )

    def forward(self, query: str) -> str:
        assert isinstance(query, str), "Your search query must be a string"

        docs = self.retriever.invoke(
            query,
        )
        return "\nRetrieved ideas:\n" + "".join(
            [
                f"\n\n===== Idea {str(i)} =====\n" + doc.page_content
                for i, doc in enumerate(docs)
            ]
        )

# 模拟派对策划知识库
party_ideas = [
    {"text": "A superhero-themed masquerade ball with luxury decor, including gold accents and velvet curtains.", "source": "Party Ideas 1"},
    {"text": "Hire a professional DJ who can play themed music for superheroes like Batman and Wonder Woman.", "source": "Entertainment Ideas"},
    {"text": "For catering, serve dishes named after superheroes, like 'The Hulk's Green Smoothie' and 'Iron Man's Power Steak.'", "source": "Catering Ideas"},
    {"text": "Decorate with iconic superhero logos and projections of Gotham and other superhero cities around the venue.", "source": "Decoration Ideas"},
    {"text": "Interactive experiences with VR where guests can engage in superhero simulations or compete in themed games.", "source": "Entertainment Ideas"}
]

source_docs = [
    Document(page_content=doc["text"], metadata={"source": doc["source"]})
    for doc in party_ideas
]

# 分割文档以提高搜索效率
    text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    add_start_index=True,
    strip_whitespace=True,
    separators=["\n\n", "\n", ".", " ", ""],
)
docs_processed = text_splitter.split_documents(source_docs)

# 创建检索工具
party_planning_retriever = PartyPlanningRetrieverTool(docs_processed)

# 初始化智能体
agent = CodeAgent(tools=[party_planning_retriever], model=InferenceClientModel())

# 使用示例
response = agent.run(
    "Find ideas for a luxury superhero-themed party, including entertainment, catering, and decoration options."
)

print(response)
```
>用了传统的 **关键词匹配式检索** —— 即 `BM25Retriever`。这是一种**基于词频和逆文档频率（TF-IDF + BM25算法）** 的检索方式