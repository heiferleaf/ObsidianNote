---
created: 2026-02-07
modified: 2026-02-07
---
> 之后转为通过 B站视频进行学习

## IOC DI

Ioc(Inversion of Control, 控制反转)。将原来代码中对象的创建、配置，反转给容器来帮忙实现。需要有一个容器，并且让容器知道要创建的对象与对象之间的关系。这个关系描述的具体实现就是配置文件。

DI(Dependency Injection，依赖注入)。对象被动接收依赖类，在容器实例化一个对象的时候，主动将他的依赖类注入给他，而不是自己去寻找。


## Spring 核心容器类图

### 1、BeanFactory

![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=249&rect=22,208,552,447|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000229.pdg]]

Spring 中，Bean的创建采用工厂模式，一系列的Bean工厂，就是Ioc容器
- 最顶层的接口是 `BeanFactory`
- 最终的实现类是 `DefaultListableBeanFactory`
- 设计这么多层次的接口，目的是为了区分Spring内部操作过程中对象的传递和转化，对对象的数据访问进行限制
	- `ListableBeanFactory` 表示Bean可以列表化
	- `HierarchicalBeanFactory` 表示Bean之间有继承关系，每一个Bean可能有父Bean
	- `AutowireCapableBeanFactory` 接口定义Bean的自动装配规则
	- 这三个接口定义了Bean的集合、Bean之间的关系，Bean的行为
`FactoryBean` 只对Ioc容器的基本行为做了定义，根本不关心Bean是如何定义，怎么加载的
要想知道工厂具体如何生产对象，需要看具体实现的Ioc容器，Spring提供了许多Ioc容器实现，`GenericApplicationContext`等等

### BeanDefinition

Spring Ioc 容器管理我们定义的Bean对象和之间的相互关系。而这个Bean对象的定义和相互关系通过 BeanDefinition 来表示![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=251&rect=56,317,499,561|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000231.pdg]]
### BeanDefinitionReader

Bean对象的解析过程很复杂，功能分的很细。Bean的解析主要就是对Spring 配置文件的解析，这个解析过程通过 `BeanDefinitionReader` 完成![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=251&rect=125,67,448,219|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000231.pdg]]

## 基于XML的IoC容器初始化

1. Ioc容器的初始化，包括 BeanDefinition 的Resource定位，加载和注册三个过程。
2. ApplicationContext Ioc容器允许上下文嵌套，保持父子继承关系。在Bean的检查中，先检查当前上下文，其次检查父上下文。
![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=257&rect=17,66,580,485|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000237.pdg]]
这些容器之间的功能差异，都是通过装饰器模式和策略模式实现的。在这些具体实现的容器的构造函数中，都调用 refresh 方法，来启动容器。
以 ClassPathXmlApplicationContext 类为例，在构造函数中，会执行
```Java
super(parent) // 父环境
setConfigLocation(configLocations) // resource 资源文件定位
if(refresh) {
	refresh() // 启动容器
}
```