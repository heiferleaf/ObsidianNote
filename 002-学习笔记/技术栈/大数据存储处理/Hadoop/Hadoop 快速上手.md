---
title: Hadoop 快速上手
created: 2026-06-02
modified: 2026-06-06
tags:
  - 技术栈
subject: Hadoop
---
# Hadoop 介绍

- `Hadoop` 是一款由 `Apache` 开源的软件，由 `java` 编写，允许用户通过编程建模，实现对于集群进行大数据的处理
	- 广义上来说，`Hadoop` 指围绕 `Hadoop` 为核心，搭建起来的处理大数据的生态圈
	- ![[QQ_1780401960835.png]]

- `Hadoop` 的核心组件包含：`HDFS`（分布式文件**存储**系统）`YARN`（集群**资源管理**和**任务调度**框架）`MapReduce`（分布式**计算**框架）
	- 目前前两者还是作为生态圈的基石，但是 `MapReduce` 已不是主流

- `Hadoop` 的优势
	- 可扩容：`Hadoop` 是在集群上完成的数据存储和计算，支持扩容
	- 成本低：由硬件能力不是那么强的通用计算机组成集群，处理大数据
	- 效率高：`Hadoop`可以在结点之间动态并发的移动数据
	- 可靠性：支持数据的备份，任务失败后自动重新部署

- `Hadoop` 发行版本，分为
	- 社区版（`Apache`）：迭代快，但是不稳定，**免费**
		- `1.0版本`：核心组件 `HDFS` `MapReduce`（包含现在 `MapReduce 和 YARN` 的功能）
		- `2.0版本`：三个核心组件，解耦
		- `3.0版本`：2.0 基础上做性能优化
	- 商业版：迭代慢，但是稳定，会解决一些社区版不支持的服务，**收费**

# Hadoop 集群

> `Hadoop` 集群包含
> 1. `HDFS` 集群
> 2. `YARN` 集群
>    
> 两者在物理上在一起，从逻辑上分离，都是主从架构
> 1. 物理在一起：部署在一个物理机器上
> 2. 逻辑上分离：集群之间没有任何依赖关系


![[QQ_1780403088331.png]]

- `HDFS`集群，包含
	- 主节点 `NameNode`（NN）
	- 从节点 `DataNode`（DN）
	- 主节点的辅助结点 `SecondaryNameNode` (SNN)
- `YARN` 集群，包含
	- 主节点 `ResourceManager` （RM）
	- 从节点 `NodeManager` (NM)

# 环境配置

- 前置：两台 `Ubuntu` 虚拟机，一台 `Kali` 虚拟机（利用现有的）
- 配置点：域名文件（给虚拟机起外号，方便后续互联）、防火墙关闭、时钟同步、JDK配置

## 一、 集群节点规划与域名配置（/etc/hosts）

为了方便后续各个组件通过机器名直接互联，需要为每台虚拟机配置本地 DNS 映射。

### 1. 配置域名映射文件

在 **三台机器** 上分别执行 `vim /etc/hosts`，在文件末尾追加集群内所有节点的 IP 与别名映射 (`ip a`)

```text
192.168.85.128  node1
192.168.85.129  node2
192.168.85.131  node3
```

## 二、 安全防护关闭（防火墙）

大数据组件内部通信需要开放大量随机端口。在实验内部局域网环境下，通常选择直接关闭防火墙以避免网络拦截。

### 1. Ubuntu 虚拟机（`node1` 与 `node2`）

分别在两台 Ubuntu 的 root 权限下执行：

Bash

```
ufw disable
```

### 2. Kali 虚拟机

Kali Linux 默认没有开启全局拦截型防火墙，你可以执行以下命令确认其处于关闭或放行状态：


```bash
iptables -F
```

## 三、 内网时钟同步闭环（Chrony）

分布式集群对节点间的时间同步要求极高。为规避部分机器由于外网网络或端口限制导致同步失败（404 或超时），采用**内网闭环模式**：只让主节点连接外网，其余节点向主节点同步。

### 1. 主节点（`node1）配置

主节点负责对接外网国家授时中心并共享时间。执行 `vim /etc/chrony/chrony.conf`：

```
# 确保包含可用的外网时间源
server ntp.ntsc.ac.cn iburst

# 允许你的虚拟机所在局域网段访问（例如 192.168.85.0 段）
allow 192.168.85.0/24
local stratum 10
```

