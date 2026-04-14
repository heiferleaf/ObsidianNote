---
created: 2026-03-30
modified: 2026-03-30
title: Kafka、分库分表
tags:
  - 技术栈
subject: 分布式软件
---

本篇笔记的内容为：
1. 通过Kafka实现消息队列，从而实现业务逻辑的异步处理，起到代码解耦、提高响应时间，削峰填谷的作用，也带来了编程代码的复杂程度上身，调试困难的问题。此外，还需要额外注意，同一个用户发送的有逻辑顺序的消息，需要被存储在通过一个Topic的同一个分区中，发送消息时，设计确认机制，防止消息丢失，设计生产者和消费者的幂等性，和状态机。
2. 实现分库分表，提高数据库的并发连接数，提高针对数据表的读写速度。但是需要考虑的问题更多，分片键的选择，数据分片算法的选择，水平分片时主键唯一性，多表连接时的问题，数据倾斜问题，深分页的时候，查询速度超慢，因为每一张水平表都需要查询相同数据的数据，然后去重排序；还有的像数据迁移时的开销


具体配置流程

1. `Docker-compose.yaml` 文件
	- 数据库
		- 需要配置多个数据库，实现水平分库效果
		- 每一个数据库，在容器创建的时候，执行`init`代码，都创建两个表
		>  一共2个库，4张表
	- Kafka 配置
		- 环境变量KAFKA_PROCESS_ROLE: broker, controller 不使用 Zoopkeeper 来管理配置，高版本的 Kafka 自己可以同时是 Broker 和 Controller
		- 给可视化工具 Kafdrop 和 后端服务使用的是两个端口
```yaml
	services:  
  # 数据库 1：ds1  
  mysql0:  
    image: mysql:8.0  
    container_name: medical-mysql0  
    environment:  
      - MYSQL_ROOT_PASSWORD=1234  
      - MYSQL_DATABASE=medical_ds0 # 首次运行容器时创建数据库  
    ports:  
      - "3307:3306"  
    volumes:  
      - ./mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro  
  
  mysql1:  
    image: mysql:8.0  
    container_name: medical-mysql1  
    environment:  
      - MYSQL_ROOT_PASSWORD=1234  
      - MYSQL_DATABASE=medical_ds1  
    ports:  
      - "3308:3306"  
    volumes:  
      - ./mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro  
  
  kafka:  
    image: apache/kafka:3.8.0  
    container_name: medical-kafka  
    restart: unless-stopped  
    ports:  
      - "9092:9092"  
    environment:  
      # 1. 基础节点配置  
      KAFKA_NODE_ID: 1  
      KAFKA_PROCESS_ROLES: broker,controller  
  
      # 2. 监听器配置（重点：去掉 INTERNAL，改用标准的 PLAINTEXT）  
      # PLAINTEXT 给 Docker 内部用 (29092)      # EXTERNAL  给宿主机 IDEA 用 (9092)      # CONTROLLER 给集群控制面用 (9093)      KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:29092,EXTERNAL://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093'  
      KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://medical-kafka:29092,EXTERNAL://localhost:9092'  
  
      # 3. 安全协议映射（官方镜像建议全部加单引号）  
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT,PLAINTEXT:PLAINTEXT'  
  
      # 4. 其他核心配置  
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@medical-kafka:9093'  
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER'  
      KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT'  
  
      # 5. 自动创建 Topic 等常规配置  
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"  
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1  
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1  
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1  
      KAFKA_LOG_DIRS: '/tmp/kraft-combined-logs'  
  
    healthcheck:  
      test: [ "CMD", "bash", "-c", "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list" ]  
      interval: 10s  
      timeout: 10s  
      retries: 5  
      start_period: 30s  
  
  # ====================================================================  
  # Kafdrop：可视化监控界面  
  # 职能：能直观看到消息是否进了死信队列，Offset 移动到了哪里  
  # ====================================================================  
  kafdrop:  
    image: obsidiandynamics/kafdrop  
    container_name: medical-kafdrop  
    ports:  
      - "9000:9000" # 浏览器访问 http://localhost:9000 即可进入监控台  
    environment:  
      - KAFKA_BROKERCONNECT=kafka:29092 # 告诉监控台去哪里连接消息引擎  
    depends_on:  
      kafka:  
        condition: service_healthy  # 等 Kafka 真正就绪  
  
  sentinel:  
    image: bladex/sentinel-dashboard:latest  
    container_name: medical-sentinel  
    ports:  
      - "8858:8858"  
    environment:  
      - SENTINEL_DASHBOARD_AUTH_USERNAME=sentinel  
      - SENTINEL_DASHBOARD_AUTH_PASSWORD=sentinel
```

 ## 2. 引入的依赖配置
### 📋 方案核心思路
1. **解耦配置**：使用 `sharding.yaml` 独立管理分片规则，避免 Spring Boot 对 YAML 语法的误解析（尤其是 `$->{}`）。
2. **环境对齐**：针对 JDK 17+ 补全被移除的 JAXB 模块。
3. **引擎支持**：显式引入 Groovy，支持 `INLINE` 表达式。
4. **代理驱动**：使用 ShardingSphere 官方 JDBC 驱动代理，实现无缝接入。

---

### 1. 依赖管理 (Maven `pom.xml`)
必须包含以下四个维度的依赖，缺一不可：

