---
created: 2026-06-08
modified: 2026-06-14
---

# Spark 基础

Spark 也是大数据处理常用的技术，支持对海量数据做**离线批处理**以及**实时流计算**

**Spark 框架模块**

Spark Core ：Spark 的核心部分，支持各种编程语言使用的 API
Spark SQL 计算
Streaming 流计算
图计算
机器学习

**Spark 运行模式**

1. Local：本地多个进程运行，并进程内的多线程，担任 Spark 的 Executor
2. StandAlone：集群模式，多个进程担任不同角色
3. YARN：由YARN集群作为不同角色
4. K8s：在云上用K8s管理集群

**Spark 架构角色**

1. Master：负责资源管理和任务的调度，类似 `YARN` 的 `ResourceManager`
2. Worker：具体工作的结点，向Master汇报自己的资源，执行指令。类似 `NodeManager`
3. Driver：负责管理具体任务的执行，类似 `ApplicationMaster`
4. Executor：负责执行任务，类似 `Container` 中的 `Task`

# Local 方式部署 Spark

Local 方式中，Master、Worker、Driver都是JVM运行的进程，而 Executor 是线程。
> Driver 有时候也能当作一个 Executor

## AnaConda 安装

1. 下载安装脚本文件
    `wget https://mirrors.tuna.tsinghua.edu.cn/anaconda/archive/Anaconda3-2024.02-1-Linux-x86_64.sh`
2. 使用 `bash` 运行这个文件
	`bash Anaconda3-2024.02-1-Linux-x86_64.sh`
	1. 会让我们指定安装路径
	2. 会让我们选择是否要刷新 `~/.bashrc` 中的环境变量
		这一步刷新后，在 bashrc 中会插入脚本，后续 `source ~/.bashrc` 可以激活 `conda`

## PySpark 虚拟环境配置

1. 使用 conda 创建环境 `conda create -n pyspark python=3.8 -y`
	1. 使用3.8的python解释器，是因为比较稳定，另外conda其实下载的时候，也会附带下载一个python解释器
2. 激活虚拟环境 `conda acticvate pyspark`
3. 在虚拟环境中安装 `pyspark`
	`pip install pyspark==3.2.0 -i https://pypi.tuna.tsinghua.edu.cn/simple`
4. 在虚拟环境的文件夹内（`/AnaConda3/envs/pyspark/bin`）中会有使用 `spark` 的脚本

> 通过虚拟环境安装的 Pyspark 库，主要是支持通过 python 语言编写代码，交给 Spark 各个角色完成任务。
> 内部内置了 Spark 运行各个角色 JVM 的 jar 包。

## 安装 `spark-3.2.0-bin-hadoop3.2.tgz`

可以和分布式集群建立通信，提供把任务提交到分布式集群上的脚本代码 `spark-submit`

> 通过安装特定版本，可以对 hadoop 集群稳定的适配；支持各种脚本语言提交任务

# Spark 程序执行层次

在大数据分布式计算中，一个 Spark 程序的生命周期在内部有着极其严密的“行政级别”划分。

从你敲下代码、提交任务，到集群最终切分数据并执行，Spark 内部将程序运行的层次由大到心，硬性划分为 4 个核心级别：**Application ➔ Job ➔ Stage ➔ Task**。

### 1. Application（应用层：项目的生命周期）

- **定义**：这是最高级别的划分。简单来说，就是你编写的**整个 `.py` 脚本文件**，或者你在交互式终端里从启动到退出的**整个会话过程**。
    
- **物理本质**：当你的程序启动，在集群中成功初始化了一个 `SparkSession`（或 `SparkContext`）时，一个 Application 就诞生了；直到代码最后执行了 `spark.stop()`，这个 Application 才会正式宣告死亡。
    
- **资源体现**：在 YARN 的管理界面（8088 端口）上，你看到的每一个以 `application_xxxxxxxx_xxxx` 命名的整行记录，就是一个独立的 Application。
    

### 2. Job（作业层：遇到“动作算子”时产生）

- **定义**：Application 只是一个外壳，真正开始干活的边界是由 **Job** 决定的。在你的代码中，**只要触发了一次 Action（动作）算子，Spark 内部就会原地立刻生成一个独立的 Job**。
    
