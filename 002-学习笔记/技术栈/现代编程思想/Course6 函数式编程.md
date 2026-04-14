---
created: 2026-04-10
modified: 2026-04-10
---
在JDK8之后，lambda表达式编译时，不再是解释为匿名内部类的实现，原因如下
- 匿名内部类每一次编译，都会生成一个字节码class文件，占用编译时的速度和编译后的文件大小
- 匿名内部类在运行时，也需要先让 ClassLoader 把类先导入内存中，所以导入时间比较长

Lambda 表示式编译时和运行时的时机行为：
1. 把Lambda的代码体，变为所处类的一个私有静态方法
	```java
	BiFunction<Integer, Integer> add = (s1, s2) -> s1 + s2;

	private static Integer lambda$test0$0(Integer s1, Integer s2) {
		return s1 + s2;
	}
	```

2. 把调用处的Lambda代码段，变为 invokeDynamic 指令，这个指令被JVM执行，会调用`LambdaMetafactory.metafactory()`，这个方法做三件事
	- 生成一个接口的实现类，没有字节码文件，直接在内存中生成
	- 实现接口中的方法，方法体中调用 1 生成的私有静态方法，类似下面的代码
	```JAVA
		// 内存中动态生成，你永远看不到这个文件
final class StreamClass$$Lambda$1 implements Comparator<String> {
    public int compare(String s1, String s2) {
        return StreamClass.lambda$test0$0(s1, s2); // 调回那个静态方法
    }
}
	```
	- 提供类对象

> 只有第一次调用一个lambda表达式的地方，才会生成实现类，后续调用，会从缓存中直接找到实例，不会重复生成。
> 实现类内部调用方法，不是像上面的代码直接调用，而是在 invokeDynamic 的时候，提供一个 MethodHandler 给生成的类，以此调用方法