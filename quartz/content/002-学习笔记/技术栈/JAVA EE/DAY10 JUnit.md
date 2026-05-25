---
title: DAY10 JUnit
created: 2025-12-14
modified: 2026-01-10
tags: [技术栈, JavaEE]
subject: JavaEE
---
**"优秀的测试是代码质量的守护者，而JUnit是Java程序员最得力的测试工具。"**

### **JUnit测试框架详解**

#### **一、为什么需要JUnit？**

在没有测试框架时，测试代码存在以下问题：
1.  **代码耦合**：测试代码与业务代码混杂在一起，难以维护。
2.  **缺乏通用性**：测试代码无法复用，每个项目都要重新编写测试逻辑。
3.  **结果验证困难**：需要手动对比预期输出和实际结果，容易出错且效率低下。
4.  **缺少组织**：难以统一管理和运行测试用例。

JUnit解决了这些问题，提供了标准化的测试编写、组织和执行方式。

#### **二、JUnit基础使用**

**1. 测试类规范**
*   测试 `A.java` 的测试类应命名为 `ATest.java`（这是**行业惯例**，并非强制要求）。
*   测试类通常与被测试类在同一个包下，但位于 `src/test/java` 目录中（Maven/Gradle项目结构）。

**2. 测试方法**
*   使用 `@Test` 注解标记测试方法。
*   测试方法应为 `public void`，可以任意命名（但建议见名知意）。

```java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class CalculatorTest {
    
    @Test
    public void testAddition() {
        Calculator calc = new Calculator();
        int result = calc.add(2, 3);
        assertEquals(5, result); // 断言期望值等于实际值
    }
}
```

**3. 常用断言方法**
断言是测试的核心，用于验证代码行为是否符合预期。

| 断言方法                                            | 说明             | 示例                                                  |
| ----------------------------------------------- | -------------- | --------------------------------------------------- |
| `assertEquals(expected, actual)`                | 判断两个值相等        | `assertEquals(5, result)`                           |
| `assertEquals(expected, actual, delta)`         | 判断浮点数相等（允许误差）  | `assertEquals(0.1, 0.10, 0.001)`                    |
| `assertTrue(condition)`                         | 判断条件为true      | `assertTrue(list.isEmpty())`                        |
| `assertFalse(condition)`                        | 判断条件为false     | `assertFalse(str.contains("error"))`                |
| `assertNull(object)`                            | 判断对象为null      | `assertNull(optionalValue)`                         |
| `assertNotNull(object)`                         | 判断对象不为null     | `assertNotNull(user)`                               |
| `assertArrayEquals(expected, actual)`           | 判断数组相等         | `assertArrayEquals(new int[]{1,2}, arr)`            |
| `assertSame(expected, actual)`                  | 判断是同一个对象（引用相等） | `assertSame(singleton, instance)`                   |
| `assertNotSame(expected, actual)`               | 判断不是同一个对象      | `assertNotSame(obj1, obj2)`                         |
| `assertThrows(ExceptionType.class, executable)` | 判断会抛出指定异常      | 见下文异常测试                                             |
| `assertTimeout(duration, executable)`           | 判断在指定时间内完成     | `assertTimeout(Duration.ofSeconds(1), () -> {...})` |

> **重要**：对于**浮点数**（`float`、`double`），由于精度问题，必须使用带 `delta` 参数的 `assertEquals`，指定允许的误差范围。

#### **三、Fixture（测试固件）**

当多个测试方法需要相同的初始化和清理代码时，使用Fixture来避免代码重复。

| 注解            | 执行时机                  | 用途                  | 方法要求          |
| ------------- | --------------------- | ------------------- | ------------- |
| `@BeforeAll`  | 在所有测试方法**之前**执行**一次** | 初始化**静态**资源（如数据库连接） | `static void` |
| `@AfterAll`   | 在所有测试方法**之后**执行**一次** | 清理**静态**资源          | `static void` |
| `@BeforeEach` | 在每个测试方法**之前**执行       | 初始化测试实例（如创建对象）      | `void`        |
| `@AfterEach`  | 在每个测试方法**之后**执行       | 清理测试实例（如关闭文件）       | `void`        |

