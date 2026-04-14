---
title: DAY9 IO
created: 2025-12-11
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
**【整理原则重申】**
1.  **完整覆盖**：首先确保100%覆盖原始摘要的所有知识点，不丢弃、不擅自概括。所有内容均以统一、流畅的叙述方式呈现。
2.  **修正错误**：对其中可能的错误或易混淆点进行指正和说明。
3.  **结构化呈现**：将内容重新组织为逻辑清晰、层次分明的格式。
4.  **必要补充**：在完全覆盖原始要点的基础上，对关键概念进行扩展说明或补充最佳实践。

---

**“理解IO，是理解程序如何与现实世界交互的关键一步。”**

### **Java IO/NIO 核心概念与操作**

#### **一、IO基础概念**

*   **IO定义**：指数据的**输入**和**输出**。程序（CPU）只能处理内存中的数据，因此需要将外部数据（如磁盘文件）**读取到内存（Input）**，或将内存中的数据**写出到外部（Output）**。
*   **IO流特性**：数据按**顺序**、**单向**流动。可分为字节流和字符流。
*   **同步 vs 异步**
    *   **同步IO**：程序发出IO请求后**必须等待**操作完成才能继续执行。**阻塞线程，CPU利用率低**。
    *   **异步IO**：程序发出IO请求后**立即返回**，继续执行后续代码。待IO操作完成后，系统会通过回调等方式通知程序。**不阻塞线程，CPU利用率高**。
    *   **Java NIO**：Java提供了 `java.nio` 包支持异步和非阻塞IO。

> **学习重点**：理解同步/异步、阻塞/非阻塞的区别。在实际开发中，**绝大多数Java IO操作是同步阻塞的**。NIO是高级内容，初期重点掌握传统IO即可。

#### **二、File类：操作文件和目录**

`File` 对象用于表示文件系统中的**文件**或**目录**，它只代表一个**路径引用**，不保证该路径实际存在。

**1. 路径获取**
```java
File f = new File("..\\dir\\file.txt");
f.getPath();      // 返回构造时的路径："..\\dir\\file.txt"
f.getAbsolutePath(); // 返回绝对路径（从盘符或根目录开始）
f.getCanonicalPath(); // 返回规范化的绝对路径（解析 `..` 和 `.`）
// 例如 `C:\Windows\System32\..\notepad.exe` → `C:\Windows\notepad.exe`
```

**2. 判断与查询**
```java
f.isFile();      // 是否是文件
f.isDirectory(); // 是否是目录
f.exists();      // 是否存在
f.canRead();     // 是否可读
f.canWrite();    // 是否可写
f.canExecute();  // 是否可执行
f.length();      // 文件大小（字节），对目录无效
```

**3. 创建与删除**
```java
// 文件操作
f.createNewFile();   // 创建新文件（仅当不存在时）
f.delete();          // 删除文件或空目录

// 目录操作
f.mkdir();           // 创建单级目录（父目录必须存在）
f.mkdirs();          // 创建多级目录（自动创建不存在的父目录）

// 临时文件
File tmp = File.createTempFile("prefix", ".suffix");
tmp.deleteOnExit();  // JVM退出时自动删除
```

**4. 遍历目录**
```java
String[] names = f.list(); // 返回子项名称数组
File[] files = f.listFiles(); // 返回File对象数组
// 可使用 FilenameFilter 或 FileFilter 进行过滤
File[] txtFiles = f.listFiles((dir, name) -> name.endsWith(".txt"));
```

> **学习重点**：`File` 对象仅用于**操作文件元数据（路径、权限、大小等）和目录结构**，**不用于读写文件内容**。这是初学者常见混淆点。

#### **三、字节流：InputStream / OutputStream**

这是最基础的IO流，以**字节**为单位操作数据。它们都是**抽象类**。

