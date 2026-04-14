---
created: 2026-02-14
modified: 2026-02-15
---

## Spring 整合第三方框架总结（注解方式）

### 1. 创建的类是已有的

类在第三方框架中已经存在，但是我们不能在已有源码上修改，无法注解@Component，所以通过在配置类中，申明@Bean方法，以实例工厂的方法创建Bean。

> 使用的注解：
> 1. @Configuration
> 2. @Bean
> 3. @Value @Autowired（方法参数中默认自带）@Qualifier @Resource

### 2. 创建的类是通过工厂得到的

对于这种类，我们通过将工厂注册为Bean，不通过直接创建类。
对于工厂的创建，通常通过使用 **FactoryBean**。以此避免工厂内部的复杂配置。换言之，FactoryBean 是第三方框架提供给我们的，关于工厂内部复杂配置，和将工厂注册为Bean的解耦类。
> 具体实现自然是通过像是 InizialingBean 接口，来初始化操作，而在重写的 getObject 方法中，得到真正的工厂


### 3. 创建的类需要进行动态代理

像MyBatis这种框架，我们编写代码时，是通过给工厂配置数据源和mapper的xml配置，然后动态的扫描mapper类包，将所有的接口转为一个具备数据源，可以真正执行sql操作的类。
但是，需要考虑以下要点
- 接口不能称为Bean
- 编写的Mapper接口中，没有任何方法的实现信息，以及数据源的信息
为此，通用的做法是注册一个配置的Bean，这个Bean实现了注册Bean定义的后处理器，在重写的方法中，会将所有的接口转为一个FactoryBean，在getObject的方法中，实现动态代理，将SQL执行所需要的信息都配置好


## XML和注解配置MyBatis框架的一些tips

1. 使用\<Bean> 标签来整合MyBatis
	- 需要将 `SqlSessionFactoryBean` 和 `MapperScannerConfigurer` 注册为Bean
		- 前者
			- 需要注入一个数据源 DataSource 和mapper的xml资源文件。
			- 实现 BeanFactory，提供SqlSessionFactory的Bean
		- 后者
			- 需要注入mapper包的路径
			- 实现注册的BeanFacotory后处理器，通过动态代理，使用sqlsession来得到具体的代理实现

2. 通过注解
	- @Component + Bean，将`SqlSessionFactoryBean`注册为Bean
	- @MapperScan，指定需要扫描的Mapper包路径，内部通过 @Import 注解，来动态的注册BeanDefinition

> 总之，先通过自己控制所有类的声明周期，观察需要创建的类，将这些类转为bean


## AOP

### 概念

AOP， Aspect Oriented Programming，面向切面编程。是OOP的升华，OOP是纵向对一个事物的抽象，包括行为和属性。而AOP是横向的，对不同事物进行一个抽象，**属性之间，方法之间，对象之间都可以组成一个切面**，这样面向切面的编程思想就是AOP。

- 目标对象（Target）：需要被增强的对象
- 代理对象（Proxy）：增强后的代理对象
- 连接点（JoinPoint）：目标对象中可以被增强的方法
- 切入点（PointCut）：目标对象中实际被增强的方法
- 通知/增强（Advice）：增强部分的代码逻辑
- 切面（Aspect）：切入点 + 通知
- 织入（Weaving）：将切入和通知组合的过程
### 示例

- 前提：存在类A对象a，类B对象b
- 想要对a的方法a1,和b的方法b1，进行一个切片组合
	> 也就是说，需要将a1和b1进行一个绑定，做完a1做b1
- 实现：动态代理

### Xml配置流程

1. 引入 AOP 坐标（aspectjweaver）
2. 准备Target、Advice，交给容器管理
3. 配置CutPoint（哪些方法需要被增强）
4. 配置Weaving织入（哪些方法被哪些方法增强）

### 具体的切点xml代码配置

> [!NOTE] 语法格式
> 
> `execution([访问修饰符] 返回值类型 包名.类名.方法名(参数))`

访问修饰符可选
通配符详解：

