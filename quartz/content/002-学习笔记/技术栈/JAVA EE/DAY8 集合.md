---
title: DAY8 集合
created: 2025-12-08
modified: 2025-12-30
tags: [技术栈, JavaEE]
subject: JavaEE
---
**“优秀的程序员善用工具，而理解工具的原理是成为大师的第一步。”**

### **Java集合框架完全解析**

#### **一、集合框架基础**

Java集合框架位于 `java.util` 包中。**`Collection`** 是除 `Map` 外所有集合类（List、Set）的根接口。`Map` 是独立的键值对集合接口。框架主要提供三种集合：**List**（有序可重复）、**Set**（无序不重复）和 **Map**（键值对）。所有集合类都支持泛型，提供了类型安全。Java集合推荐使用统一的 **`Iterator`（迭代器）** 进行遍历，应尽量避免使用 `Vector`、`Hashtable` 等遗留接口。

#### **二、List接口详解**

**1. List核心方法**
List是有序集合，允许重复元素，可通过索引访问。

```java
List<String> list = new ArrayList<>();
list.add("A");           // 末尾添加：boolean add(E e)
list.add(1, "B");        // 指定索引添加：boolean add(int index, E e)
list.remove(1);          // 删除指定索引元素：E remove(int index)
list.remove("A");        // 删除某个元素：boolean remove(Object e)
String item = list.get(0); // 获取指定索引元素：E get(int index)
int size = list.size();  // 获取链表大小：int size()
```

**2. contains和indexOf的依赖**
`contains(Object o)` 和 `indexOf(Object o)` 方法都依赖于元素的 **`equals()`** 方法来判断相等性。自定义类必须正确重写 `equals()` 方法。

**实现 `equals()` 方法的三个步骤：**
1.  **决定判等逻辑**：确定哪些字段参与比较。
2.  **使用 `instanceof` 检查类型**：确保比较对象类型正确。
3.  **比较关键字段**：使用 `Objects.equals()` 比较引用类型，使用 `==`比较基本类型。

```java
class Person {
    String name;
    int age;
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                 // 步骤1：同一对象
        if (!(o instanceof Person)) return false;   // 步骤2：类型检查
        Person p = (Person) o;
        return age == p.age &&                      // 步骤3：比较字段
               Objects.equals(name, p.name);       // 使用Objects.equals
    }
}
```

**3. ArrayList 与 LinkedList 对比表**

| 特性              | ArrayList             | LinkedList          |
| :-------------- | :-------------------- | :------------------ |
| **底层结构**        | 动态数组                  | 双向链表                |
| **随机访问**        | **O(1)**，通过索引直接定位     | **O(n)**，需要从头遍历     |
| **插入/删除**（指定位置） | **O(n)**，需要移动后续元素     | **O(1)**，只需修改相邻节点指针 |
| **内存占用**        | 较小（仅存储数据）             | 较大（存储数据+前后指针）       |
| **最佳场景**        | 频繁**随机访问**，较少在中间插入/删除 | 频繁在**列表中间**插入/删除    |

**4. List的创建方式**
除了 `new ArrayList<>()` 和 `new LinkedList<>()`，还可以通过 **`List.of()`** 方法创建列表。它返回一个**不可变**列表（内部实现是 `ImmutableCollections$ListN`），且**不接受 `null` 值**。

```java
List<String> list1 = List.of("A", "B", "C"); // 不可变，线程安全
// list1.add("D"); // 抛出 UnsupportedOperationException
// List.of(null);  // 抛出 NullPointerException
```

**5. List的遍历方式**
1.  **使用索引**：`for (int i=0; i<list.size(); i++) { list.get(i); }` 对 **LinkedList 低效**。
2.  **使用迭代器（推荐）**：
    ```java
    for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
        String s = it.next();
        // 处理s
    }
    ```
3.  **使用 for-each（本质是迭代器）**：
    ```java
    for (String s : list) {
        // 处理s
    }
    ```

**6. 数组与List的转换**
*   **List → Array**：
    ```java
    List<String> list = List.of("A", "B");
    Object[] array1 = list.toArray(); // 返回Object[]，丢失类型
    String[] array2 = list.toArray(new String[0]); // 传入类型数组，推荐
    String[] array3 = list.toArray(String[]::new); // Java 8+，函数式
    ```
*   **Array → List**：
    ```java
    String[] array = {"A", "B"};
    List<String> list1 = Arrays.asList(array); // 固定大小，可修改元素但不可增删
    List<String> list2 = new ArrayList<>(Arrays.asList(array)); // 可变列表
    List<String> list3 = List.of(array); // 不可变列表（Java 9+）
    ```