**1. InputStream 核心方法**
*   **`int read()`**：读取**一个字节**，返回 `0-255` 的int值。如果已到达流末尾，返回 `-1`。
*   **`int read(byte[] b)`**：读取若干字节并填充到字节数组 `b` 中，返回实际读取的字节数（可能小于数组长度）。到达末尾时返回 `-1`。
*   **`int read(byte[] b, int off, int len)`**：更精确地控制读取位置和长度。
*   **`void close()`**：必须关闭流以释放系统资源。

**2. 缓冲与阻塞**
*   **缓冲**：操作系统和JVM内部都有缓冲机制，目的是减少实际物理IO次数，提高效率。手动使用字节数组作为缓冲区是同样的原理。
*   **阻塞**：`read()` 方法是**阻塞**的。如果流中暂时没有数据，调用 `read()` 的线程会**停止**，直到有数据可读或流关闭。

**3. 资源释放（关键！）**
由于IO操作会抛出 `IOException`，必须确保流在任何情况下（包括发生异常时）都被关闭。**强烈推荐使用 `try-with-resources` 语法**（Java 7+）。

```java
// ❌ 错误示例：异常可能导致流未关闭
InputStream in = new FileInputStream("test.txt");
in.read();
in.close();

// ✅ 正确示例：try-with-resources 自动关闭
try (InputStream in = new FileInputStream("test.txt")) {
    byte[] buffer = new byte[1024];
    int n;
    while ((n = in.read(buffer)) != -1) {
        // 处理读取到的n个字节
    }
} // 此处自动调用 in.close()
```

**4. OutputStream 核心方法**
*   **`void write(int b)`**：写入**一个字节**。注意：参数是 `int` 类型，但只写入其**低8位**。
*   **`void write(byte[] b)`** / `write(byte[] b, int off, int len)`：写入字节数组。
*   **`void flush()`**：强制将缓冲区的数据写出到目的地。某些流（如 `BufferedOutputStream`）有缓冲区，`flush()` 可确保数据立即写出，而不会等到缓冲区满或流关闭。
*   **`void close()`**：关闭流。通常 `close()` 会先自动调用 `flush()`。

#### **四、字符流与编码**

**1. 为什么需要字符流？**
*   字节流操作的是原始字节。而文本文件是由**字符**组成的，每个字符在不同编码（如UTF-8, GBK）下占用的字节数不同。
*   **Reader / Writer** 是基于字节流的**装饰器**，它们能**自动处理字符编码的转换**，将字节流转为字符流，方便文本处理。

**2. 编码核心**
*   Java内存中，`String` 和 `char` 使用 **Unicode（UTF-16）** 编码。
*   当从字节流读取文本时，需要知道原始的**字符编码**（如UTF-8），才能正确地将字节序列解码为Unicode字符。
*   当将字符写出到字节流时，需要指定**字符编码**，将Unicode字符编码为特定字节序列。

```java
// 使用字符流读取文本文件，指定编码
try (Reader reader = new InputStreamReader(new FileInputStream("text.txt"), StandardCharsets.UTF_8)) {
    // 按字符读取
}

// 使用字符流写出文本，指定编码
try (Writer writer = new OutputStreamWriter(new FileOutputStream("output.txt"), StandardCharsets.UTF_8)) {
    writer.write("你好，世界");
}
```

> **学习重点**：
> 1.  **文本处理一律使用 `Reader/Writer` 及其子类**（如 `BufferedReader`, `PrintWriter`），而非直接使用 `InputStream/OutputStream`。
> 2.  **必须明确指定字符编码**。如果不指定，将使用平台默认编码，导致跨环境运行时乱码。

#### **五、装饰器模式与常用流**

Java IO 库大量使用了**装饰器模式**，通过组合来增加功能，而非继承。

