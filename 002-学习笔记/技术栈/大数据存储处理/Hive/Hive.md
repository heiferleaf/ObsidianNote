---
created: 2026-06-04
modified: 2026-06-08
---

# `Hive` 介绍

`Hive` 设计的目的，是把 `Sql` 语句转为 `Hadoop` 支持的 `MapReduce` 任务，简化 `MapReduce` 任务的代码编写

从目的可以探索出几个问题，例如一条 `sql` : `select city_name from city where city_id = 2`
- 要查询的文件路径是什么？
- 文件中的数据，怎么组织成多个属性列
- `city_name` 是其中的哪一个列
- 属性列的类型是什么

这些问题指向一点：`Hive`拥有对于分布式存储文件的元数据管理功能
- 数据的位置
- 数据的结构
- ...

完成上述问题之后，还需要一个能把 `sql` 语言翻译为等价的 `mapreduce` 程序
- `SQL` 解析器

# `Hive` 配置


## 1. Hadoop 核心配置：`core-site.xml`

**配置目的**：开启 Hadoop 的**超级代理人（Impersonation）机制**，允许 HiveServer2 所在的 Linux 用户代表外部连接（如 DataGrip 传入的 `root`）去安全触碰 HDFS。

XML

```
<configuration>
    <property>
        <name>hadoop.proxyuser.root.hosts</name>
        <value>*</value>
    </property>
    <property>
        <name>hadoop.proxyuser.root.groups</name>
        <value>*</value>
    </property>

    <property>
        <name>hadoop.http.staticuser.user</name>
        <value>root</value>
    </property>
</configuration>
```

## 2. Hive 核心元数据与服务端配置：`hive-site.xml`

**配置目的**：对接 MySQL 元数据库，规范默认存储路径，并向第三方工具暴露出无密码限制的开放式服务。

XML

```
<configuration>
    <property>
        <name>javax.jdo.option.ConnectionDriverName</name>
        <value>com.mysql.cj.jdbc.Driver</value>
    </property>
    <property>
        <name>javax.jdo.option.ConnectionURL</name>
        <value>jdbc:mysql://localhost:3306/hive_metadata?createDatabaseIfNotExist=true&amp;useSSL=false&amp;allowPublicKeyRetrieval=true</value>
    </property>
    <property>
        <name>javax.jdo.option.ConnectionUserName</name>
        <value>root</value>
    </property>
    <property>
        <name>javax.jdo.option.ConnectionPassword</name>
        <value>hadoop</value> </property>

    <property>
        <name>hive.metastore.warehouse.dir</name>
        <value>/user/hive/warehouse</value>
    </property>

    <property>
        <name>hive.server2.authentication</name>
        <value>NONE</value> </property>
    <property>
        <name>hive.metastore.schema.verification</name>
        <value>false</value> </property>
</configuration>
```

## 3. Hive 环境路径对齐：`hive-env.sh`

**配置目的**：强行向 Hive 进程内部灌入绝对物理路径，防止 Linux 异步启动或非登录 Shell 导致的分布式环境变量丢失。

进入 `/export/server/hive/conf/`，如果文件叫 `hive-env.sh.template`，先执行 `cp hive-env.sh.template hive-env.sh`，然后在文件顶部直接追加：

Bash

```
export JAVA_HOME=/export/server/jdk8u492-b09
export HADOOP_HOME=/export/server/hadoop-3.3.6
export HIVE_CONF_DIR=/export/server/hive/conf
```



# `Hive` 使用

## 一、 Hive 核心服务运维命令

### 1. 元数据管理服务 (Metastore)

* **启动命令**：
```bash
nohup /export/server/hive/bin/hive --service metastore >> /export/server/hive/logs/metastore.log 2>&1 &
```


* **物理本质**：24小时常驻后台，负责作为 MySQL 账本与 HDFS 之间的网桥。

### 2. 远程连接服务器 (HiveServer2)

* **启动命令**：
```bash
nohup /export/server/hive/bin/hive --service hiveserver2 >> /export/server/hive/logs/hiveserver2.log 2>&1 &
```
* **参数硬核拆解**：
* `nohup`：免挂断运行，关闭当前 Shell 终端后后台进程不会死。
* `2>&1`：把标准错误（2）重定向合并到标准输出（1）中，一同灌进日志文件。
* `&`：把整个任务丢进 Linux 后台运行。

### 3. 三大客户端对线方式

* **内置 CLI 客户端**：执行 `bin/hive`。直接单人独占连接底层组件，适合本地单机调试。
* **官方 Beeline 客户端**：
```bash
bin/beeline -u jdbc:hive2://node1:10000 -n root

```
* `!connect`：Beeline 内部切换集群的内置命令。
* `-n root`：声明业务身份。未来转成的 MapReduce 任务将以 root 身份向 YARN 提交，在 HDFS 上创建的文件夹拥有者（Owner）即为 root。


* **第三方图形化 (DataGrip)**：



## 二、 数据库核心操作与底层联动

### 1. 核心 DDL 语法

```sql
CREATE DATABASE IF NOT EXISTS my_db [LOCATION '/custom/path'];
DESC DATABASE my_db;
DROP DATABASE my_db CASCADE; -- cascade 关键字用于强制级联删除非空数据库
```

### 2. 底层三大组件联动真相

