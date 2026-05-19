---
created: 2026-04-10
modified: 2026-04-18
---
# 函数式接口编译和运行原理

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


# 高级函数式编程

## 柯里化

一个函数，返回的是另外一个函数，函数以闭包的方式进行组织，从而接收多个参数。

## 函数组合

基本的函数式接口，都具有函数组合的方法接口，是柯里化的使用体现。
- Function : 接收一个输入，得到一个输出。在使用这个函数的时候，往往伴随SCPE生产者消费者，来限制Funtion中的泛型类型。
  Function 的函数组合方式，通过andThen、compose方法，区别是调用顺序
```java
// 自身后调用，所以最终得到类型是R，输入类型是V
  default <V> Function<V, R> compose(Function<? super V, ? extends T> before) {  
    Objects.requireNonNull(before);  
    return (V v) -> apply(before.apply(v));  
}

// 因为自身先调用，返回R泛型，所以after的消费者定义为 ？ super R
// 最终返回的是 V，原始消费为 T
default <V> Function<T, V> andThen(Function<? super R, ? extends V> after) {  
    Objects.requireNonNull(after);  
    return (T t) -> after.apply(apply(t));  
}
```

- Predicate : 接收一个输入，输出一个 boolean。组合的方式是 or 、 and、 navigate

## Either Monda

和 Optional 的理念比较像，封装正确的结果和错误的信息，Optional 的错误消息只有是内部封装对象是空，Either可以封装更加详细的错误信息。
实例代码

```java
package StreamClass;  
  
import java.util.function.Function;  
  
public abstract class Either <L, R>{  
  
    public abstract boolean isLeft();  
    public abstract boolean isRight();  
  
    public static <L, R> Either<L, R> left(L value) {  
        return new Left<L, R>(value);  
    }  
  
    public static <L, R> Either<L, R> right(R value) {  
        return new Right<L, R>(value);  
    }  
  
    public abstract L getLeft();  
    public abstract R getRight();  
  
    public abstract <T> Either<L, T> map(Function<R, T> mapper);  
    public abstract <T> Either<L, T> flatMap(Function<R, Either<L, T>> mapper);  
  
    // Left 封装错误  
    static class Left <L, R> extends Either<L, R> {  
  
        private L value;  
  
        public Left(L value) {  
            this.value = value;  
        }  
  
        @Override  
        public boolean isLeft() { return true; }  
  
        @Override  
        public boolean isRight() { return false; }  
  
        @Override  
        public L getLeft() {  
            return value;  
        }  
  
        @Override  
        public R getRight() {  
            throw new IllegalStateException("Call Right() on Left");  
        }  
  
        @Override  
        public <T> Either<L, T> map(Function<R, T> mapper) {  
            return new Left(value);  
        }  
  
        @Override  
        public <T> Either<L, T> flatMap(Function<R, Either<L, T>> mapper) {  
            return new Left(value);  
        }  
  
  
    }  
  
    static class Right <L, R> extends Either<L, R> {  
  
        private R value;  
        public Right(R value) {  
            this.value = value;  
        }  
  
        @Override  
        public boolean isLeft() { return false; }  
  
        @Override  
        public boolean isRight() { return true; }  
  
        @Override  
        public L getLeft() {  
            throw new IllegalStateException("Call Left() on Right");  
        }  
  
        @Override  
        public R getRight() {  
            return value;  
        }  
  
        @Override  
        public <T> Either<L, T> map(Function<R, T> map) {  
            return new Right<>(map.apply(value));  
        }  
  
        @Override  
        public <T> Either<L, T> flatMap(Function<R, Either<L, T>> map) {  
            return map.apply(value);  
        }  
    }  
  
    public static void main(String[] args) {  
  
    }  
}
```