**1. 常用装饰器**
*   **`BufferedInputStream` / `BufferedOutputStream`**：提供**缓冲功能**，大幅提升读写性能（减少实际IO次数）。
*   **`BufferedReader` / `BufferedWriter`**：提供缓冲功能，`BufferedReader` 特有 `readLine()` 方法，方便按行读取文本。
*   **`DataInputStream` / `DataOutputStream`**：读写Java基本数据类型（`int`, `double`, `boolean` 等）。
*   **`ObjectInputStream` / `ObjectOutputStream`**：用于**Java对象序列化**。

**2. 序列化**
*   **概念**：将对象的状态（数据）转换为字节流的过程。
*   **要求**：被序列化的类必须实现 `Serializable` 接口（这是一个**标记接口**，没有方法）。
*   **`serialVersionUID`**：强烈建议显式声明，用于标识类的版本。如果类的结构发生不兼容改变，反序列化时会抛出 `InvalidClassException`。
*   **使用场景**：对象网络传输、持久化存储到文件或数据库。

```java
// 序列化
try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("data.ser"))) {
    oos.writeObject(myObject); // myObject 必须实现 Serializable
}

// 反序列化
try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream("data.ser"))) {
    MyClass obj = (MyClass) ois.readObject();
}
```
> **学习重点**：理解装饰器模式如何工作（如 `new BufferedInputStream(new FileInputStream(...))`）。掌握 `Buffered` 系列流的用法。理解序列化的基本概念和 `Serializable` 接口。

#### **六、其他重要概念（了解即可）**

1.  **Classpath资源读取**：
    ```java
    // 从类路径（classpath）读取资源文件
    InputStream in = MyClass.class.getResourceAsStream("/config.properties");
    // 路径以 `/` 开头，表示从classpath根目录查找
    ```
2.  **压缩文件处理**：`ZipInputStream` 和 `ZipOutputStream` 用于读写ZIP格式的压缩包。
3.  **标准输入/输出**：`System.in`（标准输入，`InputStream` 类型），`System.out`（标准输出，`PrintStream` 类型）。

### **Java字符流与文件工具类详解**

#### **一、字符输入流（Reader）深度解析**

**1. 字符流的本质**
`Reader` 和 `Writer` 是基于字节流的**装饰器**，它们**内部持有一个 `InputStream` 或 `OutputStream`**，通过指定的字符编码在**字节**与**字符**之间自动转换。

```java
// InputStreamReader 是将字节流转为字符流的关键桥梁
Reader reader = new InputStreamReader(
    new FileInputStream("file.txt"), // 字节流
    StandardCharsets.UTF_8           // 指定编码
);
```

**2. 常用字符输入流实现类**
*   **`StringReader`**：从**字符串**中读取字符。在内存中模拟一个字符流。
    ```java
    try (StringReader reader = new StringReader("Hello, 世界")) {
        int c;
        while ((c = reader.read()) != -1) {
            System.out.print((char) c);
        }
    }
    ```

*   **`CharArrayReader`**：从**字符数组**中读取字符。与 `StringReader` 类似，但数据源是 `char[]`。
    ```java
    char[] data = {'H', 'e', 'l', 'l', 'o'};
    try (CharArrayReader reader = new CharArrayReader(data)) {
        // 读取操作
    }
    ```

*   **`FileReader`**：从文件中读取字符的快捷类。**重要**：`FileReader` 使用的是**平台默认编码**，在跨平台环境中易导致乱码。
    ```java
    // ❌ 不推荐：使用默认编码，可能导致乱码
    try (FileReader reader = new FileReader("file.txt")) {
        // ...
    }
    
    // ✅ 推荐：明确指定编码（通过InputStreamReader包装）
    try (Reader reader = new InputStreamReader(
            new FileInputStream("file.txt"), 
            StandardCharsets.UTF_8)) {
        // ...
    }
    ```

**3. 关键原则**
*   **总是使用 `try-with-resources`** 确保 `Reader` 正确关闭。
*   **总是明确指定字符编码**，除非确定使用平台默认编码是安全的（这种情况极少）。

