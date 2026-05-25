---
created: 2026-02-13
modified: 2026-02-13
---
# 第五节：长期与短期记忆 (Memory) —— 状态管理的持久化

## 1. 核心概念与技术思想

本节的核心思想是在无状态的 LLM 调用中，通过外部存储维护对话状态。

- **技术目的**：让模型能够记住之前的对话内容，实现多轮连续交互。
    
- **核心方法**：将历史消息对象（`List[BaseMessage]`）序列化存储，并在新一轮请求时通过 `MessagesPlaceholder` 注入提示词模板。
    
- **设计思想**：状态机与备忘录模式 (Memento Pattern)。
    

## 2. 技术实现原理：八股深度拆解

### 2.1 对话上下文的生命周期

- **读取 (Load)**：在执行链开始前，根据 `session_id` 从 Redis/数据库加载历史消息。
    
- **注入 (Inject)**：将历史消息插入 Prompt，传递给模型。
    
- **响应 (Response)**：模型基于当前问题及历史背景生成回答。
    
- **回写 (Save)**：将本次 `HumanMessage` 和 `AIMessage` 追加到持久化存储中。
    

### 2.2 存储方案的演进

- **短期记忆 (ChatMessageHistory)**：存储在内存中的 List。由于进程重启即消失，仅适用于本地测试。
    
- **持久化记忆 (SQLChatMessageHistory / RedisChatMessageHistory)**：
    
    - **原理**：利用唯一标识 `session_id` 隔离不同用户的对话栈。
        
    - **八股考量**：在高并发场景下，需注意存储介质的读写 IO 瓶颈及 Token 窗口溢出问题。
        

## 3. 核心参数详解

- **session_id**：核心键值。区分不同用户或对话窗口的唯一标识。
    
- **connection_string**：数据库连接地址（如 `sqlite:///memory.db`）。
    
- **k (针对窗口记忆)**：指定保留最近的几轮对话，用于控制 Token 消耗。
    

## 4. 深度代码示例

### 4.1 SQL 记忆持久化实战


```python
from langchain_community.chat_message_histories import SQLChatMessageHistory

# 1. 初始化存储对象
# session_id: 核心键值，用于在数据库表中隔离特定用户的对话
# connection_string: 数据库连接地址，决定持久化位置
history = SQLChatMessageHistory(
    session_id="user_id_10086",
    connection_string="sqlite:///chat_history.db"
)

# 2. 读取当前对话历史
# history.messages 返回一个 List[BaseMessage]
print(f"当前历史记录: {history.messages}")

# 3. 手动模拟消息回写 (后端常在 Chain 执行后自动调用)
# add_user_message 封装了 HumanMessage 的创建与持久化逻辑
history.add_user_message("我叫张三，我想咨询架构方案")
# add_ai_message 封装了 AIMessage 的持久化逻辑
history.add_ai_message("你好张三，请问你想了解哪方面的架构？")

# 4. 再次读取验证
print(f"更新后的历史数: {len(history.messages)}")
```

### 4.2 记忆系统与 Chain 的完整组合


```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.chat_models import ChatTongyi
from langchain_core.runnables.history import RunnableWithMessageHistory

# 定义带占位符的模板
# MessagesPlaceholder: 对应核心方法中的“注入”逻辑，变量名需与 history_messages_key 对应
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个记性很好的助手。"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

chain = prompt | ChatTongyi(model="qwen-max")

# 使用封装类管理记忆流转
# lambda session_id: 对应生命周期中的“读取”步骤
chain_with_history = RunnableWithMessageHistory(
    chain,
    lambda session_id: SQLChatMessageHistory(
        session_id=session_id, 
        connection_string="sqlite:///chat_history.db"
    ),
    input_messages_key="input",
    history_messages_key="history"
)

# 调用时通过 config 传入 session_id，体现“状态机”设计思想
result = chain_with_history.invoke(
    {"input": "我刚才说我叫什么？"},
    config={"configurable": {"session_id": "user_id_10086"}}
)
print(result.content)
```

---

# 第六节：加载器 (Loader) 与分割器 (Splitter) —— 数据治理 ETL