**7. 注意只读List**
`List.of()` 和 `Arrays.asList()` 返回的 List 不一定是 `ArrayList` 或 `LinkedList`，它们可能是**只读**或**固定大小**的 List。对其调用 `add()`、`remove()` 等方法会抛出 `UnsupportedOperationException`。

#### **三、Map接口详解**

**1. Map常用操作**
Map存储键值对，常用实现类是 `HashMap`。
*   **增/改**：`V put(K key, V value)`
*   **删**：`V remove(Object key)`
*   **查**：`V get(Object key)`
*   **判断**：`boolean containsKey(Object key)`, `boolean containsValue(Object value)`

**2. Key必须实现hashCode和equals**
作为Map的Key的对象，**必须正确重写 `hashCode()` 和 `equals()` 方法**。
*   `hashCode()` 决定了键值对在哈希表中的存储位置（桶索引）。
*   当两个不同Key的 `hashCode()` 相同时（哈希冲突），`equals()` 方法用于进一步判断它们是否真的相等，从而避免错误覆盖。

**3. 实现hashCode的最佳实践**
使用 `Objects.hash()` 方法，传入所有参与 `equals()` 比较的字段。它能正确处理 `null` 值，且生成的哈希码分布较好。
```java
@Override
public int hashCode() {
    return Objects.hash(name, age); // 传入equals中比较的所有字段
}
```

**4. HashMap扩容原理**
HashMap内部有一个数组（桶），当元素数量超过 `容量 × 负载因子`（默认0.75）时，会触发**扩容**（通常是容量翻倍）。扩容需要重新计算所有元素的新位置（`rehash`），开销很大。因此，**最好在创建HashMap时预估大小，指定初始容量**。
```java
// 预估存储100个元素
Map<String, Integer> map = new HashMap<>(128); // 实际容量会调整为2的幂次（256）
```

**哈希规则：**
1.  `equals` 的对象，`hashCode` **必须**相等。
2.  不 `equals` 的对象，`hashCode` **尽量**不相等（减少冲突）。

**5. EnumMap**
当Key是**枚举类型**时，应使用 `EnumMap`。它内部使用一个紧凑的数组，将枚举实例的 `ordinal()` 值直接作为数组索引，性能极高。
```java
enum Day { MON, TUE, WED }
Map<Day, String> schedule = new EnumMap<>(Day.class);
```

**6. TreeMap（SortedMap的实现类）**
`HashMap` 的遍历顺序是**无序的**。`TreeMap` 实现了 `SortedMap` 接口，它基于**红黑树**，能够按照Key的**自然顺序**或**自定义顺序**进行排序和遍历。
*   Key必须实现 `Comparable` 接口，或者在构造时传入 `Comparator`。
*   **TreeMap判断Key是否相等，依赖于 `compareTo()` 或 `compare()` 方法返回0，而不是 `equals()` 和 `hashCode()`**。

```java
Map<String, Integer> sortedMap = new TreeMap<>();
sortedMap.put("Orange", 5);
sortedMap.put("Apple", 3); // 遍历顺序会是 Apple, Orange

// 自定义排序
Map<String, Integer> customSorted = new TreeMap<>((a, b) -> b.compareTo(a));
```

**7. Properties读取配置文件**
`Properties` 类专门用于读写 `.properties` 配置文件（键值对都是String）。其 `load()` 方法支持多种输入源：

```java
Properties props = new Properties();

// 1. 从Classpath加载（最常用，资源文件在jar包内）
try (InputStream input = getClass().getClassLoader()
        .getResourceAsStream("config.properties")) {
    if (input != null) {
        props.load(input); // load(InputStream)
    }
}

// 2. 从文件系统路径加载
try (FileInputStream fis = new FileInputStream("/path/to/config.properties")) {
    props.load(fis); // load(InputStream)
}

// 3. 从字节流加载（网络等场景）
byte[] configData = getConfigFromNetwork(); // 伪代码
try (ByteArrayInputStream bais = new ByteArrayInputStream(configData)) {
    props.load(bais);
}

// 4. 从字符流加载（支持指定编码，防止乱码）
try (Reader reader = new FileReader("config.properties", StandardCharsets.UTF_8)) {
    props.load(reader); // load(Reader) - Java 8+
}

// 读取配置（带默认值）
String value = props.getProperty("key", "defaultValue");

// 注意：Properties继承自Hashtable，但应只使用其专用方法
// props.put("key", new Object()); // 错误！会破坏类型安全
// props.setProperty("key", "value"); // 正确
```

注意：`Properties` 内部使用 `Hashtable`（已过时），所以**只应使用其 `getProperty`、`setProperty`、`load`、`store` 等专用方法**，避免使用从 `Hashtable` 继承的通用Map方法（如 `put`），否则会破坏类型安全。

