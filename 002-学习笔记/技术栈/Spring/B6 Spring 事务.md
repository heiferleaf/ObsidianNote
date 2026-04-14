---
created: 2026-02-17
modified: 2026-03-01
---


# 🛡️ Spring 事务管理 (XML 配置版)

### 1. 核心结构与依赖

Spring 事务管理不是自己去写 `commit` 或 `rollback`，而是通过 **平台事务管理器 (PlatformTransactionManager)** 接口来适配不同的数据库技术（如 JDBC, MyBatis, Hibernate）。

> [!TIP] 必备依赖
> 
> 除了 Spring 核心包，你需要 `spring-jdbc`（包含事务核心类）和 `aspectjweaver`（用于 AOP 织入）。

---

### 2. XML 配置三部曲

配置事务的逻辑是：**定义管家（事务管理器） -> 定义规则（通知） -> 定义地盘（切面）**。

XML

```
<bean id="txManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource"/>
</bean>

<tx:advice id="txAdvice" transaction-manager="txManager">
    <tx:attributes>
        <tx:method name="save*" propagation="REQUIRED" isolation="DEFAULT" read-only="false" rollback-for="Exception"/>
        <tx:method name="update*" propagation="REQUIRED"/>
        <tx:method name="delete*" propagation="REQUIRED"/>
        <tx:method name="find*" read-only="true" propagation="SUPPORTS"/>
        <tx:method name="*" read-only="false"/>
    </tx:attributes>
</tx:advice>

<aop:config>
    <aop:pointcut id="txPointcut" expression="execution(* com.whu.service..*.*(..))"/>
    <aop:advisor advice-ref="txAdvice" pointcut-ref="txPointcut"/>
</aop:config>
```

---

### 3. `<tx:method>` 属性详细说明 

这是笔记中最核心的部分

| **属性名**               | **含义**   | **详细说明与推荐配置**                                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| **`name`**            | 方法名      | 支持 `*` 通配符。如 `get*`, `save*`。                                                                     |
| **`propagation`**     | **传播行为** | **REQUIRED (最常用)**：有事务就用，没事务就建新的。<br><br>  <br><br>**REQUIRES_NEW**：不管有没有都开新的，把旧的挂起。              |
| **`isolation`**       | **隔离级别** | **DEFAULT**：使用数据库默认（MySQL通常是 Repeatable Read）。<br><br>  <br><br>解决脏读、不可重复读、幻读。                    |
| **`read-only`**       | **是否只读** | **false (默认)**。如果是查询方法，设为 `true`。数据库会做优化，且不允许增删改。                                                 |
| **`timeout`**         | 超时时间     | 单位：秒。默认 `-1`（不超时）。防止事务执行太久占用连接。                                                                   |
| **`rollback-for`**    | **回滚异常** | **非常重要！** Spring 默认只对 `RuntimeException` 回滚。<br><br>  <br><br>建议设为 `java.lang.Exception` 以覆盖所有异常。 |
| **`no-rollback-for`** | 不回滚异常    | 遇到特定异常依然提交事务。                                                                                     |

---

### 🎓 老大哥的深度拆解：什么是“事务传播行为”？

很多同学死记硬背 `REQUIRED`，你可以这样理解：

- **REQUIRED (默认值)**：老大哥带小弟。如果老大哥（ServiceA）已经开了事务，小弟（ServiceB）直接加入。如果没有，小弟自己开一个。**一荣俱荣，一损俱损。**
    
- **REQUIRES_NEW**：小弟有脾气。不管老大哥有没有事务，小弟都自己新开一个事务，老大哥的事务先挂起，等小弟忙完了老大哥再继续。**小弟回滚不影响老大哥。**
    

---

### 👨‍🏫 职业建议

> [!CAUTION] 事务失效的经典场景
> 
> 虽然你学的是 XML 配置，但原理是一样的。面试官常问：**“为什么我加了事务但不回滚？”**
> 
> 1. **异常被 `try-catch` 了**：AOP 拦截不到抛出的异常，它以为方法执行成功了，于是提交。
>     
> 2. **方法内部调用**：类里面的 `methodA()` 调用同类的 `methodB()`，事务会失效。因为这绕过了代理对象（AOP 是基于代理的），通过this指针，调用代理之前的方法。
> 3. **方法访问修饰符不支持**：在Spring中，事务允许修饰的方法必须是 public 的，不管AOP的代理方式的JDK还是CGLIB
>     
> 4. **数据库引擎不支持**：比如 MySQL 用了 MyISAM 而不是 InnoDB，事务配置得再好也没用。


### 4. 纯注解配置

1. @Transactional
	注解属性和xml中tx:advice一样
2. 配置类上注解@EnableTransactionManagement
3. 配置类中配置DataSourceTransactionManagement的Bean