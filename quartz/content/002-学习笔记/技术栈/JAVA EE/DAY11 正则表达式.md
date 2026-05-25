---
title: DAY11 正则表达式
created: 2025-12-16
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
**"正则表达式是用模式匹配来驾驭字符串的艺术。"**

### **Java正则表达式详解**

#### **一、基础匹配：String.matches()**

*   **用法**：`boolean result = string.matches(regex);`
*   **特点**：检查**整个字符串**是否完全匹配正则表达式。
*   **示例**：
    ```java
    String str = "2023年";
    boolean isYear = str.matches("20\\d\\d年"); // true
    boolean isYear2 = str.matches("20\\d\\d");  // false（不匹配"年"）
    ```

#### **二、核心字符类与预定义字符**

| 字符类      | 含义                   | 示例       | 匹配            |
| -------- | -------------------- | -------- | ------------- |
| **`.`**  | 任意单个字符（除换行符）         | `a.c`    | abc, a&c, a5c |
| **`\d`** | 数字字符：[0-9]           | `\d\d`   | 12, 45, 99    |
| **`\D`** | 非数字字符                | `\D\D`   | ab, !@, 中文    |
| **`\w`** | 单词字符：[a-zA-Z_0-9]    | `\w\w\w` | abc, A_1, x23 |
| **`\W`** | 非单词字符                | `\W\W`   | !!, 中文, 空格    |
| **`\s`** | 空白字符：[ \t\n\x0B\f\r] | `\s+`    | 空格、制表符、换行等    |
| **`\S`** | 非空白字符                | `\S+`    | abc123!@#     |

> **重要**：在Java字符串中，`\` 需要转义为 `\\`：
> ```java
> String regex = "\\d\\d";      // 实际正则：\d\d
> String regex = "20\\d\\d";    // 实际正则：20\d\d
> ```

#### **三、量词（指定出现次数）**

| 量词 | 含义 | 示例 | 匹配 | 不匹配 |
|------|------|------|------|--------|
| **`*`** | 0次或多次（贪婪） | `\d*` | "", "1", "123" | - |
| **`+`** | 1次或多次（贪婪） | `\d+` | "1", "123" | "" |
| **`?`** | 0次或1次（可选） | `-?\d+` | "123", "-456" | "--123" |
| **`{n}`** | 恰好n次 | `\d{4}` | "2023", "1234" | "123", "12345" |
| **`{n,}`** | 至少n次 | `\d{3,}` | "123", "12345" | "12" |
| **`{n,m}`** | n到m次 | `\d{2,4}` | "12", "123", "1234" | "1", "12345" |

**贪婪与非贪婪模式**：
*   **贪婪**（默认）：尽可能多地匹配
*   **非贪婪**：在量词后加 `?`，尽可能少地匹配
    ```java
    String str = "aaaab";
    str.matches("a+");     // true，匹配"aaaa"（贪婪）
    str.matches("a+?");    // true，匹配"a"（非贪婪）
    
    // 分组提取时的区别
    Pattern p1 = Pattern.compile("a*(b)");    // 贪婪：匹配"aaaab"
    Pattern p2 = Pattern.compile("a*?(b)");   // 非贪婪：匹配"b"
    ```

#### **四、边界匹配与字符集合**

| 边界 | 含义 | 示例 |
|------|------|------|
| **`^`** | 行/字符串开始 | `^\\d+`（以数字开头） |
| **`$`** | 行/字符串结束 | `\\d+$`（以数字结束） |
| **`\b`** | 单词边界 | `\bcat\b`（匹配单词"cat"） |

**字符集合**：`[...]`
*   `[abc]`：匹配 a、b 或 c
*   `[a-z]`：匹配 a 到 z 的任意字符
*   `[0-9A-F]`：匹配十六进制数字
*   `[^abc]`：匹配**除了** a、b、c 的任意字符
*   `[\u4e00-\u9fa5]`：匹配中文字符（Unicode范围）

```java
// 示例
String.matches("[1-9][0-9]*");      // 正整数（不以0开头）
String.matches("[a-zA-Z_][\\w]*");  // Java标识符
String.matches("[\\u4e00-\\u9fa5]+"); // 纯中文字符串
```

#### **五、分组与或运算**

**1. 分组**：`(...)`
*   将多个字符作为单个单元处理
*   可以配合量词使用
*   可以捕获匹配的内容（用于提取或替换）

```java
String.matches("(abc)+");        // abc, abcabc, abcabcabc
String.matches("(20|19)\\d{2}"); // 19xx或20xx年
```

**2. 或运算**：`|`
*   匹配左侧或右侧的模式
*   通常与分组结合使用

```java
String.matches("(red|blue|green)");
String.matches("(\\d{3}-)?\\d{8}"); // 可选区号的电话号码
```

#### **六、Pattern和Matcher类（高级操作）**

当需要**提取匹配内容**或**多次匹配**时，使用 `Pattern` 和 `Matcher`。

```java
import java.util.regex.*;