#### **二、字符输出流（Writer）详解**

**1. Writer核心方法**
*   `void write(int c)`：写入单个字符（0-65535）。
*   `void write(char[] cbuf)`：写入字符数组。
*   `void write(char[] cbuf, int off, int len)`：写入字符数组的一部分。
*   `void write(String str)` / `write(String str, int off, int len)`：写入字符串。
*   `void flush()`：强制刷出缓冲区数据。
*   `void close()`：关闭流（通常先调用 `flush()`）。

**2. 常用字符输出流实现类**
*   **`CharArrayWriter`**：将字符写入内部可扩展的 `char[]` 缓冲区，可通过 `toCharArray()` 或 `toString()` 获取数据。
    ```java
    try (CharArrayWriter writer = new CharArrayWriter()) {
        writer.write("Hello");
        writer.write(" World");
        char[] data = writer.toCharArray(); // 获取字符数组
        String str = writer.toString();     // 获取字符串
    }
    ```

*   **`StringWriter`**：功能类似 `CharArrayWriter`，但内部使用 `StringBuffer`，更便于构建字符串。
*   **`FileWriter`**：向文件写入字符的快捷类。同样存在**默认编码问题**，推荐使用 `OutputStreamWriter` 包装 `FileOutputStream` 并明确指定编码。

#### **三、Files工具类（Java 7+）**

`java.nio.file.Files` 提供了简洁的静态方法，极大简化了常见文件操作。

**1. 读取文件**
```java
import java.nio.file.*;

// 读取所有字节（二进制文件）
byte[] bytes = Files.readAllBytes(Paths.get("file.bin"));

// 读取所有文本（默认UTF-8）
String content = Files.readString(Paths.get("file.txt"));

// 指定编码读取文本
String content2 = Files.readString(
    Paths.get("file.txt"), 
    StandardCharsets.ISO_8859_1
);

// 按行读取（返回List<String>）
List<String> lines = Files.readAllLines(Paths.get("file.txt"));
// 也可指定编码：Files.readAllLines(path, charset)
```

**2. 写入文件**
```java
// 写入二进制数据
byte[] data = ...;
Files.write(Paths.get("file.bin"), data);

// 写入文本（默认UTF-8）
Files.writeString(Paths.get("file.txt"), "文本内容");

// 指定编码写入文本
Files.writeString(
    Paths.get("file.txt"), 
    "文本内容", 
    StandardCharsets.UTF_8
);

// 按行写入文本
List<String> lines = Arrays.asList("第一行", "第二行");
Files.write(Paths.get("file.txt"), lines);
Files.write(Paths.get("file.txt"), lines, StandardCharsets.UTF_8);

// 追加写入（使用OpenOption）
Files.writeString(
    Paths.get("file.txt"), 
    "追加内容", 
    StandardOpenOption.APPEND
);
```

**3. 其他实用方法**
```java
// 复制文件
Files.copy(sourcePath, targetPath);

// 移动/重命名文件
Files.move(sourcePath, targetPath);

// 删除文件
Files.delete(path);
Files.deleteIfExists(path); // 安全删除

// 创建目录
Files.createDirectory(path);
Files.createDirectories(path); // 创建多级目录

// 检查文件属性
boolean exists = Files.exists(path);
boolean isDir = Files.isDirectory(path);
long size = Files.size(path);
```

> **重要说明**：`Files` 类的所有读写方法都是**一次性将整个文件内容加载到内存**。对于**大文件**（如几百MB或GB级别），使用这些方法可能导致内存溢出（`OutOfMemoryError`）。处理大文件时，仍应使用传统的流式读写（`BufferedReader`、`BufferedInputStream`）。

#### **四、编码问题总结**

**黄金法则**：
1.  在内存中，Java一律使用 **Unicode（UTF-16）** 表示字符。
2.  当字符数据进出程序时（读取文件、网络传输、数据库存取），**必须明确指定编码**。
3.  如果不指定编码，JVM将使用**平台默认编码**，这是导致乱码的常见原因。