#### **四、Set接口详解**

**1. Set核心操作**
Set存储不重复元素，常用实现类是 `HashSet`。
*   **增**：`boolean add(E e)`
*   **删**：`boolean remove(Object o)`
*   **包含**：`boolean contains(Object o)`

和 `HashMap` 的Key一样，存入 `Set` 的元素也需要正确实现 `hashCode()` 和 `equals()`。

**2. HashSet的实现原理**
`HashSet` 内部封装了一个 `HashMap`，元素作为 `HashMap` 的Key，而Value则是一个固定的静态 `Object` 对象（`PRESENT`）。
```java
// 简化示意
public class HashSet<E> {
    private HashMap<E, Object> map;
    private static final Object PRESENT = new Object();
    public boolean add(E e) { return map.put(e, PRESENT) == null; }
}
```

**3. TreeSet（SortedSet实现）**
`TreeSet` 是 `SortedSet` 的实现，基于 `TreeMap`。和 `TreeMap` 类似：
*   元素必须实现 `Comparable` 或提供 `Comparator`。
*   判断元素相等性基于比较方法返回0，而非 `equals`/`hashCode`。

#### **五、Queue与Deque**

**1. Queue接口（队列，FIFO）**
Queue只能在**队尾添加**，在**队头删除/查看**。常用 `LinkedList` 实现。
*   **操作两组方法**：
    *   **抛出异常**：`add(e)`, `remove()`, `element()`
    *   **返回特殊值**：`offer(e)`, `poll()`, `peek()`（**推荐**，更安全）
*   **`PriorityQueue`**：优先级队列，出队顺序按元素排序（自然顺序或Comparator），内部通常使用堆实现。

**2. Deque接口（双端队列）**
`Deque` 继承 `Queue`，但**不建议**混用 `Queue` 的方法。它支持在两端进行插入和删除。
*   **队首/队尾操作**：`addFirst`/`offerFirst`, `addLast`/`offerLast`, `removeFirst`/`pollFirst`, `removeLast`/`pollLast`, `getFirst`/`peekFirst`, `getLast`/`peekLast`
*   **`LinkedList` 实现了 `Deque` 接口**。因此 `LinkedList` 可以作为 List、Queue、Deque 使用，编程时应**面向接口**（如 `Deque<String> deque = new LinkedList<>()`）。

**3. 用Deque模拟Stack**
Java遗留的 `Stack` 类已不推荐使用。使用 `Deque` 的 `push()`（入栈）、`pop()`（出栈）、`peek()`（查看栈顶）方法可以完美模拟栈。
```java
Deque<String> stack = new LinkedList<>();
stack.push("A"); // 压栈
stack.pop();     // 弹栈
stack.peek();    // 查看栈顶
```

#### **六、实现迭代器（Iterable）**

为了让自定义集合支持 for-each 循环，需要实现 `Iterable<T>` 接口，并返回一个 `Iterator<T>` 对象。

**实现步骤：**
1.  **集合类实现 `Iterable<T>` 接口**，重写 `iterator()` 方法。
2.  **定义一个内部类实现 `Iterator<T>` 接口**，重写 `hasNext()` 和 `next()` 方法。
3.  之后即可用 for-each 遍历该集合对象。

**示例：自定义一个简单的固定容量集合**
```java
public class FixedSizeCollection<E> implements Iterable<E> {
    private final E[] elements;
    private int count = 0;
    
    @SuppressWarnings("unchecked")
    public FixedSizeCollection(int capacity) {
        this.elements = (E[]) new Object[capacity];
    }
    
    public boolean add(E element) {
        if (count >= elements.length) return false;
        elements[count++] = element;
        return true;
    }
    
    @Override
    public Iterator<E> iterator() {
        return new FixedSizeIterator();
    }
    
    // 内部迭代器类
    private class FixedSizeIterator implements Iterator<E> {
        private int cursor = 0; // 当前遍历位置
        
        @Override
        public boolean hasNext() {
            return cursor < count; // 还有元素未遍历
        }
        
        @Override
        public E next() {
            if (!hasNext()) {
                throw new NoSuchElementException();
            }
            return elements[cursor++]; // 返回当前元素，并后移游标
        }
    }
    
    // 使用示例
    public static void main(String[] args) {
        FixedSizeCollection<String> collection = new FixedSizeCollection<>(3);
        collection.add("A");
        collection.add("B");
        collection.add("C");
        
        // 使用for-each遍历（依赖于Iterable接口）
        for (String item : collection) {
            System.out.println(item); // 输出 A, B, C
        }
    }
}
```

