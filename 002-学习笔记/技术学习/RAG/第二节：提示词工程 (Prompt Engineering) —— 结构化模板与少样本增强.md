---
created: 2026-02-13
modified: 2026-02-13
---

---

## 1. 核心概念与技术思想

提示词工程的核心思想是将**指令逻辑（Static Instruction）与业务数据（Dynamic Data）解耦**。

- **技术目的**：解决硬编码字符串难以维护的问题，实现 Prompt 的复用、角色隔离以及自动化渲染。
    
- **核心方法**：利用 LangChain 提供的 `PromptTemplate` 与 `ChatPromptTemplate` 进行变量注入，利用 `FewShotPromptTemplate` 进行上下文示例引导。
    
- **设计思想**：**模板模式 (Template Pattern)**。将不变的 Prompt 框架定义在模板中，运行时动态填充用户数据，保持后端逻辑的整洁。
    

---

## 2. 技术实现原理：八股深度拆解

### 2.1 三大核心模板组件

- **PromptTemplate (普通模板)**：
    
    - **原理**：基于 Python 的 `str.format` 机制，将字符串中的 `{variable}` 替换为实际值。主要用于简单文本补全模型。
        
- **ChatPromptTemplate (对话模板)**：
    
    - **原理**：管理消息对象序列。它允许定义 `System`、`Human`、`AI` 等不同角色的消息模板。渲染后生成 `List[BaseMessage]`。
        
- **FewShotPromptTemplate (少样本模板)**：
    
    - **原理**：利用 Transformer 的 **In-Context Learning (ICL)**。通过预先提供几组“输入-输出”示例，改变模型的注意力权重，使其在不微调的情况下学会特定任务或输出格式。
        

### 2.2 消息占位符：MessagesPlaceholder

- **定义**：一个特殊的占位符，用于在模板中预留位置以插入**不确定数量**的消息对象。
    
- **原理**：它映射到一个变量名，该变量必须传入 `List[BaseMessage]`。在渲染时，占位符会被平铺（Flatten）进消息序列中。
    
- **场景**：构建多轮对话系统时，用于动态注入 `chat_history`（历史对话记录）。
    

### 2.3 Few-Shot 的底层逻辑

- **前缀 (Prefix)**：指令引导语，告诉模型任务背景。
    
- **示例 (Examples)**：具体的样本对。
    
- **后缀 (Suffix)**：当前用户的问题入口。
    
- **设计思想**：通过示例强制模型建立“模式匹配”。在后端，这比写长篇累牍的规则描述更有效。
    

---

## 3. 核心参数详解

- **input_variables**：模板中定义的变量名列表，渲染时需一一对应。
    
- **partial_variables**：预填充变量。适用于某些变量在初始化阶段已知，无需等到运行时传入。
    
- **example_prompt**：定义 Few-Shot 中每一个示例的展现格式（如：`Human: {input} \n AI: {output}`）。
    
- **examples**：存放 Few-Shot 样本的原始数据，通常为 `list[dict]`。
    

---

## 4. 深度代码示例

### 4.1 基础 ChatPromptTemplate 变量注入

演示最常用的角色隔离与变量动态渲染。


```python
from langchain_core.prompts import ChatPromptTemplate

# 1. 定义模板结构
# 角色通过元组定义：(role, content_template)
template = ChatPromptTemplate.from_messages([
    ("system", "你是一个专业的{language}翻译官，擅长将技术文档翻译得通俗易懂。"),
    ("human", "请翻译这段内容：{text}")
])

# 2. 渲染模板
# 内存流转：Dict -> 变量替换 -> List[SystemMessage, HumanMessage]
messages = template.format_messages(
    language="英文",
    text="分布式系统的共识算法是系统稳定性的核心。"
)

# 打印查看渲染后的消息对象
for msg in messages:
    print(f"角色: {msg.type}, 内容: {msg.content}")
```

### 4.2 MessagesPlaceholder 动态历史注入

这是实现多轮对话后端逻辑的必考点。


```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

# 定义带占位符的模板
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个资深架构师，请基于历史对话回答问题。"),
    # 占位符 variable_name 必须与后续传入的 Key 一致
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}")
])

# 模拟运行时从 Redis 或数据库读取的历史对话列表
history_data = [
    HumanMessage(content="我正在设计一个高并发限流方案。"),
    AIMessage(content="建议考虑令牌桶或漏桶算法，具体取决于业务对突发流量的容忍度。")
]

# 渲染：history_data 将被平铺插入到中间位置
final_prompt = prompt.format_messages(
    chat_history=history_data,
    input="这两种算法在 Redis 中如何实现比较好？"
)
```

### 4.3 FewShotChatMessagePromptTemplate 少样本实操

详细展示如何通过示例强制模型按特定格式输出。


```python
from langchain_core.prompts import (
    ChatPromptTemplate,
    FewShotChatMessagePromptTemplate
)

# 1. 准备示例数据集 (通常存放在 JSON 文件或配置中心)
examples = [
    {"input": "订单支付失败", "output": "【支付类-高优先级】"},
    {"input": "怎么修改密码", "output": "【账户类-低优先级】"},
    {"input": "APP闪退", "output": "【技术类-中优先级】"}
]

# 2. 定义单组示例的呈现格式 (example_prompt)
example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}")
])

# 3. 构造少样本逻辑组件
few_shot_template = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples
)

# 4. 组装最终业务模板
# 注意：在对话模板中，不需要专门指定 prefix/suffix 参数
# 列表的顺序天然决定了前缀示例和后缀问题
final_template = ChatPromptTemplate.from_messages([
    ("system", "你是一个工单自动分类器，请严格模仿示例的格式进行分类。"),
    few_shot_template,
    ("human", "{input}")
])

# 5. 执行渲染
formatted_msgs = final_template.format_messages(input="无法收到短信验证码")
```

---

