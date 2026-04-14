---
title: DAY1 设计原则回顾
created: 2026-01-27
modified: 2026-01-29
tags:
  - 技术栈
subject: Spring
---

> [[DAY21 设计模式收官]] : 之前的学习总结


## 单例模式

对于懒汉式的最好方法：私有的静态内部类中，存放外部类的单例对象，外部类提供共有访问方法。

> 静态内部类加载时机：调用静态内部类的静态方法或者变量，初始化静态内部类实例


对于饿汉式的最好方式：通过枚举类型，还能防止反射和反序列化

反序列化
1. 非枚举通过 `readResolve` 方法解决反序列化：本质上是先绕过构造函数，往内存里写入二进制数据，然后查看有没有实现 `readResolve` 钩子方法，有的话执行这个方法，从而使原来创建出来的对象没人引用，被 `GC`。但是创建对象的开销还是存在
2. 枚举原理：在读入二进制数据流后，读取常量的名称，根据 `name` 查找内存中的存在对象，是通过 `Enum.valueOf(String name)` 得到的

反射
1. 非枚举：执行构造函数
2. 枚举：在构造函数执行之前，会进行枚举判断，如果是枚举，就直接抛出异常

容器式单例
	传统方式是需要单例的类，类内部 `private static` 的持有单例对象。
	在容器式单例，是一个类中，存有一个 `Map`。将需要有单例的类，建立类名到单例对象的映射，创建对象是通过反射进行创建的，单例类的构造函数需要私有，同时设置防止反射创建多个对象的措施。

线程单例
	类的单例对象在同一个线程中只有一份，但是在不同的线程之间可以有多个
	实现方式
	1. 设置存放线程单例的类
	2. 类内部持有 `private static final ThreadLocal<单例类> xxx = new ThreadLocal<>(){protected 单例类 initialValue()}`
		- `initialValue` 方法：会在 `xxx.get()` 调用、并且之前没有 `set()` 的情况下调用
	3. 类内部设置 `public static 单例类 getInstance()` 方法。如此一来，一个线程中，单例类止只有一个实例，但是在不同的线程中会有多个实例
	4. 类实现 `AutoCloseable` 接口，实现 `close`，之后配合  `try-with-resource`



## 原型模式

避免深拷贝破坏单例
	单例类实现 `Cloneable` 接口，在重写的 `clone()` 方法中，返回单例对象


## 动态代理

理解 `invoke` 方法中的 `Proxy proxy` 参数
- 含义：生成的代理类的实例化对象，也就是 `newProxyInstance` 得到的对象
- 使用时机：当代理的方法会把被代理类返回，替换返回为 `proxy`
```Java
	interface xxxAble {
		xxxAble method(); 对于这个方法的代理，如果不特殊处理，客户端就会得到被代理的类对象，这不安全，也符合代理的语义
	}
```

反编译得到的代码
- 类加载的时候，会把需要代理的方法，包括从 `Object` 类继承的
	- `toString`
	- `hashCode`
	- `equals`
	以及实现接口的多态方法加载
- 代理类对象构建的时候，会将生成代理类传入的 `InvocationHandler` 对象传入构造函数，初始化 `Proxy` 父类的参数 `h`
- 在使用代理类对象调用方法的时候，内部会调用 `h` 来 `invoke`
- `invoke` 的逻辑是在写代理类的时候，指定的

```Java
package com.whu.proxy;

import com.whu.proxy.Eatable;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.lang.reflect.UndeclaredThrowableException;

final class $Proxy0
extends Proxy
implements Eatable {
    private static final Method m0;
    private static final Method m1;
    private static final Method m2;
    private static final Method m3;

    public $Proxy0(InvocationHandler invocationHandler) {
        super(invocationHandler);
    }

    static {
        ClassLoader classLoader = $Proxy0.class.getClassLoader();
        try {
            m0 = Class.forName("java.lang.Object", false, classLoader).getMethod("hashCode", new Class[0]);
            m1 = Class.forName("java.lang.Object", false, classLoader).getMethod("equals", Class.forName("java.lang.Object", false, classLoader));
            m2 = Class.forName("java.lang.Object", false, classLoader).getMethod("toString", new Class[0]);
            m3 = Class.forName("com.whu.proxy.Eatable", false, classLoader).getMethod("eat", new Class[0]);
            return;
        }
        catch (NoSuchMethodException noSuchMethodException) {
            throw new NoSuchMethodError(noSuchMethodException.getMessage());
        }
        catch (ClassNotFoundException classNotFoundException) {
            throw new NoClassDefFoundError(classNotFoundException.getMessage());
        }
    }

    public final boolean equals(Object object) {
        try {
            return (Boolean)this.h.invoke(this, m1, new Object[]{object});
        }
        catch (Error | RuntimeException throwable) {
            throw throwable;
        }
        catch (Throwable throwable) {
            throw new UndeclaredThrowableException(throwable);
        }
    }

    public final String toString() {
        try {
            return (String)this.h.invoke(this, m2, null);
        }
        catch (Error | RuntimeException throwable) {
            throw throwable;
        }
        catch (Throwable throwable) {
            throw new UndeclaredThrowableException(throwable);
        }
    }

    public final int hashCode() {
        try {
            return (Integer)this.h.invoke(this, m0, null);
        }
        catch (Error | RuntimeException throwable) {
            throw throwable;
        }
        catch (Throwable throwable) {
            throw new UndeclaredThrowableException(throwable);
        }
    }

    public final void eat() {
        try {
            this.h.invoke(this, m3, null);
            return;
        }
        catch (Error | RuntimeException throwable) {
            throw throwable;
        }
        catch (Throwable throwable) {
            throw new UndeclaredThrowableException(throwable);
        }
    }

    private static MethodHandles.Lookup proxyClassLookup(MethodHandles.Lookup lookup) throws IllegalAccessException {
        if (lookup.lookupClass() == Proxy.class && lookup.hasFullPrivilegeAccess()) {
            return MethodHandles.lookup();
        }
        throw new IllegalAccessException(lookup.toString());
    }
}
```

