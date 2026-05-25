---
title: Agent 智能体
created: 2025-07-23
modified: 2025-12-29
tags: [技术学习, AI, Agent]
subject: AI Agent
---
> *使用的令牌：hf_REDACTED*
> READ类型：hf_REDACTED


# 目录

-  _**[[#什么是智能体|理解智能体]]**_
	- 什么是智能体，它是如何工作的
	- 智能体如何使用推理（Reasoning）和规划（Planning）做出决策
-  _**[[#什么是大语言模型？|大语言模型（LLMs）在智能体中的角色]]**_
	- LLMs如何成为智能体的大脑
	- LLMs如何通过消息系统构建对话
-  _**[[#什么是工具|工具和行动]]**_
	- 智能体如何使用外部工具和环境交互
	- 如何为智能体构建和集成工具
-  _**智能体工作流程**_
	- $思考（Think）\rightarrow 行动（Act）\rightarrow 观察（Observe）$


# 什么是智能体

## 引入

如果我点了一杯咖啡，咖啡师会接收到一条制作咖啡的命令从而产出咖啡，这个产出过程可以被进一步分解
1. 理解所需咖啡的种类和额外信息
2. 进入厨房
3. 使用工具制作咖啡
4. 把产出的咖啡给我
而上述的这一系列流程就类似智能体的工作流。LLMs就是咖啡师， _LLMs_ 理解自然语言后，可以通过 **推理**得出一系列任务的流程，并且明确所需的**工具**，并按照流程，使用工具，完成任务

## 定义

>*智能体是一个系统，利用人工智能模型来完成和环境的交互，以实现用户设定的目标。它结合推理、规划和动作的执行（通常借助外部工具）来完成任务*

可以将智能体看作两个部分

1. **大脑（AI 模型）**
	这是所有的思考的地方，AI模型通过自然语言理解，进行推理和规划，执行完成任务所要执行的行动流
2. **身体（能力和可以使用的工具）**
	这部分代表智能体所能做的一切
	可能行动的范围取决于智能体配备了什么工具

**智能体的能力层次**
	根据上述定义，智能体的能力可以看作一个连续的谱系

| 智能体等级 | 描述                 | 常见称谓   | 示例模式                                           |
| ----- | ------------------ | ------ | ---------------------------------------------- |
| ☆☆☆   | 智能体输出不影响程序流程       | 简单处理器  | `processllmoutput(llmresponse)`                |
| ★☆☆   | 智能体输出决定基本控制流       | 路由     | `if llmdecision(): patha() else: pathb()`      |
| ★★☆   | 智能体输出决定函数调用        | 函数调用者  | `runfunction(llmchosentool, llmchosenargs)`    |
| ★★★   | 智能体输出控制迭代及程序延续     | 多步智能体  | `while llmshouldcontinue(): executenextstep()` |
| ★★★   | 一个智能体流程可启动另一个智能体流程 | 多智能体系统 | `if llmtrigger(): executeagent()`              |

## 测验
### 问题1：什么是智能体？

智能体是一个完整的系统，通过人工智能模型和环境进行交互，完成用户设定的任务。

### 问题2：规划在智能体中的作用是什么？

 用于记忆过往交互记录 确定行动序列并选择满足用户请求的适用工具

### 问题3：工具如何增强智能体的能力？

工具赋予智能体执行文本生成模型原生无法实现操作的能力，例如冲咖啡或生成图像

### 问题4：行动与工具有何区别？

 行动是智能体采取的步骤，工具是智能体用于执行这些行动的外部资源

### 问题5：大语言模型（LLMs）在智能体中扮演什么角色？

作为智能体推理'大脑'，通过处理文本输入理解指令并规划行动

### 问题6：以下哪个例子最能体现 AI 智能体？

类似 Siri 或 Alexa 的虚拟助手，能够理解语音指令、进行推理并执行设置提醒或发送消息等任务

---
# 什么是大语言模型（LLMs）

## 什么是大语言模型？

大语言模型 (LLM) 是一种擅长理解和生成人类语言的人工智能模型。它们通过大量文本数据的训练，能够学习语言中的模式、结构，甚至细微差别。这些模型通常包含数千万甚至更多的参数。

如今，大多数大语言模型都是基于 Transformer 架构构建的 —— 这是一种基于“注意力”算法的深度学习架构。自 2018 年 Google 推出 BERT 以来，这种架构引起了广泛关注。![[Pasted image 20250723195852.jpg]]
Transformer 有三种类型：

1. **编码器（Encoders）**  
    基于编码器的 Transformer 接收文本（或其他数据）作为输入，并输出该文本的密集表示（或嵌入）。
    
    - **示例**：Google 的 BERT
    - **用例**：文本分类、语义搜索、命名实体识别
    - **典型规模**：数百万个参数
2. **解码器（Decoders）**  
    基于解码器的 Transformer 专注于**逐个生成新令牌以完成序列**。
    
    - **示例**：Meta 的 Llama
    - **用例**：文本生成、聊天机器人、代码生成
    - **典型规模**：数十亿（按美国用法，即 10^9）个参数
3. **序列到序列（编码器-解码器，Seq2Seq（Encoder–Decoder））**  
    序列到序列的 Transformer _结合_了编码器和解码器。编码器首先将输入序列处理成上下文表示，然后解码器生成输出序列。
    
    - **示例**：T5、BART
    - **用例**：翻译、摘要、改写
    - **典型规模**：数百万个参数

虽然大语言模型 (LLMs) 有多种形式，但它们通常是基于解码器的模型，拥有数十亿个参数。以下是一些最知名的大语言模型：

|**模型**|**提供商**|
|---|---|
|**Deepseek-R1**|DeepSeek|
|**GPT4**|OpenAI|
|**Llama 3**|Meta（Facebook AI Research）|
|**SmolLM2**|Hugging Face|
|**Gemma**|Google|
|**Mistral**|Mistral|

大语言模型 (LLM) 的基本原理简单却极其有效：**其目标是在给定一系列前一个令牌的情况下，预测下一个令牌**。这里的“令牌”是 LLM 处理信息的基本单位。你可以把“令牌”想象成“单词”，但出于效率考虑，LLM 并不直接使用整个单词。

例如，虽然英语估计有 60 万个单词，但一个 LLM 的词汇表可能只有大约 32,000 个令牌（如 Llama 2 的情况）。令牌化通常作用于可以组合的子词单元。

每个大语言模型 (LLM) 都有一些特定于该模型的**特殊令牌**。LLM 使用这些令牌来开启和关闭其生成过程中的结构化组件。例如，用于指示序列、消息或响应的开始或结束。此外，我们传递给模型的输入提示也使用特殊令牌进行结构化。其中最重要的是**序列结束令牌** (EOS，End of Sequence token)。

不同模型提供商使用的特殊令牌形式差异很大。

下表展示了特殊令牌的多样性：

|**Model**|**Provider**|**EOS Token**|**Functionality**|
|---|---|---|---|
|**GPT4**|OpenAI|`<\|endoftext\|>`|End of message text|
|**Llama 3**|Meta (Facebook AI Research)|`<\|eot_id\|>`|End of sequence|
|**Deepseek-R1**|DeepSeek|`<\|end_of_sentence\|>`|End of message text|
|**SmolLM2**|Hugging Face|`<\|im_end\|>`|End of instruction or message|
|**Gemma**|Google|`<end_of_turn>`|End of conversation turn|
## 理解下一个词元预测

大语言模型 (LLM) 被认为是**自回归**的，这意味着**一次通过的输出成为下一次的输入**。这个循环持续进行，直到模型预测下一个词元为 EOS（结束符）词元，此时模型可以停止。
	![[AutoregressionSchema.gif]]

# 什么是工具

![Unit 1 planning](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/whiteboard-check-2.jpg)

AI 智能体的关键能力在于执行**行动**。正如前文所述，这通过**工具**的使用实现。

本节将学习工具的定义、有效设计方法，以及如何通过系统消息将其集成到智能体中。

通过为智能体配备合适的工具——并清晰描述这些工具的工作原理——可显著提升 AI 的能力边界。让我们深入探讨！

## [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#ai-%E5%B7%A5%E5%85%B7%E7%9A%84%E5%AE%9A%E4%B9%89)AI 工具的定义

**工具是赋予 LLM 的函数**，该函数应实现**明确的目标**。

以下是 AI 智能体中常用的工具示例：

|工具类型|描述|
|---|---|
|网络搜索|允许智能体从互联网获取最新信息|
|图像生成|根据文本描述生成图像|
|信息检索|从外部源检索信息|
|API 接口|与外部 API 交互（GitHub、YouTube、Spotify 等）|

以上仅为示例，实际可为任何用例创建工具！

优秀工具应能**补充 LLM 的核心能力**。

例如，若需执行算术运算，为 LLM 提供**计算器工具**将比依赖模型原生能力获得更好结果。

此外，**LLM 基于训练数据预测提示的补全**，意味着其内部知识仅包含训练截止前的信息。因此，若智能体需要最新数据，必须通过工具获取。

例如，若直接询问 LLM（无搜索工具）今日天气，LLM 可能会产生随机幻觉。

![Weather](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/weather.jpg)

- 合格工具应包含：
    - **函数功能的文本描述**
    - _可调用对象_（执行操作的实体）
    - 带类型声明的_参数_
    - （可选）带类型声明的输出

## [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#%E5%B7%A5%E5%85%B7%E5%A6%82%E4%BD%95%E8%BF%90%E4%BD%9C)工具如何运作？

正如前文所述，LLM 只能接收文本输入并生成文本输出。它们无法自行调用工具。当我们谈及_为智能体提供工具_时，实质是**教导** LLM 认识工具的存在，并要求模型在需要时生成调用工具的文本。例如，若我们提供从互联网获取某地天气的工具，当询问 LLM 巴黎天气时，LLM 将识别该问题适合使用我们教授的”天气”工具，并生成代码形式的文本来调用该工具。**智能体**负责解析 LLM 的输出，识别工具调用需求，并执行工具调用。工具的输出将返回给 LLM，由其生成最终用户响应。

工具调用的输出是对话中的另一种消息类型。工具调用步骤通常对用户不可见：智能体检索对话、调用工具、获取输出、将其作为新消息添加，并将更新后的对话再次发送给 LLM。从用户视角看，仿佛 LLM 直接使用了工具，但实际执行的是我们的应用代码（**智能体**）。

后续课程将深入探讨该流程。

## [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#%E5%A6%82%E4%BD%95%E4%B8%BA-llm-%E6%8F%90%E4%BE%9B%E5%B7%A5%E5%85%B7)如何为 LLM 提供工具？

完整答案可能看似复杂，但核心是通过系统提示（system prompt）向模型文本化描述可用工具：

![System prompt for tools](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/Agent_system_prompt.png)

为确保有效性，必须精准描述：

1. ==**工具功能**==
2. ==**预期输入格式**==

因此工具描述通常采用结构化表达方式（如编程语言或 JSON）。虽非强制，但任何精确、连贯的格式均可。

若觉抽象，我们通过具体示例理解。

我们将实现简化的**计算器**工具，仅执行两整数相乘。Python 实现如下：
``` python
def calculator(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b
```
因此我们的工具名为`calculator`，其功能是**将两个整数相乘**，需要以下输入：

- **`a`**（_int_）：整数
- **`b`**（_int_）：整数

工具输出为另一个整数，描述如下：

- （_int_）：`a`与`b`的乘积

所有这些细节都至关重要。让我们将这些信息整合成 LLM 可理解的工具描述文本：

`工具名称： calculator，描述：将两个整数相乘。参数：a: int, b: int，输出：int

> **重要提示：** 此文本描述是_我们希望 LLM 了解的工具体系_。

当我们将上述字符串作为输入的一部分传递给 LLM 时，模型将识别其为工具，并知晓需要传递的输入参数及预期输出。

若需提供更多工具，必须保持格式一致性。此过程可能较为脆弱，容易遗漏某些细节。

是否有更好的方法？

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#%E8%87%AA%E5%8A%A8%E5%8C%96%E5%B7%A5%E5%85%B7%E6%8F%8F%E8%BF%B0%E7%94%9F%E6%88%90)自动化工具描述生成

我们的工具采用 Python 实现，其代码已包含所需全部信息：

- 功能描述性名称：`calculator`
- 详细说明（通过函数文档字符串实现）：`将两个整数相乘`
- 输入参数及类型：函数明确要求两个`int`类型参数
- 输出类型

这正是人们使用编程语言的原因：表达力强、简洁且精确。

虽然可以将 Python 源代码作为工具规范提供给 LLM，但具体实现方式并不重要。关键在于工具名称、功能描述、输入参数和输出类型。

我们将利用 Python 的**自省特性**，通过源代码自动构建工具描述。只需确保工具实现满足：

1. 使用类型注解（Type Hints）
2. 编写文档字符串（Docstrings）
3. 采用合理的函数命名

完成这些之后，我们只需使用一个 Python 装饰器来指示`calculator`函数是一个工具：

``` python
@Tool
def calculator(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b

print(calculator.to_string())
```

注意函数定义前的`@tool`装饰器。

通过我们即将看到的实现，可以利用装饰器提供的`to_string()`方法从源代码自动提取以下文本：

`工具名称： calculator，描述：将两个整数相乘。参数：a: int, b: int，输出：int`

正如所见，这与我们之前手动编写的内容完全一致！

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#%E9%80%9A%E7%94%A8%E5%B7%A5%E5%85%B7%E7%B1%BB%E5%AE%9E%E7%8E%B0)通用工具类实现

我们创建通用`Tool`类，可在需要时重复使用：

> **说明：** 此示例实现为虚构代码，但高度模拟了主流工具库的实际实现方式。


``` python
class Tool:
    """
    A class representing a reusable piece of code (Tool).
    
    Attributes:
        name (str): Name of the tool.
        description (str): A textual description of what the tool does.
        func (callable): The function this tool wraps.
        arguments (list): A list of argument.
        outputs (str or list): The return type(s) of the wrapped function.
    """
    def __init__(self, 
                 name: str, 
                 description: str, 
                 func: callable, 
                 arguments: list,
                 outputs: str):
        self.name = name
        self.description = description
        self.func = func
        self.arguments = arguments
        self.outputs = outputs

    def to_string(self) -> str:
        """
        Return a string representation of the tool, 
        including its name, description, arguments, and outputs.
        """
        args_str = ", ".join([
            f"{arg_name}: {arg_type}" for arg_name, arg_type in self.arguments
        ])
        
        return (
            f"Tool Name: {self.name},"
            f" Description: {self.description},"
            f" Arguments: {args_str},"
            f" Outputs: {self.outputs}"
        )

    def __call__(self, *args, **kwargs):
        """
        Invoke the underlying function (callable) with provided arguments.
        """
        return self.func(*args, **kwargs)
```

虽然看似复杂，但逐步解析即可理解其工作机制。我们定义的 **`Tool`类包含以下核心要素**：

- **`name`**（_str_）：工具名称
- **`description`**（_str_）：工具功能简述
- **`function`**（_callable_）：工具执行的函数
- **`arguments`**（_list_）：预期输入参数列表
- **`outputs`**（_str_ 或 _list_）：工具预期输出
- **`__call__()`**：调用工具实例时执行函数
- **`to_string()`**：将工具属性转换为文本描述

可通过如下代码创建工具实例：

```python
calculator_tool = Tool(
    "calculator",                   # name
    "Multiply two integers.",       # description
    calculator,                     # function to call
    [("a", "int"), ("b", "int")],   # inputs (names and types)
    "int",                          # output
)
```
但我们可以利用 Python 的`inspect`模块自动提取这些信息！这正是`@tool`装饰器的实现原理。


``` python
def tool(func):
    """
    A decorator that creates a Tool instance from the given function.
    """
    # Get the function signature
    signature = inspect.signature(func)
    
    # Extract (param_name, param_annotation) pairs for inputs
    arguments = []
    for param in signature.parameters.values():
        annotation_name = (
            param.annotation.__name__ 
            if hasattr(param.annotation, '__name__') 
            else str(param.annotation)
        )
        arguments.append((param.name, annotation_name))
    
    # Determine the return annotation
    return_annotation = signature.return_annotation
    if return_annotation is inspect._empty:
        outputs = "No return annotation"
    else:
        outputs = (
            return_annotation.__name__ 
            if hasattr(return_annotation, '__name__') 
            else str(return_annotation)
        )
    
    # Use the function's docstring as the description (default if None)
    description = func.__doc__ or "No description provided."
    
    # The function name becomes the Tool name
    name = func.__name__
    
    # Return a new Tool instance
    return Tool(
        name=name, 
        description=description, 
        func=func, 
        arguments=arguments, 
        outputs=outputs
    )
```
简而言之，在应用此装饰器后，我们可以按如下方式实现工具：

```python
@Tool
def calculator(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b

print(calculator.to_string())
```

我们可以使用`Tool`类的`to_string`方法自动生成适合LLM使用的工具描述文本：

`工具名称： calculator，描述：将两个整数相乘。参数：a: int, b: int，输出：int

该描述将被**注入**系统提示。以本节初始示例为例，替换`tools_description`后的系统提示如下：

![System prompt for tools](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/Agent_system_prompt_tools.png)

在[Actions](https://huggingface.co/learn/agents-course/zh-CN/unit1/actions)章节，我们将深入探讨智能体如何**调用**刚创建的这个工具。

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/tools#%E6%A8%A1%E5%9E%8B%E4%B8%8A%E4%B8%8B%E6%96%87%E5%8D%8F%E8%AE%AEmcp%E7%BB%9F%E4%B8%80%E7%9A%84%E5%B7%A5%E5%85%B7%E6%8E%A5%E5%8F%A3)模型上下文协议（MCP）：统一的工具接口

模型上下文协议（MCP）是一种开放式协议，它规范了应用程序向 LLM 提工具的方式。

MCP 提供

- 不断增加的预构建集成列表，您的 LLM 可以直接接入这些集成
- 在 LLM 提供商和供应商之间灵活切换的能力
- 在基础设施内保护数据安全的最佳实践

这意味着任何实施 MCP 的框架都可以利用协议中定义的工具，从而无需为每个框架重新实现相同的工具接口。

---

# 通过思考-行动-观察循环理解AI智能体

## 核心组件 (Core Components)

智能体在一个持续的循环中工作：**思考 (Thought) → 行动 (Act) 和观察 (Observe)**。

让我们一起分解这些行动：

1. **思考 (Thought)**：智能体的大语言模型 (LLM) 部分决定下一步应该是什么。
2. **行动 (Action)**：智能体通过使用相关参数调用工具来采取行动。
3. **观察 (Observation)**：模型对工具的响应进行反思。

## 思考-行动-观察循环 (The Thought-Action-Observation Cycle)

这三个组件在一个持续的循环中协同工作。用编程的类比来说，智能体使用一个 **while 循环**：循环持续进行，直到智能体的目标被实现。

视觉上，它看起来是这样的：

![Think, Act, Observe cycle](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/AgentCycle.gif)

在许多智能体框架中，**规则和指南直接嵌入到系统提示中**，确保每个循环都遵循定义的逻辑。

在一个简化版本中，我们的系统提示可能看起来像这样：

![Think, Act, Observe cycle](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/system_prompt_cycle.png)

我们在这里看到，在系统消息中我们定义了：

- _智能体的行为_。
- _我们的智能体可以访问的工具_，就像我们在上一节中描述的那样。
- _思考-行动-观察循环_，我们将其融入到大语言模型指令中。

让我们看一个小例子，在深入研究每个步骤之前理解这个过程。

## 阿尔弗雷德，天气智能体 (Alfred, the Weather Agent)

我们创建了阿尔弗雷德，天气智能体。

用户问阿尔弗雷德：“今天纽约的天气如何？”

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent.jpg)

阿尔弗雷德的工作是使用天气 API 工具回答这个查询。

以下是循环的展开过程：

### 思考 (Thought)

**内部推理：**

在收到查询后，阿尔弗雷德的内部对话可能是：

_“用户需要纽约的当前天气信息。我可以访问一个获取天气数据的工具。首先，我需要调用天气API来获取最新的详细信息。”_

这一步显示了智能体将问题分解成步骤：首先，收集必要的数据。

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent-1.jpg)

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/agent-steps-and-structure#%E8%A1%8C%E5%8A%A8-action)行动 (Action)

**工具使用：**

基于其推理和阿尔弗雷德知道有一个`get_weather`工具的事实，阿尔弗雷德准备一个 JSON 格式的命令来调用天气 API 工具。例如，它的第一个动作可能是：

思考：我需要检查纽约的当前天气。

    {
      "action": "get_weather",
      "action_input": {
        "location": "New York"
      }
    }

在这里，动作清楚地指定了要调用哪个工具（如get_weather）和要传递的参数（“location”: “New York”）。

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent-2.jpg)

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/agent-steps-and-structure#%E8%A7%82%E5%AF%9F-observation)观察 (Observation)

**来自环境的反馈：**

在工具调用之后，阿尔弗雷德接收到一个观察结果。这可能是来自API的原始天气数据，如：

_“纽约当前天气：多云，15°C，湿度60%。”_

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent-3.jpg)

这个观察结果然后被添加到提示中作为额外的上下文。它作为现实世界的反馈，确认行动是否成功并提供所需的细节。

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/agent-steps-and-structure#%E6%9B%B4%E6%96%B0%E7%9A%84%E6%80%9D%E8%80%83-updated-thought)更新的思考 (Updated thought)

**反思：**

获得观察结果后，阿尔弗雷德更新其内部推理：

_“现在我有了纽约的天气数据，我可以为用户编写答案了。”_

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent-4.jpg)

### [](https://huggingface.co/learn/agents-course/zh-CN/unit1/agent-steps-and-structure#%E6%9C%80%E7%BB%88%E8%A1%8C%E5%8A%A8-final-action)最终行动 (Final Action)

然后阿尔弗雷德生成一个按照我们告诉它的方式格式化的最终响应：

思考：我现在有了天气数据。纽约当前天气多云，温度15°C，湿度60%。

最终答案：纽约当前天气多云，温度15°C，湿度60%。

这个最终行动将答案发送回用户，完成循环。

![Alfred Agent](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/alfred-agent-5.jpg)

我们在这个例子中看到：

- **智能体在目标实现之前不断迭代循环：**

**阿尔弗雷德的过程是循环的**。它从思考开始，然后通过调用工具采取行动，最后观察结果。如果观察结果表明有错误或数据不完整，阿尔弗雷德可以重新进入循环来纠正其方法。

- **工具集成 (Tool Integration)：**

调用工具（如天气 API）的能力使阿尔弗雷德能够**超越静态知识并检索实时数据**，这是许多 AI 智能体的重要方面。

- **动态适应 (Dynamic Adaptation)：**

每个循环都允许智能体将新信息（观察）整合到其推理（思考）中，确保最终答案是明智和准确的。

这个例子展示了 _ReAct 循环_背后的核心概念（这是我们将在下一节中发展的概念）：**思考、行动和观察的相互作用使 AI 智能体（AI Agent）能够迭代地解决复杂任务**。

通过理解和应用这些原则，你可以设计出不仅能够推理其任务，而且能够**有效利用外部工具来完成它们**的智能体，同时基于环境反馈不断改进其输出。


## 智能体的思维

思维是智能体解决问题的内部推理与规划过程，通过这个过程，智能体会**将复杂问题调整为更加简单的小问题**，并反思历史经验，根据新信息不断调整计划

以下是常见思维模式的示例：

| 思维类型                       | 示例                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| *Planning（规划）*             | *“I need to break this task into three steps: 1) gather data, 2) analyze trends, 3) generate report”（“我需要将任务分解为三步：1）收集数据 2）分析趋势 3）生成报告”）* |
| *Analysis（分析）*             | *“Based on the error message, the issue appears to be with the database connection parameters”（“根据错误信息，问题似乎出在数据库连接参数”）*                   |
| *Decision Making（决策）*      | *“Given the user’s budget constraints, I should recommend the mid-tier option”（“考虑到用户的预算限制，应推荐中端选项”）*                                     |
| *Problem Solving（问题解决）*    | *“To optimize this code, I should first profile it to identify bottlenecks”（“优化此代码需先进行性能分析定位瓶颈”）*                                         |
| *Memory Integration（记忆整合）* | *“The user mentioned their preference for Python earlier, so I’ll provide examples in Python”（“用户先前提到偏好 Python，因此我将提供 Python 示例”）*        |
| *Self-Reflection（自我反思）*    | *“My last approach didn’t work well, I should try a different strategy”（“上次方法效果不佳，应尝试不同策略”）*                                              |
| *Goal Setting（目标设定）*       | *“To complete this task, I need to first establish the acceptance criteria”（“完成此任务需先确定验收标准”）*                                             |
| *Prioritization（优先级排序）*    | *“The security vulnerability should be addressed before adding new features”（“在添加新功能前应先修复安全漏洞”）*                                          |
### ReAct 方法

核心方法是 **ReAct 方法**，即”推理”（Reasoning/Think）与”行动”（Acting/Act）的结合。

ReAct 是一种简单的提示技术，在让 LLM 解码后续 token 前添加”Let’s think step by step”（让我们逐步思考）的提示。

通过提示模型”逐步思考”，可以引导解码过程生成**计划**而非直接输出最终解决方案，因为模型被鼓励将问题**分解**为_子任务_。

这种方法使模型能够更详细地考虑各个子步骤，通常比直接生成最终方案产生更少错误。

![ReAct](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/ReAct.png)

## 智能体的行动

在本节中，我们将探讨 AI 智能体 (AI agent) 与其环境交互的具体步骤。

我们将介绍动作 (actions) 如何被表示（使用 JSON 或代码），停止和解析方法 (stop and parse approach) 的重要性，以及不同类型的智能体。

动作是**AI 智能体 (AI agent) 与其环境交互的具体步骤**。

无论是浏览网络获取信息还是控制物理设备，每个动作都是智能体执行的一个特定操作。

例如，一个协助客户服务的智能体可能会检索客户数据、提供支持文章或将问题转交给人工代表。

### 智能体动作的类型 (Types of Agent Actions)

有多种类型的智能体采用不同的方式执行动作：

|智能体类型|描述|
|---|---|
|JSON 智能体 (JSON Agent)|要执行的动作以 JSON 格式指定。|
|代码智能体 (Code Agent)|智能体编写代码块，由外部解释执行。|
|函数调用智能体 (Function-calling Agent)|这是 JSON 智能体的一个子类别，经过微调以为每个动作生成新消息。|

动作本身可以服务于多种目的：

|动作类型|描述|
|---|---|
|信息收集 (Information Gathering)|执行网络搜索、查询数据库或检索文档。|
|工具使用 (Tool Usage)|进行 API 调用、运行计算和执行代码。|
|环境交互 (Environment Interaction)|操作数字界面或控制物理设备。|
|通信 (Communication)|通过聊天与用户互动或与其他智能体协作。|

智能体的一个关键部分是**在动作完成时能够停止生成新的标记 (tokens)**，这对所有格式的智能体都适用：JSON、代码或函数调用。这可以防止意外输出并确保智能体的响应清晰准确。

大语言模型 (LLM) 只处理文本，并使用它来描述它想要采取的动作以及要提供给工具的参数。

### 停止和解析方法 (The Stop and Parse Approach)

实现动作的一个关键方法是**停止和解析方法**。这种方法确保智能体的输出具有结构性和可预测性：

1. **以结构化格式生成 (Generation in a Structured Format)**：

智能体以清晰、预定义的格式（JSON或代码）输出其预期动作。

2. **停止进一步生成 (Halting Further Generation)**：

一旦动作完成，**智能体停止生成额外的标记**。这可以防止额外或错误的输出。

3. **解析输出 (Parsing the Output)**：

外部解析器读取格式化的动作，确定要调用哪个工具，并提取所需的参数。

例如，需要检查天气的智能体可能输出：
```
Thought: I need to check the current weather for New York.
Action :
{
  "action": "get_weather",
  "action_input": {"location": "New York"}
}
```
然后框架可以轻松解析要调用的函数名称和要应用的参数。

这种清晰的、机器可读的格式最大限度地减少了错误，并使外部工具能够准确处理智能体的命令。

注意：函数调用智能体的操作方式类似，通过构造每个动作，使指定的函数能够使用正确的参数被调用。 我们将在未来的单元中深入探讨这些类型的智能体。

### 代码智能体 (Code Agents)

另一种方法是使用_代码智能体_。 这个想法是：**代码智能体不是输出简单的 JSON 对象**，而是生成一个**可执行的代码块——通常使用 Python 等高级语言**。

![Code Agents](https://huggingface.co/datasets/agents-course/course-images/resolve/main/en/unit1/code-vs-json-actions.png)

这种方法提供了几个优势：

- **表达能力 (Expressiveness)：** 代码可以自然地表示复杂的逻辑，包括循环、条件和嵌套函数，提供比 JSON 更大的灵活性。
- **模块化和可重用性 (Modularity and Reusability)：** 生成的代码可以包含在不同动作或任务中可重用的函数和模块。
- **增强的可调试性 (Enhanced Debuggability)：** 使用明确定义的编程语法，代码错误通常更容易检测和纠正。
- **直接集成 (Direct Integration)：** 代码智能体可以直接与外部库和 API 集成，实现更复杂的操作，如数据处理或实时决策。

例如，一个负责获取天气的代码智能体可能生成以下 Python 代码片段：
``` python
# Code Agent Example: Retrieve Weather Information
def get_weather(city):
    import requests
    api_url = f"https://api.weather.com/v1/location/{city}?apiKey=YOUR_API_KEY"
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        return data.get("weather", "No weather information available")
    else:
        return "Error: Unable to fetch weather data."

# Execute the function and prepare the final answer
result = get_weather("New York")
final_answer = f"The current weather in New York is: {result}"
print(final_answer)

```
在这个例子中，代码智能体：

- **通过API调用**获取天气数据，
- 处理响应，
- 并使用print()函数输出最终答案。

这种方法**也遵循停止和解析方法**，通过明确划定代码块并表明执行完成的时间（在这里，通过打印 final_answer）。

## 智能体的观察

Observations（观察）是**智能体感知其行动结果的方式**。

它们提供关键信息，为智能体的思考过程提供燃料并指导未来行动。

这些是**来自环境的信号**——无论是 API 返回的数据、错误信息还是系统日志——它们指导着下一轮的思考循环。

在观察阶段，智能体会：

- **收集反馈**：接收数据或确认其行动是否成功
- **附加结果**：将新信息整合到现有上下文中，有效更新记忆
- **调整策略**：使用更新后的上下文来优化后续思考和行动

例如，当天气 API 返回数据_“partly cloudy, 15°C, 60% humidity”_（局部多云，15°C，60% 湿度）时，该观察结果会被附加到智能体的记忆（位于提示末尾）。

智能体随后利用这些信息决定是否需要额外数据，或是否准备好提供最终答案。

这种**迭代式反馈整合确保智能体始终保持与目标的动态对齐**，根据现实结果不断学习和调整。

这些观察**可能呈现多种形式**，从读取网页文本到监测机械臂位置。这可以视为工具”日志”，为行动执行提供文本反馈。

|观察类型|示例|
|---|---|
|系统反馈|错误信息、成功通知、状态码|
|数据变更|数据库更新、文件系统修改、状态变更|
|环境数据|传感器读数、系统指标、资源使用情况|
|响应分析|API 响应、查询结果、计算输出|
|基于时间的事件|截止时间到达、定时任务完成|

### 结果如何被附加？

执行操作后，框架按以下步骤处理：

1. **解析操作** 以识别要调用的函数和使用的参数
2. **执行操作**
3. **将结果附加** 作为 **Observation**