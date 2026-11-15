---
title: RDD
created: 2026-06-14
modified: 2026-06-17
tags:
  - 技术栈
subject: Spark
---
# RDD 的本质

RDD （Resilient Distribute Dataset 弹性分布式数据集）。是 Spark 中，表示一个可以分区，内部数据可以并行计算的集合
 - Dataset：一个存储数据的集合（存储是逻辑上的存储，可以根据 RDD，知道每一个数据在哪里）
 - Distribute：RDD 中的数据可以是一台机器进程内存中的，可以是横跨多台机器磁盘上的，主要的处理场景是后者，面对分布式存储数据，进行分布式计算
 - Resilient：弹性，指 RDD 中的数据可以在内存中，可以在磁盘中

# RDD 的五大特性

- RDD 中的数据可以分区
	- 不管是内存中的数据，还是分布式存储的数据
- RDD 中定义的函数作用于所有分区中
- RDD 之间有依赖关系，组织成 DAG（有向无环图）
- \[可选] KV类型的RDD 可以设置分区器
- \[可选] RDD 中对分区数据的计算，尽量在数据分片所在的机器中进行

# RDD 算子

> RDD 中对数据的分区，在任务的初始阶段，和文件分片数量一致，后续所有的算子都可以指定分区数量。
> 一旦指定了分区数量n，原来每一个处理分区的线程，会在自己的机器磁盘上，开辟n个分区，数据哈希取模，进入对应的分区，下一步n个任务，执行算子前，先把所有的机器的对应分区数据获取

**算子**：针对分布式数据操作 API 的称呼

可以分为：
- `Transformation` 算子
- `Action` 算子
  
> T 算子执行的结果还是 RDD（有分区、可以并行计算的数据集合）
> A 算子执行结果不是 RDD，比如 `collect()`
> **Action 算子会触发Job的划分，也会触发惰性计算的执行**
> **Transformation 算子中可以分为宽依赖和窄依赖，宽依赖会划分 Stage**

> 宽依赖：指父 RDD 中的一个分区数据，会分散到子 RDD 的多个分区中
> Stage 的作用，同一个 Stage 中的操作，可以根据 DAG 的依赖关系，合并一些操作，加快执行效率。


1. Transformation 算子![[Pasted image 20260614172524.png]]

# 引入 RDD 后认识Spark执行程序流程

## Spark 程序执行阶段（RDD 视角）

### 一、数据抽象

Spark 通过 RDD 对分布式数据进行抽象，屏蔽底层存储细节。数据来源可以是本地内存、HDFS 等外部文件系统。从 HDFS 读取时，初始分区数等于文件的 Block 分片数量，每个分区对应一个分片。

### 二、操作定义

算子分为两类：

- **T 算子（Transformation）**：惰性执行，只在 DAG 上登记转换节点，不触发计算。按依赖关系分为窄依赖和宽依赖两种，宽依赖是划分 Stage 的边界。
- **A 算子（Action）**：触发计算，每次调用划分出一个 Job，同一个 Application 内可以包含多个 Job。

### 三、调度结构

一次代码提交对应一个 Application，Application 在 YARN 上启动时向 ResourceManager 申请 Executor，Executor 常驻集群直到 Application 结束。

DAGScheduler 以宽依赖为切割点，将 Job 的 DAG 划分为多个 Stage。同一个 Stage 内的所有 T 算子，会被合并在一个 Task 中连续执行，不落盘。

### 四、执行流程

Stage 按 DAG 依赖关系**串行推进**：

1. 上游 Stage 的所有 Task 在 Executor 上并行执行，每个 Task 处理一个分区
2. 遇到宽依赖时触发 shuffle：所有分区的数据按 key 的 hash 重新路由，写入下游各分区，这是跨 Stage 的数据重新分配
3. 上游 Stage 全部完成后，DAGScheduler 才提交下游 Stage
4. 最后一个 Stage 执行完毕（含 A 算子逻辑），Executor 将结果返回 Driver 做最终汇总（`foreach`、`saveAsTextFile` 等写出类算子除外）

一个 Executor 可通过多线程同时执行多个 Task，因此 Executor 数量与分区数量不要求相等。

### 五、核心优化点

- **减少磁盘 IO**：Stage 内算子链式执行，中间结果留在内存，不像 MapReduce 每步都落盘
- **RDD Cache**：对复用的 RDD 显式缓存，避免重复计算
- **DAG 算子合并**：窄依赖算子在同一 Task 内流水线执行，减少不必要的 shuffle

# RDD 的数据缓存、持久化

> 主要介绍 cache() persist() checkpoint()

前面提到，一个 RDD，看作是存储数据的逻辑抽象，可以在一个 RDD 的基础上使用算子，所以 RDD 是有依赖关系的。

RDD 可以重复利用，即一个 RDD，可以多次定义下一步的算子，会根据 DAG，从头开始计算。如果想省去这个计算过程，可以空间换时间，将一个 RDD 代表的数据缓存到内存或者磁盘中，后续基于该 RDD 的下一步运算，可以直接在缓存数据中进行，不需要从依赖图起点开始计算。

在 PySpark 中，支持缓存的 API
	- cache() ：底层是 persist()
	- persist() ： 支持各种策略作为参数
		- `StorageLevel.MEMORY_ONLY`：纯内存（如果内存不够，没存下的部分下次用时重新计算）。
		- `StorageLevel.MEMORY_AND_DISK`：内存+磁盘（PySpark 默认）。
		- `StorageLevel.MEMORY_ONLY_SER`：纯内存+高效序列化（更省内存，但拿出来用时需要反序列化，费 CPU）。
		- `StorageLevel.MEMORY_AND_DISK_2`：带副本机制，把缓存数据在两个不同的节点上各存一份，容错性更高。
	- checkpoint() ：需要配合 setCheckpointDir("hdfs:///") 来指定数据的存放路径

