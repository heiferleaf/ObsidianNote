---
created: 2026-02-08
modified: 2026-02-10
---

## BeanFactory 提供的获取bean的方法

1. Object getBean(String name)
2. T getBean(Class type) : 需要ioc容器中只有一个对应类型的Bean
3. T getBean(String name, Type name)

## 配置非自定义的Bean

当我们使用一些第三方的jar包，想把其中的一些类作为Bean进行管理。
1. 考虑Bean的实例化方法：构造函数（有参无参）、静态工厂、实例工厂
2. 考虑Bean中字段的注入方式

## Bean 实例化的基本流程化

- 在 Spring 容器初始化的时候，会将 xml 配置的 bean 信息封装成 BeanDefinition 对象
- 所有的 BeanDefinition 存储到一个 Map 集合中
- Spring 容器通过对集合进行遍历，使用反射创建 Bean 实例对象
- 将创建好的 Bean 对象存在一个 singletonObjects 的 map集合中
- 当调用getBean方法时，获取实例化的对象

## Spring 后处理器

允许我们介入到 Bean 的实例化流程中，实现动态注册 BeanDenifition，动态修改 Bean定义来动态修改Bean。主要有两种
- BeanFactoryPostProcessor: Bean工厂后处理器，在BeanDefinitionMap填充完毕，Bean实例化之前执行
- BeanPostProcessor：Bean后处理器，在Bean实例化之后，填充到SingletonObjects之前执行。==每次创建一个Bean==

## Bean 的生命周期

Spring Bean 生命周期的定义：从Bean通过反射，调用构造函数，实例化之后，到Bean称为一个完整对象，存储到单例池中，这个过程过程叫做Bean的生命周期。
答题可以分为三个阶段
1. Bean 的实例化阶段：Spring 从 BeanDefinition 信息中进行判断，Bean scope是否是singleton，是否lazy-init，是否不是FactoryBean（会延迟加载）。最终，将一个 **singleton 的Bean，通过反射构造实例
2. Bean 的初始化阶段：Bean实例化之后，还需要
	1. 对属性进行填充
	2. 执行Aware接口方法
	3. 执行BeanPostProcessor方法（before）
	4. 执行InitializingBean接口方法
	5. 执行自定义的init方法
	6. 执行BeanPostProcessor方法（after）
3. Bean 的完成阶段：经过初始化之后，bean会被存储到beanFactory的单例池中

其中，第二个阶段是重点。首先学习属性注入。
根据属性的类别，分为
- 基本数据类型，或者存储基本数据类型的集合 （这里基本数据类型包括了String）
- 引用数据类型（依赖注入）
	- 单向依赖，A注入B，B不需要A（容器能够按照依赖链顺序初始化Bean）
	- 双向依赖，依赖循环。通过三级缓存解决这种问题

> [!NOTE] 三级缓存的实现
> 1. singletonObjects（一级缓存）：完整的Bean存储
> 2. earlySingletonObjects（二级缓存）：实例化之后的，且被引用的Bean存储，是不完整的bean
> 3. singletonFactories（三级缓存）：没有被引用的Bean存储，也是不完整的bean


> 考虑以下 UserServiceImpl（记为A） 和 UserDao(记为B) 相互注入的过程
> - 实例化A，将A放入三级缓存
> - A进行属性注入，在三个缓存中依次寻找B，未找到
> - 实例化B，将B放入三级缓存
> - B进行属性注入，在三级缓存中找到了A，将A放到二级缓存
> - B初始化结束，成为完整的Bean，移到一级缓存，移除二三级缓存中的B
> - A进行属性注入，在一级缓存中找到B
> - A完成实例化，将A放入一级缓存，移除二三级缓存的A


## Aware 接口注入一些属性

通过实现Aware接口，Bean可以获取一些运行时的变量环境。
- ServletContext
- ApplicationContext
- BeanName
- BeanFactory
通过实现接口对应的回调函数，可以获取上面这些变量

![[QQ_1770557349765.png]]