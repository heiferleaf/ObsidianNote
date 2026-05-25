---
created: 2026-03-13
modified: 2026-03-13
---

## 类型擦除在子类实现泛型接口（继承泛型抽象类）中的问题

> Java 泛型的类型擦除是一个历史遗留问题：在 JDK1.5 之前，我们使用集合的方式是 List list = ... ，现在的方式是List\<String> list = ...
> 为了让之前的老代码可以适配，所以采用了类型擦除技术，在运行时，JVM看到的类型参数信息都是Object

考虑下面的 Java 代码
```Java
interface Node<T> {  
    void setData(T data);  
}  
  
class StringNode implements Node<String> {  
    @Override  
    public void setData(String data) {  
        System.out.println(data);  
    }  
}
```

在类型擦除之后，也就是 JVM 可以看到的代码内容是
```java
// 泛型 T 被擦除成了 Object
public interface Node {
    void setData(Object data);
}

public class StringNode implements Node {
    // 子类的方法依然是 String
    public void setData(String data) {
        System.out.println("StringNode: " + data);
    }
}
```

可以发现一个问题，在类型查出之后，原本计划实现的接口中抽象方法，方法没有重写成功
> 方法重写 Override 的要求
> 1. 方法名相同
> 2. 方法的参数必须完全一致
> 3. 方法的访问范围不能缩小
> 4. 方法的抛出异常不能扩大
> 5. 方法的返回值可以协变返回

现在的问题是2不满足，方法参数签名没有完全相同，重写没有成功。

## 解决方案：桥接方法

所以编译器会自动生成桥接方法，这里的桥接，我更倾向于解释为适配器
通过生成下述的代码，解决了重写的问题，保证接口的泛型方法可以正确实现
```java
public void setData(Object data) {
	return this.setData((String) data);
}
```

## 后续使用

当我们后续依赖于抽象编码，创建 `Node<String> node = new StringNode();` 
在使用`node`的时候，可以通过多态函数的机制，调用子类的 `setData()` 方法，然后在同通过桥接，调用实际上我们在子类中定义的方法。