```java
import org.junit.jupiter.api.*;

public class DatabaseTest {
    private static DatabaseConnection conn; // 静态资源
    private UserDAO userDAO;               // 实例资源
    
    @BeforeAll
    static void initDatabase() {
        conn = DatabaseConnection.getConnection(); // 只执行一次
    }
    
    @AfterAll
    static void closeDatabase() {
        conn.close(); // 只执行一次
    }
    
    @BeforeEach
    void setUp() {
        userDAO = new UserDAO(conn); // 每个测试前都执行
        userDAO.clearTable();        // 确保测试环境干净
    }
    
    @AfterEach
    void tearDown() {
        userDAO.rollback(); // 每个测试后都执行
    }
    
    @Test
    void testInsertUser() {
        // 测试代码...
    }
    
    @Test 
    void testDeleteUser() {
        // 测试代码...
    }
}
```

#### **四、异常测试**

测试代码是否按预期抛出异常。

**传统方式（不推荐）**：
```java
@Test
void testDivideByZero() {
    Calculator calc = new Calculator();
    try {
        calc.divide(10, 0);
        fail("Expected ArithmeticException"); // 如果没有抛出异常，测试失败
    } catch (ArithmeticException e) {
        // 测试通过
        assertEquals("/ by zero", e.getMessage());
    }
}
```

**JUnit 5推荐方式（使用 `assertThrows`）**：
```java
@Test
void testDivideByZero() {
    Calculator calc = new Calculator();
    
    // 方式1：使用匿名内部类
    ArithmeticException e = assertThrows(ArithmeticException.class, 
        new Executable() {
            @Override
            public void execute() {
                calc.divide(10, 0);
            }
        });
    assertEquals("/ by zero", e.getMessage());
    
    // 方式2：使用Lambda表达式（推荐，更简洁）
    ArithmeticException e2 = assertThrows(ArithmeticException.class, 
        () -> calc.divide(10, 0));
    assertEquals("/ by zero", e2.getMessage());
}
```

#### **五、条件测试**

根据特定条件决定是否执行测试。

| 注解 | 说明 | 示例 |
|------|------|------|
| `@Disabled` | 禁用该测试 | `@Disabled("功能尚未实现")` |
| `@DisabledOnOs(OS.WINDOWS)` | 在指定操作系统上禁用 | `@DisabledOnOs({OS.WINDOWS, OS.MAC})` |
| `@EnabledOnOs(OS.LINUX)` | 只在指定操作系统上启用 | `@EnabledOnOs(OS.LINUX)` |
| `@DisabledOnJre(JRE.JAVA_8)` | 在指定JRE版本上禁用 | `@DisabledOnJre({JRE.JAVA_8, JRE.JAVA_11})` |
| `@EnabledForJreRange(min=JRE.JAVA_11)` | 在JRE版本范围内启用 | `@EnabledForJreRange(min=JRE.JAVA_11, max=JRE.JAVA_17)` |
| `@DisabledIfSystemProperty` | 根据系统属性禁用 | `@DisabledIfSystemProperty(named="os.arch", matches=".*64.*")` |
| `@EnabledIfEnvironmentVariable` | 根据环境变量启用 | `@EnabledIfEnvironmentVariable(named="CI", matches="true")` |

```java
@Test
@Disabled("等待Bug修复")
void testBuggyFeature() {
    // 暂时不执行的测试
}

@Test
@EnabledOnOs(OS.LINUX)
void testLinuxOnlyFeature() {
    // 只在Linux上运行的测试
}

@Test
@DisabledIfSystemProperty(named = "test.env", matches = "prod")
void testNotForProduction() {
    // 不在生产环境运行的测试
}
```

#### **六、参数化测试**

对同一测试逻辑使用多组输入数据进行测试，避免重复编写相似的测试方法。