![[QQ_1769621173646.png]]
### `CGLib`

- 出现的原因
	动态代理是依赖于接口，在创建代理类对象时，需要传入被代理类实现的接口，这样才能动态生成代理类的源码中，实现的方法。
	`CGLib` 采用底层的字节码技术（`ASM`），在运行时动态生成被代理类的子类，借助子类可以重写父类函数，实现多态的原理，来完成代理功能，
- 对比

|              |                                  |                                       |
|:------------:|:--------------------------------:| ------------------------------------- |
|     特性     |           JDK 动态代理           | CGLib 代理                            |
| **实现原理** |         反射 + 接口实现          | 字节码生成（ASM）+ 继承               |
|   **要求**   |            必须有接口            | 目标类不能是 final，方法不能是 final  |
|  **核心类**  |     Proxy, InvocationHandler     | Enhancer, MethodInterceptor           |
|   **效率**   | 运行时生成较快，执行稍慢（反射） | 运行时生成较慢，执行较快（FastClass） |

### 深度知识点讲解

#### ① FastClass 机制（CGLib 为什么快？）

JDK 代理在调用目标方法时，使用的是 method.invoke，这属于 Java 反射，效率相对较低。  
CGLib 使用了一种叫 **FastClass** 的机制：它给代理类和被代理类各生成一个类，在这个类中给所有方法编上号。调用时直接根据编号查表执行，**规避了反射**，执行速度更快。
> `FastClass` 是在 `invoke` 或者 `invokeSuper` 方法调用时才会生成的
#### ② 为什么不能代理 final？

因为 CGLib 是基于**继承**的。

- 如果类是 final，无法被继承。
    
- 如果方法是 final，子类无法重写（Override）该方法，也就无法在方法前后加逻辑。
    
- 如果方法是 private，子类也看不见，无法拦截。
    

#### ③ invokeSuper vs invoke

在 intercept 方法里：

- 调用 proxy.invokeSuper(obj, args)：调用的是**被代理的原始方法**。
    
- 调用 proxy.invoke(obj, args)：会导致**死循环**，因为它会再次触发拦截器（除非你传的是原始对象 target 而不是 obj
	> 方法调用流程：代理类对象调用方法 -> 进入方法拦截器的 `intercept` 方法 -> 通过 `methodproxy.invoke / invokeSuper` 方法，生成 `FastClass` -> 快速调用父类的方法


![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=128&rect=17,263,576,598|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000108.pdg]]

### 静态代理和动态代理的区别

- 代理类
	- 静态代理：编译的时候就存在字节码文件
	- 动态代理：运行的时候生成
- 开闭原则
	- 静态代理：被代理类拓展方法，代理类也要拓展，违反开闭原则
	- 动态代理：
		- 运行时动态生成代理类，会自动处理所有需要代理的方法
		- 可以按照策略模式，传入不同的 `InvocationHandler` 类，实现不同逻辑的代理

## 委派模式 Delegate

委派模式并不是 GoF 的设计模式之一，但是在 `Spring` 中经常出现。

`MVC` 架构中，就会将 Web 服务器收到的请求，通过 ServletDispathcer 进行分发，分给请求对应的Controller的方法进行处理

[[DAY23 Web开发#^69d49f | 具体架构]]

## 策略模式

如果有大量的具体策略，在使用其中一个具体策略的时候，可以配合单例模式和工厂模式，将策略实例单例，避免内存资源浪费，和对象创建销毁的开销，将策略的提供通过简单工厂，进行创建，实现策略提供和使用的分离。

> 考虑场景，通过传入的参数和大量的 `if-else` 语句判定使用的具体策略，不如设置策略的工厂，在工厂内部持有容器单例，将判断具体策略类型的逻辑移到工厂中，将创建和使用分析，解耦合，通过容器式单例也保证内存资源的利用


## 设计模式之间的关联关系

![[咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library).pdf#page=198&rect=25,56,590,275|咕泡学院Java架构师成长丛书 Spring 5核心原理与30个类手写实战 (（中国）谭勇德, 谭勇德 (Tom)) (Z-Library), p.000178.pdg]]