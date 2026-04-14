---
title: Java 模块
created: 2025-12-22 20:07
modified: 2025-12-22 20:07
tags: [技术栈, JavaEE]
subject: JavaEE
---
# Java模块系统核心要点总结（问答形式）

---

## Q1: Java模块系统解决了什么核心问题？

**A:** 三个主要问题：

1. **同名类冲突**
   - 传统：两个JAR有同名类，JVM悄悄选第一个，不同环境classpath顺序可能不同
   - 模块：启动时强制检查，发现同名包立即报错

2. **封装不足**
   - 传统：`public`类对整个classpath可见，无法隐藏内部实现
   - 模块：通过`exports`控制包级别可见性，未导出的包外部完全访问不到

3. **依赖不明确**
   - 传统：只检查直接依赖，传递依赖缺失只有运行时才知道
   - 模块：编译时检查完整依赖链，缺少传递依赖立即报错

---

## Q2: 为什么传统classpath会有同名类问题？

**A:** 因为Java的import只指定**包名+类名**，不指定JAR：

```java
import com.example.Utils;  // 没有指定来自哪个JAR
```

如果两个JAR都有这个类：
- 编译器/JVM使用classpath中**第一个**找到的
- 不同环境classpath顺序可能不同
- 可能导致"开发环境正常，生产环境出错"

---

## Q3: 编译时为什么不检查传递依赖？

**A:** 传统编译器的工作方式：

```
你的代码 Main.java
  └─ 调用 library.jar 的 DataProcessor.process()
       └─ process() 内部用了 Gson
```

**编译Main时：**
- ✅ 检查：`DataProcessor`类存在吗？`process()`方法存在吗？
- ❌ 不检查：`process()`内部用了什么？`library`的依赖是否齐全？

**原因：**
- library.jar已经编译好，编译器只看`.class`文件的方法签名
- 不会去检查方法体的实现代码
- 效率考虑：避免递归检查整个依赖树

**模块系统改进：**
- 通过`module-info.java`明确声明依赖
- 编译时验证整个模块依赖图的完整性

---

## Q4: 模块系统是否自动管理依赖？

**A:** **不是！** 这是一个常见误解。

**模块系统不负责：**
- ❌ 自动下载依赖
- ❌ 自动查找依赖位置
- ❌ 替代Maven/Gradle

**模块系统负责：**
- ✅ 验证依赖的完整性和一致性
- ✅ 强制封装规则
- ✅ 检测包冲突

**实际工作流：**
```bash
# 依赖路径还是要手动指定（或由构建工具指定）
javac --module-path A.jar:B.jar:C.jar --module com.myapp

# 但模块系统会验证：
# - A, B, C 的依赖关系是否正确
# - 是否有缺失的传递依赖
# - 是否有包冲突
```

---

## Q5: `--module` 参数的作用是什么？

**A:** 指定要编译哪个模块，并自动处理该模块的所有源文件。

**对比：**

```bash
# 传统方式：手动列出所有文件
javac com/a/Main.java com/a/Utils.java com/a/Service.java ...

# 模块方式：自动查找模块下所有文件
javac --module-source-path . --module com.a -d out
```

**编译器会：**
1. 查找`com.a`模块的源代码目录
2. 读取`module-info.java`
3. 自动找到模块下所有`.java`文件
4. 检查依赖模块是否在`--module-path`中
5. 验证依赖链完整性

---

## Q6: 为什么传统方式必须带上整个JRE？

**A:** 这里的"整个JRE"指的是**Java运行时环境本身**，不是你的应用JAR。

**两个层面：**

1. **应用依赖层面**（你说得对）：
   ```bash
   java -cp gson.jar:mysql.jar:myapp.jar Main
   # ✅ 只需要用到的JAR
   ```

2. **Java运行时层面**（问题所在）：
   ```
   Java 8的JRE结构：
   └── rt.jar (60MB)
       ├── java.lang.* (核心，你需要)
       ├── java.util.* (集合，你需要)
       ├── java.awt.*  (GUI，你可能不需要)
       ├── javax.swing.* (GUI)
       ├── java.sql.* (数据库)
       └── ...所有东西打包在一起
   ```

**问题：**
- rt.jar是一个**巨大的整体**，无法拆分
- 即使你只用`String`和`System.out`
- 也必须安装包含GUI、数据库等所有功能的完整JRE（200MB）

---

## Q7: jlink和jmods解决了什么问题？

**A:** 允许创建**定制化的最小运行时环境**。

### jlink的作用：

```bash
jlink --module-path $JAVA_HOME/jmods:mods \
      --add-modules com.myapp \
      --output myapp-runtime
```

**jlink会：**
1. 分析`com.myapp`的依赖树
2. 只打包需要的JDK模块（如java.base）
3. 创建包含JVM+必要模块的最小运行时

**效果对比：**
- 完整JRE: 200 MB
- jlink定制: 40-50 MB
- 最小化: 30 MB (仅java.base)

### jmods的作用：

- `.jmod`是JDK模块的完整打包格式
- 包含class文件、本地库、配置文件
- 专门为jlink优化，提供完整的模块信息

---

## Q8: 模块系统的核心价值是什么？

**A:** 不是自动化，而是**约束和验证**。

| 功能 | 传统JAR | 模块系统 |
|------|---------|----------|
| 手动指定依赖 | 需要 | 仍然需要 |
| 验证传递依赖 | ❌ | ✅ |
| 包级别封装 | ❌ | ✅ exports控制 |
| 同名包检测 | ❌ | ✅ 启动时报错 |
| 定制运行时 | ❌ | ✅ jlink支持 |
| JDK瘦身 | ❌ | ✅ 按需打包 |

**一句话总结：**
模块系统让Java从"把所有东西扔在一起"变成"明确边界、强制约束、可验证的依赖管理"，并支持创建最小化运行时环境。
