---
title: DAY4 基础部分
created: 2025-11-30
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
### **第一步：规格化整理与补充**

#### **一、String 类的不可变性**
*   **三个决定性的设计**（您的要点）：
    1.  **`final` 类**：`String`类被声明为`final`，无法被继承，杜绝了子类改变其行为的可能性。
    2.  **`final` 字符数组**：内部存储数据的`byte[]`（或`char[]`）被声明为`final`，引用一旦初始化就不能再指向其他数组。
    3.  **无`setter`方法**：没有提供任何可以修改内部数组内容的公共方法。
*   **重要补充**：所有看似修改字符串的操作（如`concat`、`replace`、`substring`）**都会返回一个新的String对象**，原对象不变。

#### **二、String 常用操作方法**
-   **长度**：`length()`
*   **比较**：`equals`、`equalsIgnoreCase`。
*   **查找**：`contains`、`indexOf`、`lastIndexOf`、`startsWith`、`endsWith`。
*   **子串**（您的要点）：
    *   `substring(int beginIndex)`：从`beginIndex`到字符串末尾。
    *   `substring(int beginIndex, int endIndex)`：提取`[beginIndex, endIndex)`区间的子串。
*   **去除空白**（您的要点）：
    *   `trim()`：去除ASCII控制字符（`\t`, `\r`, `\n`）和半角空格。
    *   `strip()`（Java 11+）：去除所有Unicode空白字符，包括全角空格`\u3000`。
*   **判空**（您的要点）：
    *   `isEmpty()`：当且仅当`length()`为0时返回`true`。
    *   `isBlank()`（Java 11+）：当字符串为空或仅包含空白字符时返回`true`。
*   **格式化**（您的要点）：
    *   `String.format(String format, Object... args)`：静态方法。
    *   `"模板".formatted(Object... args)`（Java 15+）：实例方法。
*   **替换**：`replace(char oldChar, char newChar)`或`replace(CharSequence target, CharSequence replacement)`。
*   **类型转换**：与`char[]`、`byte[]`及基本类型的转换方法。

#### **三、字符编码事宜**
*   **演进背景**（您的要点）：
    *   `ASCII`：英文，8位，0-127。
    *   `GB2312`等：本地化编码，如用2字节表示一个汉字。
    *   `Unicode`：全球统一字符集，为所有字符分配唯一码点。
    *   `UTF-8`：`Unicode`的一种变长编码实现，对ASCII兼容，节省空间。
*   **Java中的实现**（您的要点）：
    *   `String`和`char`在内存中使用**Unicode**（具体为UTF-16）编码。
    *   `String`内部的`byte[]`可能会根据内容（Latin-1或UTF-16）采用不同编码存储以优化空间。
    *   **关键理解**：`String`对象存储的是字符（Unicode码点），当与外部（I/O、网络）进行字节转换时，必须通过**编码**（`getBytes(charset)`）和**解码**（`new String(bytes, charset)`）过程，并**明确指定字符集**（如UTF-8），否则使用平台默认编码，极易导致乱码。

#### **四、StringBuilder 与 StringJoiner**
*   **StringBuilder**：
    *   **线程不安全**，但单线程下性能高。
    *   主要方法：`append`、`insert`、`toString`。
*   **StringJoiner**：用于方便地构造由分隔符、前缀、后缀连接的序列。

#### **五、包装类**
*   **目的**（您的要点）：将基本类型包装成对象，以支持`null`、泛型、集合，并提供更多实用方法。
*   **不可变性**：所有包装类（`Integer`、`Double`等）的对象也是`immutable`的。
*   **自动装箱/拆箱**（您的要点）：
    *   自动装箱：`Integer i = 100;` 等价于 `Integer i = Integer.valueOf(100);`
    *   自动拆箱：`int n = i;` 等价于 `int n = i.intValue();`
*   **判等重要警告**（您的要点）：
    *   必须使用`equals()`比较内容，**不能使用`==`**。
    *   部分值（通常是**-128到127**的`Integer`和`Short`等）会被JVM**缓存**。对此范围内的值，`==`可能为`true`，但这是**实现细节，不可依赖**。

#### **六、JavaBean**
*   一种类设计的约定（您的要点），特点：
    1.  属性`private`。
    2.  提供公共的`getter`和`setter`。
    3.  有无参公共构造器。

#### **七、枚举类**
*   **本质与设计**（您的要点）：
    *   `enum`是实现“多例模式”的语法糖。
    *   枚举实例是类内部定义的`public static final`对象。
    *   **属性**：可以有属性，通常为`private final`。
    *   **构造**：构造函数必须是`private`（可省略，默认即为`private`），在声明实例时初始化属性。
