---
created: 2026-03-13
modified: 2026-03-13
---

## 课程
现代编程思想

## 章节
Java 泛型

## 说明
1. 请独立完成。
2. 可先做基础题，再做分析题与编程题。
3. 编程题可写核心代码，不必补全所有样板代码。

---

# 一、单项选择题

### 1. 关于 Java 泛型，下列说法正确的是（B ）

A. 泛型主要用于提高运行速度  
B. 泛型主要用于编译期类型检查  
C. 泛型只能用于集合类  
D. 泛型运行时一定保留完整类型参数信息

---

### 2. 下列哪一项声明是正确的（ B）

A. `List<int> list = new ArrayList<>();`  
B. `List<Integer> list = new ArrayList<>();`  
C. `List<> list = new ArrayList<Integer>();`  
D. `List<String> list = new ArrayList<Integer>();`

---

### 3. 关于 `List<String>` 和 `List<Object>` 的关系，下列说法正确的是（C ）

A. `List<String>` 是 `List<Object>` 的子类  
B. `List<Object>` 是 `List<String>` 的子类  
C. 二者没有继承关系  
D. 二者在 Java 中完全等价

---

### 4. 关于 `List<? extends Number>`，下列说法正确的是（B）

A. 可以安全地加入任意 `Number` 子类对象  
B. 可以安全地读取为 `Number`  
C. 只能读取为 `Object`  
D. 可以安全地加入 `Integer` 和 `Double`

---

### 5. 关于 `List<? super Integer>`，下列说法正确的是（C ）

A. 只能接收 `List<Integer>`  
B. 可以安全读取为 `Integer`  
C. 可以安全写入 `Integer`  
D. 等价于 `List<Object>`

---

# 二、判断题

### 6. `List<String>` 是 `List<Object>` 的子类。（ 错）

### 7. Java 泛型可以直接使用基本类型作为类型参数，例如 `List<int>`。（ 错）

### 8. 泛型可以减少强制类型转换。（对 ）

### 9. Java 泛型的一个重要实现机制是类型擦除。（对 ）

### 10. `? extends T` 更适合写入，`? super T` 更适合读取。（ 错）

---

# 三、填空题

### 11. Java 泛型的核心思想是把 _______类型_ 作为参数。

### 12. Java 泛型主要在 _______编译_ 期进行类型检查。

### 13. Java 泛型采用的典型实现机制叫做 _______类型擦除_ 。

### 14. `? extends Number` 表示未知类型，但该类型必须是 `Number` 或其 _______子类_ 。

### 15. 经典原则 PECS 中，P 表示  ____生产者____，C 表示 ____消费者____。

---

# 四、简答题

### 16. 为什么说泛型提高了类型安全？

要求：
- 结合集合类举例说明
- 说明“编译期检查”与“运行期异常”之间的区别

没有泛型时，集合存储的是 `Object`，取出元素必须手动强转，错误只会在运行时暴露：
```java
// 无泛型，隐患代码
List list = new ArrayList();
list.add("hello");
list.add(123);          // 编译通过，运行时才出问题
String s = (String) list.get(1);  // 运行时抛出 ClassCastException
```
使用泛型后，类型约束在**编译期**就被检查：
```java
// 有泛型，编译期保护
List<String> list = new ArrayList<>();
list.add("hello");
list.add(123);          // 编译直接报错，错误提前暴露
String s = list.get(0); // 无需强转，类型安全
```

- 编译时异常：指代码在编译时，就可以发现类型不安全的问题，无法运行
- 运行时异常：指代码可以正常运行，但是需要在特定的运行环境才会出现异常，检查起来麻烦

---

### 17. 为什么 `List<String>` 不是 `List<Object>` 的子类？

要求：
- 说明如果允许这样赋值会产生什么问题
- 可结合“类型安全”进行解释

泛型不允许协变返回，也就是泛型的类型，是不能用父类的定义去接收子类。
如果允许这样赋值，那么 `List<Object>` 在使用的时候，可以存放其他类型的数据，比如`Integer`，这样在之后的运行过程中，就很有可能预料之外的错误。

