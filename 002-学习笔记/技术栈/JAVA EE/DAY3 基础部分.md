---
title: DAY3 基础部分
created: 2025-11-28
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
> **“规范不是创新的枷锁，而是协作与维护的基石。” —— 理解并善用语言规则，是迈向高级工程师的第一步。**

### **高级特性与工程化基础**

#### **1. 类的继承控制**

*   **`final` 修饰类**
    *   **作用**：表示该类是**最终类，无法被任何类继承**。
    *   **场景**：用于设计不希望被扩展的类，如 `String` 类。

*   **`sealed` 密封类**
    *   **作用**：使用 `sealed` 和 `permits` 关键字，**精确控制哪些类可以继承**当前类。
    *   **规则**：在 `permits` 中声明的子类，必须使用 `final`、`sealed` 或 `non-sealed` 之一来修饰。
    *   **语法**：
        ```java
        sealed class Shape permits Rect, Circle {
            // ...
        }
        final class Rect extends Shape { /* ... */ }
        non-sealed class Circle extends Shape { /* ... */ }
        ```

*   **实践提示**：密封类是 `final` 的增强版，在需要限定继承层次结构（如建模代数数据类型）时非常有用，兼顾了安全性与灵活性。

#### **2. 类型检查与转换**

*   **模式匹配 `instanceof`**
    *   **新语法**：在 `instanceof` 检查时直接声明类型变量 `if (obj instanceof String str)`。
    *   **作用**：如果检查通过，则变量 `str` 会自动转换为 `String` 类型并可在后续代码中直接使用。
    *   **优势**：简化了先判断、再强制转换的冗余代码。

#### **3. 接口与多态**

*   **接口 (`interface`)**
    *   **成员**：
        *   **常量**：默认是 `public static final`。
        *   **抽象方法**：默认是 `public abstract`（可省略）。
        *   **默认方法 (`default`)**：Java 8 引入，提供接口方法的默认实现。
        *   **静态方法 (`static`)**：Java 8 引入，属于接口本身。
    *   **实现规则**：实现类必须覆盖所有抽象方法，且方法的**访问权限必须是 `public`**。

*   **多态与方法重写**
    *   **核心规则**：子类重写父类方法时。
        *   **访问权限**：不能比父类方法更严格（例如，父类是 `protected`，子类不能是 `private`）。
        *   **抛出异常**：不能抛出比父类方法更宽泛的检查型异常。

#### **4. JVM 内存与类结构**

*   **类的元信息与静态成员**
    *   **存储位置**：类的字段信息、方法信息、常量池等**元数据**，以及**静态变量**，都存储在 **JVM 的方法区（Metaspace）** 中。
    *   **注意**：这里存储的是“蓝图”和静态数据，而非具体的对象实例。

*   **代码组织层级**
    *   **层级关系**：**项目 → 模块 → 包 → 类**。
    *   **作用**：模块化管理和解决命名冲突。

#### **5. 包与访问权限**

*   **`import static`**
    *   **作用**：静态导入，可直接使用指定类的静态成员而无需写类名。
    *   **语法**：`import static 包名.类名.*;`。
    *   **建议**：谨慎使用，避免降低代码可读性。

*   **跨包访问规则**
    *   **类级别**：只有 `public` 类才能被其他包访问。
    *   **成员级别**：

| 修饰符              | 同一包内 | 不同包的子类 | 不同包的非子类 |
| ---------------- | ---- | ------ | ------- |
| `public`         | ✅    | ✅      | ✅       |
| `protected`      | ✅    | ✅      | ❌       |
| `default` (无修饰符) | ✅    | ❌      | ❌       |
| `private`        | ❌    | ❌      | ❌       |

#### **6. 内部类详解**

*   **普通内部类**
    *   **定义**：在另一个类的内部定义的非静态类。
    *   **特点**：
        - 隐式持有**外部类对象的引用**，可以直接访问外部类的所有成员（包括 `private`）。
        - 必须先实例化外部类，才能创建内部类对象：`Outer outer = new Outer(); Outer.Inner inner = outer.new Inner();`

*   **静态内部类**
    *   **定义**：使用 `static` 修饰的内部类。
    *   **特点**：
        - **不持有**外部类对象的引用，因此**不能直接访问**外部类的非静态成员。
        - 创建实例不依赖外部类：`Outer.StaticInner si = new Outer.StaticInner();`
    *   **实践提示**：静态内部类更独立，开销更小，优先考虑使用，除非需要访问外部类实例成员。

*   **匿名内部类**
    *   **本质**：在**继承的同时立即实例化**的一个没有名字的局部内部类。
    *   **语法**：`new 父类构造器() { /* 类体 */ }` 或 `new 接口() { /* 实现方法 */ }`。
    *   **限制**：不能继承 `final` 或 `sealed`（且未被 `permits`）的类。
    *   **编译文件**：格式为 `外部类名$数字.class`（如 `Outer$1.class`）。

#### **7. 打包、模块与运行**

*   **`classpath`**
    *   **作用**：JVM 用于搜索类文件的路径。
    *   **指定方式**：`java -cp <路径1>;<路径2>;... <主类名>`。

*   **JAR 包**
    *   **本质**：包含 `META-INF/MANIFEST.MF` 等信息的 ZIP 格式压缩包，用于分发。
    *   **运行**：
        *   普通运行：`java -cp ./hello.jar com.hf.Hello`
        *   若有 `MANIFEST.MF` 指定了 `Main-Class`，可简化：`java -jar hello.jar`