public class RegexAdvancedExample {
    public static void main(String[] args) {
        String text = "张三的电话是13812345678，李四的电话是13987654321";
        String regex = "(1[3-9]\\d{9})"; // 手机号正则
        
        // 1. 编译正则表达式（提高性能，可复用）
        Pattern pattern = Pattern.compile(regex);
        
        // 2. 创建匹配器
        Matcher matcher = pattern.matcher(text);
        
        // 3. 查找所有匹配
        System.out.println("找到的电话号码：");
        while (matcher.find()) {
            // matcher.group() 获取完整匹配
            // matcher.group(1) 获取第1个分组
            System.out.println("位置 " + matcher.start() + "-" + 
                             matcher.end() + ": " + matcher.group());
        }
        
        // 4. 分组提取
        String html = "<div><h1>标题</h1><p>内容</p></div>";
        Pattern tagPattern = Pattern.compile("<(\\w+)>(.*?)</\\1>");
        Matcher tagMatcher = tagPattern.matcher(html);
        
        while (tagMatcher.find()) {
            System.out.println("标签: " + tagMatcher.group(1));
            System.out.println("内容: " + tagMatcher.group(2));
        }
    }
}
```

**Matcher常用方法**：
*   `find()`：查找下一个匹配
*   `group()`：返回完整匹配
*   `group(int n)`：返回第n个分组
*   `start()` / `end()`：匹配的开始/结束位置
*   `matches()`：整个字符串是否匹配
*   `lookingAt()`：从开头开始匹配

#### **七、替换与反向引用**

**1. String的替换方法**：
```java
String str = "a1b2c3";
str = str.replaceAll("\\d", "*");      // a*b*c*
str = str.replaceFirst("\\d", "*");    // a*b2c3（只替换第一个）
```

**2. 反向引用**：
在替换字符串中使用 `$n` 引用匹配的分组。

```java
// 日期格式转换：2023-12-01 → 2023年12月01日
String date = "2023-12-01";
String result = date.replaceAll(
    "(\\d{4})-(\\d{2})-(\\d{2})", 
    "$1年$2月$3日"
);
// result = "2023年12月01日"

// 姓名顺序转换：LastName, FirstName → FirstName LastName
String name = "Smith, John";
name = name.replaceAll("(\\w+),\\s*(\\w+)", "$2 $1");
// name = "John Smith"
```

**3. 在正则表达式中反向引用**：使用 `\n`
```java
// 查找重复的单词
String text = "the the cat cat jumped";
Pattern p = Pattern.compile("\\b(\\w+)\\b\\s+\\1\\b");
Matcher m = p.matcher(text);
while (m.find()) {
    System.out.println("重复单词: " + m.group(1));
}
// 输出：the, cat
```

#### **八、常用正则表达式示例**

```java
// 1. 邮箱验证
String emailRegex = "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$";
boolean isValidEmail = email.matches(emailRegex);

// 2. 手机号（中国大陆）
String phoneRegex = "^1[3-9]\\d{9}$";

// 3. 身份证（18位，简单版本）
String idCardRegex = "^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[0-9X]$";

// 4. URL
String urlRegex = "^(https?://)?([\\w.-]+)\\.([a-zA-Z]{2,6})(/\\S*)?$";

// 5. 密码强度（至少8位，包含大小写字母和数字）
String passwordRegex = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$";

// 6. 提取HTML中的所有链接
String html = "<a href=\"http://example.com\">链接</a>";
Pattern linkPattern = Pattern.compile("href=\"([^\"]+)\"");
Matcher linkMatcher = linkPattern.matcher(html);
```