|**符号**|**含义**|**示例**|
|---|---|---|
|`*`|匹配任意一个部分|`* com.whu..*.*(..)` (任意返回值的类/方法)|
|`..`|匹配多级包或任意参数|`com.whu..` (whu包及其子包) / `(..)` (任意参数)|

> execution([] * com.whu.aop.\*.*(..)) 表示aop包下的类的所有方法

### 具体织入配置

AOP Aspect 配置
	1. before：方法之前增强
	2. after-return：方法正常返回之后执行
	3. after-throwing：方法抛出异常后执行
	4. around：环绕方法执行，方法抛出异常，环绕后不执行
	5. after：切入点完成后一定执行

AOP Advisor配置
	1. 编写通知类，实现 MethodBeforeAdvice 等接口
	2. 实现接口的方法，不同的接口就是不同的通知类型
	3. 配置文件中，使用\<aop:advisor> 标签，指定通知和切入点


<!--
1. 什么是AOP
	Aspect Oriented Programming 面向切片编程，在OOP的基础上，通过将对象、类方法、类属性进行横向的切片组合，实现功能的增强
2. 关键概念
	- Target
	- Advice
	- JoinPoint
	- CutPoint
	- Aspect
	- Weaving
3. Spring实现AOP步骤
	Spring自己有是实现AOP的框架，但是一般通过借助另外的成熟框架进行具体的实现。引入aspectjweav依赖。将target和advice注册Bean，配置aop
4. AOP CutPoint配置
	execution(\[访问控制符] 返回类型 包名...类名.方法名(参数列表))
	.. 表示任意参数和包与子包
	\* 表示任意方法或者类，或者返回类型
5. AOP Aspect 配置
	1. before：方法之前增强
	2. after-return：方法正常返回之后执行
	3. after-throwing：方法抛出异常后执行
	4. around：环绕方法执行，方法抛出异常，环绕后不执行
	5. after：切入点完成后一定执行

-->

### 注解配置AOP

两种方式
1. xml开启注解配置
	`<aop:aspectj-autoproxy/>`
	可选参数proxy-target-class，true为cglib代理
	在Advice上注解@Aspect，方法上注解通知类型@Before、@Around...
2. 纯注解配置
	配置类上注解@EnableAspectJAutoProxy，开启通知扫描，可选proxy-target-class参数
	> 该注解内部的实现是通过@Import，导入一个用来注册BeanDefinition的Bean。在这个aop的场景中，就是在注册通知，和Bean后处理器，用来对Target转为代理bean
	

|**分类**|**注解名称**|**作用说明**|**关键点 / 备注**|
|---|---|---|---|
|**开启配置**|**`@EnableAspectJAutoProxy`**|开启 Spring 对 AspectJ 切面的支持。|打在配置类上，相当于 XML 中的 `<aop:aspectj-autoproxy/>`。|
|**声明切面**|**`@Aspect`**|标识当前类为一个“切面类”。|必须配合 `@Component` 才能被 Spring 扫描并识别。|
|**切点定义**|**`@Pointcut`**|定义一个通用的切点表达式。|统一管理 `execution` 语句，方便在多个通知中引用方法名。|
|**前置通知**|**`@Before`**|在目标方法执行**之前**运行。|常用于：日志开始、权限校验。|
|**后置通知**|**`@AfterReturning`**|在目标方法**正常返回**后运行。|可以获取方法的返回值（通过 `returning` 属性绑定）。|
|**异常通知**|**`@AfterThrowing`**|在目标方法**抛出异常**后运行。|可以获取异常对象（通过 `throwing` 属性绑定）。|
|**最终通知**|**`@After`**|在目标方法执行后运行，**无论成功或失败**。|相当于 `try-finally` 中的 `finally` 块。|
|**环绕通知**|**`@Around`**|包围目标方法执行，最强大的通知。|必须带参数 `ProceedingJoinPoint`，需手动执行 `proceed()`。|
|**优先级控制**|**`@Order`**|指定多个切面的执行顺序。|数值越小，优先级越高（外层切面）。|

