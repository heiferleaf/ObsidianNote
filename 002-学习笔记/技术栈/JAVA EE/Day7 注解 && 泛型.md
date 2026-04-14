---
title: Day7 注解 && 泛型
created: 2025-12-07
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
**Java编译器禁止泛型数组的直接创建（如 `new T[10]`）**
- **原因并不是编译时类型转换的难题，而是因为：**
    - 数组类型安全依赖于**JVM运行时的类型检查**；
    - 泛型参数在运行时已经被擦除，JVM无法获知数组元素的具体类型（比如T到底是什么）；
    - 因此，JVM没法保证类型安全：无法阻止你把错误类型的对象塞进泛型数组，导致可能的`ClassCastException`。
### **Java注解与泛型详解**

#### **一、注解机制详解**

**1. 注解与注释的区别**
*   **注释**：在编译时被完全去除，不会包含在字节码中。
*   **注解**：可以在编译时被打包进`.class`文件，部分注解在运行时也能被读取。

**2. 注解的三种类型**
*   **源码注解**：给编译器看的注解，不会编译进`.class`文件。
    *   `@Override`：确保方法正确重写父类方法。
    *   `@SuppressWarnings`：抑制编译器警告。
*   **编译时注解**：由工具处理`.class`文件时使用，会被编译进`.class`文件，但加载时不会进入JVM。
*   **运行时注解**：在程序运行时可以读取的注解，加载后会进入JVM。
    *   `@PostConstruct`：标注的方法会在构造方法后被自动调用。

**3. 注解参数配置**
*   **value属性**：最常用，可简化书写。
*   **默认值**：注解属性可以有默认值，使用时可省略。
*   **属性值类型**：基本数据类型、String、枚举类型、以及这三者的数组。
*   **赋值语法**：`@Annotation(name = value)`。当只有`value`属性且需要赋值时，可简写为`@Annotation(value)`；如果只有`value`属性且不冲突，可直接写值：`@Annotation("test")`。

**4. 自定义注解**
*   使用 `@interface` 关键字定义。

**5. 元注解（注解的注解）**
*   `@Target`：指定注解可应用的范围。
    *   `ElementType.TYPE`：类、接口、枚举
    *   `ElementType.FIELD`：字段
    *   `ElementType.METHOD`：方法
    *   `ElementType.CONSTRUCTOR`：构造器
    *   `ElementType.PARAMETER`：方法参数
*   `@Retention`：指定注解的生命周期。
    *   `RetentionPolicy.SOURCE`：仅源码
    *   `RetentionPolicy.CLASS`：编译时（默认值）
    *   `RetentionPolicy.RUNTIME`：运行时
    *   **重要**：自定义运行时注解必须显式指定 `@Retention(RetentionPolicy.RUNTIME)`。
*   `@Repeatable`：允许在同一处重复使用该注解。
*   `@Inherited`：标注的注解可被继承（仅适用于类继承，不适用于接口继承）。

**6. 获取注解信息**
*   **判断存在**：`isAnnotationPresent(Class)`
*   **获取注解**：
    *   `Class.getAnnotation(Class)`
    *   `Field.getAnnotation(Class)`
    *   `Method.getAnnotation(Class)`
    *   `Constructor.getAnnotation(Class)`
*   **读取参数注解**：方法参数的注解需通过二维数组获取，因为每个参数可有多个注解。
*   **读取属性值**：通过注解对象调用相应方法获取，如 `annotation.value()`。

**7. 注解的使用场景**
*   典型应用：自定义 `@Range` 注解，标注字段取值范围，结合反射进行数据校验。

#### **二、泛型机制详解**

**1. 泛型基本使用**
*   **声明与赋值**：`List<T> list = new ArrayList<T>();` 或利用类型推断 `List<T> list = new ArrayList<>();`
*   **类型安全**：泛型提供编译时类型检查，避免运行时 `ClassCastException`。
*   **转型限制**：泛型类型参数不能向上转型，如 `ArrayList<Integer>` 不能赋值给 `List<Number>`。

**2. 泛型擦除机制**
*   **本质**：Java采用擦除法实现泛型，编译后将所有泛型类型替换为 `Object` 或上界类型，并在必要处插入强制类型转换。
*   **导致的局限性**：
    1.  **不能使用基本类型**：如 `Pair<int>` 错误，需使用包装类。
    2.  **无法获取精确的Class信息**：`Pair<Integer>.class` 与 `Pair<String>.class` 都是 `Pair.class`。
    3.  **无法进行泛型类型判断**：`instanceof Pair<String>` 无效。
    4.  **不能直接实例化T类型**：`new T()` 错误，因为擦除后为 `new Object()`。
    5.  **静态成员不能使用泛型类型参数**：静态域或方法必须声明自己的类型参数。

**3. 获取泛型参数信息**
*   通过反射获取 `Type` 类型，判断是否为 `ParameterizedType`，再获取实际的类型参数。
    ```java
    Type type = clazz.getGenericSuperclass();
    if (type instanceof ParameterizedType paramType) {
        Type[] actualTypes = paramType.getActualTypeArguments();
    }
    ```

**4. 通配符**
*   `<? extends T>`：**上界通配符**，表示接收 `T` 或其子类。
    *   **读取安全**：可以安全地读取为 `T`。
    *   **写入不安全**：不能写入除 `null` 外的任何值（因为不知道具体子类型）。
    *   **PECS原则（Producer Extends）**：作为生产者（提供数据）时使用。
