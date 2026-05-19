---
created: 2026-04-26
modified: 2026-04-26
---


# Model I/O

不管我们的目的是什么，对于LLM来说，也一定就是输入-思考-输出，思考这部分不受我们的控制。那怎么让输入和输出更加的智能，就是 Model IO 模块的设计作用。

## LCEL (LangChain Expression Language)

在langchain架构中，**Model I/O 所有的组件，都继承自 Runnable 类**，包括提示词Prompt，聊天模型chatModel，解析器parse。这样的好处是可以通过 `|` 运算符进行组件的连接，得到一个 IO 流处理管道，每一个结点都是输入到输出的过程。都通过 `invoke` 方法，得到本结点的输出，也作为下一节点的输入。

这种通过 `|` 管道连接运算符，就是**LCEL的核心**。

## Prompt

1. 简单的模板 `PromptTemplate`
2. 适用于ChatModel的带有聊天记录的模板 `ChatPromptTemplate`
3. Few-shot思想的 `FewShotPromptTemplate`
4. 通过 `MessagePlaceholder` 让历史记录好组织

```python
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import PromptTemplate
from langchain_core.messages import HumanMessage

model = ChatTongyi(model="qwen-plus")
model.invoke([HumanMessage(content="Hello, how are you?")])
```

> [!note] 模块作用说明
> 1. `langchain_community.chat_models` 社区中集成的聊天模型
> 2. `langchain_core`: LangChain中包含的核心模块，比如本阶段的ModelIO，包含了Message，Prompt，Parser等等

### 提示词改造示例

```python
# 首先是提示词的改造
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate, MessagesPlaceholder

# 定义一个系统提示词
prompt_template = PromptTemplate.from_template("你是一个{field}专家")
print(prompt_template.format(field="医疗"))  # 打印出 "你是一个医疗专家"

final_prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a {field} expert."),
    ("human", "What is the best way to learn {field}?")
])
print(final_prompt_template.format(field="medicine"))  # "You are a medicine expert. What is the best way to learn medicine?"

# Few-shot 示例
example_prompt = PromptTemplate.from_template("反义词：{word} -> {antonym}")
example = [
    {"word": "happy", "antonym": "sad"},
    {"word": "hot", "antonym": "cold"},
]
few_shot_prompt_template = FewShotPromptTemplate(
    examples=example,
    example_prompt=example_prompt,
    prefix="请根据以下例子，给出{word}的反义词",
    suffix="{word}的反义词是什么？",
    input_variables=["word"]
)
print(few_shot_prompt_template.format(word="happy"))

# 不同返回类型的对比
invoke_result = prompt_template.invoke({"field": "medicine"})
print(type(invoke_result))               # langchain_core.prompt_values.StringPromptValue
print(type(invoke_result.to_string()))   # str
print(type(invoke_result.to_messages())) # list，可以给模型直接使用

# 链式调用（注释部分）
# chain = few_shot_prompt_template | model
# result = chain.invoke({"word": "happy"})
# print(result.content)

# 组合使用示例
chat_template = ChatPromptTemplate.from_messages([
    ("system", "{instructions}"),
    ("human", "{input}")
])

instruction_template = PromptTemplate.from_template("你是一个{field}专家")

input_template = FewShotPromptTemplate(
    example_prompt=example_prompt,
    examples=example,
    prefix="请根据以下例子，给出{word}的反义词",
    suffix="{word}的反义词是什么？",
    input_variables=["word"]
)

final_prompt_template = chat_template.partial(instructions=instruction_template.format(field="语言学"))
print(final_prompt_template.invoke(input=input_template.format(word="happy")).to_string())
```

> [!tip] 提示词构建要点
> 这些内容都是有关输入提示词的快速构建，有时候，我们需要对输出进行限制，确保模型按照我们想要的格式来回答。

## Parser

Parser 有两方面的作用：
- **指令注入**：让AI知道应该以什么内容输出content中的字符串
- **结果解析**：将上述的字符串转为python对象

### 常用的 Parser

