---
title: DAY6 日志 & 反射
created: 2025-12-05
modified: 2026-01-09
tags: [技术栈, JavaEE]
subject: JavaEE
---
### **日志系统、反射与动态代理详细解析**

#### **一、日志系统详解**

**1. 为什么使用日志而不是 System.out.println？**

*   **动态控制输出**：通过修改配置文件即可调整日志级别（如从INFO改为DEBUG），无需修改和重新编译代码，特别适合生产环境问题排查。
*   **结构化信息**：日志框架能自动附加时间戳、线程名、类名、方法名等上下文信息，远比手动拼接字符串规范且高效。
*   **灵活的输出目的地**：可将日志同时输出到控制台、文件、数据库、消息队列等，并可设置滚动策略（如按日期、按文件大小分割），管理方便。
*   **性能考虑**：对于`DEBUG`或`TRACE`级别的日志，字符串拼接可能产生性能开销，而日志框架（如SLF4J）的**参数化日志**`log.debug("User {} login", userId)`能避免无谓的字符串构造。

**2. Java 内置日志 (`java.util.logging` / JUL)**

*   **级别体系详解**：
    *   `SEVERE` (最高)：表示严重的错误，可能导致应用程序终止。
    *   `WARNING`：表示潜在的问题，但程序仍能运行。
    *   `INFO`：表示重要的运行时事件（如启动、关闭）。
    *   `CONFIG`：配置信息。
    *   `FINE`、`FINER`、`FINEST`：用于开发调试，提供越来越详细的跟踪信息。
*   **配置方式**：
    *   **编程式配置**：通过`LogManager`和`Logger` API在代码中设置。
    *   **配置文件**：更推荐。使用`logging.properties`文件，并通过JVM参数`-Djava.util.logging.config.file=config.properties`加载。配置文件可以定义每个Logger的级别、使用的Handler（Appender）和Formatter（Layout）。

**3. Apache Commons Logging (JCL) - 日志门面**

*   **核心思想**：**解耦**。应用代码通过JCL的API（`Log`, `LogFactory`）编写日志语句，而在**部署时**才决定使用哪个具体的日志实现（Log4j, JUL等）。
*   **类加载机制**：JCL通过复杂的类加载器搜索机制在运行时动态发现可用的日志实现库。这也导致了它在某些复杂的类加载环境（如OSGi、Web容器）中可能出现问题，这是其被SLF4J逐渐取代的原因之一。
*   **基本使用模式**：
    ```java
    import org.apache.commons.logging.Log;
    import org.apache.commons.logging.LogFactory;
    public class MyClass {
        // 通常声明为静态常量
        private static final Log log = LogFactory.getLog(MyClass.class);
        public void doSomething() {
            if (log.isDebugEnabled()) { // 检查可提升性能
                log.debug("Entering method, param: " + param);
            }
            // ... 业务逻辑
            log.info("Operation completed");
            if (exception != null) {
                log.error("Operation failed", exception); // 可记录异常堆栈
            }
        }
    }
    ```

**4. Log4j 1.x 配置详解**

*   **三大组件关系**：`Logger` (谁记录) -> `Appender` (记到哪里) -> `Layout` (记录成什么格式)。
*   **Logger的层次结构**：Logger有名称，通过点号`.`分隔，形成父子继承关系（如 `com.myapp` 是 `com.myapp.service` 的父级）。子Logger默认继承父Logger的级别和Appender。
*   **`log4j.properties` 关键配置项解释**：
* 
    ```properties
    # 设置根Logger，级别为INFO，使用两个Appender：stdout和R
    log4j.rootLogger=INFO, stdout, R
    # 定义名为`stdout`的Appender，输出到控制台
    log4j.appender.stdout=org.apache.log4j.ConsoleAppender
    log4j.appender.stdout.Target=System.out
    # 定义该Appender使用的Layout（格式）
    log4j.appender.stdout.layout=org.apache.log4j.PatternLayout
    # ConversionPattern中，%d日期，%p级别，%c类名，%L行号，%m消息，%n换行
    log4j.appender.stdout.layout.ConversionPattern=%d{ABSOLUTE} %5p %c{1}:%L - %m%n
    # 定义名为`R`的Appender，输出到滚动文件
    log4j.appender.R=org.apache.log4j.RollingFileAppender
    log4j.appender.R.File=app.log
    log4j.appender.R.MaxFileSize=10MB
    log4j.appender.R.MaxBackupIndex=10
    log4j.appender.R.layout=org.apache.log4j.PatternLayout
    log4j.appender.R.layout.ConversionPattern=%d{ISO8601} [%t] %-5p %c %x - %m%n
```


**5. SLF4J + Logback（现代首选组合）**