*   **内置方法**（您的要点）：
    *   `name()`：返回实例的声明名称（字符串）。
    *   `ordinal()`：返回实例的声明序数（`int`，从0开始）。
    *   `values()`：返回包含所有实例的数组。
    *   `valueOf(String name)`：根据名称获取对应实例。
    *   `toString()`：默认返回`name()`，**可以重写**。
    *   `compareTo(E o)`：比较两个枚举常量的**`ordinal`差值**。
*   **高级用法**（您的要点）：
    *   可以在`enum`中定义**抽象方法**，则每个枚举实例都必须实现它（通常用`{ ... }`匿名内部类语法）。
*   **重要补充**：
    *   由于`ordinal()`与定义顺序强绑定，业务中建议使用自定义字段（如`code`）作为编码，并提供`fromCode()`静态查找方法。

#### **八、记录类**
*   **目的**（您的要点）：用于创建**不可变的数据载体**，是语法糖。
*   **编译器自动生成**（您的要点）：全参构造器、`equals()`、`hashCode()`、`toString()`、以及每个组件的`getter`方法（如`x()`）。
*   **限制与特性**（您的要点）：
    *   是`final`类，**不能继承**，也**不能被继承**。
    *   可以**实现接口**。
    *   可以定义**紧凑构造函数**（用于参数验证，无参数列表）。
    *   可以定义**自定义方法**。
    *   若自定义构造函数，**必须委托给主构造函数**（使用`this(...)`）。

---

### **第二步：核心代码示例**

```java
// === 1. String不可变性验证 ===
String s1 = "Hello";
String s2 = s1;
s1 = s1.concat(" World"); // 产生新对象
System.out.println(s1); // "Hello World"
System.out.println(s2); // "Hello"
System.out.println(s1 == s2); // false

// === 2. 子串与空白去除 ===
String text = "  Hello\u3000World  ";
System.out.println(text.substring(2, 7)); // "Hello"
System.out.println(text.trim().contains("\u3000")); // true
System.out.println(text.strip().contains("\u3000")); // false

// === 3. 编码与解码（关键！）===
String original = "中文ABC";
byte[] utf8Bytes = original.getBytes(StandardCharsets.UTF_8);
String decoded = new String(utf8Bytes, StandardCharsets.UTF_8);
System.out.println(decoded.equals(original)); // true

// === 4. 包装类判等陷阱 ===
Integer a = 100, b = 100;
System.out.println(a == b); // true (在缓存范围内)
Integer c = 200, d = 200;
System.out.println(c == d); // false (超出缓存范围)
System.out.println(c.equals(d)); // true (始终正确的方式)

// === 5. 枚举：完整示例（覆盖所有要点）===
enum Status {
    // 枚举实例（多例），带属性
    PENDING(0, "等待") {
        // 要点7：实现抽象方法（匿名内部类）
        @Override
        public boolean canProceed() { return true; }
    },
    SUCCESS(1, "成功") {
        @Override
        public boolean canProceed() { return false; }
    };

    // 要点2：private final 属性
    private final int code;
    private final String desc;

    // 要点3：private构造函数
    private Status(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    // 抽象方法定义
    public abstract boolean canProceed();

    // 要点5：重写toString
    @Override
    public String toString() { return this.desc; }

    // 使用code而非ordinal
    public static Status fromCode(int code) {
        for (Status s : values()) {
            if (s.code == code) return s;
        }
        return null;
    }
}

// 使用枚举
System.out.println(Status.PENDING.name()); // "PENDING" (要点4)
System.out.println(Status.PENDING.ordinal()); // 0 (要点4)
System.out.println(Status.PENDING.toString()); // "等待" (要点5，已重写)
System.out.println(Status.PENDING.canProceed()); // true (要点7)
System.out.println(Status.PENDING.compareTo(Status.SUCCESS)); // -1 (要点6，ordinal差值)
System.out.println(Status.fromCode(1)); // SUCCESS (补充实践)

// === 6. 记录类示例 ===
record Point(int x, int y) {
    // 紧凑构造函数（要点：参数验证）
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException("坐标不能为负");
    }
    // 自定义方法（要点）
    public double distance() { return Math.sqrt(x * x + y * y); }
    // 自定义构造函数（要点：必须委托给主构造）
    public Point(int xy) { this(xy, xy); }
}

Point p = new Point(3, 4);
System.out.println(p.x()); // 3 (自动生成的getter)
System.out.println(p); // Point[x=3, y=4] (自动生成的toString)
System.out.println(new Point(5)); // Point[x=5, y=5]
```