| Parser | 作用 | 特点 |
|--------|------|------|
| `StrOutputParser` | 过滤出输出结果的content内容 | 得到字符串 |
| `JsonOutputParser` | 将 content 结果转为字典 | 需要先让模型知道输出json字符串 |
| `PydanticOutputParser` | 与 JsonOutputParser 类似 | 严格根据 Pydantic 模型进行类型校验，不符合定义的字段会抛出异常 |

> 其他的还有解析为列表，或者枚举类型等等

```python
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

class Person(BaseModel):
    name: str = Field(description="The person's name")
    age: int = Field(description="The person's age")

json_output_parser = JsonOutputParser(pydantic_object=Person)

prompt_with_output_parser = ChatPromptTemplate.from_messages([
    ("system", "你是一个信息格式化专家{parser_description}"),
    ("human", "我的年龄是{age}，名字是{name}，请帮我把这些信息格式化成JSON")
])

prompt_with_output_parser = prompt_with_output_parser.partial(parser_description=json_output_parser.get_format_instructions())
chain = prompt_with_output_parser | model | json_output_parser
result = chain.invoke({"name": "Alice", "age": 30})
print(result)
```

# Data Connection

> 在让模型的输入输出更加智能、方便之后，我们来给模型定制一个数据库。

对于单纯的LLM或者chatModel而言，其能力受限于训练数据。当训练数据时效性不强，或者在某一领域不够精通，微调是一种方案，不过太麻烦。我们能想到的简单方法是，让用户输入的提示词中，携带这些信息。但是这个过程肯定不能手动输入，LangChain就提供了**数据连接 Data Connection** 模块，用来连接数据库，经典的应用是 `RAG`。

## RAG

RAG 涉及到5个步骤：
1. **加载**：把数据内容读取到内存中
2. **切块**：把数据分片
3. **向量化（Embedding）**：把文本数据转为计算机能认识，能检索、能计算的数据
4. **存储**：把向量化后的数据进行存储
5. **检索**：根据用户的数据，在数据库中进行匹配，找到最相关的内容，放到提示词中。

### 1. 加载

数据的来源有多种，网页，文档。LangChain 的思想是统一构建为 Document 对象。

结构示意：
```
Document = (
    page_content: str,
    metadata: dict
)
```

```bash
pip install -U beautifulsoup4 lxml requests
```

```python
from langchain_community.document_loaders import WebBaseLoader

loader = WebBaseLoader("https://lilianweng.github.io/posts/2023-06-23-agent/")
docs = loader.load()  # 得到一个 Document对象的列表，每个Document对象包含了网页的内容和元数据

print(len(docs))      # 打印出加载的文档数量
print(docs[0].page_content[:50])  # 打印第一个文档的前50个字符
```

### 2. 分割

对于IO来说，一次写入太多的数据，一是时间长，二是不方便后续的检索。LangChain 提供了文本分割器。

**RecursiveCharacterTextSplitter 参数解释**：
- `chunk_size`: 每一个文本块的大小
- `chunk_overlap`: 相邻文本块的重叠文本大小
- `separators`: 切割符号，按照列表中的顺序选择，直到分割出来的文本大小满足chunk_size的要求
- `add_start_index`: 在chunk的元数据中，加一项文本在原来文档中的索引

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=100,
    chunk_overlap=20,
    separators=["\n\n", "\n", " ", ""],
    add_start_index=True  # 记录每个chunk在原始文本中的起始位置
)

# chunks = text_splitter.split_documents(docs)
# print(len(chunks))
# sample_chunk = chunks[1]
# print("-" * 30)
# print(f"块内容示例：\n{sample_chunk.page_content[:200]}...")
# print(f"块元数据示例：\n{sample_chunk.metadata}")

# 字符串分割示例
string_splitter = RecursiveCharacterTextSplitter(
    chunk_size=10,
    chunk_overlap=5,
    separators=["\n\n", "\n", " ", ""],
    add_start_index=True
)
example_string = "This is an example string to be split into chunks."
string_chunks = string_splitter.split_text(example_string)
print(string_chunks)
```

### 3. 向量化

计算机无法理解人类语言的文本，需要将文本转为数字列表。

```python
from langchain_community.embeddings import DashScopeEmbeddings

embedding_model = DashScopeEmbeddings()

text = "武汉大学"
query_result = embedding_model.embed_query(text)

