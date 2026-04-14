---
created: 2026-01-30
modified: 2026-01-31
---
# 架构
## 架构图

![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=211&rect=98,86,462,363|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000191.pdg]]

## 核心容器部分

^5b2130

`Core Container`
	1. `spring-beans`
	2. `spring-core`
	3. `spring-context`
	4. `spring-expression`

- 前两个是 `spring` 的核心模块，包含了 `IOC` 和 `DI`。其中 `BeanFactory` 使用控制反转，将应用程序的配置和实际的应用程序代码进行分离。 ==工厂实例化之后，不会自动实例化 `Bean`，只有 `Bean` 使用的时候，工厂才会进行装配==
- `spring-context` 拓展了 `BeanFactory` ，增加了 `Bean` 声明周期控制，框架事件体系和透明化加载等功能
	- `ApplicationContext` 是该模块的核心接口，是 `BeanFactory` 的子类。不同的是，在 `ApplicationContext` 实例化之后，会自动实例化所有**单例**的 `Bean` 对象
- `spring-expression` 模块是统一表达式语言的拓展模块，可以查询管理运行中的对象，可以调用对象中的方法

## AOP和设备支持

- `spring-aop`
- `spring-aspects`
- `spring-instuctment`

都是实现AOP的模块，借助动态代理的技术，在运行时生成代理类，改变一个类的功能

## 数据访问与集成

- `spring-jdbc` : 简化 jdbc 的操作，主要提供了 jdbc 的模板方法，关系型数据库对象化方法，事务管理方法
- `spring-tx` : 是 spring jdbc 事务控制的实现。事务控制一般需要放在业务层，而持久层需要实现数据库事务的持久性
- `spring-orm`
- `spring-oxm` : 将 Java 对象和 xml 数据进行映射，oxm（Object-to-XML-Mapper）
- `spring-jms` : 可以发送消息和接收消息

## Web 组件

- `spring-web` : 提供web基础
- `spring-webmvc` : 实现了 spring 的 MVC 架构
- `spring-websocket` : 和web客户端进行全双工通信的协议
- `spring-webflux` : 建立异步的，非阻塞的、事件驱动的服务

## 通信报文

- `spring-message` : 报文传送

## 集成测试

## 集成兼容

# 版本号说明

`X.Y.Z[a-c][正整数][.dev[正整数]]` : 
- X : 主版本号，当API的兼容性发生变化时，X递增
- Y : 次版本号，当API兼容其没有变化，增加了一些新功能
- Z : 修订号，当API兼容性没有发生变化，修复了一些漏洞
- `[a-c][正整数]` : 先行版本号，版本不稳定
- `.dev[正整数]` : 开发版本号，用于CI/CD

版本修饰词说明![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=218&rect=19,362,583,758|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000198.pdg]]

使用版本时限定符号![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=218&rect=12,68,587,307|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000198.pdg]]