**正确实践**：
```java
// ✅ 明确指定编码的读写
try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(
            new FileInputStream("file.txt"), 
            StandardCharsets.UTF_8))) {
    String line;
    while ((line = reader.readLine()) != null) {
        // 处理每一行
    }
}

try (BufferedWriter writer = new BufferedWriter(
        new OutputStreamWriter(
            new FileOutputStream("output.txt"), 
            StandardCharsets.UTF_8))) {
    writer.write("数据");
}
```

---

### **Java IO 核心练习题**

#### **基础题（每题15分，共45分）**

**题目1：编码转换与字符流处理**
```java
/**
 * 1. 创建一个文本文件 "source.txt"，内容为："你好，Java！"（使用UTF-8编码保存）
 * 2. 使用 FileReader 读取该文件并打印内容，观察结果
 * 3. 使用 InputStreamReader 配合 FileInputStream，指定UTF-8编码读取，观察结果
 * 4. 将读取的内容以GBK编码写入新文件 "gbk_output.txt"
 * 5. 再将 "gbk_output.txt" 以GBK编码读回，并转为UTF-8字符串打印
 * 
 * 思考：为什么第2步和第3步的结果可能不同？
 */
```

**题目2：内存字符流应用**
```java
/**
 * 1. 使用 StringReader 和 StringWriter 实现字符串反转功能
 *    输入："Hello World"，输出："dlroW olleH"
 * 2. 使用 CharArrayReader 和 CharArrayWriter 统计一段文本中
 *    每个字符出现的次数（不区分大小写）
 * 3. 实现一个简单的模板引擎：
 *    - 给定模板："尊敬的{name}，您有{count}条新消息"
 *    - 使用 StringReader 读取模板，StringWriter 写入结果
 *    - 将 {name} 替换为 "张三"，{count} 替换为 "5"
 */
```

**题目3：Files工具类实战**
```java
/**
 * 1. 使用 Files.createDirectories() 创建目录结构：./data/2024/05/20
 * 2. 在目录中创建3个文本文件，内容分别为：
 *    file1.txt: "这是第一行\n这是第二行"
 *    file2.txt: "Another file"
 *    file3.txt: "第三文件"
 * 3. 使用 Files.walk() 遍历该目录，统计：
 *    - 文件总数
 *    - 所有.txt文件的总行数
 *    - 所有文件的总字符数（中英文都算一个字符）
 * 4. 将统计结果写入该目录下的 "report.txt" 文件
 * 5. 将所有.txt文件合并为一个文件 "combined.txt"
 */
```

#### **进阶题（每题25分，共55分）**

**题目4：实现一个简单的文件编码检测器**
```java
/**
 * 实现一个工具类 FileEncodingDetector，包含以下方法：
 * 
 * 1. detectEncoding(Path filePath): 尝试检测文件的字符编码
 *    - 尝试用 UTF-8、GBK、ISO-8859-1 读取文件
 *    - 通过判断是否出现替代字符（�）或解码异常来判断编码
 *    - 返回最可能的编码
 * 
 * 2. convertEncoding(Path source, Charset sourceCharset, 
 *                    Path target, Charset targetCharset)
 *    - 将文件从一种编码转换为另一种编码
 *    - 使用 BufferedReader 和 BufferedWriter，每次处理一行
 *    - 支持大文件（不能一次性读取全部内容）
 * 
 * 3. 编写测试代码，使用不同编码的文件进行测试
 */
```

