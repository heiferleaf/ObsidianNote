---
title: DAY2 Spring 编程
created: 2026-01-29
modified: 2026-01-30
tags:
  - 技术栈
subject: Spring
---

## Spring 中的编程思想

![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=203&rect=11,270,562,487|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000183.pdg]]

## BOP 编程

`Bean` 对象
- 是将自己的生命周期交给容器进行管理的 `Java` 对象
- 由 `Java` 类定义 + 容器配置组成的。其中容器配置包含
	- `Bean` 是单例还是多例
	- 初始化之后执行什么方法
	- 依赖于谁
	- 等等
- 通过容器中的 `Bean`，才能实现
	- `DI`（依赖注入）
	- `AOP`（面向切片编程）
	- 等等

## BeanFactory

`Spring` 中
- 设计核心：`org.springframework.beans` 包，主管容器中 `bean` 对象的创建，通常用户不会直接使用，是由服务器使用的
- 架构核心：`org.springframework.core` 包，包含了很多和业务无关的工具类，比如资源加载、类型转换、甚至一些处理反射的工具类

而在`org.springframework.beans` 中，通过工厂创建 `bean` 对象，有两种方式
- 单例
- 原型

## AOP 编程

面向切片编程，将一些影响多个类的行为，比如日志输出等，封装为模块，在使用处通过声明，将模块型用到具体的组件。实现代码松耦合![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=210&rect=25,608,582,671|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000190.pdg]]