print(f"查询向量维度：{len(query_result)}")
print(f"查询向量示例：{query_result[:5]}...")
```

### 4. 存储 & 检索

```bash
pip install chromadb langchain langchain-community langchain-core
```

```python
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_community.vectorstores import Chroma

loader = WebBaseLoader("https://lilianweng.github.io/posts/2023-06-23-agent/")
docs = loader.load()

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=100,
    chunk_overlap=20,
    separators=["\n\n", "\n", " ", ""],
    add_start_index=True
)

chunks = text_splitter.split_documents(docs)
embeddings = DashScopeEmbeddings()

vector_store = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings
)

# 封装成一个检索器
retriever = vector_store.as_retriever(search_kwargs={"k": 3})
```

### 完整 RAG 链示例

```python
from pydantic import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.chat_models import ChatTongyi

class AnswerSchema(BaseModel):
    answer: str = Field(description="The answer to the question"),
    key_words: list[str] = Field(description="The key words related to the answer")
    source_segments: list[str] = Field(description="The source text segments that support the answer")

parser = JsonOutputParser(pydantic_object=AnswerSchema)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "你是一个严谨的 AI 专家。请仅根据提供的上下文（Context）来回答问题。如果你不知道，就说不知道。\n{format_instructions}"),
    ("user", "问题：{question}\n上下文：{context}")
])

partial_prompt = prompt_template.partial(format_instructions=parser.get_format_instructions())

model = ChatTongyi(model="qwen-plus")

from langchain_core.runnables import RunnablePassthrough

# 辅助函数：把检索到的多个文档块拼接成一整段话
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# 构建最终的 LCEL 链条
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | partial_prompt
    | model
    | parser
)

# 运行
question = "什么是智能体（Agent）的记忆系统（Memory）？"
result = rag_chain.invoke(question)

import json
print(json.dumps(result, indent=2, ensure_ascii=False))
```

> [!info] LCEL 中的 RunnablePassthrough
> 因为最后提示词的构建，依赖于 context（从retriever中得到）和 question（用户输入）。借助 `RunnablePassthrough()` 旁路，直接传递 question，而 context 是从检索器检索得到的结果，传入格式化函数后的结果。

### 检索器

检索是 RAG 中很重要的一部分，直接决定了在相同的知识库下，检索到的知识是否有实质性作用。

#### 检索器类型

**1. 基础检索**

通过 `vector_store.as_retriever(**kwargs)` 构建。可以传入参数，控制行为：
- `search_type`: `"similarity"` | `"mmr"` | `"similarities_score_threshold"`
- `search_kwargs`: `{"k": n}` 数量指定 | `{"score_threshold": 0.7}` 阈值分数

> [!tip] MMR算法
> MMR 是最大边际效应检索算法，除了检索相似度最高的，还会故意找一些有差异的内容，防止因为文档中反复出现匹配内容，导致检索出来内容冗余。

**2. 多查询检索**

有时候，用户提问的内容意思是对的，但是表述和知识库中的知识有点差异，貌离神合，也会导致检索效果不好。针对这种情况，多查询检索通过让模型根据用户输入，产生一些相同含义的不同表达，用这些不同表达来检索知识库。

```python
from langchain_core.retrievers import MultiQueryRetriever

retriever1 = vector_store.as_retriever(search_type="mmr", search_kwargs={"k": 3})
advanced_retriever = MultiQueryRetriever.from_llm(
    retriever=retriever1,
    llm=model
)

print(advanced_retriever.invoke("什么是智能体的记忆系统？"))
```

**3. 集成检索**

虽然基于文本向量化后的相似度计算大部分时候很有用，但不可避免的，在某些场景下，通过关键词检索效果会更好。通过集成检索，可以设置不同检索器的权重，从而一起使用。

```python
from langchain_core.retrievers import BM25Retriever, EnsembleRetriever

# 1. 初始化一个关键词检索器（像传统搜索引擎一样工作）
keyword_retriever = BM25Retriever.from_documents(chunks)
keyword_retriever.k = 2

# 2. 初始化一个向量检索器（语义搜索）
vector_retriever = vector_store.as_retriever(search_kwargs={"k": 2})