保存后重启服务：`systemctl restart chrony`

### 2. 从节点与 Kali（`node2`、`node3`）配置

其余节点不再连接外网。执行 `vim /etc/chrony/chrony.conf`，将原有的 `pool` 或 `server` 全部用 `#` 注释，并在最上方直接指定主节点：


```
server node1 iburst
```

保存后重启服务：`systemctl restart chrony`

### 3. 验证同步

在各节点执行 `chronyc sources`，若输出列表中显示 `node1 且带有 `^*` 前缀，即代表内网时钟同步成功。

## 四、 统一目录规划与权限下放

为了保证后续组件安装路径完全一致，规范化创建存储目录，并将非系统级路径的所有权交由普通用户管理。

### 1. 在三台机器上分别创建标准目录


```
mkdir -p /export/server
mkdir -p /export/software
```

### 2. 变更所有权（以普通用户 `hai` 为例）

为了规避后续由于远程 `scp` 传输或组件启动时频繁触发 `Permission denied` 权限拒绝，直接放开 `/export` 的属主：


```bash
chown -R hai:hai /export
```

## 五、 JDK 部署与全局环境变量配置

### 1. 主节点（`node1`）部署

1. **Windows 下载**：利用 Windows 浏览器直接访问开源镜像站目录，下载标准 Linux 编译版本 `jdk8u492-b09` 的 `.tar.gz` 压缩包。
2. **挂载传输**：在虚拟机内执行 `vmhgfs-fuse .host:/ /mnt/hgfs -o allow_other` 激活 VMware 共享文件夹，直接从 `/mnt/hgfs/hostD/` 将压缩包解压至标准安装目录：
    ```bash
    tar -zxvf /mnt/hgfs/hostD/OpenJDK8U-jdk_x64_linux_hotspot_8u492b08.tar.gz -C /export/server/
    ```
    

### 2. 横向集群分发（SCP）

在主节点上，直接将解压就绪的 JDK 目录通过网络分发给 `node2` 和 `node3`（由于前面已经对 `/export` 授过权，此处可以直接以普通用户身份远程写入）：


```bash
scp -r /export/server/jdk8u492-b09 hai@node2:/export/server/
scp -r /export/server/jdk8u492-b09 root@node3:/export/server/
```

### 3. 三台机器统一配置环境变量

在 **三台机器** 上分别执行 `vim /etc/profile`，在文件最底部追加以下教程标准环境变量：


```Plantext
export JAVA_HOME=/export/server/jdk8u492-b09
export PATH=$PATH:$JAVA_HOME/bin
export CLASSPATH=.:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar
```

### 4. 刷新与最终验证

在三台机器上分别执行刷新命令：

```bash
source /etc/profile
```

并在任意路径下键入以下命令（注意：**单横杠** 语法）：

```
java -version
```

当三个终端均正确打印出 `openjdk version "1.8.0_492"` 时，整个大数据集群的基础环境即宣告搭建完毕。


# Hadoop 集群配置

## 一、 系统全局环境变量：`/etc/profile`

在 **三台虚拟机**（`node1`, `node2`, `node3`）上分别执行 `vim /etc/profile`，在文件最底部粘贴以下内容：

```text
export JAVA_HOME=/export/server/jdk8u492-b09
export HADOOP_HOME=/export/server/hadoop-3.3.6
export PATH=$PATH:$JAVA_HOME/bin:$HADOOP_HOME/bin:$HADOOP_HOME/sbin
export CLASSPATH=.:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar

export HDFS_NAMENODE_USER=root
export HDFS_DATANODE_USER=root
export HDFS_SECONDARYNAMENODE_USER=root
export YARN_RESOURCEMANAGER_USER=root
export YARN_NODEMANAGER_USER=root

```

修改完成后，在三台机器上分别执行刷新指令：

```bash
source /etc/profile

```

## 二、 核心配置文件：`core-site.xml`

请粘贴到 `node1` 的 `hadoop-3.3.6/etc/hadoop/core-site.xml` 的 `<configuration>` 标签内：

```xml
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://node1:8020</value>
    </property>

    <property>
        <name>hadoop.tmp.dir</name>
        <value>/export/data/hadoop-3.3.6</value>
    </property>

    <property>
        <name>hadoop.http.staticuser.user</name>
        <value>root</value>
    </property>

    <property>
        <name>hadoop.proxyuser.root.hosts</name>
        <value>*</value>
    </property>

    <property>
        <name>hadoop.proxyuser.root.groups</name>
        <value>*</value>
    </property>

    <property>
        <name>fs.trash.interval</name>
        <value>1440</value>
    </property>

