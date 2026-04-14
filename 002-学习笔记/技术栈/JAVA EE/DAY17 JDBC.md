---
created: 2026-01-02
modified: 2026-01-04
title: DAY17 JDBC
tags:
  - 技术栈
subject: JavaEE
---

在 Java 企业级开发中，与数据库交互是几乎无法绕开的任务。尽管如今有 MyBatis、JPA 等高级 ORM 框架，但理解 **JDBC（Java Database Connectivity）** 的底层机制，仍是写出高效、安全、可靠数据访问代码的基础。本文将从最基础的数据库连接出发，逐步深入到预编译语句、批处理、连接池和事务控制，结合实际代码，系统梳理 JDBC 编程的核心要点。

---

## 一、建立数据库连接：从 DriverManager 到 DataSource

最简单的 JDBC 连接方式是使用 `DriverManager`：

```java
String url = "jdbc:mysql://localhost:3306/learnjdbc?useSSL=false&serverTimezone=UTC";
try (Connection conn = DriverManager.getConnection(url, "root", "1234")) {
    // 使用连接
}
```

这种方式适用于小型应用或学习场景，但在生产环境中存在明显缺陷：**每次请求都创建新连接，开销大且无法复用**。

### 引入连接池：HikariCP

为解决性能瓶颈，现代应用普遍采用**连接池**。HikariCP 是目前性能最优的 Java 连接池之一：

```java
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:mysql://localhost:3306/learnjdbc");
config.setUsername("root");
config.setPassword("1234");
config.setMaximumPoolSize(10);

DataSource dataSource = new HikariDataSource(config);
try (Connection conn = dataSource.getConnection()) {
    // 使用连接
}
```

> **关键机制**：`conn.close()` 并非真正关闭 TCP 连接，而是将连接**归还给池**，供后续请求复用。这极大减少了连接创建/销毁的系统开销。

---

## 二、执行 SQL：Statement vs PreparedStatement

### 1. Statement：简单但危险

```java
String sql = "SELECT * FROM students WHERE gender = " + userInput;
try (Statement stmt = conn.createStatement();
     ResultSet rs = stmt.executeQuery(sql)) {
    // 处理结果
}
```

这种方式存在严重 **SQL 注入风险**。若 `userInput` 为 `"1 OR 1=1"`，将导致全表泄露。

### 2. PreparedStatement：安全且高效

```java
String sql = "SELECT id, grade, name, gender FROM students WHERE gender = ? AND grade = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setInt(1, 1);      // 性别：1 表示男
    ps.setLong(2, 3);     // 年级：3
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            long id = rs.getLong(1);
            long grade = rs.getLong(2);
            String name = rs.getString(3);
            int gender = rs.getInt(4);
            // ...
        }
    }
}
```

**优势**：

- **防注入**：参数通过二进制协议单独传输，与 SQL 模板分离；
- **性能优化**：数据库可缓存执行计划，重复执行时无需重新解析。

> **注意**：参数索引从 1 开始；类型需匹配（如 `gender` 是 `TINYINT`，应使用 `setInt` 而非 `setObject("M")`）。

---

## 三、插入数据并获取自增主键

当表使用 `AUTO_INCREMENT` 主键时，常需在插入后立即获取生成的 ID：

```java
String sql = "INSERT INTO students(grade, name, gender) VALUES (?, ?, ?)";
try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
    ps.setLong(1, 1);
    ps.setString(2, "yhf");
    ps.setInt(3, 1);
    
    int rows = ps.executeUpdate(); // 返回影响行数
    
    try (ResultSet keys = ps.getGeneratedKeys()) {
        if (keys.next()) {
            long id = keys.getLong(1); // 获取自增主键
            System.out.println("新学生ID: " + id);
        }
    }
}
```

**关键点**：

- 构造 `PreparedStatement` 时传入 `Statement.RETURN_GENERATED_KEYS`；
- `getGeneratedKeys()` 返回的 `ResultSet` 包含生成的主键值。