- **动作算子有哪些**：例如 `.collect()`、`.show()`、`.count()`、`.saveAsTextFile()` 等。
    
- **为什么这样设计**：因为 Spark 具有惰性求值（Lazy Evaluation）的物理特性。你在前面写了一万行 `.map()`、`.filter()`、`.flatMap()`，Spark 在底层其实都在“偷懒”，只是把这些清洗逻辑记录在了一张“计划表”（DAG 有向无环图）上。只有当你敲下 `.collect()` 要求“看结果”的那一瞬间，Spark 引擎才会猛然惊醒，把之前的计划打包拧成一个 **Job** 提交上屏。
    

> 💡 **换句话说**：如果一个 `.py` 脚本里写了 3 次 `.show()` 和 1 次 `.saveAsTextFile()`，那么在这个 Application 运行期间，底层会顺次产生 **4 个 Job**。

### 3. Stage（阶段层：遇到“宽依赖/Shuffle”时切分）

- **定义**：一个 Job 包含了一连串的数据清洗步骤，Spark 会把这个 Job 拆分成一个或多个 **Stage**。而拆分的唯一物理标准，就是看代码里有没有触发 **Shuffle（洗牌）**。
    
- **切分逻辑（宽依赖 vs 窄依赖）**：
    
    - **窄依赖（不切分 Stage）**：像 `map`、`filter`。数据在单台机器的内存里流水线式往下走，不需要跨机器通过网络分发，效率极高。这些步骤会被合并在**同一个 Stage** 内（这种优化叫算子下沉/Pipeline）。
        
    - **宽依赖（必须切分 Stage）**：像 `reduceByKey`、`groupBy`、`join`。因为要按 Key 聚合，多台虚拟机上散落的数据必须通过网络进行疯狂的跨机器交换、重新洗牌。一旦遇到这种操作，Spark 就会把当前位置**一刀切断**，前一半划分为 Stage 0，后一半划分为 Stage 1。
        

### 4. Task（任务层：真正下发给线程的最小物理单元）

- **定义**：这是 Spark 中**最底层的、真正干活的、不可再分的最小数据处理单元**。
    
- **物理分配**：一个 Stage 包含了一套完全相同的计算逻辑（比如一堆 map 算子）。Spark 会根据你当前要处理的数据被切成了多少个**数据分区（Partitions）**，动态生成对应数量的 Task。
    
- **运行本质**：如果一个 Stage 要处理存放在 HDFS 上的 100 个数据块（Block），Spark 就会在这个 Stage 里实例化出 100 个 Task。这些 Task 会作为物理线程，被分布式分发到各个机器的 `Executor` 进程中的线程池里并发执行。
    

### 全流程

> 你写好的一个系统脚本（**Application**），运行期间一共有两次把结果写入数据库的操作，从而触发了两次 Action 算子，在底层拉起了 2 个 **Job**。
> 
> 其中第一个 Job 里面因为写了 `reduceByKey` 导致数据必须跨网络洗牌，被底层一刀切成了 2 个 **Stage**。
> 
> 每一个 Stage 在具体执行时，因为面对的是 HDFS 上切好的 10 份数据分片，于是各自衍生出了 10 个 **Task** 线程，由集群里的分布式节点并发吞噬计算。

# Spark On Yarn

在 Yarn 集群上部署 Spark，执行任务，可以大大的节省资源。
> 分布式计算处理，首先目标处理对象是一个分布式文件系统，在部署Hadoop的情况下，一定会有 HDFS 集群和 Yarn 集群。
> 如果采用 StandAlone 方式部署，会增加资源开销

这种方式下，yarn 中的 RM 担任 Master；NM 担任 Worker；AM 担任 Driver；Container 内运行 Executor 任务。
我们需要的只有：
- Hadoop 集群
- Spark 工具，可以把任务提交到 Yarn 集群中
- 提交的程序

`spark --master yarn --deploy-mode [cluster|client(默认)]`

- cluster 模式下， Driver 在 AM 中
- client 模式下， Driver 在提交任务的客户端进程内
	- 和 AM 的通信比较麻烦
	- 但是看日志比较方便，因为在提交任务的本地进程中
	- 生产环境不用