> cache/persist 的缓存，指每一台运行 Task 的机器，把分区的数据存储到内存或者磁盘中，如果机器宕机，或者网络通信出错，这个机器上缓存的数据就相当于丢失了。
> 所以 cache 和 persist 被认为是不可靠的，即**缓存数据有丢失的风险**，所以会保留原来的 DAG 依赖关系，用于数据丢失后，从头计算。
> 
> 而 checkpoint 会把数据存储到分布式文件系统中，自带的副本机制，让其被认为是可靠的数据缓存。因而不需要在保留之前的依赖关系。
> 
> 对 checkpoint 的思路进行拓展，可以手动把 rdd 保存到文件系统中，或者把 rdd 转为 dataframe，后续可以通过 sql 语句操纵


# 广播器

在多表连接的行为中，存在隐含的磁盘IO和网络IO开销。这是因为 *join 是宽依赖，需要先在本机上进行分区，触发 shuffle，下一步的 Task 需要把自己分区中的数据拉取过来，然后执行连接操作*。


- 在多表连接的场景中，假设 rdd1.join(rdd2)，在rdd1数据量较大的前提下，可以分为以下三种情况讨论
	1. rdd2 数据量较小：此时进行rdd1的分区操作，带来的IO开销很大。所以选择把 rdd2 的数据广播到所有的 Executor，让每一个处理rdd1的 Task 获取到 rdd2 的数据，然后本机上完成连接操作。
	2. rdd2 数据量中等：此时广播的开销也不小，选择老老实实 shuffle，然后下一个 Stage 中，先把 rdd2 的数据构造 Hash Table，然后rdd1通过 hash table 来连接 rdd2 的数。**构造 Hash Table的时间和空间开销比较划算**
	3. rdd2 数据量大：此时前两种方法都不划算，只能老实的 shuffle，然后新的 Stage 中，把拉取到的rdd1和rdd2的分区数据，分别再磁盘临时文件中进行 file sort，随后通过链表指针单向移动的方式，完成多表连接。

- PySpark中广播的 API
	- broad_value = sparkContext.broadcast(集合变量) # Driver 广播数据到所有的 Executor 中
	- broad_value.value # Task获取广播数据

# 累加器

在分布式计算的行为中，存在外部变量“无法回传”**和**“闭包重复拷贝”的致命问题。这是因为 Spark 的算子（如 `map`, `filter`, `foreach`）是在远端各个 Executor 的 Task 线程中独立运行的。如果直接在算子内部修改 Driver 端的普通 Python 变量，各个 Task 只能拿到该变量的一个独立内存副本，算子内部的累加结果在线程销毁后会灰飞烟灭，Driver 端无法感知。

在分布式数据统计的场景中，为了打破“数据只能单向空投，不能逆流回传”的物理壁垒，Spark 设计了累加器。在使用累加器时，根据其在**不同算子中的生命周期**，可以分为以下三种情况讨论：

- **写在 Action 算子中（如 `foreach`）**：这是最推荐、最安全的标准做法。因为 Action 算子会直接触发 Job 执行且没有复杂的下游血缘。各个 Task 线程在远端只管向累加器执行 `.add()`，计算完成后，Spark 底层通过心跳将各节点的小计安全回传给 Driver，在 Driver 端完成全局大计的 `sum` 汇聚。
    
- **写在 Transformation 算子中且未加缓存（如 `map`）**：**【高危，容易导致重复累加】**。由于 Transformation 算子具有懒执行（Lazy）特性，如果该 RDD 在后续被多次触发 Action 算子（例如先 `collect()` 再 `count()`），由于没有缓存，Spark 会顺着血缘链条将该 `map` 算子重复执行多次，导致累加器的最终结果翻倍偏大。
    
- **写在 Transformation 算子中且加了缓存（如 `map` + `cache`）**：此时虽然也是写在转换算子里，但因为在第一次 Action 触发时数据已被锁进内存/磁盘（`cache()`），后续的 Action 动作会直接复用缓存，不会再回头去重新执行 `map` 内部的累加逻辑，从而保证了累加器数据的精准度。
### PySpark中累加器的 API

```python
accumulator_value = sparkContext.accumulator(初始值) # Driver 端创建并注册共享累加器
accumulator_value.add(增量值)                        # Executor 端的 Task 只能执行写操作（只写不读）
accumulator_value.value                            # 只有 Driver 端有权限读取最终的全局汇总结果（只读）
```


> **分布式数据传输的十字路口**：
> 
> - **广播变量（Broadcast）**：数据**由内向外**（Driver $\rightarrow$ Executor）。大表联小表，全网统发只读字典，用**内存换网络 IO**。
>     
> - **累加器（Accumulator）**：数据**由外向内**（Executor $\rightarrow$ Driver）。全网分布式打工人，远端只管加（`add`），中心统筹拿（`.value`），用**网络心跳换全局计数**。
>

# Spark 的性能优化点

相比于 `MapReduce` 每一个 Map 执行后数据写磁盘，下一步又要读取磁盘数据操作，shuffle 时对磁盘归并排序，Reduce 任务需要读取磁盘数据。 **Spark 的每一个 Job，会更多的在内存中计算，减少磁盘IO**
此外，依赖于有向无环图 DAG，可以将一些不冲突的操作合并，优化执行操作。
最后，RDD Cache 的设计，让一些需要读取相同数据源的操作，不用每次从磁盘中重新读取数据，直接从内存读取。
