---
created: 2026-02-07
modified: 2026-02-07
---

# 🍃 Spring IoC 核心全解析笔记 (初学者深度定制版)

## 一、 容器基石：谁在管理 Bean？

### 1.1 BeanFactory：底层的“小作坊”

- **接口定义**：Spring 框架最底层的核心接口，只负责最基础的事：**实例化、配置、获取对象**。
    
- **核心特点**：
    
    - **延迟加载（Lazy-init）**：你管它要（`getBean`），它才开工创建。
        
    - **低内存占用**：适合资源极其匮乏的环境。
        
- **常用方法**：`isPrototype(name)`, `isTypeMatch(name, type)`。
    

### 1.2 ApplicationContext：全能的“智能工厂”

- **继承体系**：它不仅继承了 `BeanFactory`，还持有了它的引用（类似包装/装饰器模式）。
    
- **核心特点**：
    
    - **预加载**：容器启动时，就把所有单例 Bean 生产好，报错早发现。
        
    - **超能力**：
        
        1. **国际化 (`MessageSource`)**：让你的应用支持多语言。
            
        2. **资源解析 (`ResourceLoader`)**：可以从磁盘、类路径、URL 各种地方读文件。
            
        3. **应用事件 (`ApplicationEventPublisher`)**：支持解耦的事件广播。
            
- **常见实现类**：
    
    - `ClassPathXmlApplicationContext`：从 `resources` 文件夹找 XML。
        
    - `FileSystemXmlApplicationContext`：从电脑硬盘绝对路径找 XML。
        

---

## 二、 Bean 的创建：四种“出厂”方式

### 2.1 构造函数创建 (最常用)

Spring 通过反射调用构造器。如果没有无参构造，必须手动指定参数。

**XML 配置：**


```xml
<bean id="user" class="com.whu.User">
    <constructor-arg name="username" value="张三"/>
    <constructor-arg name="age" value="20"/>
</bean>
```

### 2.2 静态工厂创建

不需要创建工厂对象，直接调用工厂类的静态方法。

**Java 工厂类：**


```Java
public class StaticFactory {
    public static UserDao createDao() { return new UserDaoImpl(); }
}
```

**XML 配置：**


```xml
<bean id="userDao" class="com.whu.StaticFactory" factory-method="createDao"/>
```

### 2.3 实例工厂创建 (重点补充)

工厂本身也是个 Bean。必须先实例化工厂，再通过工厂实例产生产品。

**Java 工厂类：**


```java
public class MyInstanceFactory {
    public UserDao createDao() { return new UserDaoImpl(); }
}
```

**XML 配置：**

```xml
<bean id="factoryBean" class="com.whu.MyInstanceFactory"/>

<bean id="userDao" factory-bean="factoryBean" factory-method="createDao"/>
```

### 2.4 FactoryBean 接口方式 (高级进阶)

这是 Spring 提供的“黑盒”创建方式。它实现了“延迟创建”的逻辑。

**Java 实现类：**


```Java
public class MyFactoryBean implements FactoryBean<UserDao> {
    @Override
    public UserDao getObject() { return new UserDaoImpl(); } // 真正生产对象的逻辑
    @Override
    public Class<?> getObjectType() { return UserDao.class; }
}
```

**获取逻辑说明：**

- `context.getBean("myBean")` $\rightarrow$ 得到 `UserDao` 实例。
    
- `context.getBean("&myBean")` $\rightarrow$ 得到 `MyFactoryBean` 实例本身。
    

---

## 三、 Bean 的“生命”轨迹

### 3.1 作用范围 (Scope)

- **`singleton` (单例)**：默认值。容器启动时创建，全应用共享一个，适合无状态对象（Service/DAO）。
    
- **`prototype` (多例/原型)**：每次获取都创建一个新的。容器不负责销毁，适合有状态对象。
    

### 3.2 执行顺序 (从生到死)

1. **构造函数** (实例化)
    
2. **属性注入** (Setter 方法)
    
3. **InitializingBean 回调** (`afterPropertiesSet` 方法)
    
4. **自定义 `init-method`** (XML 指定)
    
5. **业务使用**
    
6. **DisposableBean 回调** (`destroy` 方法)
    
7. **自定义 `destroy-method`** (容器关闭前执行)
    

---

## 四、 依赖注入：如何喂饱一个 Bean？

### 4.1 注入集合数据 (详细配置)

如果 Bean 的成员变量是集合，需要使用专门的标签。

**Java 类：**


```Java
public class ComplexBean {
    private List<String> list;
    private Set<UserDao> set;
    private Map<String, String> map;
    private Properties props;
    // ...省略 setter...
}
```

**XML 注入：**


```xml
<bean id="complex" class="com.whu.ComplexBean">
    <property name="list">
        <list><value>A</value><value>B</value></list>
    </property>
    <property name="set">
        <set><ref bean="dao1"/><ref bean="dao2"/></set>
    </property>
    <property name="map">
        <map><entry key="k1" value="v1"/><entry key="k2" value="v2"/></map>
    </property>
    <property name="props">
        <props><prop key="username">root</prop></props>
    </property>
</bean>
```

### 4.2 自动装配 (Autowire)

> [!NOTE] 核心逻辑
> 
> 自动装配是让 Spring 自动查找依赖，减少手动 `<property>` 配置。

- **`byName`**：
    
    - 逻辑：寻找 ID 和当前类中 **Setter 方法名**（去掉 set 后首字母小写）一致的 Bean。
        
    - 示例：`setUserDao` 会去寻 ID 为 `userDao` 的 Bean。
        
- **`byType`**：
    
    - 逻辑：寻找和 **Setter 方法参数类型** 一致的 Bean。
        
    - **风险**：如果容器里同类型的 Bean 有多个，会报 `NoUniqueBeanDefinitionException`。
        

---

## 五、 XML 命名空间：说明书的方言

- **默认空间 (`xmlns`)**：`<bean>`, `<import>`, `<alias>`。
    
- **自定义空间 (`xmlns:xxx`)**：如 `context`, `aop`, `p` 空间。
    
    - 引入方式：`xmlns:context="网址"`。
        
    - 约束：`xsi:schemaLocation` 里必须配对出现“网址”和对应的 “.xsd” 文件路径。
        