# 3. 组合它们：权重各占 0.5
ensemble_retriever = EnsembleRetriever(
    retrievers=[keyword_retriever, vector_retriever],
    weights=[0.5, 0.5]
)
```

# Chains 链式编排

在复杂的应用中，单次的对话往往并不足够，需要进行：
1. **多轮对话执行**：先摘要，再翻译，再根据摘要写评论
2. **分支选择执行**：如果询问技术问题，走技术链路，如果询问...
3. **并行执行**：同时提问，选择最好的回答

> LCEL 就是实现链式编排的语法工具

## LCEL 的四大函数

| 函数 | 作用 | 说明 |
|------|------|------|
| `RunnablePassthrough` | 透传 | 把输入原封不动转为输出，或者在传输的过程中加一些新字段 |
| `RunnableParallel` | 并行 | 将输入分到多个处理流程中，得到多个输出 |
| `RunnableLambda` | 自定义 | 自定义输入到输出的变换 |
| `RunnableBranch` | 分支 | 将输入通过分支变换为输出 |

```python
from langchain_core.runnables import RunnablePassthrough, RunnableParallel, RunnableLambda, RunnableBranch

# RunnablePassthrough 示例
runnable_passthrough = RunnablePassthrough()
print(runnable_passthrough.invoke("original value"))

# RunnableParallel 示例（必须用 RunnableParallel 包装）
runnable_parallel = RunnableParallel({
    "add_field": lambda x: x + " with added value",
    "original_field": RunnablePassthrough()
})
result = runnable_parallel.invoke("original value")
print(result)

# RunnableLambda 示例
upper = RunnableLambda(lambda x: x.upper())
result = upper.invoke("hello world")
print(result)

# RunnableBranch 示例
branch = RunnableBranch(
    (lambda x: "positive" if "good" in x else "negative"),
    {
        "positive": lambda x: f"Positive branch processed: {x}",
        "negative": lambda x: f"Negative branch processed: {x}"
    }
)
```

## 完整链式编排实例

```python
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import ChatPromptTemplate, FewShotPromptTemplate, PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables import RunnablePassthrough, RunnableParallel, RunnableLambda, RunnableBranch
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from pydantic import BaseModel, Field

model = ChatTongyi(model="qwen-plus")
parser = StrOutputParser()

# 语言识别 Few-shot
lang_prompt_example = PromptTemplate.from_template("识别以下文字的语言：{content}， 输出{language}\n")
example = [
    {"content": "Hello, how are you?", "language": "English"},
    {"content": "你好，你怎么样？", "language": "Chinese"},
    {"content": "Bonjour, comment ça va?", "language": "French"},
]
lang_few_prompt = FewShotPromptTemplate(
    example_prompt=lang_prompt_example,
    examples=example,
    prefix="请根据以下例子，完成识别文本语言的任务",
    suffix="识别以下语言{user_content}",
    input_variables=["user_content"]
)

# 情感分析 Few-shot
sentiment_prompt = PromptTemplate.from_template("判断以下文本的情感倾向：{content}， 输出{sentiment}\n")
example_sentiment = [
    {"content": "I love this product!", "sentiment": "positive"},
    {"content": "This is the worst experience ever.", "sentiment": "negative"},
    {"content": "It's okay, not great but not bad.", "sentiment": "neutral"},
]
sentiment_few_prompt = FewShotPromptTemplate(
    example_prompt=sentiment_prompt,
    examples=example_sentiment,
    prefix="请根据以下例子，完成判断文本情感倾向的任务",
    suffix="判断以下文本的情感倾向：{user_content}",
    input_variables=["user_content"]
)

# 构建两个独立的链
lang_chain = lang_few_prompt | model | parser
sentiment_chain = sentiment_few_prompt | model | parser

# 回复模板
crisis_template = ChatPromptTemplate.from_template("请对邮件内容表达出的消极情绪进行回复，邮件内容{email}\n")
crisis_chain = crisis_template | model | parser
standard_template = ChatPromptTemplate.from_template("请对邮件内容进行回复，邮件内容{email}\n")
standard_chain = standard_template | model | parser