*   **SLF4J的优势**：
    1.  **稳定的API**：绑定过程在编译时完成，避免了JCL的类加载问题。
    2.  **参数化日志**：`log.debug("Found {} items for user {}", itemCount, userId);` 只有当日志级别确实需要输出时，才会进行参数替换，性能更优。
    3.  **桥接旧日志**：提供`jcl-over-slf4j`, `log4j-over-slf4j`等桥接包，可将使用JCL或Log4j API的老项目重定向到SLF4J，便于统一管理。
*   **Logback的增强**：
    *   原生实现SLF4J，性能更好。
    *   配置文件为XML格式（`logback.xml`），功能更强大，支持条件处理、过滤器、自定义变量等。
    *   自动热加载配置文件。
    *   更丰富的Appender（如SMTP、DB）。

#### **二、反射机制深度解析**

**1. Class对象：反射的基石**

*   **唯一性**：每个类（包括接口、数组、基本类型、void）在JVM中都有且只有一个对应的`Class`对象。它由JVM在类加载阶段创建，存储在方法区。
*   **获取方式对比**：
    *   `ClassName.class`：这是**类字面常量**，编译时已知，最安全高效，且会触发类的初始化（执行静态代码块）。
    *   `obj.getClass()`：适用于已有对象实例的情况。
    *   `Class.forName("full.ClassName")`：最动态，`full.ClassName`可以是外部配置的字符串。它也会触发类的初始化。可选用重载方法`Class.forName(String name, boolean initialize, ClassLoader loader)`控制是否初始化。
*   **Class对象包含的信息**：字段（`Field`）、方法（`Method`）、构造器（`Constructor`）、注解、父类、接口、类名、修饰符等。

**2. 操作字段 (Field)**

*   **获取字段的方法区别**：
    *   `getField(String name)`：仅能获取**本类及其所有父类中声明为`public`的字段**。如果找不到会抛出`NoSuchFieldException`。
    *   `getDeclaredField(String name)`：获取**本类中声明的任何字段**（包括`private`, `protected`, 包级），**但不包括继承的字段**。
    *   `getFields()` / `getDeclaredFields()`：返回对应条件的字段数组。
*   **访问权限突破**：对于非`public`字段，调用`field.setAccessible(true)`。此方法是`AccessibleObject`类的方法（`Field`, `Method`, `Constructor`的父类）。它关闭了Java语言的访问检查，使得私有成员可被访问。
*   **读写字段值**：
    *   `field.get(Object obj)`：获取`obj`对象上该字段的值。如果是静态字段，`obj`可为`null`。
    *   `field.set(Object obj, Object value)`：设置`obj`对象上该字段的值。注意类型匹配。
*   **`Modifier` 工具类**：`int mod = field.getModifiers();` 返回一个整型位掩码。使用`Modifier.isPrivate(mod)`, `Modifier.isStatic(mod)`, `Modifier.isFinal(mod)`等方法进行判断。

**3. 操作方法 (Method)**

*   **获取方法的方法区别**：与`Field`类似，`getMethod`获取`public`方法（包括继承的），`getDeclaredMethod`获取本类声明的所有方法。
*   **方法调用**：`method.invoke(Object obj, Object... args)`
    *   `obj`：调用该方法的对象实例。如果是静态方法，传`null`。
    *   `args`：调用时传递的实际参数，需与方法声明的形参类型兼容。
    *   **返回值**：`Object`类型，需要强转为实际类型。如果方法返回`void`，则`invoke`返回`null`。
*   **获取方法信息**：`getReturnType()`, `getParameterTypes()`, `getExceptionTypes()`。

**4. 操作构造器 (Constructor) 与创建实例**

*   **`Class.newInstance()`的局限**：
    1.  只能调用无参数构造器。
    2.  构造器必须是`public`的。
    3.  在Java 9后已被标记为`@Deprecated`，推荐使用`Constructor.newInstance()`。
*   **使用`Constructor`创建实例**：
    ```java
    // 获取特定参数类型的构造器
    Constructor<Person> cons = Person.class.getConstructor(String.class, int.class);
    // 使用构造器创建实例
    Person person = cons.newInstance("张三", 25);
    ```
    *   对于`private`构造器，同样需要先`setAccessible(true)`。

**5. 获取继承与实现关系**

*   `clazz.getSuperclass()`：返回直接父类的`Class`对象。对于接口、`Object`类或基本类型，返回`null`。
*   `clazz.getInterfaces()`：返回该类直接实现的所有接口的`Class`数组。**不包含父类实现的接口**。

#### **三、动态代理原理与范式**

**1. 底层实现原理**