---

# 五、代码分析题

### 18. 阅读下面代码，回答问题

```java
import java.util.*;

public class Demo {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>();
        list.add("hello");
        System.out.println(list.get(0));
    }
}
```

问题：
1. 程序输出什么？ 
2. 为什么 `list.get(0)` 不需要强制类型转换？
3. 如果改成 `List list = new ArrayList();`，会有什么变化？

回答：
1. hello
2. 编译器识别`list`定义的类型信息是 `String` ，插入强制类型转换
3. 还是 hello，因为存入时，会把常量转为 `Object`，在 `println` 的时候，会调用实际的多态方法。但是如果把代码改为用一个 `String` 类型的变量去接受数据，就会报类型转换异常的错误，需要手动写强制类型转换。

---

### 19. 阅读下面代码，回答问题

```java
import java.util.*;

public class Demo {
    public static void main(String[] args) {
        List<? extends Number> list = new ArrayList<Integer>();
        // list.add(10);
        Number n = list.get(0);
    }
}
```

问题：
1. 为什么 `list.add(10)` 不允许？
2. 为什么 `Number n = list.get(0);` 是允许的？
3. 这体现了 `extends` 的什么特点？


回答：
1. 因为 list 被定义为生产者，对于生产者，只能读取其中的数据，不能进行存入或者修改
2. 同理1，读取是合法的，因为读取出来的类型一定是 Number 以及子类，可以用Number去接收
3. 作为通配符使用的时候，**只读不写（协变，covariant）**——适合作为数据的生产者（Producer），可以安全读取，但不能安全写入
---

# 六、编程题（20 分）

### 20. 编写一个泛型类 `Container<T>`

要求：
1. 定义私有属性 `data`
2. 提供 `setData(T data)` 和 `getData()` 方法
3. 在 `main` 中测试：
   - `Container<String>`
   - `Container<Integer>`

4. 输出测试结果

可只写核心代码。


```java
public class Container<T> {

    private T data;

    public void setData(T data) {
        this.data = data;
    }

    public T getData() {
        return data;
    }

    public static void main(String[] args) {
        // 测试 String
        Container<String> strContainer = new Container<>();
        strContainer.setData("Hello, Generics!");
        System.out.println("String容器: " + strContainer.getData());

        // 测试 Integer
        Container<Integer> intContainer = new Container<>();
        intContainer.setData(42);
        System.out.println("Integer容器: " + intContainer.getData());
    }
}
```

**输出：**
```
String容器: Hello, Generics!
Integer容器: 42
```


---

# 附加思考题

1. 为什么 Java 选择类型擦除，而不是像某些语言那样在运行时完整保留泛型类型信息？
2. 泛型体现了“现代编程思想”中的哪些核心观念？

回答

1. **类型擦除**
Java 泛型在 Java 5 引入时，首要目标是**向后兼容**——已有的数百万行代码和字节码必须继续运行。类型擦除使得泛型类编译后与非泛型类产生几乎相同的字节码，老版本 JVM 无需修改即可运行新代码。

代价是"运行时无法获取泛型类型信息"（如无法写 `new T()`、`instanceof T`），但 Java 认为编译期安全保证已经足够，这是在兼容性与表达能力之间做出的**工程权衡**。C# 等语言没有历史包袱，选择了运行时保留泛型信息（具化泛型），能力更强但实现更复杂。

2. **泛型体现了哪些现代编程思想核心观念？**

|核心观念|泛型的体现|
|---|---|
|**抽象与参数化**|将"类型"本身作为参数，编写一次代码服务多种类型|
|**早期错误发现**|把运行时异常提前为编译期错误，降低修复成本|
|**表达力与安全性兼顾**|既保持代码通用性，又不牺牲类型安全|
|**关注点分离**|容器/算法的逻辑与具体类型解耦，各自独立变化|
|**可重用性**|一个 `Container<T>` 替代 `StringContainer`、`IntContainer` 等无数重复类|