# 并行分析步骤
analysis_step = RunnableParallel({
    "language": lang_chain,
    "sentiment": sentiment_chain,
    "email": RunnablePassthrough()
})

# 分支函数
def branch_func(inputs):
    if inputs["sentiment"] == "negative":
        return crisis_chain
    else:
        return standard_chain

final_chain = analysis_step | RunnableLambda(branch_func)

email = "I am really disappointed with the service I received. The product broke after one day and customer support was unhelpful."
result = final_chain.invoke({"email": email, "user_content": email})

print("Final result:")
print(result)
```

# Memory

对于大模型来说，是鱼的记忆，每一次对话，都相当于是从零开始。这是因为对于模型的架构本身，是一个 seq 到 seq 的神经网络，没有记忆系统。

**为什么我们网页上和LLM进行聊天对话的时候，可以记住上下文呢？** 这是因为客户端在发送新一轮消息的时候，会默默把历史的记录进行拼接。

LangChain 的 Memory 模块，就是一个用来自动化的完成这个**打包、存储、再次发送**的过程。

## 核心记忆类型对比

| 记忆类型 | 记录风格 | 核心逻辑 | 优点 | 缺点 | 适用场景 |
|:---|:---|:---|:---|:---|:---|
| **ConversationBufferMemory** | 全记录 | 一字不落。将所有的历史对话原封不动地存放在上下文窗口中。 | **最准确**。AI能够回溯到对话开始时的每一个细节，逻辑连贯性最强。 | **Token爆炸**。随着对话增加，消耗的Token呈线性增长。既昂贵又容易触发模型长度限制。 | 短平快的咨询、对信息准确度要求极高的精密对话。 |
| **ConversationTokenBufferMemory** | 限额记录 | 只记最近。通过设置`max_token_limit`，超过限制时自动丢弃最早的记录。 | **成本可控**。保证永远不会超过设定的Token限制，对话可以无限期进行。 | **丢失远期记忆**。一旦对话过长，AI就会彻底"忘记"最开始聊过的内容。 | 长期持续的服务机器人、需要严格控制API预算的生产环境。 |
| **ConversationSummaryMemory** | 摘要记录 | 总结陈词。每轮对话后，AI自动对之前的对话内容进行概括压缩。 | **节省空间**。大幅减少Token消耗。 | **丢失细节**。摘要会过滤掉具体的数字、日期、专有名词等。 | 故事创作、长线背景任务、用户画像分析等关注大轮廓的场景。 |

## 基础记忆示例：ConversationBufferMemory

```python
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory  # 基于内存的全量历史记录

model = ChatTongyi(model="qwen-plus")
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个有用的助手。"),
    MessagesPlaceholder(variable_name="history"),  # 历史记录占位符
    ("human", "请根据以上对话历史，回答我的问题：{question}")
])

chain = prompt | model

store = {}

def get_history_from_memory(session_id):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

chat_with_memory = RunnableWithMessageHistory(
    runnable=chain,
    get_session_history=get_history_from_memory,
    input_messages_key="question",
    history_messages_key="history"
)

config = {"configurable": {"session_id": "user_123"}}

result = chat_with_memory.invoke({"question": "我叫张三"}, config=config)
print(result.content)

result = chat_with_memory.invoke({"question": "你能记住我的名字吗？"}, config=config)
print(result.content)
```

> [!tip] 自动化优势
> 选用附带所有的历史消息，这种配置方式并不需要我们手动管理所有的历史记录的添加，也就是上面说的自动化的优势。但是在实际的流程中，我们会需要更加灵活和复杂的配置逻辑，这也决定了我们需要手动写代码，把历史消息存入日记本，让模型进行 summary。

## 高级记忆示例：带摘要的记忆管理

```python
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables import RunnableWithMessageHistory, RunnableLambda

llm = ChatTongyi(model="qwen-plus")
parser = StrOutputParser()

store: dict[str, ChatMessageHistory] = {}
summary_store: dict[str, str] = {}
MAX_HISTORY_LENGTH = 5

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

