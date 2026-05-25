---
title: DAY25 Spring 学习
created: 2026-01-26
modified: 2026-01-26
tags:
  - Spring
subject:
---
> 先学会如何用，在掌握细节原理

## SpringBoot

传统的 `Spring` 项目，采用 `Spring Framework` 核心子框架来搭建。这个框架还需要一些其他子框架辅助。
- `Spring Security` ： 认证授权
- `Spring Data` : 数据获取
- `Spring AMQP` : 消息传递
- `Spring Cloud` ： 服务治理
这些 `Spring` 子项目都依赖于 `Framework` 项目。在实际使用中，按照需求使用。

而这么多子项目的构建，就导致了使用 `Spring Framework` 搭建项目的时候，配置很麻烦。
1. 导入依赖繁琐：所有子项目的依赖，都需要手动导入
2. 项目配置繁琐：需要写 `XML` 文件声明大量的  `Bean` 对象

在使用 `SpringBoot` ，因为他的一些特性，可以简化开发。
1. 起步依赖：`SpringBoot` 项目会引入一个起步依赖，这个依赖包含了之前项目中，一些常用的依赖组合
```xml
   spring-boot-starter-web
```
> 这个起步依赖包含了 Web 开发会使用的大量 Maven 坐标。同时避免了依赖的版本冲突问题
2. 自动配置：会自动配置一些依赖需要的 `Bean` 对象
	比如引入 `MyBatis` 的起步依赖，就会自动配置 `SqISessionFactoryBean` `MapperScannerConfigurer` 对象
3. 内嵌 `Tomcat` `Jetty` 等服务器。（无需要打包成 `war` 包）
4. 外部化配置：一些属性的配置，可以写在工程外面，当配置变化时，工程不需要重新编译打包。可以直接运行
5. 项目配置不需要使用 `xml` 配置（通过`yaml`、`properities`）