```

## 三、 HDFS 配置文件：`hdfs-site.xml`

请粘贴到 `hadoop-3.3.6/etc/hadoop/hdfs-site.xml` 的 `<configuration>` 标签内：

```xml
    <property>
        <name>dfs.namenode.secondary.http-address</name>
        <value>node2:9868</value>
    </property>

```


## 四、 MapReduce 配置文件：`mapred-site.xml`

请粘贴到 `hadoop-3.3.6/etc/hadoop/mapred-site.xml` 的 `<configuration>` 标签内：

```xml
    <property>
        <name>mapreduce.framework.name</name>
        <value>yarn</value>
    </property>

    <property>
        <name>mapreduce.jobhistory.address</name>
        <value>node1:12820</value>
    </property>

    <property>
        <name>mapreduce.jobhistory.webapp.address</name>
        <value>node1:19888</value>
    </property>

    <property>
        <name>yarn.app.mapreduce.am.env</name>
        <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
    </property>

    <property>
        <name>mapreduce.map.env</name>
        <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
    </property>

    <property>
        <name>mapreduce.reduce.env</name>
        <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
    </property>

```


## 五、 YARN 配置文件：`yarn-site.xml`

请粘贴到 `hadoop-3.3.6/etc/hadoop/yarn-site.xml` 的 `<configuration>` 标签内：

```xml
    <property>
        <name>yarn.resourcemanager.hostname</name>
        <value>node1</value>
    </property>

    <property>
        <name>yarn.nodemanager.aux-services</name>
        <value>mapreduce_shuffle</value>
    </property>

    <property>
        <name>yarn.nodemanager.pmem-check-enabled</name>
        <value>false</value>
    </property>

    <property>
        <name>yarn.nodemanager.vmem-check-enabled</name>
        <value>false</value>
    </property>

    <property>
        <name>yarn.log-aggregation-enable</name>
        <value>true</value>
    </property>

    <property>
        <name>yarn.log.server.url</name>
        <value>http://node1:19888/jobhistory/logs</value>
    </property>

```


## 六、 集群节点配置文件：`workers`

主节点上编辑 `hadoop-3.3.6/etc/hadoop/workers` 文件，清空原有内容，严格按以下内容换行写入：
配置 `DataNode` 和 `NodeManager`

```text
node1
node2
node3
```

# Hadoop 使用

### 格式化文件系统（仅在首次启动前执行一次）

在 **`node1`** 终端运行格式化 NameNode 命令：

```
hdfs namenode -format
```

> **检查标准**：敲完命令后终端会疯狂刷屏。请向上翻滚检查输出日志，只要看到有一行包含 **`Has successfully formatted`** 或者是 **`Exited with status 0`**，且没有抛出严重 Exception，就说明 `node1` 的初始元数据账本已经成功建立。
> **警告**：以后集群正常运行后，千万不要重复执行这句格式化命令，否则会导致集群的 `clusterID` 发生不一致，从而引发 DataNode 无法启动或数据丢失！

### 启动、停止服务

- 开启/停止指定 `HDFS` 服务 ： 
  `hdfs --daemon start/stop/restart namenode/datanode/secondarynamenode`
- 开启/停止指定 `YARN` 服务 ：
   `yarn --daemon start/stop/restart resourcemanager/nodemanager`
- 所有 `HDFS` 集群开启/停止 ： `start/stop-dfs.sh`
- 所有 `YARN` 集群开启/停止 ：`start/stop-yarn.sh`

### 文件夹创建、文件上传、删除、查看

> 本质上，Hadoop 就是一个文件系统，是把物理上的多台机器组成的集群，抽象为逻辑上的一个文件系统。支持分布式的存储管理，资源管理，分布式的计算，因此适合处理大数据。

- `hadoop fs -mkdir 路径/文件夹名`
- `hadoop fs -put 本地文件 文件系统路径` ： 上传本地文件用
- `hadoop fs -rm 文件`
- `hadoop fs -ls 路径`

总而言之就是基本和 `linux` 命令一样