*   `Proxy.newProxyInstance()` 方法在运行时动态生成一个代理类的字节码。这个代理类通常命名为 `$ProxyN`（N为数字）。
*   生成的代理类继承自 `java.lang.reflect.Proxy`，并实现了你指定的所有接口。
*   代理类内部，每个接口方法都包含类似如下的实现：
    ```java
    // 伪代码
    public final void serviceMethod(String arg) {
        try {
            // 调用传入的InvocationHandler的invoke方法
            return handler.invoke(this, 
                Method对象表示serviceMethod, 
                new Object[]{arg});
        } catch (Throwable t) { ... }
    }
    ```

**2. 标准范式与组件职责**

*   **InvocationHandler (调用处理器)**：
    *   这是**增强逻辑的核心载体**。你需要实现其唯一的`invoke`方法。
    *   `invoke`方法的三个参数：
        1.  `proxy`：**代理对象本身**，通常很少直接用，直接使用可能导致递归调用。
        2.  `method`：正在被调用的接口方法对应的 `Method` 对象。
        3.  `args`：调用方法时传入的参数。
    *   在`invoke`内部，你可以在调用真实对象方法前后添加任意逻辑（日志、事务、权限检查、性能监控等），并决定是否调用以及如何调用真实方法。
*   `Proxy.newProxyInstance` 的三个参数：
    1.  `ClassLoader loader`：**用于定义代理类的类加载器**。通常使用和目标对象相同的类加载器（`target.getClass().getClassLoader()`）。
    2.  `Class<?>[] interfaces`：**代理类需要实现的接口列表**。代理类将具备这些接口的所有方法。必须都是接口，不能是类。
    3.  `InvocationHandler h`：**将代理对象的所有方法调用分派到的处理器**。
*   **代理对象的局限性**：
    *   只能代理接口，不能代理类。
    *   代理对象的方法调用通过反射进行，有一定性能开销（对于性能关键代码需注意）。

#### **四、综合代码示例**

```java
import java.lang.reflect.*;
import java.util.Arrays;

// 1. 深度反射示例：操作泛型、数组、内部类等
class ComplexReflectionDemo {
    static class Inner { private String secret = "hidden"; }
    public static void main(String[] args) throws Exception {
        // 获取内部类Class对象
        Class<?> innerClass = Class.forName("ComplexReflectionDemo$Inner");
        // 创建内部类实例 (需要外部类实例)
        Object innerInstance = innerClass.getDeclaredConstructor(ComplexReflectionDemo.class).newInstance(new ComplexReflectionDemo());
        Field secretField = innerClass.getDeclaredField("secret");
        secretField.setAccessible(true);
        System.out.println(secretField.get(innerInstance)); // hidden
        
        // 操作数组
        int[] array = (int[]) Array.newInstance(int.class, 5);
        Array.set(array, 0, 100);
        System.out.println(Array.get(array, 0)); // 100
        System.out.println(array.getClass().getName()); // [I
    }
}

// 2. 动态代理高级示例：模拟Spring式的事务管理
interface UserDao { void save(); void delete(); }
class UserDaoImpl implements UserDao {
    public void save() { System.out.println("保存用户..."); }
    public void delete() { System.out.println("删除用户..."); }
}
class TransactionHandler implements InvocationHandler {
    private Object target;
    public TransactionHandler(Object target) { this.target = target; }
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        Object result = null;
        try {
            System.out.println("【事务】开启事务");
            result = method.invoke(target, args);
            System.out.println("【事务】提交事务");
        } catch (Exception e) {
            System.out.println("【事务】回滚事务，原因：" + e.getCause().getMessage());
            throw e;
        } finally {
            System.out.println("【事务】释放连接");
        }
        return result;
    }
}
class DynamicProxyAdvancedDemo {
    public static void main(String[] args) {
        UserDao realDao = new UserDaoImpl();
        UserDao proxyDao = (UserDao) Proxy.newProxyInstance(
            realDao.getClass().getClassLoader(),
            realDao.getClass().getInterfaces(),
            new TransactionHandler(realDao)
        );
        proxyDao.save();
        System.out.println("---");
        // 模拟异常触发回滚
        UserDao proxyWithException = (UserDao) Proxy.newProxyInstance(
            realDao.getClass().getClassLoader(),
            realDao.getClass().getInterfaces(),
            new InvocationHandler() {
                public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                    if ("delete".equals(method.getName())) {
                        throw new RuntimeException("数据不存在");
                    }
                    return method.invoke(realDao, args);
                }
            }
        );
        try { proxyWithException.delete(); } catch (Exception e) { System.out.println(e.getCause().getMessage()); }
        
        // 查看代理类详细信息
        System.out.println("\n代理类信息:");
        System.out.println("类名: " + proxyDao.getClass());
        System.out.println("父类: " + proxyDao.getClass().getSuperclass());
        System.out.println("接口: " + Arrays.toString(proxyDao.getClass().getInterfaces()));
        System.out.println("处理器: " + Proxy.getInvocationHandler(proxyDao).getClass());
    }
}
```
