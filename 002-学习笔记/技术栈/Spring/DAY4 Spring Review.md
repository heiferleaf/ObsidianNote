---
created: 2026-04-23
modified: 2026-05-03
title: DAY4 Spring Review
tags:
  - 技术栈
subject: Spring
---

# Spring 完整学习笔记

## 目录

- [[#一、设计思想总览]]
- [[#二、IOC 容器体系]]
- [[#三、AOP 面向切面编程]]
- [[#四、事务管理]]
- [[#五、WebMVC]]
- [[#六、数据访问（MyBatis 集成）]]
- [[#七、手写轻量级 Spring 框架记录]]

---

## 一、设计思想总览

### 1.1 类的扩展

借助 JDK 反射机制，通过动态代理（JDK Proxy、CGLib）实现代理类的创建。常见于：

- **AOP** 功能增强
- **MyBatis** Mapper 接口实现类 Bean 的创建
- **事务管理**（本质也是 AOP）

**适配器模式**：WebMVC 处理器适配器将处理器映射器得到的处理器所需参数进行适配，使处理器专注于业务逻辑，不必关心参数获取的具体方式。

### 1.2 类的创建

|模式|说明|
|---|---|
|单例模式|容器默认以单例管理 Bean，也可配置为原型（Prototype）|
|建造者模式|复杂 Bean 的创建借助 Builder 逐步构造|
|工厂模式|封装 Bean 的创建过程，对外隐藏实现细节|

### 1.3 类对象之间的协作

|模式|在 Spring 中的体现|
|---|---|
|观察者模式|事件发布订阅机制（ApplicationEvent / EventListener）|
|责任链模式|HandlerMapping 执行传递；多个 AOP 通知对同一方法的串联执行|
|策略模式|不同参数解析器（ArgumentResolver）的选择与执行|

---

## 二、IOC 容器体系

### 2.1 BeanFactory 核心接口层级

```
BeanFactory
├── HierarchicalBeanFactory      父子容器管理
├── ListableBeanFactory          按类型批量获取 Bean
├── ConfigurableBeanFactory      配置能力：ClassLoader、后处理器、类型转换器
└── AutowireCapableBeanFactory   Bean 实例化与属性注入
        ↓
DefaultListableBeanFactory       同时实现上述所有接口 + BeanDefinitionRegistry
```

> [!NOTE] 父子容器划分（WebMVC 场景）
> 
> - **父容器**：Service、DAO、事务等业务 Bean
> - **子容器**：Controller、HandlerMapping、HandlerAdapter、ViewResolver、拦截器等 Web Bean
> - Controller 可以注入父容器中的 Bean，反之不行

### 2.2 ApplicationContext 扩展能力

`ApplicationContext` 在 `BeanFactory` 基础上补充四项能力：

1. **资源读取**：支持从 classpath、文件系统、URL 等路径加载配置
2. **配置环境管理**：区分开发与部署配置，按 `@Profile` 激活
3. **国际化支持**：根据用户语言环境自动转换文本
4. **事件发布订阅**：Bean 之间通过事件机制解耦协作

常用实现类：

|实现类|适用场景|
|---|---|
|`ClassPathXmlApplicationContext`|XML 配置|
|`AnnotationConfigApplicationContext`|纯注解配置|
|`AnnotationConfigWebApplicationContext`|WebMVC 注解配置|

### 2.3 三级缓存与循环依赖

> [!NOTE] 三级缓存结构
> 
> |缓存|存储内容|说明|
> |---|---|---|
> |`singletonObjects`（一级）|完整的 Bean|正常使用的单例 Bean|
> |`earlySingletonObjects`（二级）|已实例化但未初始化完成、且被引用的 Bean|解决循环依赖的中间态|
> |`singletonFactories`（三级）|Lambda 表达式（`ObjectFactory`）|延迟判断是否需要代理|

**三级缓存为什么存 Lambda 而不是直接存对象？**

三级缓存存放的是 `() -> getEarlyBeanReference(beanName, mbd, bean)` 这样的 Lambda。当发生循环依赖、其他 Bean 需要引用当前 Bean 时，才触发该 Lambda 执行：

- 若当前 Bean 需要被 AOP 代理 → 提前创建代理对象，存入二级缓存，并在 `earlyProxyReferences` 中标记"已提前代理"，防止后续重复代理
- 若不需要代理 → 直接返回原始对象

这样做的好处是**按需求值**，避免对所有 Bean 都提前执行代理判断。

**循环依赖全流程（A 依赖 B，B 依赖 A，A 需要代理）：**

```
1. 开始创建 A → 实例化 A（原始对象）→ 将 Lambda 放入三级缓存
2. 注入 A 的属性，发现需要 B → 开始创建 B
3. B 实例化 → 注入 B 的属性，发现需要 A
4. 从三级缓存取出 A 的 Lambda，执行 → 返回 A 的代理对象
   → 代理对象存入二级缓存，三级缓存删除
5. B 持有 A 的代理对象，完成初始化 → B 进入一级缓存
6. 回到 A 的初始化流程，执行后处理器时发现已在 earlyProxyReferences
   → 跳过代理步骤，直接将二级缓存中 A 的代理对象移入一级缓存
```

**代理对象内部持有原始 target 的引用**，后续对 target 的属性注入和初始化操作仍然有效，代理类无需关心。

> [!WARNING] 三级缓存的局限
> 
> - **构造函数循环依赖无法解决**：Bean 实例都尚未创建，无法放入三级缓存
> - **原型（Prototype）Bean 不能处理循环依赖**：原型 Bean 不放入缓存，每次都新建

### 2.4 Bean 完整生命周期

```
实例化（构造函数）
    ↓
属性注入（@Autowired / setter）
    ↓
Aware接口实现方法
	↓
BeanPostProcessor#postProcessBeforeInitialization
    ↓
@PostConstruct / InitializingBean#afterPropertiesSet / init-method
    ↓
BeanPostProcessor#postProcessAfterInitialization  ← AOP 代理在此生成
    ↓
【Bean 就绪，放入一级缓存】
    ↓
@PreDestroy / DisposableBean#destroy / destroy-method
```

### 2.5 XML 配置 Bean

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd">

    <!-- 引入外部属性文件 -->
    <context:property-placeholder location="classpath:db.properties"/>

    <!-- 基础 Bean 定义 -->
    <bean id="userService" class="com.example.service.UserServiceImpl"
          scope="singleton" lazy-init="false"
          init-method="init" destroy-method="cleanup">
        <!-- 构造参数注入 -->
        <constructor-arg name="maxRetry" value="3"/>
        <!-- 属性注入：值 -->
        <property name="timeout" value="5000"/>
        <!-- 属性注入：引用另一个 Bean -->
        <property name="userDao" ref="userDao"/>
        <!-- 属性注入：集合 -->
        <property name="roles">
            <list>
                <value>ADMIN</value>
                <value>USER</value>
            </list>
        </property>
    </bean>

    <bean id="userDao" class="com.example.dao.UserDaoImpl"/>

</beans>
```

```java
// 对应的 Java 类
public class UserServiceImpl implements UserService {

    private UserDao userDao;
    private int timeout;
    private int maxRetry;
    private List<String> roles;

    // 对应 constructor-arg
    public UserServiceImpl(int maxRetry) {
        this.maxRetry = maxRetry;
    }

    // 对应 init-method
    public void init() {
        System.out.println("UserService 初始化，最大重试次数: " + maxRetry);
    }

    // 对应 destroy-method
    public void cleanup() {
        System.out.println("UserService 销毁，释放资源");
    }

    // setter 用于属性注入
    public void setUserDao(UserDao userDao) { this.userDao = userDao; }
    public void setTimeout(int timeout) { this.timeout = timeout; }
    public void setRoles(List<String> roles) { this.roles = roles; }
}
```

```java
// 启动容器
ClassPathXmlApplicationContext ctx =
    new ClassPathXmlApplicationContext("applicationContext.xml");

UserService service = ctx.getBean("userService", UserService.class);
service.doSomething();

ctx.close(); // 触发 destroy-method
```

### 2.6 注解配置 Bean（等价替换）

```java
// 配置类
@Configuration
@ComponentScan(basePackages = "com.example")
@PropertySource("classpath:db.properties")
public class AppConfig { }
```

```java
// 业务类
@Service                          // 注册为 Bean，等价于 <bean class="..."/>
@Scope("singleton")               // 默认单例，可省略
public class UserServiceImpl implements UserService {

    @Autowired                    // 字段注入，等价于 <property ref="..."/>
    private UserDao userDao;

    @Value("${db.timeout:5000}")  // 读取属性文件，冒号后为默认值
    private int timeout;

    @PostConstruct                // 等价于 init-method
    public void init() {
        System.out.println("初始化，timeout=" + timeout);
    }

    @PreDestroy                   // 等价于 destroy-method
    public void cleanup() {
        System.out.println("销毁，释放资源");
    }
}
```

```java
// 启动容器
AnnotationConfigApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);

UserService service = ctx.getBean(UserService.class);
service.doSomething();
ctx.close();
```

### 2.7 常用注解速查

|分类|注解|说明|
|---|---|---|
|Bean 注册|`@Component` `@Service` `@Repository` `@Controller`|语义化组件注册|
|Bean 行为|`@Scope` `@Lazy`|作用域、懒加载|
|生命周期|`@PostConstruct` `@PreDestroy`|初始化/销毁回调|
|依赖注入|`@Autowired` `@Value` `@Resource` `@Qualifier` `@Primary`|注入方式|
|配置|`@Configuration` `@ComponentScan` `@PropertySource`|配置类定义|
|环境|`@Profile`|按环境激活 Bean|

---

## 三、AOP 面向切面编程

### 3.1 核心概念

|概念|说明|
|---|---|
|**Target**|被增强的目标对象|
|**Advice**|增强/通知逻辑（Before、After、Around 等）|
|**JoinPoint**|连接点，包含代理对象、被代理对象、方法及参数的完整上下文|
|**PointCut**|切入点表达式，在 JoinPoint 集合中筛选需要增强的执行点|
|**Aspect**|切面 = PointCut + Advice 的组合|
|**Advisor**|Spring 内部对 Aspect 的抽象，一个 Advisor 对应一个切点 + 一个通知|

### 3.2 底层代理机制

|代理方式|原理|生成速度|调用速度|限制|
|---|---|---|---|---|
|JDK Proxy|基于接口|快|较慢（反射）|目标类必须实现接口|
|CGLib|基于继承，生成子类|较慢（生成方法表）|快（方法索引）|目标类不能是 final|

> [!NOTE] Spring 默认使用 JDK 动态代理；可通过 `@EnableAspectJAutoProxy(proxyTargetClass = true)` 强制使用 CGLib。

### 3.3 通知执行顺序

```
请求进入
  ↓
@Around（前半段）
  ↓
@Before
  ↓
目标方法执行
  ↓
@After（always，类似 finally）
  ↓
@AfterReturning 或 @AfterThrowing（二选一）
  ↓
@Around（后半段，pjp.proceed() 之后）
  ↓
返回结果
```

### 3.4 XML 配置 AOP

```xml
<beans xmlns:aop="http://www.springframework.org/schema/aop"
       xsi:schemaLocation="...
           http://www.springframework.org/schema/aop
           http://www.springframework.org/schema/aop/spring-aop.xsd">

    <bean id="loggingAspect" class="com.example.aspect.LoggingAspect"/>

    <aop:config>
        <!-- 切点：匹配 service 包下所有方法 -->
        <aop:pointcut id="servicePc"
            expression="execution(* com.example.service.*.*(..))"/>

        <aop:aspect ref="loggingAspect">
            <aop:before          pointcut-ref="servicePc" method="before"/>
            <aop:after           pointcut-ref="servicePc" method="after"/>
            <aop:around          pointcut-ref="servicePc" method="around"/>
            <aop:after-throwing  pointcut-ref="servicePc"
                                 method="onException" throwing="ex"/>
        </aop:aspect>
    </aop:config>
</beans>
```

```java
// XML 版切面类，普通 POJO 即可，无需注解
public class LoggingAspect {

    public void before(JoinPoint jp) {
        System.out.println("[Before] " + jp.getSignature().getName());
    }

    public void after(JoinPoint jp) {
        System.out.println("[After] " + jp.getSignature().getName());
    }

    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        System.out.println("[Around] 执行前");
        Object result = pjp.proceed(); // 调用目标方法
        System.out.println("[Around] 执行后，返回值: " + result);
        return result;
    }

    public void onException(JoinPoint jp, Exception ex) {
        System.out.println("[AfterThrowing] 异常: " + ex.getMessage());
    }
}
```

### 3.5 注解配置 AOP（常用）

```java
// 开启 AOP 注解支持
@Configuration
@ComponentScan("com.example")
@EnableAspectJAutoProxy   // 等价于 XML 中的 <aop:aspectj-autoproxy/>
public class AppConfig { }
```

```java
@Aspect
@Component
public class LoggingAspect {

    // 复用切点，避免重复写表达式
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceLayer() { }

    @Before("serviceLayer()")
    public void before(JoinPoint jp) {
        System.out.println("[Before] " + jp.getSignature().getName());
    }

    @After("serviceLayer()")
    public void after(JoinPoint jp) {
        System.out.println("[After] " + jp.getSignature().getName());
    }

    @Around("serviceLayer()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = pjp.proceed();
        long cost = System.currentTimeMillis() - start;
        System.out.println("[Around] 耗时: " + cost + "ms");
        return result;
    }

    @AfterThrowing(pointcut = "serviceLayer()", throwing = "ex")
    public void onException(JoinPoint jp, Exception ex) {
        System.out.println("[AfterThrowing] " + jp.getSignature() +
                           " 抛出: " + ex.getMessage());
    }
}
```

### 3.6 切点表达式语法

```
execution( [修饰符] 返回类型 [类路径].方法名(参数) [异常] )

常用示例：
execution(* com.example.service.*.*(..))      // service 包下所有类的所有方法
execution(* com.example..*.*(..))             // example 包及子包下所有方法
execution(public * *(..))                     // 所有 public 方法
execution(* *.save*(..))                      // 方法名以 save 开头
execution(* *(String, ..))                    // 第一个参数为 String 的方法
```

---

## 四、事务管理

> [!NOTE] Spring 事务本质是 AOP，通过对 Service 层方法的动态代理，在方法执行前开启事务、执行后提交或回滚。

### 4.1 事务传播行为

|传播行为|说明|适用场景|
|---|---|---|
|`REQUIRED`（默认）|有事务则加入，无则新建|大多数写操作|
|`SUPPORTS`|有事务则加入，无则以非事务方式执行|查询操作|
|`REQUIRES_NEW`|总是新建事务，挂起外层事务|需要独立提交/回滚的子操作|
|`MANDATORY`|必须在事务中执行，否则抛异常|强制要求调用方开启事务|
|`NEVER`|必须在非事务中执行，否则抛异常|不允许事务的场景|
|`NOT_SUPPORTED`|以非事务方式执行，挂起外层事务|不需要事务的批量操作|
|`NESTED`|外层事务的嵌套事务（savepoint 实现）|子操作失败不影响外层|

### 4.2 事务隔离级别

|隔离级别|脏读|不可重复读|幻读|
|---|---|---|---|
|`READ_UNCOMMITTED`|✓|✓|✓|
|`READ_COMMITTED`|✗|✓|✓|
|`REPEATABLE_READ`|✗|✗|✓|
|`SERIALIZABLE`|✗|✗|✗|

### 4.3 XML 配置事务（完整）

```xml
<!-- 1. 数据源 -->
<bean id="dataSource" class="com.alibaba.druid.pool.DruidDataSource">
    <property name="url"      value="${db.url}"/>
    <property name="username" value="${db.username}"/>
    <property name="password" value="${db.password}"/>
</bean>

<!-- 2. 事务管理器 -->
<bean id="txManager"
      class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource"/>
</bean>

<!-- 3. 事务通知：配置传播行为、隔离级别、超时、回滚规则 -->
<tx:advice id="txAdvice" transaction-manager="txManager">
    <tx:attributes>
        <tx:method name="save*"   propagation="REQUIRED"
                   isolation="DEFAULT" timeout="10"
                   rollback-for="Exception"/>
        <tx:method name="update*" propagation="REQUIRED"/>
        <tx:method name="find*"   propagation="SUPPORTS" read-only="true"/>
        <tx:method name="*"       propagation="REQUIRED"/>
    </tx:attributes>
</tx:advice>

<!-- 4. 切面绑定：将事务通知织入 service 层 -->
<aop:config>
    <aop:advisor advice-ref="txAdvice"
                 pointcut="execution(* com.example.service.*.*(..))"/>
</aop:config>
```

### 4.4 注解配置事务（常用）

```java
@Configuration
@EnableTransactionManagement   // 等价于 <tx:annotation-driven/>
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        DruidDataSource ds = new DruidDataSource();
        ds.setDriverClassName("com.mysql.cj.jdbc.Driver");
        ds.setUrl("jdbc:mysql://localhost:3306/demo?useSSL=false");
        ds.setUsername("root");
        ds.setPassword("root");
        return ds;
    }

    @Bean
    public DataSourceTransactionManager txManager(DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }
}
```

```java
@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserMapper userMapper;

    // propagation: 当前无事务则新建，有则加入（默认）
    // rollbackFor: 遇到 Exception 及子类均回滚（默认只回滚 RuntimeException）
    @Transactional(propagation = Propagation.REQUIRED,
                   isolation  = Isolation.DEFAULT,
                   timeout    = 10,
                   rollbackFor = Exception.class)
    public void transfer(long fromId, long toId, int amount) {
        userMapper.deduct(fromId, amount);
        if (amount > 10000) throw new RuntimeException("超额，触发回滚");
        userMapper.add(toId, amount);
    }

    // 只读事务，不加写锁，适用于查询
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public User findById(long id) {
        return userMapper.findById(id);
    }
}
```

---

## 五、WebMVC

### 5.1 核心处理流程

```
HTTP 请求
    ↓
DispatcherServlet（前端控制器）
    ↓
HandlerMapping（处理器映射器）→ HandlerExecutionChain（处理器 + 拦截器链）
    ↓
HandlerAdapter（处理器适配器）→ 参数解析 → 调用 Controller 方法
    ↓
返回 ModelAndView / @ResponseBody 数据
    ↓
ViewResolver（视图解析器，REST 接口可忽略）
    ↓
HTTP 响应
```

> [!NOTE] DispatcherServlet 组件初始化策略 启动时优先使用容器中注册的对应类型 Bean；若不存在，则回退至 `DispatcherServlet.properties` 中的默认配置组件。

### 5.2 注解配置启动（替代 web.xml）

```java
// 替代 web.xml，Tomcat 启动时通过 SPI 自动扫描并调用 onStartup
public class WebAppInitializer
        extends AbstractAnnotationConfigDispatcherServletInitializer {

    // 父容器配置类：Service、DAO、事务等业务 Bean
    @Override
    protected Class<?>[] getRootConfigClasses() {
        return new Class[]{RootConfig.class};
    }

    // 子容器配置类：Controller、拦截器、视图解析器等 Web Bean
    @Override
    protected Class<?>[] getServletConfigClasses() {
        return new Class[]{WebConfig.class};
    }

    // DispatcherServlet 拦截路径
    @Override
    protected String[] getServletMappings() {
        return new String[]{"/"};
    }
}
```

### 5.3 WebConfig 子容器配置

```java
@Configuration
@EnableWebMvc
@ComponentScan("com.example.controller")
public class WebConfig implements WebMvcConfigurer {

    // 视图解析器
    @Bean
    public InternalResourceViewResolver viewResolver() {
        InternalResourceViewResolver r = new InternalResourceViewResolver();
        r.setPrefix("/WEB-INF/views/");
        r.setSuffix(".jsp");
        return r;
    }

    // 拦截器注册
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuthInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/login");
    }

    // 静态资源放行
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
                .addResourceLocations("/WEB-INF/static/");
    }

    // 消息转换器（支持 JSON 响应）
    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.add(new MappingJackson2HttpMessageConverter());
    }
}
```

### 5.4 Controller 编写

```java
@RestController              // = @Controller + @ResponseBody
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    // GET /api/users/42
    @GetMapping("/{id}")
    public User getUser(@PathVariable long id) {
        return userService.findById(id);
    }

    // GET /api/users?page=1&size=20
    @GetMapping
    public List<User> list(@RequestParam(defaultValue = "1")  int page,
                           @RequestParam(defaultValue = "20") int size) {
        return userService.findPage(page, size);
    }

    // POST /api/users  Body: {"name":"alice","age":20}
    @PostMapping
    public User create(@RequestBody User user) {
        return userService.save(user);
    }

    // 读取请求头
    @GetMapping("/token")
    public String parseToken(@RequestHeader("Authorization") String token) {
        return "token received: " + token;
    }
}
```

### 5.5 拦截器实现

```java
@Component
public class AuthInterceptor implements HandlerInterceptor {

    // 请求到达 Controller 前执行；返回 false 则中断链路
    @Override
    public boolean preHandle(HttpServletRequest req,
                             HttpServletResponse res,
                             Object handler) throws Exception {
        String token = req.getHeader("Authorization");
        if (token == null) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        return true;
    }

    // Controller 执行完、视图渲染前
    @Override
    public void postHandle(HttpServletRequest req, HttpServletResponse res,
                          Object handler, ModelAndView mv) { }

    // 整个请求完成后（含异常）
    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res,
                               Object handler, Exception ex) {
        if (ex != null) System.out.println("请求异常: " + ex.getMessage());
    }
}
```

### 5.6 请求参数注解速查

|注解|来源|示例|
|---|---|---|
|`@PathVariable`|URL 路径段 `/users/{id}`|`@PathVariable long id`|
|`@RequestParam`|查询参数 `?page=1`|`@RequestParam(defaultValue="1") int page`|
|`@RequestBody`|请求体（JSON）|`@RequestBody User user`|
|`@RequestHeader`|请求头|`@RequestHeader("Authorization") String token`|
|`@RequestAttribute`|请求属性（拦截器设置）|`@RequestAttribute("userId") Long userId`|

---

## 六、数据访问（MyBatis 集成）

### 6.1 集成原理

Spring 集成 MyBatis 的核心是将两个对象注册为 Bean：

- **`SqlSessionFactoryBean`**：创建 `SqlSessionFactory`，管理数据库连接和 SQL 映射
- **`MapperScannerConfigurer`** / `@MapperScan`：扫描 Mapper 接口，通过动态代理自动创建实现类 Bean

> [!NOTE] 第三方命名空间原理 所有第三方 XML 命名空间（如 `mybatis:`）的实现机制一致：容器启动时扫描自定义标签，从 `META-INF/spring.handlers` 中找到对应处理器，处理器内部完成 Bean 注册。效果等价于手写 `@Bean` 方法，但省去了样板代码。

### 6.2 完整配置

```java
@Configuration
@ComponentScan("com.example.service")
@EnableTransactionManagement
@MapperScan("com.example.mapper")   // 扫描 Mapper 接口，自动创建代理 Bean
public class RootConfig {

    @Bean
    public DataSource dataSource() {
        DruidDataSource ds = new DruidDataSource();
        ds.setDriverClassName("com.mysql.cj.jdbc.Driver");
        ds.setUrl("jdbc:mysql://localhost:3306/demo?useSSL=false");
        ds.setUsername("root");
        ds.setPassword("root");
        ds.setInitialSize(5);
        ds.setMaxActive(20);
        return ds;
    }

    @Bean
    public SqlSessionFactoryBean sqlSessionFactory(DataSource ds) throws Exception {
        SqlSessionFactoryBean fb = new SqlSessionFactoryBean();
        fb.setDataSource(ds);
        fb.setTypeAliasesPackage("com.example.entity");   // 实体类别名
        fb.setMapperLocations(
            new PathMatchingResourcePatternResolver()
                .getResources("classpath:mapper/*.xml")); // XML Mapper 路径
        return fb;
    }

    @Bean
    public DataSourceTransactionManager txManager(DataSource ds) {
        return new DataSourceTransactionManager(ds);
    }
}
```

### 6.3 Mapper 接口编写

```java
@Mapper   // 也可省略，由 @MapperScan 统一处理
public interface UserMapper {

    // 写法一：注解 SQL（简单语句推荐）
    @Select("SELECT * FROM user WHERE id = #{id}")
    User findById(long id);

    @Insert("INSERT INTO user(name,age) VALUES(#{name},#{age})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(User user);

    // 写法二：绑定 XML Mapper（复杂 SQL 推荐，方法名对应 XML 中的 id）
    List<User> findPage(@Param("offset") int offset,
                        @Param("size")   int size);

    void deduct(@Param("id") long id, @Param("amount") int amount);

    void add(@Param("id") long id, @Param("amount") int amount);
}
```

### 6.4 XML Mapper

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.mapper.UserMapper">

    <!-- 字段名与属性名不一致时使用 resultMap -->
    <resultMap id="userMap" type="User">
        <id     property="id"   column="user_id"/>
        <result property="name" column="user_name"/>
        <result property="age"  column="user_age"/>
    </resultMap>

    <select id="findPage" resultMap="userMap">
        SELECT user_id, user_name, user_age
        FROM user
        LIMIT #{offset}, #{size}
    </select>

    <update id="deduct">
        UPDATE user SET balance = balance - #{amount} WHERE id = #{id}
    </update>

    <update id="add">
        UPDATE user SET balance = balance + #{amount} WHERE id = #{id}
    </update>

</mapper>
```

---
