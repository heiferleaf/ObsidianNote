---
created: 2026-01-14
modified: 2026-01-23
---

> 为什么泛型数组不允许创建（名义上），但是泛型的集合可以创建

泛型数组不允许创建
   数组由于历史理由原因是允许协变返回的，`Object[] arr = new String[]{"123"}`是被允许的，搭配JVM运行数组时，数组的真实类型被保留，会对数据类型做检查。这才保证了安全性和可行性。
   但是泛型在编译后类型被擦除，这就导致了，如果创建泛型的数组，比如`Person<Integer>[] arr`，也需要满足数组的协变，可以赋值给`Person<Object>[]`，那么接下来使用的时候，可能数组中存放`Person<String>`，这是允许的，因为编译器觉得基类引用存放子类对象，JVM又因为类型擦除，检查不了真实类型，这种不符合逻辑的情况就允许出现。为了杜绝这一点，所以编译时，不让==直接创建泛型数组==。
   至于泛型的集合为什么允许存在呢`List<String>`，本质原因是集合是Java的类，所以对集合操作是通过类的方法实现的，而编译器又可以看到源码中的类型信息，就可以在方法的调用出通过强制类型转换，和类型安全检查，保证上述这种问题出现（String集合中只能放String）
```Java
   List<String>[] arr = new List<>[3]; // 假设允许创建
   Object[] other = arr; // 因为数组允许协变
   other[0] = new ArrayList<Integer>(); // 编译器通过，因为编译器看的是other变量的类型
```

> [!NOTE] 
> 可以说，集合存放泛型允许的本质原因，就是略过了数组的允许协变，所以`Object[] other = arr;`，编译器不允许这种事情在集合上发生
> 上面的论述，可以得出结论：**泛型**不允许协变，否则就会出现类似泛型数组这样的问题

> 通过可变参数函数创建泛型数组注意

```Java
public T[] toArr(T... args) {
	return args;
}
```

1. 传入参数前，编译器根据传入参数的类型直接创建一个具体类型的数组
2. 传入参数中，因为类型擦除，参数声明是一个Object[]数组，所以等价于数组的协变
3. 因为传入的参数不是泛型数组，而是有具体类型的数组，所以JVM运行时，可以看到args的实际类型信息，会对数组的数据类型进行检查
4. 返回的是Object[]
5. 编译器根据方法的赋值等号左侧变量的数据类型，插入强制类型转换，转为对应的类型数组

> `A.isAssignableFrom(@NotNull Class<T> B)`的逻辑

`A`类是否可以由`B`类进行赋值，等价于，能否用`A`类引用指向`B`类对象。

在下面的代码中，`n.getClass()`得到的是`Integer.class`，是`n`的真实类型
```Java
Number n = Integer.valueOf("123");
boolean b = n.getClass().isAssignableFrom(Number.class); // false
boolean b1 = n.getClass().isAssignableFrom(Integer.class); // true
```

> 包装类造成NPE的具体场景
> 本质是将null的包装类转为数值

1. 自动拆箱：赋值给基本数据类型
2. 包装类参与算数运算：编译器会先拆箱
3. 和基本数据类型进行判等的逻辑，如果是两个包装类对象判断，会判断他们的堆区地址
4. 在条件判断中使用 `Boolean`包装类，会拆箱为 `boolean`
5. 函数返回值声明是基本数据类型，但是返回内容是包装类，会默认拆箱

> `null`指针的解决：` Optional<T>`

1. 尽量不要使用`Option.of(obj)`，这要求传入对象不能为`null`，失去了类的作用
2. 尽量不要使用`Option`中的`get`方法，如果内部持有为空，会抛出异常，这个不使用`Option`没有区别
3. 推荐的创建方式：`Option.ofNullable(obj)`，obj可能为空
	1. 推荐的数据处理方 式：
	2. 映射：map
	3. 过滤：filter
5. 数据获取方式
	1. `isPresent()` + `get()`：检查内部持有对象是否为null
	2. `ifPresent(Consumer<? super T> consumer)`：传入一个消费者，使用内部持有的对象，不会返回内容

> instanceof 和 isAssignableFrom

- 使用时机不同
	- 持有一个对象实例的时候，可以通过 `instanceof` 判断对象是否可以转为具体类型
	- 持有一个Class实例的时候，可以通过 `isAssignableFrom` 判断类的赋值允许情况 
- 类型转换逻辑不同
	- `a instanceof B`：a 实例是否可以转为B类型，B类型可以是a真实类型或者其父类
	- `aClass.isAssignableFrom(bClass)`：b类是否可以赋值给a类引用，b类可以是a类或者其子类