* **MySQL（记账）**：在系统表 `DBS` 中插入一条记录，绑定 `DB_ID`、库名、以及 HDFS 上的大本营坐标。
* **Hadoop HDFS（占地）**：在物理磁盘上抠出一个以 `.db` 结尾的专属空文件夹（默认在 `hive-site.xml` 的 `hive.metastore.warehouse.dir` 路径下）。


## 三、 数据表架构：内部表 vs 外部表

| 特性                    | 内部表 (Managed Table)                  | 外部表 (External Table)                   |
| --------------------- | ------------------------------------ | -------------------------------------- |
| **关键字**               | 无（直接 `CREATE TABLE`）                 | `EXTERNAL` 关键字 + `LOCATION` 明确指定路径     |
| **物理路径**              | 默认死死锁在数仓大本营路径下                       | 路径自由，通常指向集群公共数据区                       |
| **数据与表关系**            | 强绑定，生命周期由 Hive 完全控制                  | 相互独立，可“先建表、后移入数据”或“先有数据、后套表”           |
| **`DROP TABLE` 斩首后果** | **物理毁灭**：同时抹除 MySQL 元数据与 HDFS 真实数据文件 | **账本抹除**：仅删除 MySQL 元数据，HDFS 上的物理文件完好无损 |

* **状态查询**：执行 `DESC FORMATTED 表名;`。
* 观察 `Table Type` 字段：`MANAGED_TABLE` 为内部表；`EXTERNAL_TABLE` 为外部表。

* **内外类型动态切换**：
```sql
ALTER TABLE 表名 SET TBLPROPERTIES('EXTERNAL'='TRUE');  -- 切换为外部表（必须大写）
ALTER TABLE 表名 SET TBLPROPERTIES('EXTERNAL'='FALSE'); -- 切换为内部表
```


## 四、 性能优化大杀器：分区表 vs 分桶表

### 1. 分区表 (Partition) —— 目录层面的“粗粒度索引”

* **核心思想**：利用分布式“大化小”逻辑，将数据按照指定列在 HDFS 上切分为不同的**物理子文件夹**。
* **语法规则**：
```sql
CREATE TABLE t_partition (id INT, name STRING) 
PARTITIONED BY (dt STRING, country STRING) -- 分区列是伪列，绝不能出现在普通列定义中
ROW FORMAT DELIMITED FIELDS TERMINATED BY '\t';

```

* **性能优化**：
	* **单值筛选**：`WHERE dt='2026-06-04'` 使得计算引擎直接定位目标文件夹，瞬间无视全表其余海量数据。
	* **高效 JOIN / GROUP BY**：同分区数据天然聚集在同一物理目录下，完美规避全表盲洗，极大地压制了网络 Shuffle 开销。

### 2. 分桶表 (Bucket) —— 文件层面的“精准哈希分流”

* **核心思想**：在文件夹内部，根据指定列的哈希值对桶数取模（`hash(col) % 桶数`），将数据精准分流进固定数量的**物理文件**中。
* **语法规则**：
```sql
CREATE TABLE t_bucket (id INT, name STRING) 
CLUSTERED BY (id) INTO 4 BUCKETS; -- 确定物理文件数死死锁定为 4 个

```


* **必设防线**：
```sql
SET hive.enforce.bucketing = true;
```
* **为什么要开**：强制让后台的 Reduce 任务数量与分桶数量绝对一致（1比1承包）。若不开启，上游多线程并行写入时，每个 ReduceTask 都会为所有桶单独建文件，导致落盘文件数呈**乘法级爆炸**，诱发 NameNode 小文件雪崩。
* **数据导入死律**：分桶表的数据**只能从其他数据表用 SQL 导入**。绝不能用 `LOAD DATA` 直接加载外部裸文件，因为 `LOAD` 的底层仅仅是文件的物理移动，不经过 MapReduce 内存计算，根本无法算出一行数据到底该归属于哪个桶号。

## 五、 数据输入与输出 (I/O) 闭环工具箱

### 1. 数据的导入 (Input)

* **方式一：从外部裸文件直接抽入（不触发 MapReduce 计算）**
```sql
LOAD DATA [LOCAL] INPATH '路径' [OVERWRITE] INTO TABLE 表名;
```
* 带 `LOCAL`：从 Linux 本地文件系统（`file://`）抓取，本质是复制。
* 不带 `LOCAL`：从 HDFS 内部移动，本质是 **`mv` 剪切**。
* `OVERWRITE`：清洗并覆盖掉原表内所有老数据。


* **方式二：数仓内部表对表高效导流 (经过 MapReduce 计算)**
```sql
INSERT [OVERWRITE | INTO] TABLE 目标表 SELECT 字段 FROM 源表;
```



### 2. 数据的导出 (Output)

* **方式一：通过标准 SQL 直接对冲导出到文件**
```sql
INSERT OVERWRITE [LOCAL] DIRECTORY '目标路径' SELECT * FROM 表名;
```

* **方式二：利用 Linux CLI 终端静默秒刷（适合自动化 Shell 脚本调度）**
```bash
/export/server/hive/bin/hive -e 'SELECT * FROM my_db.t_table;' > /my/local/path/res.txt
```


* **分隔符底牌说明**：HDFS 内部的文本行，默认字段分隔符是 `\001`（部分高级编辑器中显示为 `SOH` 占位符）。在建表时通过 `ROW FORMAT DELIMITED FIELDS TERMINATED BY '期待字符'` 可以将其像素级替换为您需要的业务符号（如 `,` 或 `\t`）。