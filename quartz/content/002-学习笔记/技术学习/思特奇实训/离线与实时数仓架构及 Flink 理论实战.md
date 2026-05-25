---
created: 2026-02-02
modified: 2026-02-02
---

## 一、 数据中台：由“解耦”到“复用”

### 1. 传统开发模式（烟囱式）

- **定义**：针对单一业务需求（如特定报表）进行从底层 ETL 到顶层应用的垂直开发。
    
- **技术缺陷**：
    
    - **逻辑冗余**：同类计算逻辑在多个 Job 中重复存在，增加计算与维护成本。
        
    - **数据不一致性**：缺乏统一的元数据管理，导致相同指标（Metrics）在不同系统产生歧义。
        

### 2. 数据中台标准化（One Data）

- **OneModel（统一建模）**：通过规范化的维度建模，确保指标定义唯一。
    
- **OneID（实体打通）**：基于 ID Mapping 算法，跨设备/端实现唯一实体关联。
    
- **OneService（统一服务）**：屏蔽底层物理存储（Hive/ClickHouse/HBase），通过标准 API 对外暴露数据。
    

---

## 二、 架构选型：离线与实时对比

|**维度**|**离线数仓 (Offline DW)**|**实时数仓 (Real-time DW)**|
|---|---|---|
|**触发机制**|调度触发（Time-triggered）|事件触发（Event-triggered）|
|**计算模式**|批处理（Batch Processing）|流处理（Stream Processing）|
|**状态管理**|静态快照（Snapshot）|持续状态维护（Stateful Computing）|
|**数据源交互**|Pull（JDBC/HDFS 增量拉取）|Push（CDC 捕获/MQ 消息订阅）|
|**存储层**|HDFS/S3（高吞吐、高延迟）|Kafka/Pulsar (临时), Doris/Druid (OLAP)|

### 架构模式演进

- **Lambda 架构**：离线链路保证最终准确性，实时链路保证低延迟。**痛点**：逻辑需在两套引擎（如 Spark 与 Flink）中双重实现。
    
- **Kappa 架构**：以流处理为核心，历史数据通过消息重放（Replay）实现。**局限**：对存储介质（如 Kafka）的保留期限及查询性能有极高要求。
    

---

## 三、 Flink 核心技术特性

### 1. 核心优势

- **精确一次（Exactly-Once）**：通过分布式快照算法（Chandy-Lamport）实现端到端的一致性。
    
- **乱序容忍**：引入 **Watermark（水位线）** 机制，度量事件时间（Event Time）进度，处理网络延迟导致的乱序数据。
    
- **流批一体**：将批处理视为流处理的特例（Bounded Stream），统一 API 栈。
    

### 2. 组件功能定义

- **Flink CDC (Change Data Capture)**：通过解析数据库日志（如 MySQL Binlog）获取行级变更。相比传统轮询，其 IO 损耗更低，且能捕获 `DELETE` 操作。
    
- **Flink CEP (Complex Event Processing)**：在流数据中通过模式匹配（Pattern Matching）识别复杂事件序列（如 A 事件后 5 分钟内未发生 B 事件）。
    
- **Kafka**：作为解耦层，平衡上游高并发写入与下游计算引擎处理能力之间的速率差异。
    

---

## 四、 数据治理与保障体系

### 1. 生产安全

- **敏感数据处理**：在 ingestion 阶段进行脱敏（Masking）或非对称加密。
    
- **权限管理**：实施 RBAC（基于角色的访问控制），限制底层明细数据的直接访问。
    

### 2. 运维监控

- **数据血缘 (Data Lineage)**：通过静态解析 SQL 或动态跟踪 TaskSlot，建立从 Source 到 Sink 的拓扑路径，用于链路价值分析及故障影响评估。
    
- **反压监控 (Back-pressure)**：监控下游处理能力不足时，压力向上游传递的状态，防止内存溢出（OOM）。
    

---