#### **七、Collections工具类**

`Collections` 提供了大量静态工具方法操作集合：
*   **创建空/单元素/不可变集合**：`emptyList()`, `singletonList()`, `unmodifiableList()`
*   **排序/洗牌**：`sort(list)`, `sort(list, comparator)`, `shuffle(list)`
*   **查找/极值**：`binarySearch(list, key)`, `max(collection)`, `min(collection)`
*   **同步包装**：`synchronizedList(list)`（性能较差，更推荐使用 `java.util.concurrent` 包下的并发集合）
*   **其他实用方法**：`reverse(list)`, `fill(list, obj)`, `copy(dest, src)`, `frequency(collection, o)`等。

---

### **核心代码示例（整合要点）**

```java
import java.util.*;
import java.util.concurrent.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class CollectionCompleteReview {
    public static void main(String[] args) throws Exception {
        // 1. List equals/hashCode 的重要性
        class Item {
            String id; int value;
            Item(String id, int v) { this.id = id; value = v; }
            @Override public boolean equals(Object o) {
                if (this == o) return true;
                if (!(o instanceof Item)) return false;
                Item item = (Item) o;
                return Objects.equals(id, item.id);
            }
            @Override public int hashCode() { return Objects.hash(id); }
        }
        List<Item> itemList = new ArrayList<>();
        itemList.add(new Item("a", 1));
        System.out.println("Contains 'a'? " + itemList.contains(new Item("a", 9))); // true
        
        // 2. HashMap 初始容量 & Properties
        Map<String, Integer> map = new HashMap<>(64); // 避免频繁扩容
        
        // Properties多种加载方式演示
        Properties props = new Properties();
        
        // 从字符串加载（模拟配置文件内容）
        String configContent = "server.port=8080\ndb.url=jdbc:mysql://localhost/test\n";
        try (InputStream input = new ByteArrayInputStream(configContent.getBytes())) {
            props.load(input);
        }
        
        // 模拟从文件加载
        // try (FileReader reader = new FileReader("config.properties", StandardCharsets.UTF_8)) {
        //     props.load(reader);
        // }
        
        System.out.println("Server port: " + props.getProperty("server.port", "80"));
        System.out.println("DB URL: " + props.getProperty("db.url"));
        System.out.println("Missing key: " + props.getProperty("missing.key", "default"));
        
        // 3. EnumMap & TreeMap
        enum Level { LOW, MEDIUM, HIGH }
        Map<Level, String> enumMap = new EnumMap<>(Level.class);
        enumMap.put(Level.HIGH, "重要");
        
        Map<String, Integer> treeMap = new TreeMap<>(Comparator.reverseOrder());
        treeMap.put("Bob", 90); treeMap.put("Alice", 95);
        System.out.println("TreeMap order: " + treeMap.keySet()); // [Bob, Alice]
        
        // 4. Queue & Deque as Stack
        Queue<Integer> queue = new LinkedList<>();
        queue.offer(1); queue.offer(2);
        System.out.println("Queue poll: " + queue.poll()); // 1
        
        Deque<Integer> stack = new LinkedList<>();
        stack.push(1); stack.push(2);
        System.out.println("Stack pop: " + stack.pop()); // 2
        
        // 5. Collections 工具类
        List<Integer> nums = new ArrayList<>(Arrays.asList(3,1,4,1,5));
        Collections.sort(nums);
        Collections.reverse(nums);
        Collections.shuffle(nums);
        System.out.println("Collections操作后: " + nums);
        
        // 6. 自定义迭代器集合测试
        FixedSizeCollection<String> customCollection = new FixedSizeCollection<>(3);
        customCollection.add("First");
        customCollection.add("Second");
        
        System.out.println("自定义集合遍历:");
        for (String s : customCollection) {
            System.out.println("  " + s);
        }
    }
}

// 自定义迭代器集合实现
class FixedSizeCollection<E> implements Iterable<E> {
    private final E[] elements;
    private int count = 0;
    
    @SuppressWarnings("unchecked")
    public FixedSizeCollection(int capacity) {
        this.elements = (E[]) new Object[capacity];
    }
    
    public boolean add(E element) {
        if (count >= elements.length) return false;
        elements[count++] = element;
        return true;
    }
    
    @Override
    public Iterator<E> iterator() {
        return new FixedSizeIterator();
    }
    
    private class FixedSizeIterator implements Iterator<E> {
        private int cursor = 0;
        
        @Override
        public boolean hasNext() {
            return cursor < count;
        }
        
        @Override
        public E next() {
            if (!hasNext()) {
                throw new NoSuchElementException();
            }
            return elements[cursor++];
        }
    }
}
```