*   `<? super T>`：**下界通配符**，表示接收 `T` 或其父类。
    *   **写入安全**：可以安全地写入 `T` 及其子类。
    *   **读取不安全**：读取只能作为 `Object`。
    *   **PECS原则（Consumer Super）**：作为消费者（消费数据）时使用。
*   `<?>`：**无限定通配符**，表示未知类型，等同于 `<? extends Object>` + `<? super Object>` 。既不能读（除 `Object` 外），也不能写（除 `null` 外）。常用于做空值判断或不需要类型信息的操作。

**5. 泛型数组**
*   **不能直接创建**：`Pair<String>[] ps = new Pair<String>[2];` // 编译错误
*   **变通方法**：创建原始类型数组后强制转型（会有未检查警告）。
    ```java
    Pair<String>[] ps = (Pair<String>[]) new Pair[2];
    ```
*   **更安全的方式**：使用 `ArrayList<Pair<String>>` 替代数组。

---

#### **三、核心代码示例**

```java
import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;

// ========== 1. 注解完整示例 ==========

// 自定义运行时注解
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@interface Range {
    int min() default 0;
    int max() default 100;
    String message() default "数值超出范围";
}

// 使用注解的类
class Person {
    @Range(min = 1, max = 120, message = "年龄必须在1-120之间")
    private int age;
    
    @Range(min = 1, max = 50, message = "名字长度必须在1-50之间")
    private String name;
    
    public Person(int age, String name) {
        this.age = age;
        this.name = name;
    }
}

// 注解处理器：使用反射进行校验
class AnnotationValidator {
    public static List<String> validate(Object obj) throws IllegalAccessException {
        List<String> errors = new ArrayList<>();
        for (Field field : obj.getClass().getDeclaredFields()) {
            if (field.isAnnotationPresent(Range.class)) {
                field.setAccessible(true);
                Range range = field.getAnnotation(Range.class);
                Object value = field.get(obj);
                if (value instanceof Integer num) {
                    if (num < range.min() || num > range.max()) {
                        errors.add(field.getName() + ": " + range.message());
                    }
                } else if (value instanceof String str) {
                    if (str.length() < range.min() || str.length() > range.max()) {
                        errors.add(field.getName() + ": " + range.message());
                    }
                }
            }
        }
        return errors;
    }
}

// ========== 2. 泛型与通配符示例 ==========

// 泛型类定义
class Box<T> {
    private T content;
    public void set(T content) { this.content = content; }
    public T get() { return content; }
    
    // 静态泛型方法需声明自己的类型参数
    public static <K> Box<K> createBox(K content) {
        Box<K> box = new Box<>();
        box.set(content);
        return box;
    }
}

// 通配符使用示例
class WildcardDemo {
    // 上界通配符：只能读，不能写（除了null）
    public static double sumOfList(List<? extends Number> list) {
        double sum = 0.0;
        for (Number num : list) { // 可以安全读取为Number
            sum += num.doubleValue();
        }
        // list.add(new Integer(1)); // 错误！不能写入
        return sum;
    }
    
    // 下界通配符：可以写入，读取只能作为Object
    public static void addNumbers(List<? super Integer> list) {
        for (int i = 1; i <= 5; i++) {
            list.add(i); // 可以安全写入Integer
        }
        // Integer num = list.get(0); // 错误！读取只能得到Object
        Object obj = list.get(0); // 正确
    }
}

// ========== 3. 泛型擦除与反射获取泛型信息示例 ==========

class GenericClass<T> {
    private T data;
    public GenericClass(T data) { this.data = data; }
}

class StringGenericClass extends GenericClass<String> {
    public StringGenericClass(String data) { super(data); }
}

class GenericReflectionDemo {
    public static void main(String[] args) {
        // 验证泛型擦除
        List<Integer> intList = new ArrayList<>();
        List<String> strList = new ArrayList<>();
        System.out.println(intList.getClass() == strList.getClass()); // true
        
        // 通过反射获取泛型参数的实际类型
        Type type = StringGenericClass.class.getGenericSuperclass();
        System.out.println(type); // GenericClass<java.lang.String>
        
        if (type instanceof ParameterizedType paramType) {
            Type[] actualTypes = paramType.getActualTypeArguments();
            for (Type actualType : actualTypes) {
                System.out.println("实际类型参数: " + actualType); // class java.lang.String
            }
        }
    }
}

// ========== 4. 综合测试 ==========
public class AnnotationAndGenericDemo {
    public static void main(String[] args) throws Exception {
        System.out.println("=== 注解验证测试 ===");
        Person p1 = new Person(150, "A");
        Person p2 = new Person(25, "ThisIsAVeryLongNameThatExceedsTheLimit");
        System.out.println("p1校验结果: " + AnnotationValidator.validate(p1));
        System.out.println("p2校验结果: " + AnnotationValidator.validate(p2));
        
        System.out.println("\n=== 泛型与通配符测试 ===");
        // 泛型类使用
        Box<String> stringBox = Box.createBox("Hello");
        System.out.println("Box内容: " + stringBox.get());
        
        // 上界通配符测试
        List<Integer> intList = Arrays.asList(1, 2, 3);
        System.out.println("整数列表和: " + WildcardDemo.sumOfList(intList));
        
        // 下界通配符测试
        List<Number> numList = new ArrayList<>();
        WildcardDemo.addNumbers(numList);
        System.out.println("添加数字后列表: " + numList);
    }
}
```