**1. 基础参数化测试**
```java
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;

public class StringUtilsTest {
    
    // 使用ValueSource提供基本类型数据
    @ParameterizedTest
    @ValueSource(ints = {-1, -5, -100, 0})
    void testIsPositive(int number) {
        assertFalse(StringUtils.isPositive(number));
    }
    
    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "\t", "\n"})
    void testIsBlank(String input) {
        assertTrue(StringUtils.isBlank(input));
    }
    
    // 使用CsvSource提供多参数数据
    @ParameterizedTest
    @CsvSource({
        "abc, Abc",          // 输入: "abc"，期望输出: "Abc"
        "APPLE, Apple",      // 测试大写转换
        "gooD, Good",        // 测试混合大小写
        "'', ''",            // 测试空字符串
        "hello world, Hello world" // 测试多个单词
    })
    void testCapitalize(String input, String expected) {
        assertEquals(expected, StringUtils.capitalize(input));
    }
}
```

**2. 从方法获取参数**
```java
@ParameterizedTest
@MethodSource("provideStringsForTest")
void testWithMethodSource(String input, boolean expected) {
    assertEquals(expected, StringUtils.isPalindrome(input));
}

// 提供测试数据的静态方法
static Stream<Arguments> provideStringsForTest() {
    return Stream.of(
        Arguments.of("racecar", true),    // 回文字符串
        Arguments.of("hello", false),     // 非回文
        Arguments.of("a", true),          // 单个字符
        Arguments.of("", true),           // 空字符串
        Arguments.of("A man a plan a canal Panama", true) // 忽略空格和大小写
    );
}
```

>建议让参数获取的方法和测试方法同名，这样注解内不需要指定方法名称
>提供参数的方法需要是静态的



**3. 从CSV文件读取参数**
创建 `src/test/resources/test-data.csv`：
```csv
input,expected
abc,Abc
APPLE,Apple
gooD,Good
"",""
hello world,Hello world
```

```java
@ParameterizedTest
@CsvFileSource(resources = "/test-data.csv", numLinesToSkip = 1)
void testCapitalizeFromFile(String input, String expected) {
    assertEquals(expected, StringUtils.capitalize(input));
}
```

**4. 其他参数提供器**
*   `@EnumSource`：枚举值作为参数
*   `@NullSource`：提供null值
*   `@EmptySource`：提供空值（空字符串、空集合等）
*   `@NullAndEmptySource`：同时提供null和空值

```java
@ParameterizedTest
@EnumSource(TimeUnit.class) // 测试所有TimeUnit枚举值
void testTimeUnit(TimeUnit unit) {
    assertNotNull(unit.name());
}

@ParameterizedTest
@NullAndEmptySource
@ValueSource(strings = {"  ", "\t", "\n"})
void testIsBlankWithNullAndEmpty(String input) {
    assertTrue(StringUtils.isBlank(input));
}
```

#### **七、测试命名与显示**

**1. 自定义测试显示名称**
```java
@Test
@DisplayName("测试加法功能 - 正数相加")
void testAdditionWithPositiveNumbers() {
    // ...
}

@ParameterizedTest(name = "{index} => 输入: {0}, 期望: {1}")
@CsvSource({"abc,Abc", "APPLE,Apple"})
@DisplayName("字符串首字母大写测试")
void testCapitalizeWithDisplay(String input, String expected) {
    // ...
}
```

**2. 嵌套测试（组织相关测试）**
```java
@Nested
@DisplayName("用户服务测试")
class UserServiceTest {
    
    @Test
    void testCreateUser() { /* ... */ }
    
    @Nested
    @DisplayName("用户查询测试")
    class UserQueryTest {
        @Test
        void testFindById() { /* ... */ }
        @Test 
        void testFindAll() { /* ... */ }
    }
}
```

#### **八、最佳实践总结**

1.  **测试独立性**：每个测试应该独立运行，不依赖其他测试的状态。
2.  **测试单一职责**：一个测试方法只测试一个功能点。
3.  **命名清晰**：测试方法名应清晰描述测试目的。
4.  **及时清理**：使用 `@AfterEach` 或 `@AfterAll` 清理测试资源。
5.  **优先使用参数化测试**：避免重复代码。
6.  **合理使用条件测试**：但不要过度使用，避免测试变得难以理解。
7.  **测试异常情况**：不仅要测试正常流程，还要测试边界情况和异常情况。
8.  **保持测试快速**：测试应该快速执行，避免慢速测试影响开发效率。

通过掌握JUnit的这些功能，您可以编写出结构清晰、可维护性强、覆盖全面的单元测试，显著提高代码质量。