---

## 四、批处理：高效操作大量数据

逐条执行 INSERT/UPDATE 在数据量大时效率极低。JDBC 提供**批处理**机制：

```java
try (PreparedStatement ps = conn.prepareStatement(
        "INSERT INTO students(grade, name, gender) VALUES (?, ?, ?)")) {
    
    for (Student s : students) {
        ps.setLong(1, s.grade);
        ps.setString(2, s.name);
        ps.setInt(3, s.gender);
        ps.addBatch(); // 添加到批
    }
    
    int[] results = ps.executeBatch(); // 一次性执行所有语句
    System.out.println("共插入 " + results.length + " 条记录");
}
```

**优势**：

- 减少网络往返次数；
- 数据库可优化日志写入，提升吞吐量。

> **限制**：批处理**无法获取自增主键**。若需主键，应改用单条插入或业务生成 ID。

---

## 五、事务控制：保证数据一致性

当多个操作必须“全成功或全失败”时，需启用事务。

### 1. 基本事务流程

```java
Connection conn = dataSource.getConnection();
try {
    conn.setAutoCommit(false); // 关闭自动提交，开启事务
    
    // 执行多条 SQL（如插入学生 + 记录日志）
    insertStudent(conn, student);
    insertLog(conn, "student created");
    
    conn.commit(); // 全部成功，提交
} catch (SQLException e) {
    conn.rollback(); // 出错，回滚所有操作
    throw e;
} finally {
    conn.close(); // 归还连接
}
```

**核心原则**：

- **`setAutoCommit(false)` 是事务起点**；
- **异常时必须显式 `rollback()`**，否则部分操作会残留；
- **连接池会自动重置连接状态**，无需手动 `setAutoCommit(true)`。

### 2. 隔离级别控制

为应对并发问题，可设置事务隔离级别：

```java
conn.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
```

MySQL InnoDB 默认使用 `REPEATABLE READ`，通过 **MVCC + 间隙锁** 有效防止脏读、不可重复读和幻读。

> **重要提醒**：隔离级别**无法解决丢失更新**（Lost Update）。例如两个事务同时读取分数后修改，后提交者会覆盖前者。

### 3. 防止丢失更新：显式加锁

在“读取 → 计算 → 更新”场景中，必须使用悲观锁：

```java
// 在事务内执行
String sql = "SELECT score FROM students WHERE id = ? FOR UPDATE";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setLong(1, studentId);
    ResultSet rs = ps.executeQuery();
    // ... 基于当前值计算新分数
    // 执行 UPDATE
}
```

`FOR UPDATE` 会对查询行加排他锁，阻塞其他事务修改，直到当前事务结束。

> **前提**：`WHERE` 条件字段必须有索引，否则可能升级为表锁，严重影响并发性能。

---

## 六、最佳实践总结

| 场景         | 推荐做法                                                             |
| ---------- | ---------------------------------------------------------------- |
| **数据库连接**  | 使用 HikariCP 等连接池，避免 `DriverManager` 直连                           |
| **SQL 执行** | 始终使用 `PreparedStatement`，禁止字符串拼接                                 |
| **批量操作**   | 使用 `addBatch()` + `executeBatch()` 提升性能                          |
| **事务控制**   | `setAutoCommit(false)` → 执行 SQL → `commit()` / `rollback()`      |
| **并发更新**   | 对关键读写使用 `SELECT ... FOR UPDATE`                                  |
| **资源管理**   | 用 `try-with-resources` 自动关闭 `Connection`、`Statement`、`ResultSet` |

---

## 结语

JDBC 虽然底层，但其设计体现了数据库交互的核心思想：**连接复用、参数化查询、批量优化、事务原子性**。掌握这些原理，不仅能写出健壮的原生 JDBC 代码，更能深入理解上层框架（如 Spring Transaction、MyBatis）的工作机制。在追求开发效率的同时，不忘底层逻辑，方能在复杂场景中游刃有余。