---
created: 2026-02-10
modified: 2026-02-10
---
# Spring 整合 MyBatis 技术笔记

## 一、 核心依赖配置

整合过程需引入四类核心组件，确保 Spring 容器能够接管 MyBatis 的执行环境。

|**依赖类别**|**核心坐标 (Group ID : Artifact ID)**|**作用描述**|
|---|---|---|
|**MyBatis 核心**|`org.mybatis : mybatis`|持久层框架基础逻辑。|
|**整合桥接包**|`org.mybatis : mybatis-spring`|提供 FactoryBean 及自动扫描支持。|
|**Spring 数据支持**|`org.springframework : spring-jdbc`|提供事务管理与数据源接入接口。|
|**连接池**|`com.zaxxer : HikariCP` (推荐)|负责底层数据库连接的物理管理。|

---

## 二、 方案一：基础配置方式（手动装配 Bean）

此方式不依赖自定义命名空间，通过 Spring 标准 Bean 生命周期完成整合。

### 1. SqlSessionFactoryBean

- **性质**：实现 `FactoryBean<SqlSessionFactory>` 与 `InitializingBean` 接口。
    
- **原理**：Spring 在初始化该 Bean 时，通过 `afterPropertiesSet()` 方法解析 `Mapper` 路径及 `DataSource`。
    
- **结果**：调用 `getObject()` 时，将构建好的 `SqlSessionFactory` 单例注入 Spring 容器。
    

### 2. MapperScannerConfigurer

- **性质**：实现 `BeanDefinitionRegistryPostProcessor` 接口。
    
- **原理**：在 Bean 定义阶段介入，通过 `ClassPathMapperScanner` 扫描指定包下的接口。
    
- **逻辑劫持**：将接口的 `BeanDefinition` 指向 `MapperFactoryBean`。由于接口无法直接实例化，此举确保后续通过 `FactoryBean` 的代理逻辑产生接口实现类。
    

---

## 三、 方案二：自定义命名空间方式（Schema 扩展）

利用 Spring 的插件化机制简化 XML 配置。

### 1. 介入机制：NamespaceHandler

- **配置表现**：使用 `<mybatis:scan />` 标签。
    
- **底层链路**：
    
    1. Spring 解析器读取 XML，根据 URI 定位到 `MyBatisNamespaceHandler`。
        
    2. Handler 内部委派 `BeanDefinitionParser` 对标签属性（如 `base-package`）进行解析。
        
    3. 解析器动态生成一个 `MapperScannerConfigurer` 的定义并注册至容器，其后续流程与方案一一致。
        

---

## 四、 关键组件原理与协作

### 1. FactoryBean 的应用逻辑

MyBatis 的核心组件（如工厂类和代理类）初始化逻辑复杂，不符合 Spring 的标准 Bean 属性设置逻辑。通过 `FactoryBean` 接口，可以将解析 XML、构建 Configuration、生成代理对象等黑盒逻辑封装在 `getObject()` 方法内。

### 2. 事务同步与连接管理

在 Spring 环境下，MyBatis 的数据库操作由 `SqlSessionHolder` 进行协调。

- **连接获取**：当执行 SQL 时，MyBatis-Spring 会通过 `DataSourceUtils` 从 Spring 的事务资源管理器中获取当前线程绑定的 `Connection`。
    
- **生命周期同步**：若当前存在 `@Transactional` 事务，`Connection` 的提交与释放将由 Spring 事务管理器统一调度，而非由 MyBatis 独立控制。
    

---

## 五、 配置注意事项

- **依赖顺序**：`MapperScannerConfigurer` 应优先于普通 Bean 初始化，但应通过名称（`sqlSessionFactoryBeanName`）引用工厂，以避免提前触发 `SqlSessionFactory` 实例化导致配置文件占位符失效。
    
- **类型匹配**：由于 Mapper 是通过 JDK 动态代理生成的，注入时应始终使用接口类型而非实现类。
    

