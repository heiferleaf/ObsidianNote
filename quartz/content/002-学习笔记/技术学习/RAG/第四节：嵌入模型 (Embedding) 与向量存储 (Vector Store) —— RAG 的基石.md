---
created: 2026-02-13
modified: 2026-02-13
---


---

## 1. 核心概念与技术思想

本节的核心思想是将**非结构化文本转化为高维空间的向量坐标**。

- **技术目的**：实现基于语义（Meaning）而非关键词（Keyword）的检索。
    
- **核心方法**：利用 `Embedding` 模型将文本降维映射，通过 `VectorStore` 进行空间距离计算。
    
- **设计思想**：**空间索引 (Spatial Indexing)**。将文本匹配问题转化为数学上的向量相似度计算问题。
    

---

## 2. 技术实现原理：八股深度拆解

### 2.1 Embedding 的数学本质

面试必问：Embedding 到底在做什么？

- **高维投影**：将一段文本映射为固定维度的浮点数数组（如 1536 维或 768 维）。
    
- **语义距离**：在向量空间中，意思相近的句子，其向量间的夹角余弦值（Cosine Similarity）越趋近于 1。
    
- **不可逆性**：Embedding 是单向压缩，无法从向量反向还原出原始文本。
    

### 2.2 向量数据库 (Vector Store) 的运行机制

- **入库逻辑**：`Text` -> `Embedding` -> `存储 (Vector + Metadata)`。
    
- **检索逻辑**：
    
    1. 用户 Query 被实时转化为向量。
        
    2. 数据库计算 Query 向量与库中所有向量的距离。
        
    3. 返回距离最近的前 K 个 Document。
        
- **ANN 算法**：为了应对百万级以上数据，数据库通常使用 **HNSW (分层导航小世界)** 等近似最近邻算法，以牺牲极小精度为代价大幅提升检索速度。
    

---

## 3. 核心参数详解

- **`model`**：Embedding 模型名称（如 `text-embedding-v3`）。
    
- **`k`**：检索参数。指定返回最相关文档的数量，直接影响后续模型的上下文长度。
    
- **`score_threshold`**：分数阈值。用于过滤相似度太低的无关结果。
    
- **`metadata`**：元数据。在检索时可以基于此字段进行 SQL-like 的硬过滤（如：只查某个用户的文档）。
    

---

## 4. 深度代码示例

### 4.1 嵌入模型初始化与向量计算

展示如何手动获取文本向量。

Python

```
from langchain_community.embeddings import DashScopeEmbeddings

# 1. 初始化 Embedding 模型适配器
# 这里的模型决定了向量的维度 (如 1536 维)
embeddings = DashScopeEmbeddings(
    model="text-embedding-v2",
    dashscope_api_key="你的API_KEY"
)

# 2. 计算文本向量 (Embed Query)
query_text = "分布式系统一致性协议"
vector = embeddings.embed_query(query_text)

# 打印向量维度及其前五项
print(f"向量长度: {len(vector)}")
print(f"向量片段: {vector[:5]}")
```

### 4.2 向量数据库 (FAISS) 持久化存储与检索

使用轻量级向量库 FAISS 展示全流程。

Python

```
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

# 1. 准备 Document 对象 (包含内容与元数据)
docs = [
    Document(page_content="Redis使用单线程模型，通过IO多路复用实现高并发。", metadata={"id": 1}),
    Document(page_content="MySQL的InnoDB存储引擎支持事务，默认级别是可重复读。", metadata={"id": 2}),
    Document(page_content="Kafka是一个高吞吐的分布式消息队列，基于磁盘顺序写。", metadata={"id": 3})
]

# 2. 向量化并构建索引 (内存操作)
# 底层逻辑：遍历 docs -> embed -> 构建 HNSW 索引
db = FAISS.from_documents(docs, embeddings)

# 3. 持久化到本地磁盘 (Obsidian 适配代码)
db.save_local("faiss_index_db")

# 4. 加载索引并执行相似度搜索
new_db = FAISS.load_local("faiss_index_db", embeddings, allow_dangerous_deserialization=True)
query = "消息中间件原理"

# 执行检索：返回最相关的 1 个文档
# 底层：计算 Query 向量与库中 3 个向量的欧式距离/余弦相似度
results = new_db.similarity_search(query, k=1)

print(f"检索结果: {results[0].page_content}")
print(f"元数据: {results[0].metadata}")
```

---