```xml
<!-- 1. ShardingSphere 核心 (5.4.x 建议不再使用 starter，直接用 core 以获得最佳兼容性) -->
<dependency>
    <groupId>org.apache.shardingsphere</groupId>
    <artifactId>shardingsphere-jdbc-core</artifactId>
    <version>5.4.1</version>
</dependency>

<!-- 2. Groovy 脚本引擎 (必须有，否则无法解析 $->{...} 分片算法) -->
<dependency>
    <groupId>org.apache.groovy</groupId>
    <artifactId>groovy</artifactId>
    <version>4.0.23</version>
</dependency>

<!-- 3. JAXB API 兼容 (解决 JDK 17 缺失命名空间问题) -->
<dependency>
    <groupId>javax.xml.bind</groupId>
    <artifactId>jaxb-api</artifactId>
    <version>2.3.1</version>
</dependency>

<!-- 4. JAXB 运行时实现 (提供解析引擎) -->
<dependency>
    <groupId>org.glassfish.jaxb</groupId>
    <artifactId>jaxb-runtime</artifactId>
    <version>2.3.9</version>
</dependency>
```

---

### 2. 主配置入口 (`application.yml`)
利用 Spring Boot 的 `main.allow-bean-definition-overriding` 允许数据源覆盖，并指向外部配置文件：

```yaml
spring:
  main:
    # 允许 ShardingSphere 覆盖 Spring 默认生成的候选 Bean
    allow-bean-definition-overriding: true

  datasource:
    # 使用 ShardingSphere 专用驱动，通过 classpath 加载规则文件
    driver-class-name: org.apache.shardingsphere.driver.ShardingSphereDriver
    url: jdbc:shardingsphere:classpath:sharding.yaml
```

---

### 3. 分片规则定义 (`sharding.yaml`)
这是最核心的业务分片逻辑，注意其中的 **驼峰命名规则** 与 **双引号转义**。

```yaml
mode:
  type: Standalone  # 单机模式

dataSources:  # ⚠️ 注意此处为驼峰命名的 dataSources
  ds0:
    dataSourceClassName: com.zaxxer.hikari.HikariDataSource
    driverClassName: com.mysql.cj.jdbc.Driver
    jdbcUrl: jdbc:mysql://localhost:3307/medical_ds0?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: "1234"
  ds1:
    dataSourceClassName: com.zaxxer.hikari.HikariDataSource
    driverClassName: com.mysql.cj.jdbc.Driver
    jdbcUrl: jdbc:mysql://localhost:3308/medical_ds1?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: "1234"

rules:
  - !SHARDING
    tables:
      t_registration:
        # 物理表分布，使用双引号包裹表达式
        actualDataNodes: "ds$->{0..1}.t_registration_$->{0..1}"
        databaseStrategy:
          standard:
            shardingColumn: patient_id
            shardingAlgorithmName: database-inline
        tableStrategy:
          standard:
            shardingColumn: registration_id
            shardingAlgorithmName: table-inline
        keyGenerateStrategy:
          column: id
          keyGeneratorName: snowflake

    shardingAlgorithms:
      database-inline:
        type: INLINE
        props:
          # 使用 Math.abs 防止 hashCode 为负数导致的取模越界
          algorithm-expression: "ds$->{Math.abs(patient_id.hashCode()) % 2}"
      table-inline:
        type: INLINE
        props:
          algorithm-expression: "t_registration_$->{Math.abs(registration_id.hashCode()) % 2}"

    keyGenerators:
      snowflake:
        type: SNOWFLAKE
        props:
          worker-id: 123

props:
  sql-show: true # 调试阶段开启，控制台将输出 Logic SQL 与 Actual SQL
```

---

### 💡 核心要点总结（避坑检查清单）

1. **SnakeYAML 冲突**：Spring Boot 3 默认带的是 SnakeYAML 2.x，而老版 ShardingSphere (5.1.x) 只支持 1.x。**升级到 5.4.1** 是解决该冲突的终极办法。
2. **表达式取模**：在 `INLINE` 表达式中，建议始终使用 `Math.abs(...) % N`。否则如果 `hashCode` 是负数，取模后的结果可能找不到对应的数据库名（如 `ds-1`）。
3. **配置文件名称**：在独立的 `sharding.yaml` 中，主键是 `dataSources`（加了 **S** 且驼峰），而在 Spring Boot 内部配置通常是 `datasource`。
4. **JAXB 异常**：如果启动报 `ClassNotFound: javax.xml.bind.JAXBException`，说明你的 JDK 版本高于 8 且没有手动引入 `jaxb-api`。
5. **代理模式优势**：通过 `jdbc:shardingsphere:classpath:sharding.yaml` 接入，MyBatis/JPA 可以像操作普通单库一样操作 `t_registration` 逻辑表，无需改动任何 SQL 代码。
> 还可以重点关注一下Kafka的配置
> - 生产者指定 acks : all 。是防止消息丢失的手段，等到leader和ISR中的follower都确认之后，才能发送下一条消息
> - 生产者开启幂等性，防止产生重复消息，底层实现机制是通过唯一的序列号
> - 对于同一个用户，前后有逻辑顺序关系的、属于同一种Topic的消息，需要映射到相同的分区
> - 对于消费者，关闭自动提交，开启手动提交，在任务完成后提交，保证at-least-once
