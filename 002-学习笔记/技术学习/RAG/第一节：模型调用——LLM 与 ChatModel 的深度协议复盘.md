---
created: 2026-02-13
modified: 2026-02-13
---
## 1. 核心概念与技术思想

本节的核心思想是**通信协议的标准化适配**。

- **技术目的**：掌握如何通过 LangChain 统一接口屏蔽底层厂商（OpenAI, 通义千问, Llama等）API 协议的差异。
    
- **核心方法**：通过 `Runnable` 接口实现的 `invoke`（同步）、`ainvoke`（异步）和 `stream`（流式）方法进行通信。
    
- **设计思想**：**适配器模式 (Adapter Pattern)**。将各家厂商返回的原始 JSON 响应封装为标准化的类对象 `BaseMessage`，使后端业务逻辑与具体模型供应商解耦。
    

## 2. 技术实现原理：八股深度拆解

### 2.1 LLM 与 ChatModel 的协议区别

面试中常问两者的底层逻辑差异，这决定了数据如何封装。

- **LLM (Large Language Model)**：
    
    - **协议层**：Text-in, Text-out。
        
    - **实现原理**：基于字符序列的概率预测（Next Token Prediction），不具备原生的角色（Role）感知能力。
        
- **ChatModel (对话模型)**：
    
    - **协议层**：Messages-in, Message-out。
        
    - **实现原理**：将对话结构化为消息列表。这是目前主流 RAG 和 Agent 的核心，因为它能通过角色标识区分指令（System）、用户意图（Human）和模型回复（AI）。
        

### 2.2 消息对象 (BaseMessage) 的内存状态

模型调用的输入不再是简单的字符串，而是消息类对象的集合。

- **SystemMessage**：设定模型的人设、回复准则及约束。在注意力机制中占据全局权重的起始点。
    
- **HumanMessage**：代表最终用户的输入内容。
    
- **AIMessage**：模型生成的回复。除 `content` 外，还包含 `response_metadata`，记录了 Token 消耗和停止原因（finish_reason）。
    
- **AIMessageChunk**：流式调用时的特有对象。支持 `+` 运算符重载，允许在内存中进行片段累加。
    

## 3. 核心参数详解

初始化模型时，参数的选择直接影响后端业务的稳定性与成本。

- **model**：指定模型版本（如 qwen-max）。
    
- **temperature (温度)**：控制采样概率分布。$T=0$ 时模型倾向于选最高概率的词，结果确定；$T>1$ 时分布变平坦，结果更具创意。后端业务通常建议 $T \le 0.3$。
    
- **max_tokens**：强制限制生成长度。防止模型陷入逻辑死循环或输出过长导致响应超时及费用失控。
    
- **streaming**：布尔值。决定是否支持分片传输，是实现“打字机”前端效果的前提。
    

## 4. 深度代码示例

### 4.1 非流式同步调用 (Invoke)

适用于后台批处理或短文本生成，逻辑简单但首字延迟高。



```python
import os
from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import HumanMessage, SystemMessage

# 初始化模型适配器
# 1. model: 使用通义千问旗舰版
# 2. temperature: 设为 0.1 保证后端输出的稳定性
# 3. dashscope_api_key: 建议存放在环境变量中
model = ChatTongyi(
    model="qwen-max",
    temperature=0.1,
    max_tokens=500,
    dashscope_api_key=os.getenv("DASHSCOPE_API_KEY")
)

# 构造结构化消息输入列表 (Input Schema)
messages = [
    SystemMessage(content="你是一个专业的后端架构师，擅长分布式系统设计。"),
    HumanMessage(content="请简述微服务架构中，为什么建议使用数据库每服务（Database per Service）模式？")
]

# 执行同步调用
# 内存流转：List[BaseMessage] -> JSON Payload -> HTTP POST -> AIMessage Object
response = model.invoke(messages)

# 获取核心数据字段
print(f"返回文本内容: {response.content}")
print(f"Token使用详情: {response.response_metadata['usage']}")
```

### 4.2 流式调用 (Stream) 与 Chunk 累加实现

这是对接前端 SSE（Server-Sent Events）的关键。


```python
# 原理：model.stream 返回一个 Python Generator
# 每次迭代产生一个 AIMessageChunk 对象

full_response = ""
print("AI 响应中：", end="")
for chunk in model.stream("请用 Python 写一个支持高并发的生产者消费者模式代码"):
    # chunk.content 包含当前时刻产生的增量字符串
    print(chunk.content, end="", flush=True)
    
    # 后端逻辑中通过重载的 + 号进行对象累加
    full_response += chunk.content

print("\n响应完整结束。")
```

### 4.3 异步并行调用 (Ainvoke)

在异步框架（如 FastAPI）中，必须使用异步接口以释放事件循环。


```python
import asyncio

async def async_model_call():
    # 异步非阻塞调用，提升系统并发吞吐量
    response = await model.ainvoke([
        HumanMessage(content="解释一下 Redis 的多路复用模型")
    ])
    print(f"异步返回: {response.content}")

# 运行异步任务
# asyncio.run(async_model_call())
```

