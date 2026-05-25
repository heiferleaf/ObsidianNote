---
created: 2026-02-10
modified: 2026-02-14
---
# Spring 注解驱动开发与底层实现原理

## 一、 Spring 配置方式的演进历史

- **Spring 2.0**: 引入注解支持（如 `@Transactional`）。
    
- **Spring 2.5**: 引入核心 Bean 定义注解（`@Component`、`@Autowired` 等），支持混合配置。
    
- **Spring 3.0**: 引入 JavaConfig 方案（`@Configuration`、`@Bean`），实现全注解驱动，脱离 XML。
    

---

## 二、 核心组件定义与扫描机制

### 1. 组件扫描声明

- **XML 方式**: `<context:component-scan base-package="com.whu"/>`
    
- **实现机制**: Spring 内部通过自定义命名空间处理器映射到 `ContextNamespaceHandler`，注册 `ConfigurationClassPostProcessor`（核心后处理器）来解析包路径并扫描注解。
    

### 2. 核心注解分类

- **声明式注解**: `@Component`（通用）、`@Repository`（持久层）、`@Service`（业务层）、`@Controller`（控制层）。
    
- **生命周期与作用域**:
    
    - `@Scope`: 定义 Bean 作用域（Singleton/Prototype）。
        
    - `@Lazy`: 延迟加载开关。
        
    - `@PostConstruct` / `@PreDestroy`: 定义初始化后与销毁前的回调方法。
        

---

## 三、 依赖注入（DI）详述

### 1. 注入注解对比

|**注解**|**匹配策略**|**来源**|**特点**|
|---|---|---|---|
|**`@Autowired`**|先 `byType`，再 `byName`|Spring 原生|默认要求 Bean 必须存在，可配合 `@Qualifier` 指定名称。|
|**`@Resource`**|先 `byName`，再 `byType`|JSR-250 (Java)|更加通用，减少与 Spring 框架的耦合。|
|**`@Value`**|表达式注入|Spring 原生|支持 SpEL 表达式及 `${}` 占位符注入配置信息。|

### 2. 集合注入

Spring 支持将容器中所有匹配类型的 Bean 自动注入到集合中：

`@Autowired private List<UserDao> userDaoList;`

---

## 四、 非自定义 Bean 的配置（第三方类库）

对于无法在源码上加注解的类（如 `SqlSessionFactory`），使用方法注解：

- **`@Bean`**: 标注于方法上，等价于 **实例工厂**。
    
- **BeanName 逻辑**: 默认使用方法名作为 Bean 的 ID。
    
- **参数注入**: 方法参数会自动从容器中 `byType` 注入，无需额外标注 `@Autowired`。
    
> 方法所属的类需要被容器进行管理，一般都是@Component + @Bean
---

## 五、 全注解驱动的替换方案

通过 **JavaConfig 类** 完全替代 XML 配置文件：

1. **`@Configuration`**: 标识当前类为配置类，底层会被 CGLIB 提升，确保内部 `@Bean` 方法调用的单例特性。
    
2. **`@PropertySource`**: 替代 `<context:property-placeholder>`，加载外部 `.properties` 文件。
    
3. **`@ComponentScan`**: 替代 `<context:component-scan>`。
    
4. **入口切换**: 使用 `AnnotationConfigApplicationContext` 作为 IoC 容器入口。
    

---

## 六、 进阶条件控制

- **`@Primary`**: 当类型匹配存在多个候选者时，指定首选 Bean。对 `getBean(Class)` 方法同样有效。
    
- **`@Profile`**: 环境隔离。
    
    - **生效范围**: 标注在类或 `@Bean` 方法上。
        
    - **激活方式**: 虚拟机参数 `-Dspring.profiles.active=dev` 或 `System.setProperty()`。
        

---

## 七、 实现机制深挖

### 1. 扫描注册流程

当使用 `AnnotationConfigApplicationContext` 初始化时：

1. **解析器启动**: `AnnotationBeanDefinitionReader` 扫描指定的配置类。
    
2. **后处理器介入**: 容器自动注册 `ConfigurationClassPostProcessor`（这是一个 `BeanDefinitionRegistryPostProcessor`）。
    
3. **动态扫描**: 该后处理器扫描 `@ComponentScan` 指定的路径，利用 `ClassPathBeanDefinitionScanner` 检测带有 `@Component` 系列注解的类。
    
4. **BD 封装**: 将扫描到的类元数据封装为 `BeanDefinition` 并注册到 `BeanFactory` 的注册表中。
    

### 2. 依赖注入处理

- **`AutowiredAnnotationBeanPostProcessor`**: 专门负责处理 `@Autowired` 和 `@Value`。
    
- **执行时机**: 在 Bean 的 **实例化之后、初始化之前**，通过反射或 setter 方法注入依赖。
    