## 1. 核心概念与技术思想

本节的核心思想是非结构化数据的标准化处理。

- **技术目的**：将多样化的文件（PDF, CSV, URL）转换为模型可读取的 `Document` 对象。
    
- **核心方法**：通过 `Loader` 提取文本，通过 `Splitter` 将长文切分为可控的片段（Chunks）。
    
- **设计思想**：数据转换管道 (ETL Pipeline)。
    

## 2. 技术实现原理：八股深度拆解

### 2.1 递归分治分割逻辑 (RecursiveCharacterTextSplitter)

- **语义完整性**：简单切分会导致一句话被截断，丢失上下文。
    
- **递归逻辑**：先尝试按 `\n\n` (段落) 切分；切不动再试 `\n` (句子)；再试 (空格)。
    
- **Overlap (重叠度)**：相邻 Chunk 之间保留一定比例的重叠，目的是确保跨分片的语义不丢失。
    

## 3. 深度代码示例

### 3.1 文本加载与递归切分实战


```python
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 1. 加载非结构化文档 (Loader)
# 技术目的实现：将外部 PDF 转换为 Document 列表
loader = PyPDFLoader("distributed_systems.pdf")
raw_documents = loader.load()

# 2. 初始化切分器 (Splitter)
# chunk_size: 控制每个分片的物理上限
# chunk_overlap: 实现“重叠度”，保证语义连续性
# separators: 体现“递归逻辑”，从段落到空格逐级尝试
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", " ", ""] 
)

# 3. 执行切分 (核心方法)
# 内存状态变化：1个大 Document 对象 -> N个小 Document 片段
documents = text_splitter.split_documents(raw_documents)

print(f"切分后的片段数量: {len(documents)}")
print(f"第一个片段内容预览: {documents[0].page_content[:100]}")
```

---

# 第七节：RAG (检索增强生成) —— 工业级知识库架构

## 1. 核心概念与技术思想

本节的核心思想是解耦知识与推理。

- **技术目的**：解决 LLM 训练数据滞后、领域知识缺失及幻觉问题。
    
- **核心思想**：开卷考试模式。让模型根据检索到的参考资料生成回答。
    

## 2. 技术实现原理：八股深度拆解

### 2.1 RAG 全链路步骤

- **清洗阶段**：通过 `Loader` 和 `Splitter` 准备标准化 Chunk。
    
- **索引阶段**：Embedding 模型将 Chunk 向量化并存入 Vector Store。
    
- **检索阶段**：将用户 Query 向量化，从库中检索 Top-K 相关的 Document。
    
- **增强阶段**：将检索出的 Document 拼接成上下文，填充进 Prompt 模板。
    
- **生成阶段**：模型基于上下文输出回答。
    

## 3. 深度代码示例

### 3.1 工业级 RAG 链条完整实现


```python
from langchain_community.chat_models import ChatTongyi
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# 1. 索引阶段环境准备 (涉及“索引阶段”概念)
embeddings = DashScopeEmbeddings(model="text-embedding-v2")
# 假设 db_index 已由上一节的 documents 构建
vectorstore = FAISS.load_local("db_index", embeddings, allow_dangerous_deserialization=True)
# retriever: 封装了“检索阶段”的 Top-K 逻辑 (k=3)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# 2. 增强阶段：定义 RAG 提示词模板 (涉及“增强阶段”概念)
# {context} 是 RAG 的核心槽位，用于注入检索到的背景
template = """你是一个专业的客服助手，请仅根据以下提供的背景信息回答问题。
背景信息：
{context}

用户问题：{question}

回答要求：若背景信息不足以回答，请告知无法回答，不要编造。
"""
prompt = ChatPromptTemplate.from_template(template)

# 3. 构造 LCEL 管道 (体现“全链路步骤”的整合)
# RunnablePassthrough: 透传问题到模板变量 {question}
# retriever: 自动根据问题执行检索并填充到 {context}
rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | ChatTongyi(model="qwen-max")
    | StrOutputParser()
)

# 4. 执行生成阶段
ans = rag_chain.invoke("如何申请售后退款？")
print(ans)
```
