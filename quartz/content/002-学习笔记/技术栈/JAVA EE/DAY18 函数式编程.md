---
title: DAY18 函数式编程
created: 2026-01-02
modified: 2026-01-03
tags:
  - 技术栈
  - 函数式编程
subject: JavaEE
---
## 函数式编程引入

在面向过程的设计思想中，一个大任务会被细分为具体的函数，通过讲大任务拆解成小函数，从而实现高内聚、低耦合。往往来说，面向过程的设计思想具有以下的特点：
- 自顶而下的设计方式
- 操作和数据分离（通过函数抽离，OOP是字段和方法都封装在类对象中）
可以说，函数就是面向过程的主要特点。在Java中，虽然不能直接定义函数，但是可以通过静态方法，实现类的函数，通过this指针，调用对象的方法。

接下来，明确函数的定义
- 数据：涉及到具体值
- 操作：针对数据进行某种运算
- 有限步数据的定义和针对数据的操作集合 - 函数

接下来，明确函数的分类
- 无副作用：函数中不设计数据可变的变量定义，只包含输入的变量，常量，运算
	- 输入一定，输出就一定
	- 例如：add(a, b) -> a+b
- 有副作用：包含一些变量，比如静态类变量，就算输入相同，也会因为运行所处环境的不同，输出会有变化

**函数式编程的特点**：在一个函数中，允许将另一个函数作为参数传入，还允许返回一个函数。使用的**无副作用**的函数,关注于操作，而非数据。通过将这种函数作为基本的运算单位。

> 历史上，研究这种函数式编程的理论是Lambda演算，所以，经常会把支持函数式编程的编码风格称为lambda表达式

## `Lambda`表达式

1. 格式
```
（s1, s2） -> {方法体}
```
2. 特点
	传参无需类型说明，会根据调用处推导
	单个参数，参数不需要`()`括
	单条语句，方法体不需要`()`
	单条返回语句，`return`也不需要

## Lambda应用一 -- `FunctionalInterface`

- 前提：
	- 定义接口
	- 接口只有一个方法
	- 接口注解@FunctionalInterface
- 使用
	- 函数参数中，需要传入接口实现类对象的，可以传入lambda函数

> 接口内只有一个方法：
> 	这个方法是接口自己的抽象方法
> 	接口有别的默认方法、静态方法、继承下来的方法，都无关

## Lambda应用二 -- `方法引用`

在可以传入Lambda函数的地方，如果存在一个方法的签名和接口的方法一致，就可以通过方法引用代替Lambda函数

```Java
public static void main(String[] args) {
	int[] nums = {1, 2, 3};
	// 1. lambda, 递增排序
	Arrays.sort(nums, (a, b) -> a - b);
	// 2. 方法引用
	Arrays.sorts(nums, Main::cmp)
}
public static int cmp(int a, int b) {
	return a - b;
}
```

> 签名一致，不包括方法名需要和接口的一样，需要的是传输参数的个数，类型，顺序一样，以及返回类型的一致

这里的方法引用：包括实例的方法，类的静态方法，还可以是类的构造函数，等到后面学习了Stream编程在具体展开

## `Stream`流编程

### 概念理解

`Stream`流和IO流的本质区别：

1. IO流：将文件或者网络的数据，按照字节或者字符读取/写
2. Stream流：将Java类对象实例，按照指定顺序组织流
	- 这个存放Java序列，和List容器不一样，List容器内存放的对象，都是已经在内存中的对象，而Stream流的输出内容，可能是根据输入内容计算出来的，原先在内存中是不存在的

从上述和IO流的对比和List容器的对比中，可以总结处Stream有以下特点：
1. 可以 *存储* 有限个或者无限个的数据。存储特别指出：从逻辑上在Stream流的数据可能还没有在内容中，是能计算出来的理论上会在Stream中的数据
2. 针对Stream，可以定义函数式编程，也就是给流设置一系列的操作序列，但是具体的结果，只有在最后结果获取的地方计算，也即是==惰性计算==
3. Stream流使用泛型，所以不能存储基本数据类型

针对Stream的方法，通常定义成支持链式操作的，也就是方法返回Stream流，有点像装饰器设计模式。

### 创建Stream流

1. `Stream.of`: 输入可变数量的参数，得到一个能输出的Stream
2. `Arrays.stream(数组)`
3. 集合的`stream`方法

> 这些都是基于已有序列创建的流，元素固定

1. 使用Supplier
2. 针对文件
3. Pattern
4. 基本数据类型的定制版本

### Map

`Stream`的`Map`函数

将原来Stream中的每一个元素映射到一个新的元素，组成新的Stream流。
可以实现数据类型的转换
函数接口中，传入的参数是一个Function接口的实现对象，可以用lambda函数或者方法引用代替

```
// Funtion接口
@FunctionalInterfeace
interface Function <R, T>{
	R apply(T t);
}
// map方法
<R> Stream<R> map(Funciton<? super T, ? extends R> mapper)
```

1. map就是对原Stream流的每一个元素，调用传入的apply方法
### Filter

`filter`函数，传入一个Predicate接口实现对象

```Java
@FunctionalInterfave
interface Predicate <T>{
	boolean test(T t);
}
```

当返回结果是true时，元素被留下，否则过滤

### Reduce

### Stream的输出

Map和Filter都是转换操作，不会涉及运算。
Reduce和collector都是聚合操作，会进行运算。

1. Stream.collect
	1. 传入Collectors.toList():得到一个Collector的示例对象，将stream输出为List
	2. 传入Collectors.toSet()

### 其他操作

1. sorted
2. skip
3. distinct
4. concat
5. flatMap
6. parallel
7. count
8. max
9. min
10. 针对IntStream， DoubleStream， LongStream
	1. sum()
	2. average()
11. 测试Stream中元素是否都满足或存在满足元素
	1. allMatch
	2. anyMatch
