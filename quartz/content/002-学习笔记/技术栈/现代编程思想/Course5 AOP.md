---
created: 2026-04-03
modified: 2026-04-03
---
1. 在反射的方法获取中，优先获取子类自己的重写方法

```java

Class clazz = ...

clazz.getMethods(); // 获取所有父类、接口和自己的共有方法
clazz.getMethod(方法名, 参数类型列表) // 优先获取子类的方法（public）

```

2.  对于 AOP 的概念理解
- JoinPoint ： 连接点，是在 Spring AOP 中，访问AOP生成的代理对象的方法时，动态产生的实例，包含了代理对象，被代理对象，代理方法，方法调用参数，执行链，这些上下文信息。
- PointCut ： 切入点，是在编译时确定的唯一的匹配规则，用于 JointPoint 筛选使用的执行链中的执行者。

3. Order 影响的顺序
	是同一种注解方法，比如都是 @Before ，之间的执行顺序，不会改变类A的before 和类B的after 之间的顺序。
	换句话说，以被代理方法的执行P为分界，在P之前执行的，和在P之后执行的，是不会被影响的，但是都在P之前执行的，和都在P之后执行的，比如 @Before @Around的前，会作为一个整体，进行顺序执行


4. 注解的执行顺序

```
Around 前
	Before
	try {
		执行
		after-return
	} catch() {
		after-throwing
	} fianlly {
		after
	}
Around 后 （如果catch中没有继续抛出异常）
	
```