def maybe_summarize(session_id: str) -> None:
    history_obj = get_session_history(session_id)
    messages = history_obj.messages
    if len(messages) <= MAX_HISTORY_LENGTH * 2:
        return

    old_messages = messages[:-MAX_HISTORY_LENGTH * 2]
    recent_messages = messages[-MAX_HISTORY_LENGTH * 2:]
    existing_summary = summary_store.get(session_id, "无")
    old_text = "\n".join(
        f"{'用户' if m.type == 'human' else 'AI'}: {m.content}"
        for m in old_messages
    )
    result = llm.invoke(
        f"请将以下对话压缩为简洁摘要，保留关键信息。\n\n"
        f"已有摘要:\n{existing_summary}\n\n"
        f"新增对话:\n{old_text}\n\n"
        f"更新后的摘要（直接输出）:"
    )
    summary_store[session_id] = result.content
    history_obj.clear()
    for msg in recent_messages:
        history_obj.add_message(msg)

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个有记忆能力的助手。\n\n对话历史摘要（较早的对话）:\n{summary}"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

chain = prompt | llm | parser

def make_inject_summary(session_id: str):
    def _inject(inputs: dict) -> dict:
        return {
            **inputs,
            "summary": summary_store.get(session_id, "暂无历史摘要"),
        }
    return RunnableLambda(_inject)

def chat(session_id: str, user_input: str) -> str:
    maybe_summarize(session_id)
    chain_with_history = RunnableWithMessageHistory(
        make_inject_summary(session_id) | chain,
        get_session_history,
        input_messages_key="input",
        history_messages_key="history",
    )
    return chain_with_history.invoke(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}},
    )

# 测试代码
if __name__ == "__main__":
    sid = "user_001"
    turns = [
        "我叫小明，我喜欢打篮球。",
        "我最近在学 Python，主要用 LangChain 做项目。",
        "我住在上海，喜欢吃火锅。",
        "我的猫叫豆豆，是一只橘猫。",
        "你还记得我叫什么名字吗？",
        "我的猫叫什么？",
        "我在学什么框架？",
    ]
    for user_msg in turns:
        print(f"用户: {user_msg}")
        print(f"AI  : {chat(sid, user_msg)}")
        print(f"摘要: {summary_store.get(sid, '无')[:80]}")
        print("─" * 50)
```

# Agent

对于我们自己定义的 chain 执行链，是一条写死的路径，只要路径没有说做什么，就一定不会做。问题随之而来——人不可能穷尽所有的问题，也不能每次碰到问题都重新编写 chain。

一个伟大的想法：**让 LLM 自己决定下一步如何执行，我们只需要提供执行的权限和工具**。

## Agent 的三个核心组件

1. **LLM**：模型，作为决策的大脑，判断下一步应该执行什么操作，使用什么工具
2. **Tool**：工具，作为 Agent 的能力支撑，工具定义的功能边界就是 Agent 的能力边界
3. **Tool Executor**：工具执行者，LLM 本身不具备调用工具的能力，只作为一个想法产生器

## ReAct 框架

Agent 的一个常用框架是 **ReAct（Reason + Action）**：思考+行动。它把一个任务交给 LLM，进行若干轮次的：
- **思考**：应该做什么
- **行动**：使用什么工具，传入什么参数
- **观察**：根据工具得到的结果，进行下一步思考

这个过程持续到思考时认为得到最终结果。

在 LangChain 中，可以通过 `@tool` 装饰器，装饰任意一个函数，把它变为工具。

## 一、定义工具

```python
from langchain.tools import tool

@tool
def add(a: int, b: int) -> int:
    """返回两个整数的和"""
    return a + b

@tool
def subtract(a: int, b: int) -> int:
    """返回两个整数的差"""
    return a - b

tools = [add, subtract]
tool_map = {t.name: t for t in tools}
```

> [!warning] 函数注解的重要性
> 函数中的注解非常重要，它是 LLM 进行思考的凭据——分析何时使用，如何使用（传入什么参数），如何进行下一步（根据返回内容）。

## 二、创建 Agent（方式一：传统提示词方式）

```bash
pip install langchainhub
```

```python
from langchain_classic.agents import AgentExecutor, create_structured_chat_agent
from langchain_community.chat_models import ChatTongyi
from langchain_core.prompts import PromptTemplate