**题目5：实现配置文件的读写管理器**
```java
/**
 * 设计一个 PropertiesFileManager 类，要求：
 * 
 * 1. 支持多种配置文件格式：
 *    - Java Properties 格式（key=value）
 *    - JSON 格式
 *    - 自定义格式（每行 "key:value"）
 * 
 * 2. 方法：
 *    - load(Path file, FileFormat format): 加载配置文件到 Map
 *    - save(Path file, Map<String, String> config, FileFormat format): 保存配置
 *    - getString(String key): 获取配置值
 *    - setString(String key, String value): 设置配置值
 * 
 * 3. 要求：
 *    - 使用适当的 Reader/Writer 实现
 *    - 处理字符编码（统一使用UTF-8）
 *    - 线程安全
 *    - 对于Properties格式，继承java.util.Properties类
 * 
 * 4. 扩展：支持配置变更监听器
 */
```

**题目6：大文件处理与性能优化**
```java
/**
 * 场景：有一个10GB的日志文件 "access.log"，需要：
 * 
 * 1. 统计访问次数最多的前10个IP地址
 * 2. 统计每种HTTP状态码的出现次数
 * 3. 将包含错误（状态码>=500）的行提取到单独文件 "errors.log"
 * 
 * 日志格式示例：
 * 192.168.1.1 - - [20/May/2024:10:30:00 +0800] "GET /index.html HTTP/1.1" 200 1024
 * 
 * 要求：
 * 1. 不能使用 Files.readAllLines() 或类似一次性加载全部内容的方法
 * 2. 使用缓冲流提高性能
 * 3. 合理使用数据结构（考虑HashMap、PriorityQueue等）
 * 4. 实现进度显示（每处理100万行打印一次进度）
 * 5. 注意内存使用，避免OOM
 * 
 * 编写完整解决方案并测试（可用小文件测试，但代码要支持大文件）
 */
```

#### **挑战题（30分）**

**题目7：实现一个简单的文本文件差异比较工具**
```java
/**
 * 实现一个类似于 diff 的工具，比较两个文本文件的差异。
 * 
 * 功能要求：
 * 1. 支持三种输出格式：
 *    - 并排显示（类似IDE的对比视图）
 *    - 统一格式（unified diff）
 *    - 上下文格式（context diff）
 * 
 * 2. 核心算法：实现基于行的最长公共子序列（LCS）算法
 * 
 * 3. 优化：使用滚动数组减少内存使用
 * 
 * 4. 支持字符级差异高亮（可选）
 * 
 * 输入：两个文件路径
 * 输出：差异报告（可输出到文件或控制台）
 * 
 * 示例：
 * 文件A：                    文件B：
 *  第一行                    第一行
 *  第二行                    修改的行
 *  第三行                    第三行
 *                           新增行
 * 
 * 输出（并排格式）：
 * 文件A              |   文件B
 * -------------------|-------------------
 * 第一行             |   第一行
 * 第二行             |   修改的行 [修改]
 * 第三行             |   第三行
 *                    |   新增行 [新增]
 */
```

---

### **练习要求与提示**

**核心考察点**：
1. **字符编码**：理解UTF-8、GBK等编码的区别，掌握正确指定编码的方法
2. **流的选择**：根据场景选择正确的流类型（字节流/字符流、缓冲流、内存流）
3. **资源管理**：正确使用 `try-with-resources` 确保资源释放
4. **性能考虑**：处理大文件时的内存优化与缓冲策略
5. **API熟悉度**：熟练使用 `Files` 工具类简化常见操作

**编码规范**：
1. 所有IO操作必须使用 `try-with-resources`
2. 字符流操作必须明确指定字符编码
3. 合理处理 `IOException`
4. 为方法添加必要的注释
5. 编写单元测试验证功能正确性

**学习建议**：
1. 从基础题开始，确保理解字符流与字节流的转换关系
2. 进阶题需要综合运用集合、IO、算法等知识
3. 挑战题可作为长期项目，逐步完善功能
4. 实际运行代码时，注意文件路径和编码设置
5. 对比不同实现方式的性能差异，理解缓冲的重要性

完成这些练习后，您将对Java IO有深入的理解，能够处理各种文件操作场景，并为学习NIO打下坚实基础。
