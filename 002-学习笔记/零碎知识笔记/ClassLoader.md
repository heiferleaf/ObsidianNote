---
created: 2026-01-28
modified: 2026-01-28
---
![[QQ_1769580765205.png]]


## 📌 Java 类加载器核心笔记

### 1. 三大默认类加载器（双亲委派模型）

- **Bootstrap ClassLoader（启动类加载器）**：由 C++ 编写。加载核心库（`rt.jar`）。Java 代码中获取结果为 `null`。
    
- **Extension ClassLoader（扩展类加载器）**：加载 `%JAVA_HOME%/lib/ext` 下的 Jar 包。
    
- **App/System ClassLoader（应用类加载器）**：加载你项目里的 `classpath`（你的代码和 Maven 依赖）。
    

---

### 2. 双亲委派机制 (Parent Delegation)

- **流程**：收到加载请求 → 先委托给父加载器 → 父类加载不到 → 自己才动手。
    
- **核心目的**：
    
    - **安全**：防止核心类（如 `String`）被篡觉。
        
    - **唯一性**：保证同一个类不会被重复加载。
        

---

### 3. 三种获取 ClassLoader 的方式对比

|**代码方式**|**含义**|**特点/局限性**|
|---|---|---|
|`obj.getClass().getClassLoader()`|**静态绑定**|谁写的代码就用谁的加载器。框架层代码用它时，常因为找不到业务层资源而报错。|
|`ClassLoader.getSystemClassLoader()`|**全局唯一**|永远指向 AppClassLoader。在 Tomcat 多应用环境下，无法区分不同的 Web 项目。|
|`Thread.currentThread().getContextClassLoader()`|**动态感知**|**【推荐】** 拿到当前线程执行任务时的加载器。能实现“父加载器”反向调用“子加载器”的资源。|

---

### 4. 为什么截图代码要用 ContextClassLoader？

- **打破阶级局限**：框架代码（如 JDBC、Spring）通常由较高级别的加载器加载，而配置文件（`db.properties`）位于低级别的应用目录。
    
- **向下兼容**：只有通过“线程上下文”拿到的加载器，才能跨越双亲委派的限制，确保框架能精准摸到用户项目里的私有资源。
    

---

### 💡 面试一句话总结：

> “`getClassLoader()` 是**向上看**（遵循双亲委派），而 `getContextClassLoader()` 是为了**向下看**（打破双亲委派带来的限制）。它是框架代码加载用户配置文件的万能钥匙。”