*   **模块系统**
    *   **本质**：带有 `module-info.java` 的 JAR 包，用于声明式依赖管理和封装。
    *   **核心命令**：
        - 编译：`javac -d mods --module-source-path src $(find src -name "*.java")`
        - 打包：`jar --create --file hello.jar -C mods/hello .`
        - 运行：`java --module-path mods -m hello.world/com.itranswarp.sample.Main`
    *   **优势**：强封装性、显式依赖、减少依赖冲突。

*   **版本兼容性错误**
    *   **`UnsupportedClassVersionError`**：运行时环境版本 **低于** 编译环境版本。
    *   **编译版本控制**：
        *   `javac --release 11 Main.java`：指定源码和字节码版本均为 11。
        *   `javac --source 8 --target 11 Main.java`：源码版本为 8，字节码版本为 11（不推荐，可能缺失API）。

---
#java-advanced #inheritance #sealed-class #interface #polymorphism #jvm-memory #access-modifier #inner-class #static-inner-class #anonymous-class #jar #classpath #java-module #java-version

### **Java 模块系统详解**

#### **1. 模块的核心概念**

*   **什么是模块？**
    *   一个包含 `module-info.java` 文件的JAR包。
    *   `module-info.java` 是模块的**描述符**，定义了模块的**身份、依赖和接口**。

*   **模块要解决的核心问题？**
    1.  **依赖管理**：从传统的`classpath`隐式、脆弱的依赖，变为**显式声明**。
    2.  **强封装**：明确指定哪些包可以被外部访问，彻底解决“反射滥用”等访问控制问题。
    3.  **可靠配置**：JVM在启动时就能验证所有模块依赖是否完备，避免运行时才报`NoClassDefFoundError`。

#### **2. 模块描述符 (`module-info.java`) 语法**

```java
// 关键字'module'后跟唯一的模块名
module com.example.myapp {
    // 声明本模块依赖哪些其他模块
    requires java.sql;
    requires transitive com.example.utils; // 传递性依赖

    // 将指定的包（package）导出给其他模块使用
    exports com.example.myapp.api;
    exports com.example.myapp.model to com.example.framework;

    // 允许其他模块使用反射（如Spring, Hibernate）访问本模块指定包的非公共成员
    opens com.example.myapp.internal;

    // 指定本模块中哪个类是该模块的“主类”（可用于java -m启动）
    provides com.example.spi.MyService with com.example.impl.MyServiceImpl;
}
```

*   **关键字解析**：
    *   `requires`：声明对另一个模块的编译期和运行期依赖。
    *   `requires transitive`：**传递性依赖**。依赖本模块的模块，会自动获得对`com.example.utils`模块的访问权。这相当于将依赖“传递”了下去。
    *   `exports`：**导出包**。只有被导出的包，模块外的代码才能访问其`public`类型。
    *   `opens`：**开放包**。主要为了向后兼容框架（Spring, Hibernate）。开放包允许在运行时通过反射访问其所有成员（包括`private`），但编译时仍不能访问。
    *   `provides ... with ...`：用于Java服务加载机制（SPI），声明服务实现。

#### **3. 模块的编译、打包与运行命令**

假设项目结构如下：
```
src/
└── com.example.hello/
    ├── module-info.java
    └── com/
        └── example/
            └── hello/
                └── Main.java
```

*   **编译模块**
    ```bash
    # -d 指定编译输出目录
    javac -d mods/com.example.hello \
          src/com.example.hello/module-info.java \
          src/com.example.hello/com/example/hello/Main.java
    ```
    编译后，`mods`目录下会形成与模块名对应的结构。

*   **打包模块化JAR**
    ```bash
    # --create 创建jar
    # --file 指定输出的jar文件名
    # -C 切换到指定目录，并将其内容加入jar包
    jar --create --file hello.jar -C mods/com.example.hello .
    ```
    这个JAR包就是一个**模块化JAR**，因为它根目录包含`module-info.class`。

*   **运行模块**
    ```bash
    # --module-path (-p) 指定模块路径，替代传统的classpath
    # -m 指定主模块/主类，格式为：模块名/主类全限定名
    java --module-path hello.jar -m com.example.hello/com.example.hello.Main
    ```

#### **4. 模块路径 (`--module-path`) 与类路径 (`-cp`) 的对比**

| 特性 | 类路径 (`-cp`) | 模块路径 (`-p`) |
| :--- | :--- | :--- |
| **寻址方式** | 平铺的“资源池”，JVM全局搜索 | 严格的模块化命名空间，按模块名查找 |
| **依赖解析** | 懒加载，运行时可能报错 | 启动时即解析所有模块依赖，确保完备性 |
| **封装性** | 弱，可通过反射访问任何类 | 强，只有`exports`/`opens`的包才可被外部访问 |
| **应用场景** | 传统无模块应用、第三方库 | **Java 9+ 的显式模块化应用** |

#### **5. 重要实践提示与“坑”**

1.  **模块名唯一性**：模块名应全局唯一，通常使用**反向域名的约定**（如 `com.example.myapp`）。

2.  **“未命名模块”与“自动模块”**：
    *   放在模块路径上的JAR包，**必须**是模块化JAR。
    *   传统的非模块化JAR放在模块路径上，会变为**自动模块**，模块名由其文件名推断。这是一种迁移手段，但非长久之计。
    *   传统JAR放在类路径上，则所有类都被归入**未命名模块**，可以访问所有其他模块，但失去了模块化的所有优势。

3.  **服务加载机制 (`uses`/`provides`)**：这是模块系统中实现**解耦**的强大工具。一个模块可以`uses`一个接口，而另一个模块`provides`该接口的实现。运行时由JVM动态绑定。

4.  **迁移策略**：大型项目迁移到模块系统是渐进式的。可以从创建少数几个核心模块开始，其他部分仍作为自动模块或留在类路径上。