llm = ChatTongyi(model="qwen-turbo")

prompt = PromptTemplate.from_template("""Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format strictly:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action, MUST be a valid JSON object, for example: {{"a": 1, "b": 2}}
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Important: Action Input must always be a valid JSON object with double quotes around keys.

Begin!

Question: {input}
Thought:{agent_scratchpad}""")

agent = create_structured_chat_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True  # 遇到解析错误时继续执行
)

agent_executor.invoke({"input": "请计算 5 + 3 - 2 的结果"})
```

> [!caution] 提示词方式的局限性
> 上述代码理论可行，但是实际上可能会因为模型不按照提示词的要求输出，导致解析错误。更加稳妥的方案是通过绑定工具实现。

## 三、创建 Agent（方式二：工具绑定方式 - 推荐）

```python
from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import ToolMessage, HumanMessage
from langchain.tools import tool

llm = ChatTongyi(model="qwen-plus")
llm_with_tools = llm.bind_tools(tools)

def run_agent(user_input: str):
    messages = [HumanMessage(content=user_input)]

    while True:
        response = llm_with_tools.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            print("最终答案：", response.content)
            return response.content

        for tool_call in response.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]

            try:
                tool_result = tool_map[tool_name].invoke(tool_args)
                is_error = False
            except Exception as e:
                print(f"调用工具时出错: {tool_name}({tool_args}) - {e}")
                tool_result = f"Error: {e}"
                is_error = True

            print(f"调用工具: {tool_name}({tool_args}) = {tool_result}")

            messages.append(ToolMessage(
                content=str(tool_result),
                tool_call_id=tool_call["id"],
                status="error" if is_error else "success"
            ))
```

## 四、带参数校验的工具示例

```python
from pydantic import BaseModel, Field

class EmailPayloadBody(BaseModel):
    email: str = Field(description="接收者的邮箱地址")
    subject: str = Field(description="邮件的主题")
    body: str = Field(description="邮件的内容正文")

@tool
def get_user_email(user_name: str) -> str:
    """获取用户的邮箱地址"""
    db = {
        "hf": "123456@example.com"
    }
    return db.get(user_name, "")

@tool(args_schema=EmailPayloadBody)
def send_email(email: str, subject: str, body: str) -> str:
    """发送邮件的工具函数"""
    print(f"发送邮件到 {email}，主题：{subject}，内容：{body}")
    return "邮件发送成功"

agent_llm = ChatTongyi(model="qwen-turbo")
agent_tools = [get_user_email, send_email]
agent_tool_map = {t.name: t for t in agent_tools}
max_round = 5

def agent_with_more_robustness(user_input: str):
    messages = [
        ("system", "你是一个有用的助手。"),
        ("human", user_input)
    ]

    agent_llm_with_tools = agent_llm.bind_tools(agent_tools)

    for i in range(max_round):
        response = agent_llm_with_tools.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            print("最终答案：", response.content)
            return response.content
        else:
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]

                try:
                    tool_result = agent_tool_map[tool_name].invoke(tool_args)
                    is_error = False
                except Exception as e:
                    print(f"调用工具时出错: {tool_name}({tool_args}) - {e}")
                    tool_result = f"Error: {e}"
                    is_error = True

                print(f"调用工具: {tool_name}({tool_args}) = {tool_result}")

                messages.append(ToolMessage(
                    content=str(tool_result),
                    tool_call_id=tool_call["id"],
                    status="error" if is_error else "success"
                ))
    print("达到最大交互轮数，停止执行。")

# 测试
agent_with_more_robustness("帮我给hf发封邮件，告诉他我的名字是张三")
```

## 其他 Agent 框架

上述是 ReAct 模式下的 Agent，还有一些别的框架：

| 框架 | 核心思想 | 特点 |
|------|----------|------|
| **Tool Calling** | 模型直接输出工具调用的指令 | 省略了中间的思考文本，更简洁高效 |
| **Plan-and-Execute** | 计划执行，在任务最开始先写完整的步骤流程 | 不容易把最初的任务跑偏 |
| **LangGraph** | 状态机模式，把每一步看作结点，用边连接成网络 | 支持循环、分支、甚至人工干预 |
```